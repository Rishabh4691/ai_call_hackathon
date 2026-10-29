"""Person A: Piper text-to-speech. See docs/Backend_Person_A_Voice_API.pdf section 6.

One German and one English voice, chosen by the language of the reply.
Contract: synthesize(text, language) -> path to a .wav file.
"""

import os
import re
import uuid
import wave
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
AUDIO_DIR = BACKEND_DIR / "tmp" / "audio"
MODELS_DIR = BACKEND_DIR / "models"

VOICE_FILES = {
    "de": os.getenv("PIPER_VOICE_DE", str(MODELS_DIR / "de_DE-thorsten-medium.onnx")),
    "en": os.getenv("PIPER_VOICE_EN", str(MODELS_DIR / "en_US-lessac-medium.onnx")),
}

_voices: dict = {}


def load() -> None:
    """Load both voices once at startup."""
    from piper import PiperVoice

    for language, path in VOICE_FILES.items():
        if not os.path.exists(path):
            raise RuntimeError(f"Piper voice not found: {path}. See backend/README_voice.md, 'Download the voices'.")
        _voices[language] = PiperVoice.load(path)


def voice_names() -> dict:
    return {language: Path(path).stem for language, path in VOICE_FILES.items()}


# Abbreviations that sound wrong when read aloud. Extend after listening to the output.
_EXPANSIONS = {
    "de": [
        (r"\bMo\s*[-–]\s*Fr\b", "Montag bis Freitag"),
        (r"\bMo\s*[-–]\s*Do\b", "Montag bis Donnerstag"),
        (r"\bSa\b", "Samstag"),
        (r"\bStr\.", "Straße"),
        (r"\bz\.\s?B\.", "zum Beispiel"),
        (r"\bca\.", "circa"),
    ],
    "en": [
        (r"\bMon\s*[-–]\s*Fri\b", "Monday to Friday"),
        (r"\be\.g\.", "for example"),
    ],
}

_EMOJI = re.compile("[\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F1E6-\U0001F1FF]")


def clean_for_speech(text: str, language: str) -> str:
    """Strip markdown and emojis and expand abbreviations before synthesis."""
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)      # [label](url) -> label
    text = re.sub(r"https?://\S+", "", text)                    # bare URLs are unreadable
    text = re.sub(r"[*_#`>|]+", "", text)                       # markdown symbols
    text = _EMOJI.sub("", text)
    for pattern, replacement in _EXPANSIONS.get(language, []):
        text = re.sub(pattern, replacement, text)
    return re.sub(r"\s+", " ", text).strip()


def synthesize(text: str, language: str) -> str:
    """Contract function: write the reply to tmp/audio/<uuid>.wav and return its path."""
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    out_path = AUDIO_DIR / f"{uuid.uuid4().hex}.wav"
    voice = _voices.get(language) or _voices["de"]
    clean = clean_for_speech(text, language)
    with wave.open(str(out_path), "wb") as wav:
        if hasattr(voice, "synthesize_wav"):   # piper-tts 1.3+
            voice.synthesize_wav(clean, wav)
        else:                                  # older piper-tts versions
            voice.synthesize(clean, wav)
    return str(out_path)
