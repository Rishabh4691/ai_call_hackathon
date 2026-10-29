/**
 * Entry point and UI state machine (SPEC.md §5). Owner: A.
 *
 *   idle ──press──▶ listening ──release / tap / 30 s──▶ thinking ──reply──▶ speaking ──end / Esc──▶ idle
 *                                                         └──fail──▶ error ──Retry──▶ thinking or idle
 *
 * - Hold vs tap: a press released within TAP_MS is a tap (toggle mode: the next press stops); a longer press is
 *   hold-to-talk (release stops). Keyboard activation (talkToggle) always toggles.
 * - Barge-in: pressing while the assistant speaks stops playback and starts recording.
 * - Esc stops playback. Start over cancels everything and makes a new session_id.
 * - Retry re-sends the failed turn after network, timeout, server_busy or internal; otherwise back to idle.
 * Talks to the page only through the js/ui.js functions in CONTRACT.md.
 */
import * as ui from './js/ui.js';
import * as api from './js/api.js';
import * as recorder from './js/recorder.js';
import * as player from './js/player.js';

const TAP_MS = 400;
const RESENDABLE = new Set(['network', 'timeout', 'server_busy', 'internal']);

// ---------- call mode (?call=1): a hands-free conversation like a phone call ----------
// One press starts the call. Each turn: the mic opens, the room noise is measured, speech is detected, and the
// turn is sent after CALL_SILENCE_MS of silence. When the reply has been spoken, the mic opens again by itself.
// The mic is closed while the assistant speaks, so it never hears itself. Esc / Stop ends the call.
const pageParams = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
const CALL = pageParams.get('call') === '1';
const CALL_SILENCE_MS = Number(pageParams.get('silence')) || 1200; // pause that ends a turn
const CALL_NO_SPEECH_MS = 12_000;   // nobody speaks for this long -> the call ends
const CALL_MIN_SPEECH_MS = 300;     // speech shorter than this counts as noise
const CALL_RELISTEN_MS = 300;
let callActive = false;
let vad = null;                     // per-turn voice detection state
let callMisses = 0;                 // turns in a row without recognised speech

