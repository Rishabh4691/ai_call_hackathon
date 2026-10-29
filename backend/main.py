"""AI Service Navigator - Person A: voice and API layer.

Run from the backend/ folder:
  Real:  uvicorn main:app --host 0.0.0.0 --port 8001
  Mock:  MOCK=1 uvicorn main:app --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
import os
import re
import time
import uuid
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.concurrency import run_in_threadpool

import mock
import sessions
from errors import APIError, register_error_handlers
from voice import lang
from voice.tts import AUDIO_DIR

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("navigator")

MOCK = os.getenv("MOCK") == "1"
AUDIO_MAX_AGE_SECONDS = 60 * 60
MIN_AUDIO_BYTES = 1024
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_WAITING = 3


def _fallback_navigate(session_id, history, user_text, language):
    """Used only if Person B's brain fails to import, so voice and frontend keep working."""
    return {
        "reply_text": "Pflegen Sie Ihre Mutter zu Hause?" if language == "de" else "Do you care for your mother at home?",
        "needs_more_info": True,
        "service": None,
    }


# Person B's brain (backend/brain/navigator.py, see contracts.py).
try:
    from brain.navigator import navigate

    NAVIGATE_SOURCE = "brain.navigator"
except Exception:
    log.exception("Could not import brain.navigator.navigate - using the fallback stub")
    navigate = _fallback_navigate
    NAVIGATE_SOURCE = "fallback stub (brain import failed)"


def _valid_navigate_result(result) -> bool:
    """True if navigate() returned the shape agreed in contracts.py."""
    if not isinstance(result, dict):
        return False
    if not isinstance(result.get("reply_text"), str) or not result["reply_text"].strip():
        return False
    if not isinstance(result.get("needs_more_info"), bool):
        return False
    service = result.get("service")
    return service is None or isinstance(service, dict)

state = {"ready": False, "models": {}, "error": None}
inference_lock = asyncio.Lock()
waiting = 0


# ---------------- Startup: load models once ----------------
def _load_models() -> None:
    from voice import stt, tts

    t0 = time.perf_counter()
    stt.load()
    tts.load()
    # Warm up: synthesize a short sentence, then transcribe it.
    warm_path = tts.synthesize("Hallo, ich brauche Hilfe.", "de")
    with open(warm_path, "rb") as f:
        try:
            stt.transcribe(f.read(), None, ".wav")
        except APIError as e:
            log.warning("Speech-to-text warm-up failed: %s", e)
    os.remove(warm_path)
    state["models"] = {
        "stt": f"faster-whisper {stt.MODEL_NAME} ({stt.DEVICE}, {stt.COMPUTE_TYPE})",
        "tts": tts.voice_names(),
        "navigate": NAVIGATE_SOURCE,
    }
    log.info("Models loaded and warmed up in %.1f s", time.perf_counter() - t0)


