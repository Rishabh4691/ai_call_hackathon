/**
 * Everything on the page (SPEC.md §4 and §8). Owner: B (Gemini).
 *
 * SKELETON: a plain, minimal version so the engine can be tested today. Replace it freely, but keep these
 * exports and their arguments exactly as in CONTRACT.md:
 *   init, setState, addUser, addAssistant, addService, setBackendOk, clear, languagePref
 * Still to do for B: real layout and styling, icons per state, A−/A+ text size, pulsing ring, level meter,
 * reduced motion, dark mode, screen-reader polish (see SPEC.md §8).
 */
import { t, getLang, setLang, languagePref as storedLanguagePref } from './i18n.js';

/** @returns {'auto'|'de'|'en'} */
export const languagePref = storedLanguagePref;

const TALK_LABEL = {
  idle: 'talkIdle',
  listening: 'talkListening',
  thinking: 'talkThinking',
  speaking: 'talkSpeaking',
  error: 'talkIdle',
};
const KNOWN_FIELDS = new Set(['id', 'name', 'why', 'address', 'phone', 'email', 'website', 'opening_hours', 'languages']);

let handlers = {};
let state = 'idle';
let lastDetail = {};
let cardCount = 0;
const els = {};

/**
 * Build the page and wire events to the handlers from app.js.
 * @param {Record<string, Function>} h handlers, see CONTRACT.md
 */
