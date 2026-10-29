"""Embedders. Two interchangeable backends:

  e5     multilingual-e5-small via sentence-transformers. The real one: German and English share
         one vector space, so a German question finds English text. Needs the model download.
  tfidf  character n-gram TF-IDF (scikit-learn). Offline fallback for development and tests.
         Lexical only: it cannot match a German question to English text unless words overlap.

get_embedder("auto") tries e5 and falls back to tfidf with a loud warning.
"""
import hashlib
import logging

import numpy as np

from .config import CACHE_DIR, E5_MODEL
from .textutil import normalize

log = logging.getLogger(__name__)


class TfidfEmbedder:
    name = "tfidf"

    def __init__(self):
        self.vec = None

    def fit(self, docs):
        from sklearn.feature_extraction.text import TfidfVectorizer

        self.vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), sublinear_tf=True, preprocessor=normalize)
        self.vec.fit(docs)

    def encode_docs(self, docs):
        return self.vec.transform(docs).toarray().astype(np.float32)

    def encode_query(self, text):
        return self.vec.transform([text]).toarray().astype(np.float32)[0]


class E5Embedder:
    name = "e5"

    def __init__(self, model_name=E5_MODEL):
        from sentence_transformers import SentenceTransformer

        self.model_name = model_name
        self.model = SentenceTransformer(model_name)

    def fit(self, docs):
        pass  # pretrained, nothing to fit

    def encode_docs(self, docs):
        key = hashlib.sha256((self.model_name + "\n".join(docs)).encode()).hexdigest()[:16]
        path = CACHE_DIR / f"e5_{key}.npy"
        if path.exists():
            return np.load(path)
        vecs = self.model.encode(["passage: " + d for d in docs], normalize_embeddings=True, batch_size=16)
        CACHE_DIR.mkdir(parents=True, exist_ok=True)
        np.save(path, vecs.astype(np.float32))
        return vecs.astype(np.float32)

    def encode_query(self, text):
        return self.model.encode(["query: " + text], normalize_embeddings=True)[0].astype(np.float32)


def get_embedder(choice="auto"):
    if choice == "tfidf":
        return TfidfEmbedder()
    if choice == "e5":
        return E5Embedder()
    try:
        return E5Embedder()
    except Exception as exc:  # missing package, no network, model not cached
        log.warning("E5 embedder unavailable (%s: %s). Falling back to TF-IDF: German<->English matching "
                    "will be weaker. Set EMBEDDER=e5 on a machine with the model to measure the real thing.",
                    type(exc).__name__, exc)
        return TfidfEmbedder()
