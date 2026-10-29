"""Person A: faster-whisper speech-to-text. See docs/Backend_Person_A_Voice_API.pdf section 5.

Contract: transcribe(audio_bytes, language_hint) -> {"text": str, "language": "de" | "en"}.
The optional `suffix` tells the decoder the container format (".webm" from browsers, ".wav" from tests).
"""

import logging
import os
import tempfile

from errors import APIError
from voice import lang

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")        # fall back to "base" if too slow
DEVICE = os.getenv("WHISPER_DEVICE", "cpu")             # "cuda" if a GPU is available
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE", "int8")
# Place and service names Whisper should expect (it otherwise hears "Main-Spessart" as "mein Spessort").
# A list of names, not a sentence, so it does not push the language towards German or English.
INITIAL_PROMPT = os.getenv(
    "WHISPER_PROMPT",
    "Caritas, Würzburg, Main-Spessart, Lohr am Main, Karlstadt, Marktheidenfeld, Kitzingen, Schweinfurt, Werneck, "
    "Haßberge, Haßfurt, Bad Kissingen, Münnerstadt, Rhön-Grabfeld, Bad Neustadt an der Saale, Aschaffenburg, "
    "Miltenberg, Unterfranken, Schuldnerberatung, Suchtberatung, Sozialstation, Pflegedienst.",
)
MIN_SECONDS = 0.3
MAX_SECONDS = 30.0

_model = None


def load() -> None:
    """Load once at startup, never per request."""
    global _model
    from faster_whisper import WhisperModel

    _model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


def transcribe(audio_bytes: bytes, language_hint: str | None = None, suffix: str = ".webm") -> dict:
    if _model is None:
        raise APIError("server_busy", "Speech model is still loading.")

    hint = language_hint if language_hint in lang.SUPPORTED else None

    # Browser recordings arrive as webm/opus; faster-whisper decodes them via PyAV.
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(audio_bytes)
        path = f.name
    try:
        segments, info = _model.transcribe(path, language=hint, vad_filter=True, beam_size=1,
                                           initial_prompt=INITIAL_PROMPT or None)
        segments = list(segments)  # the generator does the actual work
    except Exception as e:
        logging.getLogger("navigator").exception("Transcription failed")
        raise APIError("bad_request", f"Could not decode the audio ({type(e).__name__}).")
    finally:
        os.remove(path)

    if info.duration < MIN_SECONDS:
        raise APIError("empty_audio", "Recording is shorter than 0.3 seconds.")
    if info.duration > MAX_SECONDS + 0.5:
        raise APIError("bad_request", "Recording is longer than 30 seconds.")

    text = " ".join(s.text.strip() for s in segments).strip()
    if not text:
        raise APIError("no_speech")

    language = hint or lang.pick_de_or_en(info)
    return {"text": text, "language": language}
