# Voice and API layer (Person A)

FastAPI server: receives audio or text, transcribes it with faster-whisper, calls
`brain.navigator.navigate()` (Person B), speaks the reply with Piper and returns one JSON response.
Spec: `docs/Backend_Person_A_Voice_API.pdf`.

## Install (from `backend/`)

```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
```

`av<19` is pinned on purpose: PyAV 19 breaks faster-whisper 1.2.1 ("Could not decode the audio (TypeError)").

## Download the voices (once)

```bash
python -m piper.download_voices --download-dir models de_DE-thorsten-medium en_US-lessac-medium
```

Voice licences differ: check each voice's model card (rhasspy/piper-voices on Hugging Face) before public use.
The Whisper model (`small`, ~500 MB) downloads automatically on the first real start and is cached.

## Run (from `backend/`)

```bash
MOCK=1 uvicorn main:app --host 0.0.0.0 --port 8000 --reload   # canned answers, no models
uvicorn main:app --host 0.0.0.0 --port 8001                    # real voice + brain
```

Then open http://localhost:8001/health (shows `"ok": false` while loading) and http://localhost:8001/docs.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `MOCK` | unset | `1` = canned responses, no models loaded |
| `WHISPER_MODEL` | `small` | Use `base` if a turn takes more than ~3 s per 10 s of speech |
| `WHISPER_DEVICE` / `WHISPER_COMPUTE` | `cpu` / `int8` | `cuda` / `float16` on a GPU |
| `PIPER_VOICE_DE` / `PIPER_VOICE_EN` | `models/de_DE-thorsten-medium.onnx` / `models/en_US-lessac-medium.onnx` | Voice files |
| `CORS_ORIGINS` | `*` | Comma-separated allowed frontend origins |
| `TTS_LENGTH_SCALE` | `1.25` | Speaking speed: 1.0 = Piper default, higher = slower |
| `TTS_SENTENCE_PAUSE` | `0.5` | Seconds of silence after each sentence |
| `TTS_GERMAN_NAMES` | `1` | In English replies, speak German names (streets, towns, services) with German pronunciation, in the same English voice. `0` = off |

## How replies are spoken

- Phone numbers and postcodes are read digit by digit, in the reply's language.
- Ranges and times: "4–6" → "4 to 6" / "4 bis 6", "Mo–Fr" → "Monday to Friday" / "Montag bis Freitag", "10:00" → "10 Uhr".
- English replies keep one voice: German names are turned into German phonemes (`[[...]]` blocks) that the English voice speaks.
  The name detection is a heuristic in `voice/tts.py` (`_GERMAN_TOWNS`, `_GERMAN_SUFFIXES`); add names there if one is missed.

## Test with curl (macOS can generate test speech with `say`)

```bash
say -v Anna "Ich weiß nicht mehr weiter, meine Mutter ist pflegebedürftig" -o test_de.aiff
afconvert -f WAVE -d LEI16@16000 test_de.aiff test_de.wav
curl -F "audio=@test_de.wav" -F language=auto -F session_id=t1 localhost:8001/talk
curl -F "text=Ich brauche Hilfe" -F language=auto -F session_id=t1 localhost:8001/talk
curl -o reply.wav localhost:8001/audio/<id>.wav && afplay reply.wav
```

## Endpoints

- `POST /talk` (multipart/form-data): exactly one of `audio` (webm/opus or wav, max 30 s) or `text`,
  plus `language` (`auto` | `de` | `en`) and `session_id`.
- `GET /audio/{id}.wav`: generated reply audio (deleted after 1 hour).
- `GET /health`: `{"ok": true}` once models are loaded, with model names and which `navigate` is in use.

Errors: `{"error": "<code>", "message": "..."}` with `empty_audio` 400, `no_speech` 422,
`bad_request` 400, `server_busy` 503, `internal` 500.

## Files

| File | Purpose |
|---|---|
| `main.py` | FastAPI app, endpoints, CORS, model loading, request flow, timings |
| `voice/stt.py` | `transcribe()` with faster-whisper |
| `voice/tts.py` | `synthesize()` with Piper, text cleaning for speech |
| `voice/lang.py` | German/English detection helpers |
| `sessions.py` | In-memory session history (60 min expiry, last 10 turns) |
| `errors.py` | Error codes and JSON error handlers |
| `mock.py` | Canned responses for `MOCK=1` |

Measured on a MacBook Air (CPU): about 2 s per turn for speech-to-text plus speech output, excluding the LLM.
