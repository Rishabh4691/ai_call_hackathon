"""Load Data_caritas_expanded.xlsx into SQLite (data/navigator.db).

Run:  python -m brain.ingest
Reads columns by header name, so a renamed or missing column fails loudly instead of
silently loading wrong data. The DB is generated, never edited by hand (it is git-ignored).
"""
import json
import sqlite3
import sys
from pathlib import Path

import openpyxl

from .config import DATA_DIR, DB_PATH, OFFICIAL_XLSX_PATH, SERVICE_DATA, XLSX_PATH
from .geo import region_of_city

NOT_STATED = "Not stated in source"
EXTRA_TOPICS_PATH = DATA_DIR / "extra_topics.json"

# Topic graph edges: service category -> online-counselling topic ids (Online_Topics sheet).
# Explicit and hand-written on purpose: this is the "graph-lite" layer. Extend it when new
# categories appear. An empty list means "deliberately not linked" (e.g. emergency numbers).
CATEGORY_TOPICS = {
    "General social counselling": ["OT01"],
    "Housing and homelessness": ["HX01", "OT01"],
    "Crisis and suicide prevention": ["OT19", "OT18"],
    "General / reception": ["OT01"],
    "Debt / insolvency": ["OT14"],
    "Addiction counselling": ["OT17"],
    "Migration / refugee and integration counselling": ["OT12"],
    "Return migration": ["OT02", "OT12"],
    "Pregnancy counselling": ["OT15"],
    "Family / parenting counselling": ["OT04", "OT08"],
    "Regional network information": ["OT01"],
    "Parent / mother-father cure counselling (Kurberatung)": ["OT10"],
    "Housing and homelessness; offending and resettlement": ["HX01", "OT16", "OT01"],
    "Legal guardianship (Betreuungsverein); women's counselling": ["OT13"],
    "Family / parenting counselling; women's counselling": ["OT04"],
    "Children and youth helpline": ["OT08"],
    "Parent helpline": ["OT04"],
    "Violence against women helpline": ["HX02", "OT04"],
    "Pregnancy counselling (national hotline)": ["OT15"],
    "Sexual abuse helpline": ["HX02", "OT08"],
    "Crime victim helpline": ["HX02", "OT01"],
    "Mental health information line": ["OT03"],
    "Bereavement / serious illness helpline": ["OT18", "OT06"],
    "Older people helpline": ["OT11"],
    "Care helpline": ["OT11"],
    "Emergency": [],
}

SERVICE_COLS = {
    "id": "Service_ID", "category": "Category", "name": "Service name", "provider": "Provider / organisation",
    "relationship": "Provider relationship", "city": "City / locality", "postcode": "Postcode", "address": "Address",
    "coverage": "Coverage / eligibility", "phone": "Phone", "email": "Email", "website": "Website / contact URL",
    "contact_mode": "Contact mode", "hours": "Published availability / hours", "access_rule": "Appointment / access rule",
    "cost_note": "Cost / confidentiality note", "keywords_en": "Search keywords / user intents",
    "confidence_note": "Data confidence / follow-up", "source_url": "Source URL", "last_checked": "Last checked",
    "keywords_de": "Search keywords (DE)", "origin": "Row origin",
}
TOPIC_COLS = {
    "id": "Topic_ID", "label_de": "German topic label", "label_en": "English topic label",
    "scope": "Relevant service scope", "phrasing_en": "Synthetic example user phrasing",
    "clarification": "Useful clarification fields", "channels": "Published channel(s)",
    "timing": "Availability / response timing", "location_routing": "Location routing",
    "handling_note": "Prototype handling note", "source_url": "Source_URL",
    "phrasing_de": "Example user phrasing (DE, synthetic)", "keywords_de": "Search keywords (DE)",
}
AVAIL_COLS = {
    "id": "Rule_ID", "scope": "Scope / service", "channel": "Channel", "timing": "Published availability / timing",
    "registration": "Registration / anonymity", "location_fields": "Location fields",
    "behaviour": "Prototype behaviour", "source_url": "Source URL", "last_checked": "Last checked",
}

SCHEMA = """
CREATE TABLE services (
  id TEXT PRIMARY KEY, kind TEXT, region TEXT, category TEXT, name TEXT, provider TEXT, relationship TEXT,
  city TEXT, postcode TEXT, address TEXT, coverage TEXT, phone TEXT, email TEXT, website TEXT, contact_mode TEXT,
  hours TEXT, access_rule TEXT, cost_note TEXT, keywords_en TEXT, keywords_de TEXT, confidence_note TEXT,
  source_url TEXT, last_checked TEXT, origin TEXT, search_text TEXT
);
CREATE TABLE topics (
  id TEXT PRIMARY KEY, label_de TEXT, label_en TEXT, scope TEXT, phrasing_en TEXT, phrasing_de TEXT,
  clarification TEXT, channels TEXT, timing TEXT, location_routing TEXT, handling_note TEXT,
  keywords_de TEXT, source_url TEXT, origin TEXT, search_text TEXT
);
CREATE TABLE service_topics (service_id TEXT, topic_id TEXT, PRIMARY KEY (service_id, topic_id));
CREATE TABLE availability (
  id TEXT PRIMARY KEY, scope TEXT, channel TEXT, timing TEXT, registration TEXT, location_fields TEXT,
  behaviour TEXT, source_url TEXT, last_checked TEXT
);
CREATE INDEX idx_services_region ON services(region);
"""


def _clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return None if (not s or s == NOT_STATED) else s


def _rows(ws, cols, sheet):
    it = ws.iter_rows(values_only=True)
    headers = [h for h in next(it)]
    missing = [h for h in cols.values() if h not in headers]
    if missing:
        raise KeyError(f"Sheet '{sheet}' is missing columns: {missing}")
    idx = {h: i for i, h in enumerate(headers) if h}
    for row in it:
        if all(v is None for v in row):
            continue
        yield {k: _clean(row[idx[h]]) for k, h in cols.items()}


