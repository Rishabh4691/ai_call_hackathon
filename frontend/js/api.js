/**
 * Backend client (SPEC.md §6 and §9). Owner: A.
 * Same code path for the real FastAPI backend and for mock mode (?mock=1).
 */
import { mockFetch } from './mock.js';

const params = new URLSearchParams(globalThis.location ? globalThis.location.search : '');

/**
 * Base URL of the FastAPI backend (built by the backend teammates). Default from SPEC.md §6.
 * When the backend runs on a teammate's laptop, open the page with ?api=http://<their-ip>:8000 instead of
 * editing code.
 */
export const API_BASE = (params.get('api') || 'http://localhost:8000').replace(/\/+$/, '');

const TALK_TIMEOUT_MS = 60_000;
const HEALTH_TIMEOUT_MS = 5_000;
const BACKEND_CODES = new Set(['empty_audio', 'no_speech', 'server_busy', 'internal']);

/** True when the page was opened with ?mock=1. */
export const MOCK = params.get('mock') === '1';

const doFetch = MOCK ? mockFetch : (url, options) => fetch(url, options);

/** Error with a code from CONTRACT.md: empty_audio, no_speech, server_busy, internal, network, timeout, aborted. */
export class ApiError extends Error {
  /**
   * @param {string} code
   * @param {string} [message]
   * @param {number} [status]
   */
  constructor(code, message, status) {
    super(message || code);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Send one conversation turn. Pass either `audio` or `text`, not both.
 * @param {{audio?: Blob, text?: string, language?: 'auto'|'de'|'en', sessionId: string, signal?: AbortSignal}} turn
 * @returns {Promise<{session_id: string, transcript: string, detected_language: string, reply_text: string,
 *   reply_audio_url: string|null, needs_more_info: boolean, service: object|null}>}
 * @throws {ApiError}
 */
export async function talk({ audio, text, language = 'auto', sessionId, signal }) {
  const form = new FormData();
  if (audio) {
    form.append('audio', audio, fileNameFor(audio));
  } else {
    form.append('text', text || '');
  }
  form.append('language', language);
  form.append('session_id', sessionId);
  return request('/talk', { method: 'POST', body: form }, TALK_TIMEOUT_MS, signal);
}

/**
 * Check whether the backend is reachable (call on page load).
 * @returns {Promise<boolean>}
 */
export async function health() {
  try {
    const body = await request('/health', { method: 'GET' }, HEALTH_TIMEOUT_MS);
    return Boolean(body && body.ok === true);
  } catch {
    return false;
  }
}

/**
 * Turn the backend's relative reply_audio_url into a full URL.
 * @param {string|null|undefined} path
 * @returns {string|null}
 */
export function audioUrl(path) {
  if (!path) return null;
  return new URL(path, API_BASE).href;
}

function fileNameFor(blob) {
  const type = blob.type || '';
  if (type.includes('mp4')) return 'speech.mp4';
  if (type.includes('wav')) return 'speech.wav';
  if (type.includes('ogg')) return 'speech.ogg';
  return 'speech.webm';
}

async function request(path, options, timeoutMs, outerSignal) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctrl.abort();
  }, timeoutMs);
  const onOuterAbort = () => ctrl.abort();
  if (outerSignal) {
    if (outerSignal.aborted) ctrl.abort();
    else outerSignal.addEventListener('abort', onOuterAbort, { once: true });
  }

  let res;
  try {
    res = await doFetch(API_BASE + path, { ...options, signal: ctrl.signal });
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new ApiError(timedOut ? 'timeout' : 'aborted', timedOut ? 'Request timed out' : 'Request cancelled');
    }
    throw new ApiError('network', err && err.message);
  } finally {
    clearTimeout(timer);
    if (outerSignal) outerSignal.removeEventListener('abort', onOuterAbort);
  }

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const code = body && BACKEND_CODES.has(body.error) ? body.error : 'internal';
    throw new ApiError(code, body && body.message, res.status);
  }
  return body;
}