export function init(h) {
  handlers = h || {};
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="top">
      <h1 data-i18n="appName"></h1>
      <div class="lang" role="group" data-i18n-label="language">
        <button type="button" data-lang="de">DE</button>
        <button type="button" data-lang="en">EN</button>
      </div>
    </header>
    <p class="notice" role="note"><span data-i18n="notice"></span><br><strong data-i18n="emergency"></strong></p>
    <p class="backend-down" role="alert" data-i18n="backendDown" hidden></p>
    <p class="welcome" data-i18n="welcome"></p>
    <ol class="conversation" aria-live="polite"></ol>
    <div class="controls">
      <button type="button" class="talk" aria-pressed="false"></button>
      <p class="error" role="alert" hidden><span class="error-text"></span>
        <button type="button" class="retry" data-i18n="retry"></button></p>
      <form class="text-form">
        <label for="text-input" data-i18n="inputLabel"></label>
        <input id="text-input" type="text" autocomplete="off" data-i18n-placeholder="inputPlaceholder">
        <button type="submit" data-i18n="send"></button>
      </form>
      <button type="button" class="start-over" data-i18n="startOver"></button>
    </div>`;

  els.conversation = app.querySelector('.conversation');
  els.talk = app.querySelector('.talk');
  els.error = app.querySelector('.error');
  els.errorText = app.querySelector('.error-text');
  els.backendDown = app.querySelector('.backend-down');
  els.input = app.querySelector('#text-input');

  els.talk.addEventListener('pointerdown', (e) => {
    if (e.button === 0) call('talkDown');
  });
  els.talk.addEventListener('pointerup', () => call('talkUp'));
  els.talk.addEventListener('pointercancel', () => call('talkUp'));
  els.talk.addEventListener('contextmenu', (e) => e.preventDefault());
  els.talk.addEventListener('click', (e) => {
    if (e.detail === 0) call('talkToggle'); // keyboard (Space/Enter); pointer clicks have detail >= 1
  });

  app.querySelector('.retry').addEventListener('click', () => call('retry'));
  app.querySelector('.start-over').addEventListener('click', () => call('startOver'));
  app.querySelector('.text-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = els.input.value.trim();
    if (!text) return;
    els.input.value = '';
    call('sendText', text);
  });
  app.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setLang(btn.dataset.lang);
      applyStrings();
      call('languageChanged', btn.dataset.lang);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') call('stop');
  });

  applyStrings();
}

/**
 * @param {'idle'|'listening'|'thinking'|'speaking'|'error'} next
 * @param {{seconds?: number, level?: number, error?: string}} [detail]
 */
export function setState(next, detail = {}) {
  state = next;
  lastDetail = detail;
  const label = t(TALK_LABEL[next] || 'talkIdle');
  const timer = next === 'listening' && Number.isFinite(detail.seconds) ? ` ${Math.floor(detail.seconds)} s` : '';
  els.talk.dataset.state = next;
  els.talk.textContent = label + timer;
  els.talk.setAttribute('aria-label', label);
  els.talk.setAttribute('aria-pressed', String(next === 'listening'));
  els.talk.disabled = next === 'thinking';
  els.error.hidden = next !== 'error';
  if (next === 'error') els.errorText.textContent = t(`error_${detail.error || 'internal'}`);
}

/** @param {string} text */
export function addUser(text) {
  addMessage('user', t('you'), text);
}

/** @param {string} text @param {string|null} audioUrl */
export function addAssistant(text, audioUrl) {
  const li = addMessage('assistant', t('assistant'), text);
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'replay';
  replay.dataset.i18n = 'replay';
  replay.textContent = t('replay');
  replay.addEventListener('click', () => call('replay', audioUrl, text));
  li.append(replay);
}

/** @param {Record<string, unknown>} service */
export function addService(service) {
  els.conversation.querySelectorAll('.service.latest').forEach((n) => n.classList.remove('latest'));
  cardCount += 1;
  const headingId = `service-${cardCount}`;
  const li = document.createElement('li');
  li.className = 'service latest';
  const card = document.createElement('section');
  card.setAttribute('aria-labelledby', headingId);

  const kicker = textEl('p', t('recommended'), 'kicker');
  kicker.dataset.i18n = 'recommended';
  const heading = textEl('h2', service.name || '');
  heading.id = headingId;
  card.append(kicker, heading);

  if (service.why) {
    const whyTitle = textEl('h3', t('whyTitle'));
    whyTitle.dataset.i18n = 'whyTitle';
    card.append(whyTitle, textEl('p', service.why));
  }

  const dl = document.createElement('dl');
  addRow(dl, 'address', service.address);
  addRow(dl, 'phone', service.phone, service.phone ? `tel:${String(service.phone).replace(/[^\d+]/g, '')}` : null);
  addRow(dl, 'email', service.email, service.email ? `mailto:${service.email}` : null);
  addRow(dl, 'website', service.website, safeHttpUrl(service.website));
  addRow(dl, 'opening_hours', service.opening_hours);
  addRow(dl, 'languages', Array.isArray(service.languages) ? service.languages.join(', ').toUpperCase() : null);
  for (const [key, value] of Object.entries(service)) {
    if (!KNOWN_FIELDS.has(key)) addRow(dl, null, formatValue(value), null, prettyKey(key));
  }
  card.append(dl);
  li.append(card);
  els.conversation.append(li);
  li.scrollIntoView({ block: 'nearest' });
}

/** @param {boolean} ok */
export function setBackendOk(ok) {
  els.backendDown.hidden = Boolean(ok);
}

export function clear() {
  els.conversation.replaceChildren();
  cardCount = 0;
}

// ---------- helpers ----------

function call(name, ...args) {
  const fn = handlers[name];
  if (typeof fn === 'function') fn(...args);
}

function applyStrings() {
  document.documentElement.lang = getLang();
  document.querySelectorAll('[data-i18n]').forEach((n) => {
    n.textContent = t(n.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-label]').forEach((n) => {
    n.setAttribute('aria-label', t(n.dataset.i18nLabel));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((n) => {
    n.setAttribute('placeholder', t(n.dataset.i18nPlaceholder));
  });
  document.querySelectorAll('[data-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === getLang()));
  });
  if (els.talk) setState(state, lastDetail);
}

function addMessage(kind, who, text) {
  const li = document.createElement('li');
  li.className = kind;
  const label = textEl('span', who, 'who');
  label.dataset.i18n = kind === 'user' ? 'you' : 'assistant';
  li.append(label, textEl('p', text || ''));
  els.conversation.append(li);
  li.scrollIntoView({ block: 'nearest' });
  return li;
}

function addRow(dl, key, value, href, rawLabel) {
  if (value === null || value === undefined || value === '') return;
  const dt = textEl('dt', rawLabel || t(key));
  if (key) dt.dataset.i18n = key;
  const dd = document.createElement('dd');
  if (href) {
    const a = textEl('a', String(value));
    a.href = href;
    if (href.startsWith('http')) {
      a.target = '_blank';
      a.rel = 'noopener';
    }
    dd.append(a);
  } else {
    dd.textContent = String(value);
  }
  dl.append(dt, dd);
}

function textEl(tag, text, className) {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function safeHttpUrl(url) {
  return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
}

function formatValue(value) {
  if (typeof value === 'boolean') return t(value ? 'yes' : 'no');
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return value;
}

function prettyKey(key) {
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