def _join(*parts):
    return " | ".join(p for p in parts if p)


def build(xlsx=XLSX_PATH, db=DB_PATH):
    xlsx, db = Path(xlsx), Path(db)
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    services = list(_rows(wb["Regional_Services"], SERVICE_COLS, "Regional_Services"))
    topics = list(_rows(wb["Online_Topics"], TOPIC_COLS, "Online_Topics"))
    avail = list(_rows(wb["Availability"], AVAIL_COLS, "Availability"))

    for t in topics:
        t["origin"] = "Caritas online-counselling catalogue (workbook)"
    if EXTRA_TOPICS_PATH.exists():
        for x in json.loads(EXTRA_TOPICS_PATH.read_text(encoding="utf-8")):
            topics.append({k: x.get(k) for k in TOPIC_COLS} | {"origin": "Internal extension (not in the Caritas catalogue)",
                                                                "keywords_de": _join(x.get("keywords_de"), x.get("keywords_en"))})

    unmapped = sorted({s["category"] for s in services} - set(CATEGORY_TOPICS))
    if unmapped:
        raise ValueError(f"Categories without a topic mapping (add to CATEGORY_TOPICS): {unmapped}")
    topic_ids = {t["id"] for t in topics}
    bad = sorted({t for ts in CATEGORY_TOPICS.values() for t in ts} - topic_ids)
    if bad:
        raise ValueError(f"CATEGORY_TOPICS refers to unknown topics: {bad}")

    if db.exists():
        db.unlink()
    db.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(db)
    con.executescript(SCHEMA)

    if SERVICE_DATA == "official" and OFFICIAL_XLSX_PATH.exists():
        services = []  # only the official Caritas list; the workbook still provides the topics
    for s in services:
        s["kind"] = "hotline" if (s["city"] or "").strip().lower() == "nationwide" else "local"
        s["region"] = region_of_city(s["city"])
        s["search_text"] = _join(
            s["name"], s["category"], s["provider"], s["city"], s["coverage"],
            f"Keywords: {s['keywords_en']}" if s["keywords_en"] else None,
            f"Stichworte: {s['keywords_de']}" if s["keywords_de"] else None,
        )
        cols = ["id", "kind", "region", "category", "name", "provider", "relationship", "city", "postcode", "address",
                "coverage", "phone", "email", "website", "contact_mode", "hours", "access_rule", "cost_note",
                "keywords_en", "keywords_de", "confidence_note", "source_url", "last_checked", "origin", "search_text"]
        con.execute(f"INSERT INTO services ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [s[c] for c in cols])
        for tid in CATEGORY_TOPICS[s["category"]]:
            con.execute("INSERT OR IGNORE INTO service_topics VALUES (?,?)", (s["id"], tid))

    # Official Caritas facility list: every help-relevant facility (name + address), linked to its topics.
    official_count = 0
    if OFFICIAL_XLSX_PATH.exists():
        from .geocode import load_geo, region_of_county
        from .official import load as load_official

        official, official_links = load_official(OFFICIAL_XLSX_PATH, region_of_city, load_geo(), region_of_county)
        bad = sorted({t for _, t in official_links} - topic_ids)
        if bad:
            raise ValueError(f"official.py refers to unknown topics: {bad}")
        cols = ["id", "kind", "region", "category", "name", "provider", "relationship", "city", "postcode", "address",
                "coverage", "phone", "email", "website", "contact_mode", "hours", "access_rule", "cost_note",
                "keywords_en", "keywords_de", "confidence_note", "source_url", "last_checked", "origin", "search_text"]
        for s in official:
            con.execute(f"INSERT INTO services ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [s[c] for c in cols])
        con.executemany("INSERT OR IGNORE INTO service_topics VALUES (?,?)", official_links)
        official_count = len(official)

    for t in topics:
        t["search_text"] = _join(
            t["label_de"], t["label_en"], t["scope"],
            (t["phrasing_en"] or "").strip("“”\"") or None,
            (t["phrasing_de"] or "").strip("„“”\"") or None,
            f"Stichworte: {t['keywords_de']}" if t["keywords_de"] else None,
        )
        cols = ["id", "label_de", "label_en", "scope", "phrasing_en", "phrasing_de", "clarification", "channels",
                "timing", "location_routing", "handling_note", "keywords_de", "source_url", "origin", "search_text"]
        con.execute(f"INSERT INTO topics ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [t[c] for c in cols])

    for a in avail:
        cols = list(AVAIL_COLS)
        con.execute(f"INSERT INTO availability ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})", [a[c] for c in cols])

    con.commit()
    stats = {
        "services": con.execute("SELECT COUNT(*) FROM services").fetchone()[0],
        "local": con.execute("SELECT COUNT(*) FROM services WHERE kind='local'").fetchone()[0],
        "hotlines": con.execute("SELECT COUNT(*) FROM services WHERE kind='hotline'").fetchone()[0],
        "topics": con.execute("SELECT COUNT(*) FROM topics").fetchone()[0],
        "links": con.execute("SELECT COUNT(*) FROM service_topics").fetchone()[0],
        "availability_rules": con.execute("SELECT COUNT(*) FROM availability").fetchone()[0],
        "services_without_region": con.execute("SELECT COUNT(*) FROM services WHERE region IS NULL").fetchone()[0],
        "official_facilities": official_count,
        "service_data": SERVICE_DATA if OFFICIAL_XLSX_PATH.exists() else "workbook only (official list not found)",
    }
    con.close()
    return stats


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else XLSX_PATH
    print(build(path))