async def _startup() -> None:
    try:
        await run_in_threadpool(_load_models)
        state["ready"] = True
    except Exception as e:
        state["error"] = str(e)
        log.exception("Model loading failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    if MOCK:
        mock.ensure_silent_wav(AUDIO_DIR)
        state["models"] = {"mode": "mock", "navigate": "mock"}
        state["ready"] = True
        log.info("Running in MOCK mode: no models loaded")
    else:
        # Load in the background so /health can report "ok": false while loading.
        app.state.loader = asyncio.create_task(_startup())
    yield


app = FastAPI(title="AI Service Navigator - voice API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
register_error_handlers(app)


# ---------------- Helpers ----------------
def _cleanup_old_audio() -> None:
    now = time.time()
    for path in AUDIO_DIR.glob("*.wav"):
        if path.name != mock.MOCK_AUDIO_NAME and now - path.stat().st_mtime > AUDIO_MAX_AGE_SECONDS:
            path.unlink(missing_ok=True)


def _suffix_for(upload: UploadFile) -> str:
    name = (upload.filename or "").lower()
    ctype = (upload.content_type or "").lower()
    if name.endswith(".wav") or "wav" in ctype:
        return ".wav"
    if name.endswith(".ogg") or "ogg" in ctype:
        return ".ogg"
    return ".webm"


def _call_navigate(session_id: str, history: list[dict], user_text: str, language: str) -> dict:
    try:
        result = navigate(session_id, history, user_text, language)
    except Exception:
        log.exception("navigate() raised. Input: session=%s language=%s text=%r history=%r",
                      session_id, language, user_text, history)
        raise APIError("internal", "The navigator failed.")
    if not _valid_navigate_result(result):
        log.error("navigate() returned an invalid shape: %r. Input: session=%s language=%s text=%r",
                  result, session_id, language, user_text)
        raise APIError("internal", "The navigator returned an invalid response.")
    return result


# ---------------- Endpoints ----------------
@app.get("/health")
async def health():
    return {"ok": state["ready"], "mock": MOCK, "models": state["models"], "error": state["error"]}


@app.get("/audio/{audio_id}.wav")
async def get_audio(audio_id: str):
    path = AUDIO_DIR / f"{audio_id}.wav"
    if not re.fullmatch(r"[A-Za-z0-9_-]+", audio_id) or not path.exists():
        return JSONResponse(status_code=404, content={"error": "not_found", "message": "Audio file not found."})
    return FileResponse(path, media_type="audio/wav")


@app.post("/talk")
async def talk(
    audio: UploadFile | None = File(None),
    text: str | None = Form(None),
    language: str = Form("auto"),
    session_id: str | None = Form(None),
):
    global waiting
    t_start = time.perf_counter()

    # ---- Validate input ----
    language = (language or "auto").strip().lower()
    if language not in ("auto", "de", "en"):
        raise APIError("bad_request", "language must be auto, de or en.")
    text = (text or "").strip() or None
    if audio is not None and text is not None:
        raise APIError("bad_request", "Send either audio or text, not both.")
    if audio is None and text is None:
        raise APIError("bad_request", "Send audio or text.")

    audio_bytes = b""
    if audio is not None:
        audio_bytes = await audio.read()
        if len(audio_bytes) < MIN_AUDIO_BYTES:
            raise APIError("empty_audio")
        if len(audio_bytes) > MAX_AUDIO_BYTES:
            raise APIError("bad_request", "Audio file is too large.")

    session_id = (session_id or "").strip() or str(uuid.uuid4())
    _cleanup_old_audio()

    # ---- Mock mode: canned answers, no models ----
    if MOCK:
        user_language = language if language != "auto" else (lang.detect_text(text) if text else "de")
        transcript = text or ("Ich brauche Hilfe für meine Mutter." if user_language == "de" else "I need help for my mother.")
        result = mock.respond(user_language, sessions.turn_count(session_id))
        sessions.append_turn(session_id, transcript, result["reply_text"])
        return _response(session_id, transcript, user_language, result, f"/audio/{mock.MOCK_AUDIO_NAME}",
                         {"stt_ms": 0, "nav_ms": 0, "tts_ms": 0,
                          "total_ms": round((time.perf_counter() - t_start) * 1000)})

    # ---- Real mode ----
    if not state["ready"]:
        raise APIError("server_busy", "Models are still loading." if not state["error"] else "Models failed to load.")
    if waiting >= MAX_WAITING:
        raise APIError("server_busy")

    waiting += 1
    try:
        async with inference_lock:
            # 1. Speech-to-text (or typed text)
            t0 = time.perf_counter()
            if audio is not None:
                hint = language if language != "auto" else None
                from voice import stt
                stt_result = await run_in_threadpool(stt.transcribe, audio_bytes, hint, _suffix_for(audio))
                transcript, user_language = stt_result["text"], stt_result["language"]
            else:
                transcript = text
                user_language = language if language != "auto" else lang.detect_text(text)
            stt_ms = round((time.perf_counter() - t0) * 1000)

            # 2. Brain (Person B)
            t0 = time.perf_counter()
            history = sessions.get_history(session_id)
            result = await run_in_threadpool(_call_navigate, session_id, history, transcript, user_language)
            nav_ms = round((time.perf_counter() - t0) * 1000)

            # 3. Text-to-speech in the language of the reply
            t0 = time.perf_counter()
            reply_lang = lang.reply_language(result["reply_text"], user_language)
            from voice import tts
            wav_path = await run_in_threadpool(tts.synthesize, result["reply_text"], reply_lang)
            tts_ms = round((time.perf_counter() - t0) * 1000)
    finally:
        waiting -= 1

    sessions.append_turn(session_id, transcript, result["reply_text"])
    timings = {"stt_ms": stt_ms, "nav_ms": nav_ms, "tts_ms": tts_ms,
               "total_ms": round((time.perf_counter() - t_start) * 1000)}
    log.info("talk session=%s lang=%s timings=%s", session_id, user_language, timings)
    return _response(session_id, transcript, user_language, result, f"/audio/{Path(wav_path).stem}.wav", timings)


def _response(session_id, transcript, detected_language, result, audio_url, timings) -> dict:
    return {
        "session_id": session_id,
        "transcript": transcript,
        "detected_language": detected_language,
        "reply_text": result["reply_text"],
        "reply_audio_url": audio_url,
        "needs_more_info": result["needs_more_info"],
        "service": result["service"],
        "timings": timings,
    }
