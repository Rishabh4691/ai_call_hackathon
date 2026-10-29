"""Shared contract between Person A (voice + API) and Person B (brain).

Do not change these signatures without telling the other owner.
"""
from typing import Optional, TypedDict


class Service(TypedDict):
    id: str
    name: str
    why: str            # 1-2 plain-language sentences, in the user's language
    address: str
    phone: str
    email: str
    website: str
    opening_hours: str
    languages: list     # e.g. ["de", "en"]


class NavigateResult(TypedDict):
    reply_text: str
    needs_more_info: bool
    service: Optional[Service]   # None while a follow-up question is being asked


class TranscribeResult(TypedDict):
    text: str
    language: str       # "de" | "en"


# ---- Person A implements (backend/voice/) ---------------------------------
def transcribe(audio_bytes: bytes, language_hint: Optional[str]) -> TranscribeResult:
    raise NotImplementedError


def synthesize(text: str, language: str) -> str:
    """Return the path to a generated .wav file."""
    raise NotImplementedError


# ---- Person B implements (backend/brain/) ---------------------------------
def navigate(session_id: str, history: list, user_text: str, language: str) -> NavigateResult:
    """history: [{"role": "user" | "assistant", "text": str}, ...]"""
    raise NotImplementedError
