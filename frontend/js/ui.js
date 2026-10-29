/**
 * Everything on the page (SPEC.md §4 and §8). Owner: B.
 *
 * Exports and arguments exactly as in CONTRACT.md:
 *   init, setState, addUser, addAssistant, addService, setBackendOk, clear, languagePref
 *
 * Layout: a warm Caritas reception. Header with logo tile, text size and DE/EN; an always-visible emergency strip;
 * a hero card whose centre is the talk button, drawn as a living "agent" shape that changes with the state
 * (rings follow the microphone level); the latest exchange as a caption; the text field right below.
 * Beside it the recommended services (newest on top), and under it the full conversation.
 * With ?call=1 the page speaks of a conversation (one press starts it, Esc or "End conversation" ends it).
 *
 * The agent shape is adapted from "Agent state" by Cojeev (000h, MIT licence): https://cojeev.com/ui/docs/agent-state/
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

const SCALE_KEY = 'navigator.scale';
const SCALES = [1, 1.25, 1.5, 1.75, 2];

const ICONS = {
  signpost: '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M15 3h2v26h-2z"/><path d="M6 7h15l4 3.5L21 14H6z"/><path d="M26 16H11l-4 3.5L11 23h15z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.6 10.8a15.2 15.2 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"/></svg>',
};

// The agent shape: equal path topology, so SVG <animate> can morph between the silhouettes.
const SHAPES = {
  idle: 'M90 24C116 17 151 32 153 60C157 84 139 96 124 116C111 135 81 141 59 126C34 113 22 85 32 61C43 36 65 31 90 24Z',
  thinking: 'M90 18C120 27 132 19 148 51C163 78 141 92 135 116C127 146 94 137 68 129C40 123 18 98 30 70C40 48 66 7 90 18Z',
  working: 'M90 17C114 11 156 41 151 65C146 85 165 110 134 123C106 140 85 121 61 131C34 140 17 94 30 71C44 47 68 25 90 17Z',
  error: 'M90 30C113 7 131 35 147 54C167 77 135 93 139 117C142 142 105 128 83 132C55 139 18 117 28 89C37 65 60 40 90 30Z',
};
const ORB_SHAPE = { idle: 'idle', listening: 'idle', thinking: 'thinking', speaking: 'working', error: 'error' };

let handlers = {};
let state = 'idle';
let lastDetail = {};
let orbState = null;
let cardCount = 0;
let callStarted = false;
let scaleIndex = 0;
const els = {};

/**
 * Build the page and wire events to the handlers from app.js.
 * @param {Record<string, Function>} h handlers, see CONTRACT.md
 */
