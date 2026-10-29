/**
 * All user-facing text, German and English (SPEC.md §7). Owner: B (Gemini).
 * Skeleton version: keep the exported names (t, getLang, setLang, languagePref); add or reword strings freely.
 * Plain, short sentences (A2–B1). Every error code from CONTRACT.md has an `error_<code>` entry.
 */
export const STRINGS = {
  de: {
    appName: 'Caritas Wegweiser',
    tagline: 'Die passende Beratungsstelle in Unterfranken finden',
    language: 'Sprache',
    textSize: 'Schriftgröße',
    textSmaller: 'Schrift kleiner',
    textLarger: 'Schrift größer',
    talkRegion: 'Sprechen',
    hintIdle: 'Gedrückt halten oder einmal tippen',
    servicesTitle: 'Empfohlene Stellen',
    serviceEmpty: 'Hier erscheint Ihre passende Stelle',
    serviceEmptyHint: 'Erzählen Sie kurz, wobei Sie Hilfe brauchen. Dann zeige ich Ihnen, wer Ihnen weiterhilft.',
    conversationTitle: 'Gesprächsverlauf',
    callService: 'Jetzt anrufen',
    notice: 'Ich berate nicht selbst. Ich zeige Ihnen, welche Stelle Ihnen weiterhelfen kann.',
    emergencyTitle: 'Im Notfall',
    emergency112: 'Notruf',
    emergencyCrisis: 'Telefonseelsorge, rund um die Uhr',
    emergency: 'Im Notfall: 112 · Telefonseelsorge: 0800 111 0 111',
    backendDown: 'Der Dienst ist gerade nicht erreichbar. Bitte versuchen Sie es später noch einmal.',
    welcome: 'Halten Sie den Knopf gedrückt und sprechen Sie. Sie können auch schreiben.',
    welcomeCall: 'Drücken Sie einmal auf den Knopf. Danach sprechen Sie einfach, wie am Telefon.',
    talkIdle: 'Sprechen',
    talkStart: 'Gespräch beginnen',
    talkWaiting: 'Gleich geht es weiter',
    talkListening: 'Ich höre zu',
    talkThinking: 'Einen Moment bitte',
    talkSpeaking: 'Antwort läuft',
    hintSpeaking: 'Zum Unterbrechen den Knopf drücken',
    hintListening: 'Sprechen Sie jetzt. Ich antworte, wenn Sie eine kurze Pause machen.',
    endCall: 'Gespräch beenden',
    typeInstead: 'Lieber schreiben',
    retry: 'Nochmal versuchen',
    inputLabel: 'Ihre Nachricht',
    inputPlaceholder: 'Zum Beispiel: Ich habe Schulden und wohne in Kitzingen',
    send: 'Senden',
    startOver: 'Neues Gespräch',
    replay: 'Nochmal anhören',
    you: 'Sie',
    assistant: 'Caritas Wegweiser',
    recommended: 'Empfohlene Stelle',
    whyTitle: 'Warum diese Stelle',
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
    appName: 'Caritas Wegweiser',
    tagline: 'Find the right support service in Lower Franconia',
    language: 'Language',
    textSize: 'Text size',
    textSmaller: 'Smaller text',
    textLarger: 'Larger text',
    talkRegion: 'Talk',
    hintIdle: 'Hold, or tap once',
    servicesTitle: 'Recommended services',
    serviceEmpty: 'Your matching service will appear here',
    serviceEmptyHint: 'Tell me briefly what you need help with. Then I show you who can help.',
    conversationTitle: 'Conversation',
    callService: 'Call now',
    notice: "I don't give counselling myself. I show you which service can help you.",
    emergencyTitle: 'In an emergency',
    emergency112: 'Emergency',
    emergencyCrisis: 'Telefonseelsorge crisis line, day and night',
    emergency: 'Emergency: 112 · Telefonseelsorge (crisis line): 0800 111 0 111',
    backendDown: 'The service is not reachable right now. Please try again later.',
    welcome: 'Hold the button and speak. You can also type.',
    welcomeCall: 'Press the button once. Then simply talk, as on the phone.',
    talkIdle: 'Speak',
    talkStart: 'Start conversation',
    talkWaiting: 'One moment',
    talkListening: 'Listening',
    talkThinking: 'One moment please',
    talkSpeaking: 'Answering',
    hintSpeaking: 'Press the button to interrupt',
    hintListening: 'Please speak now. I will answer when you pause.',
    endCall: 'End conversation',
    typeInstead: 'Type instead',
    retry: 'Try again',
    inputLabel: 'Your message',
    inputPlaceholder: 'For example: I have debts and live in Kitzingen',
    send: 'Send',
    startOver: 'New conversation',
    replay: 'Play again',
    you: 'You',
    assistant: 'Caritas Wegweiser',
    recommended: 'Recommended service',
    whyTitle: 'Why this service',
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
