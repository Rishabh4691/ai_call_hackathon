/**
 * Everything on the page (SPEC.md §4 and §8). Owner: B.
 *
 * Exports and arguments exactly as in CONTRACT.md:
 *   init, setState, addUser, addAssistant, addService, setBackendOk, clear, languagePref
 *
 * Layout: a calm reception desk. Masthead with the name, an emergency strip, the conversation as a transcript
 * (the assistant's words set like a letter, the person's words as short notes), and a dock at the bottom with
 * one large talk button whose rings follow the microphone level.
 * With ?call=1 the page speaks of a conversation (one press starts it, Esc or "End conversation" ends it).
 */
import { t, getLang, setLang, languagePref as storedLanguagePref } from './i18n.js';

/** @returns {'auto'|'de'|'en'} */
export const languagePref = storedLanguagePref;

const CALL = new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('call') === '1';

const TALK_LABEL = {
  idle: 'talkIdle',
  listening: 'talkListening',
  thinking: 'talkThinking',
  speaking: 'talkSpeaking',
  error: 'talkIdle',
};
const KNOWN_FIELDS = new Set(['id', 'name', 'why', 'address', 'phone', 'email', 'website', 'opening_hours', 'languages']);

const ICONS = {
  mic: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>',
  wait: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/></svg>',
  speak: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18V6L7.5 9.5H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  signpost: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M15 3h2v26h-2z"/><path d="M6 7h15l4 3.5L21 14H6z"/><path d="M26 16H11l-4 3.5L11 23h15z"/></svg>',
};

let handlers = {};
let state = 'idle';
let lastDetail = {};
let cardCount = 0;
let callStarted = false;
const els = {};

/**
 * Build the page and wire events to the handlers from app.js.
 * @param {Record<string, Function>} h handlers, see CONTRACT.md
 */
