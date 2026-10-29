/**
 * Microphone recording (SPEC.md §5 and §9). Owner: A.
 *
 * API used by app.js:
 *   start({ onProgress, onLimit }) -> Promise<void>   resolves once the mic is open and recording runs
 *       onProgress({ seconds, level }) every 100 ms; level is 0..1, or undefined without Web Audio.
 *       onLimit() once, when the 30 s cap (SPEC.md §6) has stopped the recording; call stop() to get it.
 *   stop()        -> Promise<Blob>   resolves with the recording
 *   cancel()      -> void            discards the recording, also while start() still waits for permission
 *   isRecording() -> boolean
 *
 * MediaRecorder uses 'audio/webm;codecs=opus' when supported, otherwise the browser default (Safari: usually
 * audio/mp4). Every MediaStream track is stopped after recording, also on errors.
 * Errors are RecorderError with a CONTRACT.md code: mic_denied, mic_unavailable, empty_audio, or 'aborted'
 * when cancel() ran during start().
 */

/** Hard recording limit in seconds (SPEC.md §6). */
export const MAX_SECONDS = 30;

const PREFERRED_TYPE = 'audio/webm;codecs=opus';
const PROGRESS_MS = 100;

/** Error with a code from CONTRACT.md, like ApiError in js/api.js. */
export class RecorderError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   */
  constructor(code, message) {
    super(message || code);
    this.name = 'RecorderError';
    this.code = code;
  }
}

let current = null; // running recording: { stream, recorder, chunks, done, timer, meter }
let pending = null; // start() waiting for getUserMedia: { cancelled }

/**
 * Open the microphone and start recording.
 * @param {{onProgress?: (p: {seconds: number, level?: number}) => void, onLimit?: () => void}} [callbacks]
 * @returns {Promise<void>}
 * @throws {RecorderError}
 */
export async function start({ onProgress, onLimit } = {}) {
  if (current || pending) throw new RecorderError('internal', 'Already recording');
  if (!globalThis.navigator?.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    throw new RecorderError('mic_unavailable');
  }

  const attempt = { cancelled: false };
  pending = attempt;
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    throw new RecorderError(attempt.cancelled ? 'aborted' : micErrorCode(err), err && err.message);
  } finally {
    if (pending === attempt) pending = null;
  }
  if (attempt.cancelled) {
    stopTracks(stream);
    throw new RecorderError('aborted');
  }

  let recorder;
  try {
    recorder = new MediaRecorder(stream, recorderOptions());
  } catch (err) {
    stopTracks(stream);
    throw new RecorderError('mic_unavailable', err && err.message);
  }

  const rec = { stream, recorder, chunks: [], done: null, timer: null, meter: openMeter(stream) };
  rec.done = new Promise((resolve) => {
    recorder.addEventListener('stop', resolve, { once: true });
    recorder.addEventListener('error', resolve, { once: true });
  });
  recorder.addEventListener('dataavailable', (e) => {
    if (e.data && e.data.size > 0) rec.chunks.push(e.data);
  });
  try {
    recorder.start();
  } catch (err) {
    cleanup(rec);
    throw new RecorderError('mic_unavailable', err && err.message);
  }
  current = rec;

  const startedAt = performance.now();
  rec.timer = setInterval(() => {
    const seconds = Math.min((performance.now() - startedAt) / 1000, MAX_SECONDS);
    if (onProgress) onProgress({ seconds, level: rec.meter ? rec.meter.level() : undefined });
    if (seconds >= MAX_SECONDS) {
      clearInterval(rec.timer);
      if (recorder.state !== 'inactive') recorder.stop();
      if (onLimit) onLimit();
    }
  }, PROGRESS_MS);
}

/**
 * Stop recording and return the audio.
 * @returns {Promise<Blob>}
 * @throws {RecorderError} 'empty_audio' when nothing was recorded
 */
export async function stop() {
  const rec = current;
  if (!rec) throw new RecorderError('empty_audio', 'Not recording');
  current = null;
  clearInterval(rec.timer);
  if (rec.recorder.state !== 'inactive') rec.recorder.stop();
  await rec.done;
  cleanup(rec);
  const type = rec.recorder.mimeType || (rec.chunks[0] && rec.chunks[0].type) || '';
  const blob = new Blob(rec.chunks, type ? { type } : undefined);
  if (blob.size === 0) throw new RecorderError('empty_audio');
  return blob;
}

/** Discard the recording and release the microphone. Safe to call at any time. */
export function cancel() {
  if (pending) pending.cancelled = true;
  const rec = current;
  current = null;
  if (!rec) return;
  try {
    if (rec.recorder.state !== 'inactive') rec.recorder.stop();
  } catch {
    /* already stopped */
  }
  cleanup(rec);
}

/** @returns {boolean} true while the microphone is recording */
export function isRecording() {
  return current !== null;
}

// ---------- helpers ----------

function recorderOptions() {
  const supported = typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(PREFERRED_TYPE);
  return supported ? { mimeType: PREFERRED_TYPE } : undefined;
}

function micErrorCode(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'mic_denied';
  return 'mic_unavailable';
}

function cleanup(rec) {
  clearInterval(rec.timer);
  if (rec.meter) rec.meter.close();
  stopTracks(rec.stream);
}

function stopTracks(stream) {
  if (stream) stream.getTracks().forEach((track) => track.stop());
}

/** Level meter from an AnalyserNode; null when Web Audio is missing (the level is then simply absent). */
function openMeter(stream) {
  const Ctx = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Ctx) return null;
  try {
    const ctx = new Ctx();
    if (ctx.state === 'suspended' && ctx.resume) ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    return {
      level() {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) sum += ((v - 128) / 128) ** 2;
        // Speech RMS is rarely above 0.25; scale so normal speaking fills most of the meter.
        return Math.min(1, Math.sqrt(sum / data.length) * 4);
      },
      close() {
        try {
          ctx.close().catch(() => {});
        } catch {
          /* already closed */
        }
      },
    };
  } catch {
    return null;
  }
}
