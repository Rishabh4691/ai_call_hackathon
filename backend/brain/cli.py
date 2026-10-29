"""Try retrieval from the command line:

    python -m brain.cli "Ich habe Mahnungen und weiß nicht weiter" [--k 5]
    EMBEDDER=e5 python -m brain.cli "I need debt advice in Kitzingen"
"""
import argparse
import logging

from .config import DB_PATH
from .ingest import build
from .retrieve import Retriever


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("text")
    ap.add_argument("--k", type=int, default=5)
    args = ap.parse_args()
    logging.basicConfig(level=logging.WARNING)
    if not DB_PATH.exists():
        print("Building database:", build())
    r = Retriever()
    out = r.search(args.text, k=args.k)
    print(f"embedder={r.embedder.name} crisis={out['crisis']} region={out['region']} needs_location={out['needs_location']}")
    print(f"topic: {out['topic']['id']} {out['topic']['label_de']} / {out['topic']['label_en']}")
    print(f"ask next: {out['topic']['clarification']}")
    for h in out["hits"]:
        print(f"  {h['score']:.4f} {h['id']} [{h['category']}] {h['name']} – {h['city']}  ({'; '.join(h['reasons'][:2])})")


if __name__ == "__main__":
    main()