export function init(h) {
  handlers = h || {};
  const app = document.getElementById('app');
  app.innerHTML = `
    <header class="header">
      <div class="brand">
        <span class="logo">${ICONS.signpost}</span>
        <div>
          <h1 data-i18n="appName"></h1>
          <p class="tagline" data-i18n="tagline"></p>
        </div>
      </div>
      <div class="tools">
        <div class="seg textsize" role="group" data-i18n-label="textSize">
          <button type="button" class="smaller" data-i18n-label="textSmaller">A−</button>
          <button type="button" class="larger" data-i18n-label="textLarger">A+</button>
        </div>
        <div class="seg lang" role="group" data-i18n-label="language">
          <button type="button" data-lang="de">DE</button>
          <button type="button" data-lang="en">EN</button>
        </div>
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

    <div class="layout">
      <section class="card hero" aria-labelledby="talk-title">
        <h2 id="talk-title" class="sr-only" data-i18n="talkRegion"></h2>
        <p class="welcome" data-i18n="${CALL ? 'welcomeCall' : 'welcome'}"></p>
        <div class="talk-wrap">
          <span class="ring ring-outer" aria-hidden="true"></span>
          <span class="ring ring-inner" aria-hidden="true"></span>
          <span class="pulse" aria-hidden="true"><span></span><span></span></span>
          <button type="button" class="talk" aria-pressed="false"></button>
        </div>
        <p class="status" aria-live="polite"><strong class="status-label"></strong><span class="status-hint"></span></p>
        <div class="caption" aria-hidden="true">
          <p class="caption-user" hidden></p>
          <p class="caption-text" hidden></p>
        </div>
        <p class="error" role="alert" hidden><span class="error-text"></span>
          <button type="button" class="retry btn btn-small" data-i18n="retry"></button></p>
        <form class="text-form">
          <label for="text-input" data-i18n="inputLabel"></label>
          <div class="text-row">
            <input id="text-input" type="text" autocomplete="off" data-i18n-placeholder="inputPlaceholder">
            <button type="submit" class="btn btn-primary" data-i18n="send"></button>
          </div>
        </form>
        <div class="dock-actions">
          <button type="button" class="start-over btn btn-ghost" data-i18n="startOver"></button>
          <button type="button" class="end-call btn btn-ghost" data-i18n="endCall" hidden></button>
        </div>
      </section>

      <aside class="side" aria-labelledby="services-title">
        <h2 id="services-title" class="sr-only" data-i18n="servicesTitle"></h2>
        <div class="card service-empty">
          <span class="empty-icon">${ICONS.pin}</span>
          <p class="empty-title" data-i18n="serviceEmpty"></p>
          <p class="empty-text" data-i18n="serviceEmptyHint"></p>
        </div>
        <ol class="services" aria-live="polite"></ol>
      </aside>

      <section class="card chat-card" aria-labelledby="chat-title">
        <h2 id="chat-title" class="card-title" data-i18n="conversationTitle"></h2>
        <ol class="conversation" aria-live="polite" tabindex="0" data-i18n-label="conversationTitle"></ol>
      </section>
    </div>`;

  els.app = app;
  els.conversation = app.querySelector('.conversation');
  els.services = app.querySelector('.services');
  els.serviceEmpty = app.querySelector('.service-empty');
  els.talkWrap = app.querySelector('.talk-wrap');
  els.talk = app.querySelector('.talk');
  els.statusLabel = app.querySelector('.status-label');
  els.statusHint = app.querySelector('.status-hint');
  els.captionUser = app.querySelector('.caption-user');
  els.captionText = app.querySelector('.caption-text');
  els.error = app.querySelector('.error');
  els.errorText = app.querySelector('.error-text');
  els.backendDown = app.querySelector('.backend-down');
  els.input = app.querySelector('#text-input');
  els.endCall = app.querySelector('.end-call');
  els.welcome = app.querySelector('.welcome');
  els.form = app.querySelector('.text-form');
  els.smaller = app.querySelector('.smaller');
  els.larger = app.querySelector('.larger');

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
  els.smaller.addEventListener('click', () => applyScale(scaleIndex - 1));
  els.larger.addEventListener('click', () => applyScale(scaleIndex + 1));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (CALL) {
      callStarted = false;
      els.endCall.hidden = true;
    }
    call('stop');
  });

  applyScale(storedScaleIndex());
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
  if (orbState !== next) {
    // Rebuild the shape only when the state changes, not on every level update while listening.
    orbState = next;
    els.talk.innerHTML = orbSvg(next);
  }
  els.statusLabel.textContent = label + seconds;
  els.statusHint.textContent = next === 'speaking' ? t('hintSpeaking')
    : next === 'listening' && CALL ? t('hintListening')
      : next === 'idle' && !CALL ? t('hintIdle') : '';

  const level = next === 'listening' && Number.isFinite(detail.level) ? Math.max(0, Math.min(1, detail.level)) : 0;
  els.talkWrap.style.setProperty('--level', level.toFixed(2));

  els.error.hidden = next !== 'error';
  if (next === 'error') els.errorText.textContent = t(`error_${detail.error || 'internal'}`);
}

/** @param {string} text */
export function addUser(text) {
  addMessage('user', t('you'), text);
  els.welcome.hidden = true;
  setCaption(els.captionUser, text ? `„${text}“` : '');
  setCaption(els.captionText, '');
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
  li.querySelector('.bubble').append(replay);
  scrollChat();
  setCaption(els.captionText, text);
}

