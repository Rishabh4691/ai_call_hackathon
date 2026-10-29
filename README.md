# AI Service Navigator ("Voice to Help")

A voice assistant that helps people find the right social support service. You describe your
situation out loud, in German or English (for example "I don't know what to do, my mother needs care"),
and the assistant asks follow-up questions, then recommends a matching Caritas service in Lower
Franconia (Würzburg, Schweinfurt, Aschaffenburg, ...) with its address, phone number and opening hours.
The reply is shown as text and spoken aloud.

Built at a hackathon.

## How it works

```
 microphone / text
        │
        ▼
 ┌──────────────┐   ┌─────────────────────┐   ┌──────────────┐
 │ Speech-to-   │──▶│ Brain               │──▶│ Text-to-     │──▶ JSON reply + .wav audio
 │ text         │   │ find the service,   │   │ speech       │
 │ faster-      │   │ ask follow-ups      │   │ Piper        │
 │ whisper      │   │ (E5 embeddings)     │   │ (DE + EN)    │
 └──────────────┘   └─────────────────────┘   └──────────────┘
      backend/voice        backend/brain           backend/voice
```

Everything runs locally on a CPU. No cloud API keys are needed.

## Repository layout

```
.
├── README.md                 ← you are here
├── backend/                  FastAPI server (Python)
│   ├── README.md             detailed backend docs: setup, env vars, API, files
│   ├── main.py               app entry point and the /talk, /audio, /health endpoints
│   ├── contracts.py          shared data shapes between the voice layer and the brain
│   ├── sessions.py           in-memory conversation history
│   ├── errors.py             error codes and JSON error responses
│   ├── mock.py               canned answers for MOCK=1 (frontend work without models)
│   ├── requirements.txt
│   ├── voice/                speech-to-text, text-to-speech, language detection
│   ├── brain/                service data ingest, retrieval, region detection, crisis safety check
│   ├── data/                 service data, topic list, schema
│   ├── tests/                retrieval evaluation (German + English cases)
│   ├── models/               Piper voice files go here (git-ignored)
│   └── tmp/audio/            generated reply audio (git-ignored)
└── docs/
    ├── pitch-deck.pptx                         hackathon pitch
    ├── Backend_Person_A_Voice_API.pdf          backend voice/API spec
    └── Frontend_Spec_AI_Service_Navigator.pdf  frontend spec
```

## Quick start

Requires Python 3.10+.

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Fastest way to try the API: canned answers, no models downloaded
MOCK=1 uvicorn main:app --port 8000
curl -F "text=Ich brauche Hilfe" -F language=auto -F session_id=t1 localhost:8000/talk
```

For the real voice pipeline, download the Piper voices once and start without `MOCK`:

```bash
python -m piper.download_voices --download-dir models de_DE-thorsten-medium en_US-lessac-medium
uvicorn main:app --host 0.0.0.0 --port 8001
```

Open http://localhost:8001/docs for the interactive API docs. The first real start downloads the
Whisper model (~500 MB), and `/health` reports `"ok": false` until it has loaded.

See [`backend/README.md`](backend/README.md) for configuration, the API reference and how to test with recorded speech.

## API in one glance

`POST /talk` (multipart form) with either `audio` or `text`, plus `language` (`auto` | `de` | `en`) and `session_id`:

```json
{
  "session_id": "t1",
  "transcript": "Ich brauche Hilfe",
  "detected_language": "de",
  "reply_text": "Pflegen Sie Ihre Mutter zu Hause?",
  "reply_audio_url": "/audio/3f2a….wav",
  "needs_more_info": true,
  "service": null,
  "timings": { "stt_ms": 0, "nav_ms": 4, "tts_ms": 610, "total_ms": 620 }
}
```

When `needs_more_info` is `false`, `service` holds the recommended service (name, why it fits, address, phone, email, website, opening hours, languages).

## Project status

| Part | Status |
|---|---|
| Voice layer: speech-to-text, text-to-speech, API | Working |
| Retrieval: embeddings, region boost, crisis detection | Working, try it with `python -m brain.cli "..."` |
| `brain/navigator.py` (the conversation logic called by `/talk`) | **Stub**: returns a fixed placeholder answer, not yet connected to retrieval |
| Service data `backend/data/Data_caritas_expanded.xlsx` | **Not in the repo**: add it before running the retrieval CLI or eval |
| Frontend | **Not in the repo**: see `docs/Frontend_Spec_AI_Service_Navigator.pdf` |

## Team

The backend was split between two owners, and `contracts.py` is the agreed interface between them:

- **Person A, voice and API:** `main.py`, `voice/`, `sessions.py`, `errors.py`, `mock.py`
- **Person B, brain:** `brain/`, `data/`, `tests/`
