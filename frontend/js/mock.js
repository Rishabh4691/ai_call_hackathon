/**
 * Mock backend for ?mock=1 (SPEC.md §11). Owner: A.
 *
 * mockFetch(url, options) behaves like window.fetch() for POST /talk and GET /health, so js/api.js uses the
 * same code path in mock and real mode.
 *
 * Page URL parameters:
 *   mock=1            enable mock mode (read in js/api.js)
 *   scenario=<id>     scenario for voice turns: gambling | care | jobcenter | pregnancy | crisis | unclear
 *                     (default: care). Typed text picks a scenario by keywords.
 *   error=<code>      every /talk call fails: empty_audio | no_speech | server_busy | internal
 *   health=down       GET /health fails
 *   delay=<ms>        simulated thinking time (default 1500)
 *
 * All services below are FICTIONAL examples for UI work, marked "(Beispiel)", except the real crisis line
 * Krisendienste Bayern (0800 655 3000, free, 24/7).
 */

const ERROR_STATUS = { empty_audio: 400, no_speech: 422, server_busy: 503, internal: 500 };
const ERROR_MESSAGE = {
  empty_audio: 'No audio received.',
  no_speech: 'No speech detected in the audio.',
  server_busy: 'The server is busy. Try again shortly.',
  internal: 'Internal server error.',
};

const CRISIS = /nicht mehr leben|umbringen|suizid|selbstmord|sterben will|kill myself|suicid|end my life|want to die|don.t want to live/i;

