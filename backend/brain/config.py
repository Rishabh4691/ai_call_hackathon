import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
XLSX_PATH = DATA_DIR / "Data_caritas_expanded.xlsx"
DB_PATH = DATA_DIR / "navigator.db"
CACHE_DIR = DATA_DIR / ".cache"

# "auto" = multilingual E5 if sentence-transformers + the model are available, else TF-IDF fallback.
# Force one with EMBEDDER=e5 or EMBEDDER=tfidf.
EMBEDDER = os.environ.get("EMBEDDER", "auto")
E5_MODEL = os.environ.get("E5_MODEL", "intfloat/multilingual-e5-small")

# Small corpus (~60 services): a small k keeps rank 1 clearly ahead of rank 5 (k=60 is for huge lists).
RRF_K = 10
# Topic channel: the best topic counts fully, weaker topics count less (less noise from near-misses).
TOPIC_RANK_WEIGHTS = [1.0, 0.5, 0.25]
REGION_MATCH_BOOST = 1.5
REGION_MISMATCH_FACTOR = 0.25

# region key -> aliases a user might say (matched after accent stripping)
REGIONS = {
    "würzburg": ["würzburg", "wuerzburg", "wurzburg"],
    "schweinfurt": ["schweinfurt"],
    "aschaffenburg": ["aschaffenburg"],
    "kitzingen": ["kitzingen"],
    "bad kissingen": ["bad kissingen", "kissingen"],
    "rhön-grabfeld": ["bad neustadt", "neustadt an der saale", "neustadt/saale", "rhön-grabfeld", "rhoen-grabfeld", "rhön", "rhoen"],
    "haßberge": ["haßfurt", "hassfurt", "haßberge", "hassberge"],
    "miltenberg": ["miltenberg", "bürgstadt", "buergstadt"],
    "main-spessart": ["lohr", "karlstadt", "main-spessart", "main spessart"],
}
