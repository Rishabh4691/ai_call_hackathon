/**
 * Reply audio playback (SPEC.md §5 and §6). Owner: A.
 *
 * API used by app.js:
 *   play(url, text, lang) -> Promise<void>   resolves when playback ends, fails or is stopped; never rejects
 *       url from api.audioUrl(reply.reply_audio_url), played with one reusable <audio> element created in JS
 *       (not added to the page). If url is null (mock mode, or the backend's speech output failed) or the file
 *       cannot be played, `text` is read with window.speechSynthesis in `lang` (SPEC.md decision 3).
 *   stop()      -> void      stop immediately (Esc, barge-in, Start over)
 *   isPlaying() -> boolean
 *   unlock()    -> void      call inside a user gesture (talk button, send); lets Safari play audio later
 */

const VOICE_LANG = { de: 'de-DE', en: 'en-GB' };
const SPEECH_START_MS = 3000; // speechSynthesis that has not started by then is treated as unavailable

let audioEl = null;
let current = null; // running playback: { end() }
let unlocked = false;

/**
 * Play the reply audio, or read the text aloud when there is no audio.
 * @param {string|null} url
 * @param {string} text
 * @param {'de'|'en'} [lang]
 * @returns {Promise<void>}
 */
export function play(url, text, lang = 'de') {
  stop();
  return new Promise((resolve) => {
    const cleanups = [];
    const playback = {
      ended: false,
      onEnd(fn) {
        cleanups.push(fn);
      },
      end() {
        if (playback.ended) return;
        playback.ended = true;
        cleanups.forEach((fn) => fn());
        if (current === playback) current = null;
        resolve();
      },
    };
    current = playback;
    if (url) playFile(url, playback, () => speakText(text, lang, playback));
    else speakText(text, lang, playback);
  });
}

/** Stop any playback right away. */
export function stop() {
  if (current) current.end();
}

/** @returns {boolean} true while reply audio or speech is playing */
export function isPlaying() {
  return current !== null;
}

/** Prime audio output inside a user gesture, so later play() calls are allowed (mainly iOS Safari). */
export function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    const el = element();
    el.muted = true;
    el.src = silentWav();
    const p = el.play();
    if (p) p.then(() => { if (!current) el.pause(); }).catch(() => {});
  } catch {
    /* nothing to unlock */
  }
  try {
    if (globalThis.speechSynthesis && typeof SpeechSynthesisUtterance !== 'undefined') {
      speechSynthesis.speak(new SpeechSynthesisUtterance(''));
    }
  } catch {
    /* no speech synthesis */
  }
}

// ---------- helpers ----------

function element() {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = 'auto';
  }
  return audioEl;
}

function playFile(url, playback, fallback) {
  const el = element();
  let failed = false;
  const onEnded = () => playback.end();
  const onError = () => {
    if (failed || playback.ended) return;
    failed = true;
    detach();
    fallback();
  };
  const detach = () => {
    el.removeEventListener('ended', onEnded);
    el.removeEventListener('error', onError);
  };
  el.addEventListener('ended', onEnded);
  el.addEventListener('error', onError);
  playback.onEnd(() => {
    detach();
    el.pause();
    el.removeAttribute('src');
    el.load();
  });

  el.muted = false;
  el.src = url;
  const p = el.play();
  if (p) p.catch(onError);
}

function speakText(text, lang, playback) {
  const synth = globalThis.speechSynthesis;
  if (!text || !synth || typeof SpeechSynthesisUtterance === 'undefined') {
    playback.end();
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = VOICE_LANG[lang] || VOICE_LANG.de;
  const voice = pickVoice(synth, utterance.lang);
  if (voice) utterance.voice = voice;
  utterance.onend = () => playback.end();
  utterance.onerror = () => playback.end();

  // Backstop: some browsers never fire onend (or never start without voices), which would leave the
  // app stuck in 'speaking'.
  const startedBy = performance.now() + SPEECH_START_MS;
  const endBy = startedBy + text.length * 150;
  let started = false;
  const watchdog = setInterval(() => {
    const busy = synth.speaking || synth.pending;
    if (busy) started = true;
    const now = performance.now();
    if ((started && !busy) || (!started && now > startedBy) || now > endBy) playback.end();
  }, 250);

  playback.onEnd(() => {
    clearInterval(watchdog);
    utterance.onend = null;
    utterance.onerror = null;
    synth.cancel();
  });
  synth.cancel();
  synth.speak(utterance);
}

function pickVoice(synth, bcp47) {
  const voices = typeof synth.getVoices === 'function' ? synth.getVoices() : [];
  const base = bcp47.slice(0, 2);
  return voices.find((v) => v.lang === bcp47) || voices.find((v) => v.lang && v.lang.startsWith(base)) || null;
}

let silence = null;

/** A 50 ms silent WAV as a data: URL, built in code so no file or request is needed. */
function silentWav() {
  if (silence) return silence;
  const samples = 400; // 8 kHz, 8-bit mono
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset, s) => { for (let i = 0; i < s.length; i++) bytes[offset + i] = s.charCodeAt(i); };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  silence = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
  return silence;
}