/** Each turn: what the caller says (for voice), what the assistant replies, and an optional service. */
const SCENARIOS = {
  gambling: {
    lang: 'de',
    keywords: /zock|glücksspiel|spielsucht|wetten|casino|gambl|betting/i,
    turns: [
      {
        transcript: { de: 'Ich zock zu viel und jetzt ist das Geld weg.', en: 'I gamble too much and now the money is gone.' },
        reply: { de: 'Das klingt belastend. In welchem Ort wohnen Sie?', en: 'That sounds hard. Which town do you live in?' },
      },
      {
        transcript: { de: 'In Würzburg.', en: 'In Würzburg.' },
        reply: { de: 'Danke. Die Suchtberatung passt gut zu Ihnen.', en: 'Thank you. The addiction counselling service is a good fit for you.' },
        service: {
          id: 'mock_gambling',
          name: 'Suchtberatung Würzburg (Beispiel)',
          why: {
            de: 'Sie spielen zu viel und haben Geldsorgen. Diese Stelle hilft bei Glücksspiel und auch bei Schulden.',
            en: 'You gamble too much and have money worries. This service helps with gambling and also with debts.',
          },
          address: 'Musterstraße 1, 97070 Würzburg',
          phone: '+49 931 000000',
          email: 'info@example.org',
          website: 'https://example.org',
          opening_hours: 'Mo–Fr 9–12 Uhr',
          languages: ['de', 'en'],
        },
      },
    ],
  },
  care: {
    lang: 'de',
    keywords: /pfleg|schlaganfall|mutter|vater|demenz|stroke|caring for|carer|dementia/i,
    turns: [
      {
        transcript: { de: 'Mein Mann kann seit dem Schlaganfall nix mehr allein.', en: "Since his stroke my husband can't manage alone." },
        reply: { de: 'Das ist viel auf einmal. Pflegen Sie Ihren Mann zu Hause?', en: 'That is a lot at once. Are you caring for your husband at home?' },
      },
      {
        transcript: { de: 'Ja, in Ochsenfurt.', en: 'Yes, in Ochsenfurt.' },
        reply: { de: 'Danke. Die Pflegeberatung für Angehörige passt gut zu Ihnen.', en: 'Thank you. The advice service for family carers is a good fit for you.' },
        service: {
          id: 'mock_care',
          name: 'Pflegeberatung für Angehörige (Beispiel)',
          why: {
            de: 'Sie pflegen Ihren Mann zu Hause. Diese Stelle berät pflegende Angehörige.',
            en: 'You care for your husband at home. This service advises family carers.',
          },
          address: 'Musterweg 5, 97199 Ochsenfurt',
          phone: '+49 9331 000000',
          email: 'pflege@example.org',
          website: 'https://example.org/pflege',
          opening_hours: 'Di und Do 9–12 Uhr',
          languages: ['de'],
          // Extra fields: the card must render unknown fields gracefully (SPEC.md §11).
          cost: 'kostenlos (Beispiel)',
          appointment_needed: true,
        },
      },
    ],
  },
  jobcenter: {
    lang: 'en',
    keywords: /jobcenter|brief|letter|bescheid|formular|form|amt|ukrain|refugee|geflüchtet/i,
    turns: [
      {
        transcript: { de: 'Ich habe einen Brief vom Jobcenter bekommen und verstehe ihn nicht.', en: "I got a letter from the Jobcenter and I don't understand it." },
        reply: { de: 'Ich helfe Ihnen, die richtige Stelle zu finden. In welchem Ort wohnen Sie?', en: 'I can help you find the right place. Which town do you live in?' },
      },
      {
        transcript: { de: 'In Schweinfurt.', en: 'Schweinfurt.' },
        reply: { de: 'Danke. Die Migrationsberatung passt gut zu Ihnen.', en: 'Thank you. The migration advice service is a good fit for you.' },
        service: {
          id: 'mock_migration',
          name: 'Migrationsberatung Schweinfurt (Beispiel)',
          why: {
            de: 'Sie brauchen Hilfe mit einem Brief vom Amt. Diese Stelle hilft Menschen, die neu in Deutschland sind, mit Briefen und Formularen.',
            en: 'You need help with an official letter. This service helps people who are new to Germany with letters and forms.',
          },
          address: 'Beispielplatz 3, 97421 Schweinfurt',
          phone: '+49 9721 000000',
          email: 'migration@example.org',
          website: 'https://example.org/migration',
          opening_hours: 'Mo–Do 8–16 Uhr',
          languages: ['de', 'en', 'uk', 'ru'],
          target_group: 'Erwachsene mit Migrationsgeschichte (Beispiel)',
        },
      },
    ],
  },
  pregnancy: {
    lang: 'de',
    keywords: /schwanger|pregnan/i,
    turns: [
      {
        transcript: { de: 'Ich bin schwanger und weiß nicht weiter.', en: "I'm pregnant and I don't know what to do." },
        reply: { de: 'Danke, dass Sie das sagen. Sind Sie gerade in Sicherheit?', en: 'Thank you for telling me. Are you safe right now?' },
      },
      {
        transcript: { de: 'Ja. Ich wohne in Kitzingen.', en: 'Yes. I live in Kitzingen.' },
        reply: { de: 'Danke. Die Schwangerschaftsberatung passt gut zu Ihnen.', en: 'Thank you. The pregnancy advice service is a good fit for you.' },
        service: {
          id: 'mock_pregnancy',
          name: 'Schwangerschaftsberatung Kitzingen (Beispiel)',
          why: {
            de: 'Sie sind schwanger und suchen Rat. Diese Stelle berät Schwangere in allen Fragen.',
            en: 'You are pregnant and looking for advice. This service advises pregnant women on all questions.',
          },
          address: 'Musterstraße 9, 97318 Kitzingen',
          phone: '+49 9321 000000',
          email: 'beratung@example.org',
          website: 'https://example.org/schwanger',
          opening_hours: 'Mo–Fr 8–12 Uhr',
          languages: ['de', 'en'],
        },
      },
    ],
  },
  crisis: {
    lang: 'de',
    keywords: CRISIS,
    turns: [
      {
        transcript: { de: 'Ich will nicht mehr leben.', en: "I don't want to live anymore." },
        reply: {
          de: 'Ich höre Sie, und es ist gut, dass Sie sprechen. Wenn Sie in Gefahr sind, rufen Sie jetzt die 112. Der Krisendienst ist rund um die Uhr für Sie da: 0800 655 3000.',
          en: "I hear you, and it's good that you are talking. If you are in danger, call 112 now. The crisis service is there for you day and night: 0800 655 3000.",
        },
        service: {
          id: 'crisis_bayern',
          name: 'Krisendienste Bayern',
          why: {
            de: 'Sie sind in einer schweren Krise. Dort hilft Ihnen sofort ein Mensch, kostenlos und rund um die Uhr.',
            en: 'You are in a serious crisis. A person there helps you right away, free of charge, day and night.',
          },
          address: null,
          phone: '0800 655 3000',
          email: null,
          website: 'https://www.krisendienste.bayern',
          opening_hours: 'rund um die Uhr',
          languages: ['de'],
          urgent: true,
        },
      },
    ],
  },
  unclear: {
    lang: 'de',
    keywords: null,
    turns: [
      {
        transcript: { de: 'Keine Ahnung, mir wächst alles über den Kopf.', en: "I don't know, everything is too much for me." },
        reply: { de: 'Das klingt anstrengend. Geht es eher um Geld, um Gesundheit oder um die Familie?', en: 'That sounds exhausting. Is it more about money, health or family?' },
      },
      {
        transcript: { de: 'Eigentlich um alles, auch ums Geld.', en: 'Everything really, money too.' },
        reply: { de: 'Danke. In welchem Ort wohnen Sie?', en: 'Thank you. Which town do you live in?' },
      },
      {
        transcript: { de: 'In Karlstadt.', en: 'In Karlstadt.' },
        reply: { de: 'Danke. Die Allgemeine Sozialberatung passt gut zu Ihnen.', en: 'Thank you. The general social counselling service is a good fit for you.' },
        service: {
          id: 'mock_general',
          name: 'Allgemeine Sozialberatung Karlstadt (Beispiel)',
          why: {
            de: 'Bei Ihnen kommen mehrere Dinge zusammen. Diese Stelle hilft zuerst und vermittelt dann weiter.',
            en: 'Several things are coming together for you. This service helps first and then connects you further.',
          },
          address: 'Beispielgasse 2, 97753 Karlstadt',
          phone: '+49 9353 000000',
          email: 'sozial@example.org',
          website: 'https://example.org/sozial',
          opening_hours: 'Mo, Mi, Fr 9–12 Uhr',
          languages: ['de'],
        },
      },
    ],
  },
};

