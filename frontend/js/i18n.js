/**
 * All user-facing text, German and English (SPEC.md §7). Owner: B (Gemini).
 * Skeleton version: keep the exported names (t, getLang, setLang, languagePref); add or reword strings freely.
 * Plain, short sentences (A2–B1). Every error code from CONTRACT.md has an `error_<code>` entry.
 */
export const STRINGS = {
  de: {
    appName: 'Hilfe-Navigator',
    language: 'Sprache',
    notice: 'Ich gebe keine Beratung, ich helfe Ihnen nur, die richtige Stelle zu finden.',
    emergency: 'Im Notfall: 112 · Telefonseelsorge: 0800 111 0 111',
    backendDown: 'Der Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es später noch einmal.',
    welcome: 'Erzählen Sie mir, was los ist. Halten Sie den großen Knopf gedrückt und sprechen Sie. Oder schreiben Sie unten.',
    talkIdle: 'Sprechen',
    talkListening: 'Ich höre zu…',
    talkThinking: 'Einen Moment…',
    talkSpeaking: 'Stopp',
    retry: 'Nochmal versuchen',
    inputLabel: 'Ihre Nachricht',
    inputPlaceholder: 'Oder hier schreiben…',
    send: 'Senden',
    startOver: 'Neu anfangen',
    replay: 'Nochmal anhören',
    you: 'Sie',
    assistant: 'Assistent',
    recommended: 'Empfohlene Stelle',
    whyTitle: 'Warum das zu Ihnen passt',
    address: 'Adresse',
    phone: 'Telefon',
    email: 'E-Mail',
    website: 'Webseite',
    opening_hours: 'Öffnungszeiten',
    languages: 'Sprachen',
    yes: 'ja',
    no: 'nein',
    error_empty_audio: 'Ich habe nichts gehört. Bitte halten Sie den Knopf gedrückt und sprechen Sie.',
    error_no_speech: 'Ich konnte Sie nicht verstehen. Bitte sprechen Sie noch einmal, etwas langsamer.',
    error_server_busy: 'Gerade ist viel los. Bitte versuchen Sie es gleich noch einmal.',
    error_internal: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es noch einmal.',
    error_mic_denied: 'Ich darf das Mikrofon nicht benutzen. Sie können unten auch schreiben.',
    error_mic_unavailable: 'Ich finde kein Mikrofon. Sie können unten auch schreiben.',
    error_network: 'Keine Verbindung zum Dienst. Bitte versuchen Sie es noch einmal.',
    error_timeout: 'Das dauert zu lange. Bitte versuchen Sie es noch einmal.',
  },
  en: {
    appName: 'Help Navigator',
    language: 'Language',
    notice: "I don't give counseling. I only help you find the right service.",
    emergency: 'Emergency: 112 · Telefonseelsorge (crisis line): 0800 111 0 111',
    backendDown: 'The service is not reachable right now. Please try again later.',
    welcome: "Tell me what's going on. Hold the big button and speak. Or type below.",
    talkIdle: 'Speak',
    talkListening: 'Listening…',
    talkThinking: 'Thinking…',
    talkSpeaking: 'Stop',
    retry: 'Try again',
    inputLabel: 'Your message',
    inputPlaceholder: 'Or type here…',
    send: 'Send',
    startOver: 'Start over',
    replay: 'Play again',
    you: 'You',
    assistant: 'Assistant',
    recommended: 'Recommended service',
    whyTitle: 'Why this fits you',
    address: 'Address',
    phone: 'Phone',
    email: 'Email',
    website: 'Website',
    opening_hours: 'Opening hours',
    languages: 'Languages',
    yes: 'yes',
    no: 'no',
    error_empty_audio: "I didn't hear anything. Please hold the button and speak.",
    error_no_speech: "I couldn't understand you. Please try again, a little slower.",
    error_server_busy: "It's busy right now. Please try again in a moment.",
    error_internal: 'Something went wrong. Please try again.',
    error_mic_denied: "I'm not allowed to use the microphone. You can also type below.",
    error_mic_unavailable: "I can't find a microphone. You can also type below.",
    error_network: "I can't reach the service. Please try again.",
    error_timeout: 'This is taking too long. Please try again.',
  },
};

const STORAGE_KEY = 'navigator.lang';

function storedLang() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** @returns {'auto'|'de'|'en'} 'auto' until the user has used the DE/EN toggle */
export function languagePref() {
  const s = storedLang();
  return s === 'de' || s === 'en' ? s : 'auto';
}

/** @returns {'de'|'en'} active UI language: toggle choice, else browser language, else German */
export function getLang() {
  const pref = languagePref();
  if (pref !== 'auto') return pref;
  const nav = (globalThis.navigator && navigator.language ? navigator.language : 'de').slice(0, 2).toLowerCase();
  return nav === 'en' ? 'en' : 'de';
}

/** Save the toggle choice and update <html lang>. @param {'de'|'en'} lang */
export function setLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage blocked: the choice lasts for this page view only */
  }
  document.documentElement.lang = lang;
}

/** @param {string} key @returns {string} text in the active language */
export function t(key) {
  const lang = getLang();
  return STRINGS[lang][key] ?? STRINGS.de[key] ?? key;
}
