import re
import unicodedata


def normalize(text):
    """Lowercase, strip accents, ß->ss. Used for matching and for the TF-IDF fallback."""
    t = (text or "").lower().replace("ß", "ss")
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", t).strip()