/** session_id -> { id: scenario id, turn: next turn index } */
const sessions = new Map();

function pageParams() {
  return new URLSearchParams(globalThis.location ? globalThis.location.search : '');
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function errorResponse(code) {
  return jsonResponse(ERROR_STATUS[code] || 500, { error: code, message: ERROR_MESSAGE[code] || ERROR_MESSAGE.internal });
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    }
  });
}

function guessLanguage(text) {
  return /[äöüß]|\b(ich|und|nicht|mein|meine|bin|habe|wohne|geld|ja|nein|bitte)\b/i.test(text) ? 'de' : 'en';
}

function pickScenario(text, params) {
  if (text) {
    for (const [id, sc] of Object.entries(SCENARIOS)) {
      if (sc.keywords && sc.keywords.test(text)) return id;
    }
    return 'unclear';
  }
  const wanted = params.get('scenario');
  return wanted && SCENARIOS[wanted] ? wanted : 'care';
}

/**
 * Drop-in replacement for fetch() in mock mode.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
export async function mockFetch(url, options = {}) {
  const params = pageParams();
  const path = new URL(url, 'http://mock.local').pathname;
  const method = (options.method || 'GET').toUpperCase();

  if (path.endsWith('/health')) {
    await wait(150, options.signal);
    return params.get('health') === 'down'
      ? errorResponse('internal')
      : jsonResponse(200, { ok: true });
  }

  if (!(path.endsWith('/talk') && method === 'POST')) {
    return jsonResponse(404, { error: 'internal', message: 'Unknown mock endpoint' });
  }

  await wait(Number(params.get('delay')) || 1500, options.signal);

  const forced = params.get('error');
  if (forced) return errorResponse(ERROR_STATUS[forced] ? forced : 'internal');

  const form = options.body instanceof FormData ? options.body : new FormData();
  const textRaw = form.get('text');
  const text = typeof textRaw === 'string' ? textRaw.trim() : '';
  const audio = form.get('audio');
  const language = form.get('language') || 'auto';
  const sessionId = form.get('session_id') || 'no-session';

  if (text && audio) {
    return jsonResponse(400, { error: 'internal', message: 'Send either audio or text, not both.' });
  }
  if (!text && (!audio || audio.size === 0)) return errorResponse('empty_audio');

  // Crisis words override any running scenario, like the real crisis guard should.
  let state = sessions.get(sessionId);
  if (text && CRISIS.test(text)) {
    state = { id: 'crisis', turn: 0 };
  } else if (!state) {
    state = { id: pickScenario(text, params), turn: 0 };
  }
  const scenario = SCENARIOS[state.id];
  const turn = scenario.turns[Math.min(state.turn, scenario.turns.length - 1)];
  sessions.set(sessionId, { id: state.id, turn: state.turn + 1 });

  const lang = language === 'de' || language === 'en' ? language : (text ? guessLanguage(text) : scenario.lang);
  const service = turn.service
    ? { ...turn.service, why: turn.service.why[lang] }
    : null;
  const replyText = service ? `${turn.reply[lang]} ${service.why}` : turn.reply[lang];

  return jsonResponse(200, {
    session_id: sessionId,
    transcript: text || turn.transcript[lang],
    detected_language: lang,
    reply_text: replyText,
    reply_audio_url: null,
    needs_more_info: !service,
    service,
  });
}
