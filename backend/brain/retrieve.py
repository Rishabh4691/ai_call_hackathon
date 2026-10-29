"""Hybrid retrieval: direct service search + topic-graph expansion, merged with rank fusion.

search(text, history) returns ranked candidate services plus the signals navigate() needs:
  - crisis        a safety flag (route to crisis line / emergency number, skip retrieval-driven chat)
  - region        a Landkreis found in the user's words, used to prefer nearby services
  - needs_location  True when the best matches are the same kind of service in several regions
  - topic         the best-matching online topic with its clarification fields and handling note
"""
import sqlite3

import numpy as np

from .config import (DB_PATH, EMBEDDER, REGION_MATCH_BOOST, REGION_MISMATCH_FACTOR, RRF_K, TOPIC_RANK_WEIGHTS)
from .embed import get_embedder
from .geo import region_of_text
from .safety import detect_crisis

SERVICE_FIELDS = ["id", "kind", "region", "category", "name", "provider", "city", "postcode", "address", "coverage",
                  "phone", "email", "website", "contact_mode", "hours", "access_rule", "cost_note",
                  "confidence_note", "source_url", "last_checked", "origin"]


class Retriever:
    def __init__(self, db_path=DB_PATH, embedder=None):
        con = sqlite3.connect(db_path)
        con.row_factory = sqlite3.Row
        self.services = [dict(r) for r in con.execute("SELECT * FROM services ORDER BY id")]
        self.topics = [dict(r) for r in con.execute("SELECT * FROM topics ORDER BY id")]
        self.links = {}
        for r in con.execute("SELECT service_id, topic_id FROM service_topics"):
            self.links.setdefault(r["topic_id"], []).append(r["service_id"])
        con.close()

        self.embedder = embedder or get_embedder(EMBEDDER)
        s_docs = [s["search_text"] for s in self.services]
        t_docs = [t["search_text"] for t in self.topics]
        self.embedder.fit(s_docs + t_docs)
        self.S = self.embedder.encode_docs(s_docs)
        self.T = self.embedder.encode_docs(t_docs)
        self._sidx = {s["id"]: i for i, s in enumerate(self.services)}

    # ------------------------------------------------------------------
    def search(self, text, history=None, k=5):
        history = history or []
        user_turns = [h["text"] for h in history if h.get("role") == "user"][-2:]
        query = " ".join(user_turns + [text])

        crisis = detect_crisis(text) or (detect_crisis(user_turns[-1]) if user_turns else None)
        region = region_of_text(query)

        q = self.embedder.encode_query(query)
        s_sim = self.S @ q
        t_sim = self.T @ q

        scores = {s["id"]: 0.0 for s in self.services}
        reasons = {s["id"]: [] for s in self.services}

        # channel 1: direct service similarity
        for rank, i in enumerate(np.argsort(-s_sim)):
            sid = self.services[i]["id"]
            scores[sid] += 1.0 / (RRF_K + rank)
            if rank < 10:
                reasons[sid].append(f"direct#{rank + 1} sim={s_sim[i]:.2f}")

        # channel 2: topic graph. best topics -> every service linked to them
        topic_order = list(np.argsort(-t_sim))
        for rank, ti in enumerate(topic_order[:len(TOPIC_RANK_WEIGHTS)]):
            tid = self.topics[ti]["id"]
            for sid in self.links.get(tid, []):
                scores[sid] += TOPIC_RANK_WEIGHTS[rank] / (RRF_K + rank)
                reasons[sid].append(f"topic {tid}#{rank + 1}")

        # region preference (soft: other regions are demoted, never removed)
        hits = []
        for s in self.services:
            sc = scores[s["id"]]
            region_match = bool(region and s["region"] == region)
            if region and s["region"] is not None:
                sc *= REGION_MATCH_BOOST if region_match else REGION_MISMATCH_FACTOR
            hits.append({**{f: s[f] for f in SERVICE_FIELDS}, "score": sc, "region_match": region_match,
                         "reasons": reasons[s["id"]]})
        hits.sort(key=lambda h: -h["score"])
        top = hits[:k]

        best_topic = self.topics[topic_order[0]]
        return {
            "query": query,
            "crisis": crisis,
            "region": region,
            "needs_location": self._needs_location(top, region, crisis),
            "topic": {f: best_topic[f] for f in ("id", "label_de", "label_en", "clarification", "handling_note",
                                                  "location_routing", "channels", "timing")},
            "topics_ranked": [(self.topics[i]["id"], round(float(t_sim[i]), 3)) for i in topic_order[:3]],
            "hits": top,
        }

    @staticmethod
    def _needs_location(top, region, crisis):
        """Ask for town/postcode when the best matches are one kind of service across several regions."""
        if region or crisis:
            return False
        local = [h for h in top[:3] if h["region"] is not None]
        if len(local) < 2:
            return False
        same_kind = len({h["category"] for h in local}) == 1
        return same_kind and len({h["region"] for h in local}) >= 2
