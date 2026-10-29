"""Retrieval evaluation in German and English.

    python -m tests.eval_retrieval                  # auto: E5 if available, else TF-IDF fallback
    EMBEDDER=e5 python -m tests.eval_retrieval      # the real multilingual model
    EMBEDDER=tfidf python -m tests.eval_retrieval   # lexical fallback

A case passes if a service of an expected category is in the top 3 (top-1 is also reported).
Add your own messy phrasings to cases.json: that file is the regression suite for the prompt/retrieval.
"""
import json
import logging
import sys
from pathlib import Path

from brain.config import DB_PATH
from brain.ingest import build
from brain.retrieve import Retriever
from brain.safety import detect_crisis

CASES = Path(__file__).with_name("cases.json")


def main():
    logging.basicConfig(level=logging.WARNING, format="%(message)s")
    cases = json.loads(CASES.read_text(encoding="utf-8"))
    if not DB_PATH.exists():
        build()
    r = Retriever()
    print(f"embedder = {r.embedder.name}\n")

    stats = {"de": [0, 0, 0], "en": [0, 0, 0]}  # top1, top3, total
    fails = []
    for it in cases["intents"]:
        for lang in ("de", "en"):
            out = r.search(it[lang], k=3)
            cats = [h["category"] for h in out["hits"]]
            hit1 = cats[0] in it["expect"]
            hit3 = any(c in it["expect"] for c in cats)
            stats[lang][0] += hit1
            stats[lang][1] += hit3
            stats[lang][2] += 1
            if not hit3:
                fails.append((it["id"], lang, it[lang], cats))

    print("Intent retrieval (expected category in top results)")
    for lang in ("de", "en"):
        t1, t3, n = stats[lang]
        print(f"  {lang.upper()}: top-1 {t1}/{n} ({t1 / n:.0%})   top-3 {t3}/{n} ({t3 / n:.0%})")
    for cid, lang, text, cats in fails:
        print(f"    MISS [{cid}/{lang}] {text}\n         got: {cats}")

    print("\nTown routing (expected service ranks first, region detected)")
    rfail = 0
    for c in cases["regions"]:
        out = r.search(c["text"], k=3)
        ok = out["hits"][0]["id"] == c["expect_id"] and out["region"] == c["region"]
        rfail += not ok
        print(f"  {'ok  ' if ok else 'MISS'} {c['id']}: top={out['hits'][0]['id']} region={out['region']}")

    print("\nCrisis flag")
    cfail = 0
    for c in cases["crisis"]:
        got = detect_crisis(c["text"])
        ok = got == c["expect"]
        cfail += not ok
        print(f"  {'ok  ' if ok else 'MISS'} {c['text']!r}: {got}")

    print("\nFollow-up logic")
    nl = r.search("Ich habe Schulden und weiß nicht weiter.")
    has_city = r.search("Ich habe Schulden und wohne in Kitzingen.")
    print(f"  debt without town -> needs_location={nl['needs_location']} (expected True)")
    print(f"  debt with town    -> needs_location={has_city['needs_location']} (expected False)")
    fu = int(nl["needs_location"] is not True) + int(has_city["needs_location"] is not False)

    bad = rfail + cfail + fu
    print(f"\nSummary: routing/crisis/follow-up failures = {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
