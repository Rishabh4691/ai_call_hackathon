"""Language selection helpers. The assistant supports German ("de") and English ("en")."""

SUPPORTED = ("de", "en")
DEFAULT = "de"


def detect_text(text: str) -> str:
    """Detect de/en for typed text; default to German on failure (spec section 5)."""
    try:
        from langdetect import DetectorFactory, detect_langs

        DetectorFactory.seed = 0  # deterministic results
        for guess in detect_langs(text):
            if guess.lang in SUPPORTED:
                return guess.lang
    except Exception:
        pass
    return DEFAULT


def pick_de_or_en(info) -> str:
    """Choose between de and en from faster-whisper's language probabilities."""
    probs = dict(getattr(info, "all_language_probs", None) or [])
    de, en = probs.get("de", 0.0), probs.get("en", 0.0)
    if de == 0.0 and en == 0.0:
        return info.language if getattr(info, "language", None) in SUPPORTED else DEFAULT
    return "de" if de >= en else "en"


def reply_language(reply_text: str, user_language: str) -> str:
    """The reply follows the user's language; check the text in case the brain switched."""
    if len(reply_text.split()) >= 4:
        return detect_text(reply_text)
    return user_language if user_language in SUPPORTED else DEFAULT
