"""In-memory session store (spec section 6). No database needed for the prototype."""

import threading
import time

SESSION_TTL_SECONDS = 60 * 60   # expire after 60 minutes idle
MAX_TURNS = 10                  # keep the last 10 turns (user + assistant = 1 turn)

_sessions: dict[str, dict] = {}
_lock = threading.Lock()


def _expire_old(now: float) -> None:
    for sid in [s for s, data in _sessions.items() if now - data["last_seen"] > SESSION_TTL_SECONDS]:
        del _sessions[sid]


def get_history(session_id: str) -> list[dict]:
    """Return a copy of the history; creates the session if it is unknown."""
    now = time.time()
    with _lock:
        _expire_old(now)
        session = _sessions.setdefault(session_id, {"history": [], "last_seen": now})
        session["last_seen"] = now
        return [dict(turn) for turn in session["history"]]


def append_turn(session_id: str, user_text: str, assistant_text: str) -> None:
    now = time.time()
    with _lock:
        session = _sessions.setdefault(session_id, {"history": [], "last_seen": now})
        session["history"].append({"role": "user", "text": user_text})
        session["history"].append({"role": "assistant", "text": assistant_text})
        session["history"] = session["history"][-2 * MAX_TURNS:]
        session["last_seen"] = now


def turn_count(session_id: str) -> int:
    with _lock:
        session = _sessions.get(session_id)
        return len(session["history"]) // 2 if session else 0