/** @param {Record<string, unknown>} service */
export function addService(service) {
  els.services.querySelectorAll('.service.latest').forEach((n) => n.classList.remove('latest'));
  cardCount += 1;
  const headingId = `service-${cardCount}`;
  const li = document.createElement('li');
  li.className = 'service latest';
  const card = document.createElement('section');
  card.className = 'card service-card';
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

  const tel = service.phone ? `tel:${String(service.phone).replace(/[^\d+]/g, '')}` : null;
  if (tel) {
    const callBtn = document.createElement('a');
    callBtn.className = 'btn btn-primary call-service';
    callBtn.href = tel;
    callBtn.innerHTML = ICONS.phone;
    const callText = textEl('span', t('callService'));
    callText.dataset.i18n = 'callService';
    callBtn.append(callText);
    card.append(callBtn);
  }

  li.append(card);
  els.services.prepend(li);
  els.serviceEmpty.hidden = true;
  li.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

/** @param {boolean} ok */
export function setBackendOk(ok) {
  els.backendDown.hidden = Boolean(ok);
}

export function clear() {
  els.conversation.replaceChildren();
  els.services.replaceChildren();
  els.serviceEmpty.hidden = false;
  cardCount = 0;
  callStarted = false;
  els.endCall.hidden = true;
  els.welcome.hidden = false;
  setCaption(els.captionUser, '');
  setCaption(els.captionText, '');
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

function storedScaleIndex() {
  try {
    const i = SCALES.indexOf(Number(localStorage.getItem(SCALE_KEY)));
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
}

function applyScale(index) {
  scaleIndex = Math.max(0, Math.min(SCALES.length - 1, index));
  const scale = SCALES[scaleIndex];
  document.documentElement.style.setProperty('--scale', String(scale));
  els.smaller.disabled = scaleIndex === 0;
  els.larger.disabled = scaleIndex === SCALES.length - 1;
  try {
    localStorage.setItem(SCALE_KEY, String(scale));
  } catch {
    /* storage blocked: the size lasts for this page view only */
  }
}

function setCaption(node, text) {
  node.textContent = text || '';
  node.hidden = !text;
  // Restart the fade-in for the new text.
  node.classList.remove('fresh');
  if (text) {
    void node.offsetWidth;
    node.classList.add('fresh');
  }
}

/** The talk button's face: the agent shape for the given state; it flows while listening, thinking or speaking. */
function orbSvg(next) {
  const shapeKey = ORB_SHAPE[next] || 'idle';
  const shape = SHAPES[shapeKey];
  const alt = SHAPES[shapeKey === 'thinking' ? 'working' : 'thinking'];
  const animated = (next === 'listening' || next === 'thinking' || next === 'speaking') && !reducedMotion();
  const ease = 'calcMode="spline" keyTimes="0;0.5;1" keySplines="0.42 0 0.58 1;0.42 0 0.58 1"';
  const morph = animated
    ? `<animate attributeName="d" values="${shape};${alt};${shape}" dur="${shapeKey === 'working' ? 5 : 7}s" repeatCount="indefinite" ${ease}/>`
    : '';
  const sway = animated
    ? '<animateTransform attributeName="transform" type="rotate" values="0 90 80;12 90 80;-6 90 80;0 90 80" dur="10s" repeatCount="indefinite"/>'
    : '';
  const face = next === 'error'
    ? '<path d="M90 66v16"/><path d="M90 91h.01"/>'
    : next === 'thinking'
      ? '<path d="M77 77v5M101 77v5"/><path d="M85 91h10"/>'
      : next === 'speaking'
        ? '<path d="M77 77v5M101 77v5"/><ellipse cx="90" cy="92" rx="5" ry="3.2"/>'
        : '<path d="M77 77v5M101 77v5"/><path d="M84 91q6 4 12 0"/>';
  return `<svg class="orb" viewBox="0 0 180 160" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="orb-body" cx=".3" cy=".2" r=".85">
        <stop style="stop-color:var(--agent-light)"/>
        <stop offset=".5" style="stop-color:var(--agent-base)"/>
        <stop offset="1" style="stop-color:var(--agent-deep)"/>
      </radialGradient>
      <radialGradient id="orb-fold" cx=".65" cy=".22" r=".8">
        <stop style="stop-color:var(--agent-cream);stop-opacity:.84"/>
        <stop offset=".4" style="stop-color:var(--agent-light);stop-opacity:.7"/>
        <stop offset="1" style="stop-color:var(--agent-deep);stop-opacity:.2"/>
      </radialGradient>
      <linearGradient id="orb-rim" x1="30" y1="30" x2="138" y2="134" gradientUnits="userSpaceOnUse">
        <stop style="stop-color:var(--agent-cream);stop-opacity:.92"/>
        <stop offset=".48" style="stop-color:var(--agent-light);stop-opacity:.2"/>
        <stop offset="1" style="stop-color:var(--agent-deep);stop-opacity:.8"/>
      </linearGradient>
      <clipPath id="orb-clip"><path d="${shape}">${morph}</path></clipPath>
    </defs>
    <ellipse cx="92" cy="139" rx="43" ry="5" style="fill:var(--agent-deep)" opacity=".14"/>
    <path d="${shape}" fill="url(#orb-body)">${morph}</path>
    <g clip-path="url(#orb-clip)">
      <g>${sway}
        <path d="M15 61C51 32 81 110 128 89C165 72 142 24 105 14C163 7 181 113 125 142C74 168 20 125 15 61Z" fill="url(#orb-fold)"/>
        <path d="M26 48C64 18 59 134 119 110C147 99 132 71 155 47" stroke="url(#orb-rim)" stroke-width="1.2"/>
        <path d="M30 44C69 19 58 139 125 111C151 99 136 69 159 43" stroke="url(#orb-rim)" stroke-width=".65" opacity=".75"/>
        <path d="M35 42C74 26 64 143 131 109C154 97 141 65 162 40" stroke="url(#orb-rim)" stroke-width=".5" opacity=".5"/>
        <path d="M24 92C47 78 93 148 139 118" style="stroke:var(--agent-deep)" stroke-opacity=".25" stroke-width="14"/>
      </g>
    </g>
    <path d="${shape}" stroke="url(#orb-rim)" stroke-width="1.2">${morph}</path>
    <g class="orb-face" style="stroke:var(--agent-ink)" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${face}</g>
  </svg>`;
}

function addMessage(kind, who, text) {
  const li = document.createElement('li');
  li.className = kind;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  const label = textEl('span', who, 'who');
  label.dataset.i18n = kind === 'user' ? 'you' : 'assistant';
  bubble.append(label, textEl('p', text || ''));
  li.append(bubble);
  els.conversation.append(li);
  scrollChat();
  return li;
}

/** Keep the newest message in view (after layout, so a just-added replay button is included). */
function scrollChat() {
  requestAnimationFrame(() => {
    els.conversation.scrollTo({ top: els.conversation.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
  });
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