export function init(h) {
  handlers = h || {};
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="masthead">
      <div class="brand">
        <span class="mark">${ICONS.signpost}</span>
        <div>
          <h1 data-i18n="appName"></h1>
          <p class="tagline" data-i18n="tagline"></p>
        </div>
      </div>
      <div class="lang" role="group" data-i18n-label="language">
        <button type="button" data-lang="de">DE</button>
        <button type="button" data-lang="en">EN</button>
      </div>
    </header>

    <section class="emergency" role="note" aria-labelledby="emergency-title">
      <p class="notice" data-i18n="notice"></p>
      <div class="hotlines">
        <h2 id="emergency-title" data-i18n="emergencyTitle"></h2>
        <p><span data-i18n="emergency112"></span> <a href="tel:112">112</a></p>
        <p><span data-i18n="emergencyCrisis"></span> <a href="tel:08001110111">0800 111 0 111</a></p>
      </div>
    </section>

    <p class="backend-down" role="alert" data-i18n="backendDown" hidden></p>

    <ol class="conversation" aria-live="polite"></ol>

    <div class="dock">
      <p class="welcome" data-i18n="${CALL ? 'welcomeCall' : 'welcome'}"></p>
      <div class="talk-wrap">
        <span class="ring ring-outer" aria-hidden="true"></span>
        <span class="ring ring-inner" aria-hidden="true"></span>
        <button type="button" class="talk" aria-pressed="false"><span class="icon"></span></button>
      </div>
      <p class="status" aria-live="polite"><strong class="status-label"></strong><span class="status-hint"></span></p>
      <p class="error" role="alert" hidden><span class="error-text"></span>
        <button type="button" class="retry quiet" data-i18n="retry"></button></p>
      <form class="text-form" hidden>
        <label for="text-input" data-i18n="inputLabel"></label>
        <div class="text-row">
          <input id="text-input" type="text" autocomplete="off" data-i18n-placeholder="inputPlaceholder">
          <button type="submit" data-i18n="send"></button>
        </div>
      </form>
      <div class="dock-actions">
        <button type="button" class="type-toggle quiet" aria-expanded="false" aria-controls="text-input" data-i18n="typeInstead"></button>
        <button type="button" class="start-over quiet" data-i18n="startOver"></button>
        <button type="button" class="end-call quiet" data-i18n="endCall" hidden></button>
      </div>
    </div>`;

  els.conversation = app.querySelector('.conversation');
  els.talkWrap = app.querySelector('.talk-wrap');
  els.talk = app.querySelector('.talk');
  els.icon = app.querySelector('.talk .icon');
  els.statusLabel = app.querySelector('.status-label');
  els.statusHint = app.querySelector('.status-hint');
  els.error = app.querySelector('.error');
  els.errorText = app.querySelector('.error-text');
  els.backendDown = app.querySelector('.backend-down');
  els.input = app.querySelector('#text-input');
  els.endCall = app.querySelector('.end-call');
  els.welcome = app.querySelector('.welcome');
  els.form = app.querySelector('.text-form');
  els.typeToggle = app.querySelector('.type-toggle');

  els.typeToggle.addEventListener('click', () => {
    const open = els.form.hidden;
    els.form.hidden = !open;
    els.typeToggle.setAttribute('aria-expanded', String(open));
    if (open) els.input.focus();
  });

  // Keep new messages visible above the sticky dock.
  const dock = app.querySelector('.dock');
  const syncDock = () => app.style.setProperty('--dock-h', `${dock.offsetHeight + 16}px`);
  if (typeof ResizeObserver === 'function') new ResizeObserver(syncDock).observe(dock);
  syncDock();

  els.talk.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (CALL) markCallStarted();
    call('talkDown');
  });
  els.talk.addEventListener('pointerup', () => call('talkUp'));
  els.talk.addEventListener('pointercancel', () => call('talkUp'));
  els.talk.addEventListener('contextmenu', (e) => e.preventDefault());
  els.talk.addEventListener('click', (e) => {
    if (e.detail !== 0) return; // keyboard (Space/Enter) only; pointer clicks have detail >= 1
    if (CALL) markCallStarted();
    call('talkToggle');
  });

  app.querySelector('.retry').addEventListener('click', () => call('retry'));
  app.querySelector('.start-over').addEventListener('click', () => call('startOver'));
  els.endCall.addEventListener('click', () => {
    callStarted = false;
    els.endCall.hidden = true;
    call('stop');
    setState(state === 'listening' ? 'idle' : state, lastDetail);
  });
  els.form.addEventListener('submit', (e) => {
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
    if (e.key !== 'Escape') return;
    if (CALL) {
      callStarted = false;
      els.endCall.hidden = true;
    }
    call('stop');
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
  let labelKey = TALK_LABEL[next] || 'talkIdle';
  if (CALL && next === 'idle') labelKey = callStarted ? 'talkWaiting' : 'talkStart';
  const label = t(labelKey);
  const seconds = next === 'listening' && Number.isFinite(detail.seconds) ? `, ${Math.floor(detail.seconds)} s` : '';

  els.talkWrap.dataset.state = next;
  els.talk.dataset.state = next;
  els.talk.setAttribute('aria-label', label);
  els.talk.setAttribute('aria-pressed', String(next === 'listening'));
  els.talk.disabled = next === 'thinking';
  els.icon.innerHTML = next === 'thinking' ? ICONS.wait : next === 'speaking' ? ICONS.speak : ICONS.mic;
  els.statusLabel.textContent = label + seconds;
  els.statusHint.textContent = next === 'speaking' ? t('hintSpeaking') : next === 'listening' && CALL ? t('hintListening') : '';

  const level = next === 'listening' && Number.isFinite(detail.level) ? Math.max(0, Math.min(1, detail.level)) : 0;
  els.talkWrap.style.setProperty('--level', level.toFixed(2));

  els.error.hidden = next !== 'error';
  if (next === 'error') els.errorText.textContent = t(`error_${detail.error || 'internal'}`);
}

/** @param {string} text */
export function addUser(text) {
  addMessage('user', t('you'), text);
  els.welcome.hidden = true;
}

/** @param {string} text @param {string|null} audioUrl */
export function addAssistant(text, audioUrl) {
  const li = addMessage('assistant', t('assistant'), text);
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'replay quiet';
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
    const why = document.createElement('div');
    why.className = 'why';
    const whyTitle = textEl('h3', t('whyTitle'));
    whyTitle.dataset.i18n = 'whyTitle';
    why.append(whyTitle, textEl('p', service.why));
    card.append(why);
  }

  const dl = document.createElement('dl');
  addRow(dl, 'address', service.address);
  addRow(dl, 'phone', service.phone, service.phone ? `tel:${String(service.phone).replace(/[^\d+]/g, '')}` : null);
  addRow(dl, 'email', service.email, service.email ? `mailto:${service.email}` : null);
  addRow(dl, 'website', service.website, safeHttpUrl(service.website));
  addRow(dl, 'opening_hours', service.opening_hours);
  addRow(dl, 'languages', Array.isArray(service.languages) && service.languages.length
    ? service.languages.join(', ').toUpperCase() : null);
  for (const [key, value] of Object.entries(service)) {
    if (!KNOWN_FIELDS.has(key)) addRow(dl, null, formatValue(value), null, prettyKey(key));
  }
  if (dl.children.length) card.append(dl);
  li.append(card);
  els.conversation.append(li);
  li.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** @param {boolean} ok */
export function setBackendOk(ok) {
  els.backendDown.hidden = Boolean(ok);
}

export function clear() {
  els.conversation.replaceChildren();
  cardCount = 0;
  callStarted = false;
  els.endCall.hidden = true;
  els.welcome.hidden = false;
}

// ---------- helpers ----------

function markCallStarted() {
  if (callStarted) return;
  callStarted = true;
  els.endCall.hidden = false;
}

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
  document.title = `${t('appName')} – ${t('tagline')}`;
  if (els.talk) setState(state, lastDetail);
}

function addMessage(kind, who, text) {
  const li = document.createElement('li');
  li.className = kind;
  const label = textEl('span', who, 'who');
  label.dataset.i18n = kind === 'user' ? 'you' : 'assistant';
  li.append(label, textEl('p', text || ''));
  els.conversation.append(li);
  li.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
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

function reducedMotion() {
  return Boolean(globalThis.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
}
