"""Look up every town of the services database once on OpenStreetMap (Nominatim) -> data/towns_geo.json.

    python -m brain.geocode          (about 4 minutes for ~230 towns: Nominatim allows 1 request per second)

The file gives each town its coordinates and its district (Landkreis). ingest.py uses the district,
navigator.py uses the coordinates to sort services by real distance. Without the file, both fall back
to postcode-based approximations. Run it again only when new towns are added; it skips known towns.
"""
import json
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

from .config import DATA_DIR, DB_PATH
from .textutil import normalize

GEO_PATH = DATA_DIR / "towns_geo.json"
USER_AGENT = "caritas-wegweiser-hackathon/0.1 (THWS student prototype)"

# district names as OpenStreetMap writes them -> region keys used in config.REGIONS
COUNTY_TO_REGION = {
    "wurzburg": "würzburg", "landkreis wurzburg": "würzburg",
    "schweinfurt": "schweinfurt", "landkreis schweinfurt": "schweinfurt",
    "aschaffenburg": "aschaffenburg", "landkreis aschaffenburg": "aschaffenburg",
    "landkreis kitzingen": "kitzingen", "landkreis bad kissingen": "bad kissingen",
    "landkreis rhon-grabfeld": "rhön-grabfeld", "landkreis hassberge": "haßberge",
    "landkreis miltenberg": "miltenberg", "landkreis main-spessart": "main-spessart",
}


def town_key(city: str) -> str:
    """The key used for a town everywhere."""
    return normalize(city or "")


def load_geo() -> dict:
    if GEO_PATH.exists():
        return json.loads(GEO_PATH.read_text(encoding="utf-8"))
    return {}


def region_of_county(county: str):
    return COUNTY_TO_REGION.get(normalize(county or ""))


def _lookup(town: str, postcode: str):
    query = {"city": town, "country": "Germany", "format": "json", "addressdetails": 1, "limit": 1}
    if postcode:
        query["postalcode"] = postcode
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=20) as resp:
        results = json.loads(resp.read().decode())
    if not results:
        return None
    r = results[0]
    addr = r.get("address", {})
    county = addr.get("county") or addr.get("city") or ""
    return {"lat": float(r["lat"]), "lon": float(r["lon"]), "county": county}


def main():
    if not DB_PATH.exists():
        sys.exit("Build the database first: python -m brain.ingest")
    con = sqlite3.connect(DB_PATH)
    towns = {}
    for city, postcode in con.execute("SELECT city, postcode FROM services WHERE city IS NOT NULL"):
        if "/" in city or "," in city or "nationwide" in city.lower():
            continue
        towns.setdefault(town_key(city), (city, (postcode or "")[:5]))
    con.close()

    geo = load_geo()
    todo = [(k, v) for k, v in towns.items() if k not in geo]
    print(f"{len(towns)} towns, {len(todo)} to look up (about {len(todo)} seconds)")
    for i, (key, (name, postcode)) in enumerate(todo, 1):
        try:
            hit = _lookup(name, postcode) or _lookup(name, "")
        except Exception as e:  # network problem: keep what we have, run again later
            print(f"  stopped at {name}: {e}")
            break
        if hit:
            geo[key] = {"name": name, **hit}
        print(f"  {i}/{len(todo)} {name}: {hit['county'] if hit else 'not found'}")
        time.sleep(1.1)  # Nominatim usage policy: at most 1 request per second
        if i % 20 == 0:
            GEO_PATH.write_text(json.dumps(geo, ensure_ascii=False, indent=1), encoding="utf-8")
    GEO_PATH.write_text(json.dumps(geo, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Saved {len(geo)} towns to {GEO_PATH}. Now rebuild: rm data/navigator.db, then restart the server.")


if __name__ == "__main__":
    main()
