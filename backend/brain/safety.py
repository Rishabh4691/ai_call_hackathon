"""Tiny crisis lexicon (German + English). PROTOTYPE ONLY.

Matches on accent-stripped lowercase text. A fluent German speaker and a domain expert
should review and extend these patterns before any real use. When this fires, navigate()
must show the crisis line / emergency number instead of asking follow-up questions.
"""
import re

from .textutil import normalize

_PATTERNS = {
    "suicide": [
        r"suizid", r"selbstmord", r"umbringen", r"nicht mehr leben", r"leben beenden",
        r"mir das leben nehmen", r"nicht mehr weiterleben", r"kill myself", r"suicid",
        r"end my life", r"want to die", r"(do not|dont|don't) want to live", r"hurt myself", r"mir (was|etwas) antun",
    ],
    "violence": [
        r"schlagt mich", r"schlagt mich gerade", r"pruge?lt mich", r"bedroht mich", r"bedroht mich gerade",
        r"hits me", r"beats me", r"threatens me", r"threatening me", r"abus(es|ing) me",
    ],
    "emergency": [
        r"\bnotfall\b", r"\bin gefahr\b", r"\b112\b", r"\b110\b", r"\bemergency\b", r"\bin danger\b", r"akute gefahr",
    ],
}
_COMPILED = {k: [re.compile(p) for p in v] for k, v in _PATTERNS.items()}


def detect_crisis(text):
    """Return 'suicide' | 'violence' | 'emergency' | None."""
    t = normalize(text)
    for label in ("suicide", "violence", "emergency"):
        if any(p.search(t) for p in _COMPILED[label]):
            return label
    return None
