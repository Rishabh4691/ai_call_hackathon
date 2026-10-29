"""Canned responses for MOCK=1 (spec section 9).

The server runs without any models. First call -> follow-up question,
second and later calls -> a full service object. The service below is
an invented example, not real Caritas data.
"""

import wave
from pathlib import Path

MOCK_AUDIO_NAME = "mock.wav"

_FOLLOW_UP = {
    "de": "Pflegen Sie Ihre Mutter zu Hause?",
    "en": "Do you care for your mother at home?",
}

_RECOMMENDATION = {
    "de": "Die Pflegeberatung der Caritas kann Ihnen helfen. Dort bekommen Sie kostenlose Beratung zur Pflege zu Hause.",
    "en": "The Caritas care counselling service can help you. They give free advice on caring for someone at home.",
}

_SERVICE = {
    "id": "mock-001",
    "name": "Pflegeberatung (Beispiel)",
    "why": {
        "de": "Sie pflegen Ihre Mutter zu Hause und brauchen Beratung zur Pflege.",
        "en": "You care for your mother at home and need advice on care.",
    },
    "address": "Musterstraße 1, 97070 Würzburg",
    "phone": "0931 000000",
    "email": "beispiel@example.org",
    "website": "https://www.example.org",
    "opening_hours": "Mo-Fr 9-12 Uhr",
    "languages": ["de", "en"],
}


def respond(language: str, turn_index: int) -> dict:
    lang = language if language in ("de", "en") else "de"
    if turn_index == 0:
        return {"reply_text": _FOLLOW_UP[lang], "needs_more_info": True, "service": None}
    service = dict(_SERVICE)
    service["why"] = _SERVICE["why"][lang]
    return {"reply_text": _RECOMMENDATION[lang], "needs_more_info": False, "service": service}


def ensure_silent_wav(audio_dir: Path) -> Path:
    """Write 0.5 s of silence (16 kHz mono) to serve as reply_audio_url in mock mode."""
    audio_dir.mkdir(parents=True, exist_ok=True)
    path = audio_dir / MOCK_AUDIO_NAME
    if not path.exists():
        with wave.open(str(path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(16000)
            wav.writeframes(b"\x00\x00" * 8000)
    return path