/** @returns {string} a new session id (crypto.randomUUID needs localhost or HTTPS) */
function newSessionId() {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

let sessionId = newSessionId();
let state = 'idle';
let epoch = 0;         // bumped on Start over; late results from an older epoch are dropped
let inFlight = null;   // AbortController of the running request

let mic = null;        // null | 'starting' (waiting for permission) | 'recording'
let micId = 0;         // bumped whenever a recording ends, so its late callbacks are ignored
let pressMode = null;  // null | 'pending' (pointer down, hold or tap not decided yet) | 'toggle'
let pressAt = 0;
let ignoreUp = false;  // the press that stopped a recording must not act again on release

let speakId = 0;       // bumped when playback is stopped, so its end does not change the state
let replyLang = null;  // 'de' | 'en' from the last reply, for speech fallback and replays
let lastTurn = null;   // the turn that failed, for Retry
let lastError = null;

function setState(next, detail = {}) {
  state = next;
  if (next === 'error') lastError = detail.error;
  ui.setState(next, detail);
}

function speechLang() {
  const pref = ui.languagePref();
  return replyLang || (pref === 'de' || pref === 'en' ? pref : 'de');
}

// ---------- recording ----------

async function startListening(mode) {
  if (mic || inFlight) return;
  stopPlayback(); // barge-in, or a replay still playing
  const id = ++micId;
  mic = 'starting';
  pressMode = mode;
  vad = null;
  try {
    await recorder.start({
      onProgress({ seconds, level }) {
        if (id === micId && mic === 'recording') {
          ui.setState('listening', { seconds, level });
          if (pressMode === 'call') callTick(seconds, level);
        }
      },
      onLimit() {
        if (id === micId) finishListening();
      },
    });
  } catch (err) {
    if (id !== micId) return;
    resetMic();
    if (err && err.code === 'aborted') setState('idle');
    else setState('error', { error: (err && err.code) || 'mic_unavailable' });
    return;
  }
  if (id !== micId) return; // cancelled while the mic opened; recorder.cancel() already ran
  mic = 'recording';
  setState('listening', { seconds: 0 });
}

async function finishListening() {
  if (!mic) return;
  if (mic === 'starting') {
    cancelListening();
    setState('idle');
    return;
  }
  const myEpoch = epoch;
  resetMic();
  setState('thinking');
  let audio;
  try {
    audio = await recorder.stop();
  } catch (err) {
    if (myEpoch === epoch) {
      setState('error', { error: (err && err.code) || 'empty_audio' });
      callAfterError((err && err.code) || 'empty_audio');
    }
    return;
  }
  if (myEpoch === epoch) sendTurn({ audio });
}

// ---------- call mode ----------

/** Voice detection on the recorder's level (0..1, every 100 ms): end the turn after a pause. */
function callTick(seconds, level) {
  if (level === undefined) return; // no Web Audio: the person presses the button to send
  const now = seconds * 1000;
  if (!vad) vad = { floor: level, speechMs: 0, quietSince: null, heard: false };
  if (now <= 400) {                // the first moments measure the room noise
    vad.floor = Math.min(vad.floor, level);
    return;
  }
  const speechLevel = Math.max(0.15, vad.floor * 3);
  const quietLevel = Math.max(0.1, vad.floor * 2);
  if (level >= speechLevel) {
    vad.speechMs += 100;
    vad.quietSince = null;
    if (vad.speechMs >= CALL_MIN_SPEECH_MS) vad.heard = true;
  } else if (level < quietLevel && vad.quietSince === null) {
    vad.quietSince = now;
  }
  if (vad.heard && vad.quietSince !== null && now - vad.quietSince >= CALL_SILENCE_MS) {
    finishListening();
  } else if (!vad.heard && now >= CALL_NO_SPEECH_MS) {
    endCall();
  }
}

function startCall() {
  callActive = true;
  callMisses = 0;
  startListening('call');
}

function endCall() {
  callActive = false;
  vad = null;
  if (mic) cancelListening();
  if (state === 'listening') setState('idle');
}

/** Open the mic again for the next turn, if the call is still on and nothing else is happening. */
function callRelisten(delay = CALL_RELISTEN_MS) {
  if (!callActive) return;
  setTimeout(() => {
    if (callActive && !mic && !inFlight && state !== 'thinking' && state !== 'speaking') startListening('call');
  }, delay);
}

/** No speech recognised: try again twice, then end the call. Other errors end the call. */
function callAfterError(code) {
  if (!callActive) return;
  if ((code === 'no_speech' || code === 'empty_audio') && ++callMisses <= 2) callRelisten(1200);
  else endCall();
}

function cancelListening() {
  resetMic();
  recorder.cancel();
}

function resetMic() {
  micId++;
  mic = null;
  pressMode = null;
}

// ---------- request and reply ----------

/**
 * Send one turn (text or audio) and render the reply.
 * @param {{text?: string, audio?: Blob}} turn
 * @param {{echo?: boolean}} [options] echo: false when Retry re-sends text that is already shown
 */
async function sendTurn(turn, { echo = true } = {}) {
  if (inFlight) return;
  const myEpoch = epoch;
  lastTurn = turn;
  if (turn.text && echo) ui.addUser(turn.text);
  setState('thinking');
  const ctrl = new AbortController();
  inFlight = ctrl;
  let reply;
  try {
    reply = await api.talk({ ...turn, language: ui.languagePref(), sessionId, signal: ctrl.signal });
    if (!reply || typeof reply !== 'object') throw new api.ApiError('internal', 'Empty reply');
  } catch (err) {
    if (myEpoch !== epoch || (err && err.code === 'aborted')) return;
    setState('error', { error: (err && err.code) || 'internal' });
    callAfterError((err && err.code) || 'internal');
    return;
  } finally {
    if (inFlight === ctrl) inFlight = null;
  }
  if (myEpoch !== epoch) return;

  lastTurn = null;
  callMisses = 0;
  if (reply.session_id) sessionId = reply.session_id;
  if (reply.detected_language === 'de' || reply.detected_language === 'en') replyLang = reply.detected_language;
  if (!turn.text && reply.transcript) ui.addUser(reply.transcript);
  const url = api.audioUrl(reply.reply_audio_url);
  if (reply.reply_text) ui.addAssistant(reply.reply_text, url);
  if (reply.service) ui.addService(reply.service);
  speak(url, reply.reply_text);
}

/** Show 'speaking' while the reply plays, then 'idle' unless something else took over. */
async function speak(url, text) {
  if (!url && !text) {
    setState('idle');
    callRelisten();
    return;
  }
  const id = ++speakId;
  setState('speaking');
  await player.play(url, text, speechLang());
  if (id === speakId) {
    setState('idle');
    callRelisten(); // call mode: the next turn starts by itself
  }
}

function stopPlayback() {
  speakId++;
  player.stop();
  if (state === 'speaking') setState('idle');
}

function startOver() {
  callActive = false;
  vad = null;
  epoch++;
  if (inFlight) {
    inFlight.abort();
    inFlight = null;
  }
  cancelListening();
  ignoreUp = false;
  stopPlayback();
  lastTurn = null;
  replyLang = null;
  sessionId = newSessionId();
  ui.clear();
  setState('idle');
}

// ---------- handlers from js/ui.js ----------

const busy = () => state === 'thinking' || inFlight !== null;

/** Call mode button: start the call / send now while listening / interrupt while speaking. */
function callPress() {
  player.unlock();
  if (busy()) return;
  if (!callActive) {
    startCall();
    return;
  }
  if (mic) {
    ignoreUp = true;
    finishListening();
    return;
  }
  startListening('call'); // barge-in while the assistant speaks
}

ui.init({
  talkDown() {
    if (CALL) {
      callPress();
      return;
    }
    player.unlock();
    if (busy()) return;
    if (mic) {
      // Second press in toggle mode (or a hold whose release never arrived): stop and send.
      ignoreUp = true;
      finishListening();
      return;
    }
    ignoreUp = false;
    pressAt = performance.now();
    startListening('pending');
  },
  talkUp() {
    if (ignoreUp) {
      ignoreUp = false;
      return;
    }
    if (pressMode !== 'pending') return;
    // Released early, or while the permission prompt was still open: keep recording until the next press.
    if (mic === 'starting' || performance.now() - pressAt < TAP_MS) pressMode = 'toggle';
    else finishListening();
  },
  talkToggle() {
    if (CALL) {
      callPress();
      return;
    }
    player.unlock();
    if (busy()) return;
    if (mic) finishListening();
    else startListening('toggle');
  },
  sendText(text) {
    player.unlock();
    if (busy()) return;
    if (mic) cancelListening();
    stopPlayback();
    sendTurn({ text });
  },
  replay(audioUrl, text) {
    player.unlock();
    if (mic || busy()) return;
    stopPlayback();
    speak(audioUrl, text);
  },
  stop() {
    if (callActive) endCall(); // Esc / Stop ends the call
    if (state === 'speaking' || player.isPlaying()) stopPlayback();
  },
  startOver,
  retry() {
    if (mic || busy()) return;
    const turn = lastTurn;
    lastTurn = null;
    if (turn && RESENDABLE.has(lastError)) sendTurn(turn, { echo: false });
    else setState('idle');
  },
  languageChanged() {
    // The UI language is handled in js/ui.js; the next request sends the new ui.languagePref().
  },
});
setState('idle');
api.health().then(ui.setBackendOk);
