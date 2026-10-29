# AI Service Navigator

A voice assistant that helps people find the right Caritas support service in the Lower Franconia network.
Users speak naturally in German or English; the assistant asks short follow-up questions and recommends the
one service that fits, with a plain-language reason. It does **not** give counseling. Principle: *no wrong door to support.*

Everything is open source and runs locally: faster-whisper (speech-to-text), Ollama (LLM), multilingual embeddings (RAG), Piper (text-to-speech), FastAPI, and a plain HTML/JS frontend.

## Team and ownership

| Area | Folder | Owner | Spec |
|---|---|---|---|
| Frontend | `frontend/` | Frontend team | `docs/Frontend_Spec_AI_Service_Navigator.pdf` |
| Voice + API layer | `backend/voice/`, `backend/main.py` | Person A | `docs/Backend_Person_A_Voice_API.pdf` |
| Navigation brain (RAG, prompt, data) | `backend/brain/`, `backend/data/` | Person B | `backend/contracts.py` |

## The contract between Person A and Person B

`backend/contracts.py` defines `transcribe`, `synthesize` and `navigate`. **Do not change signatures without telling the other person.**
Until the real `navigate` exists, `backend/brain/navigator.py` contains a stub, so voice and frontend work is never blocked.

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
MOCK=1 uvicorn main:app --reload --port 8000   # once main.py exists (Person A)
```

Frontend: open `frontend/index.html` from a local server (microphone needs `localhost` or HTTPS), e.g. `python -m http.server 5500` in `frontend/`.

## Person B quick start (brain)

```bash
cd backend
pip install -r requirements.txt
python -m brain.ingest                               # Excel -> data/navigator.db
python -m brain.cli "Ich habe Schulden in Kitzingen" # try retrieval
EMBEDDER=e5 python -m tests.eval_retrieval           # German + English test (needs the E5 model)
```

- Data: `backend/data/Data_caritas_expanded.xlsx` (source of truth) and `backend/data/extra_topics.json` (internal topics, not from Caritas).
- `EMBEDDER=auto` (default) uses multilingual E5 and falls back to TF-IDF with a warning. TF-IDF is lexical only: always measure with `EMBEDDER=e5` before trusting accuracy numbers.
- Safety lexicon (`brain/safety.py`) and German keywords are prototype text and need review by a fluent German speaker.

## Git workflow

- `main` is always runnable. Never push broken code to it.
- One branch per person/area: `frontend/<topic>`, `voice/<topic>`, `brain/<topic>`.
- Small pull requests, merged often (at least every hour). One review from a teammate before merge.
- Do not edit another person's folder without asking. Contract changes need both owners.
- Large files (voice models, audio) are not committed; see `.gitignore`.

## Timeline (5-hour prototype)

| When | Milestone |
|---|---|
| 0:00 to 0:15 | Contract agreed, repo cloned by everyone |
| 0:15 to 2:00 | Parallel work against stubs and mock mode |
| 2:00 | Integration checkpoint: real `navigate` plugged in |
| 2:00 to 4:00 | Tuning, testing in German and English |
| 4:00 to 5:00 | README, demo run-through |

## Licenses

All components are open source. Check each Piper voice's model card for its license and note it here before publishing.
Add a project `LICENSE` file once the team has decided (MIT or Apache-2.0 are common choices).
