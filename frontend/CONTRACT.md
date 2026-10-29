# CONTRACT.md — the seam between A (engine) and B (interface)

Change this file only after A and B have agreed. A edits it, both pull.

## Ownership and dependency direction
| Files | Owner | Role |
|---|---|---|
| `index.html`, `styles.css`, `js/i18n.js`, `js/ui.js` | B | Everything the user sees. The only code that touches the DOM. |
| `app.js`, `js/api.js`, `js/recorder.js`, `js/player.js`, `js/mock.js` | A | State, audio, backend, mock mode. Never touches the DOM. |
| `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `CONTRACT.md`, `SPEC.md`, `README.md` | A | Shared docs, changed only by agreement. |

`app.js` imports `js/ui.js`, `js/api.js`, `js/recorder.js`, `js/player.js`.
`js/ui.js` imports `js/i18n.js` only. It never imports `app.js`; it calls the handlers passed to `init()`.

## `js/ui.js` exports — B implements, A calls

```js
init(handlers)
// handlers, all provided by app.js:
//   talkDown()               pointerdown on the talk button
//   talkUp()                 pointerup or pointercancel on the talk button
//   talkToggle()             keyboard activation of the talk button (a click with event.detail === 0)
//   sendText(text)           text fallback submitted (trimmed, non-empty)
//   replay(audioUrl, text)   replay button on an assistant bubble (audioUrl may be null)
//   stop()                   Esc key, or the Stop action while speaking
//   startOver()              Start over button
//   retry()                  Retry button in the error state
//   languageChanged(lang)    DE/EN toggle used: 'de' | 'en'

setState(state, detail = {})
// state:  'idle' | 'listening' | 'thinking' | 'speaking' | 'error'
// detail: { seconds }  listening time so far (listening)
//         { level }    microphone level 0..1, may be absent (listening)
//         { error }    error code from the table below (error)

addUser(text)                  // user bubble: transcript or typed text
addAssistant(text, audioUrl)   // assistant bubble with a replay button
addService(service)            // service card; newest highlighted, earlier cards stay in the history
setBackendOk(ok)               // false: show a "service not reachable" banner
clear()                        // empty the conversation (Start over)
languagePref()                 // 'auto' | 'de' | 'en'; 'auto' until the user has used the toggle
```

Hold versus tap is decided in `app.js`, not in `js/ui.js`: `ui.js` only reports `talkDown`/`talkUp`
and keyboard `talkToggle`. A press released within about 400 ms is a tap (toggle mode); a longer press is
hold-to-talk. Pressing while the assistant speaks stops playback and starts recording (barge-in).

## Error codes — B writes one DE and one EN message for each in `js/i18n.js`
| Code | Raised by | Meaning |
|---|---|---|
| `empty_audio` | backend or recorder | No audio was recorded |
| `no_speech` | backend | Audio contained no recognisable speech |
| `server_busy` | backend | Backend overloaded, try again |
| `internal` | backend or api.js | Anything else that went wrong |
| `mic_denied` | recorder.js | The user or browser blocked the microphone |
| `mic_unavailable` | recorder.js | No microphone, or recording not supported |
| `network` | api.js | Backend not reachable |
| `timeout` | api.js | No answer within 60 s |

## Backend API (SPEC.md §6, unchanged)
- `POST /talk`, multipart form: `audio` (webm/opus or wav, max 30 s) **or** `text`; `language` (`auto` | `de` | `en`);
  `session_id` (UUID made on page load, new one on Start over).
- 200 response: `session_id`, `transcript`, `detected_language`, `reply_text`, `reply_audio_url`,
  `needs_more_info`, `service` (null until a recommendation is ready).
- `GET /audio/{id}.wav` returns the spoken reply. `GET /health` returns `{"ok": true}`.
- Errors: non-2xx with `{"error": "<code>", "message": "..."}`.

## Service object
```json
{ "id": "...", "name": "...", "why": "...", "address": "...", "phone": "...", "email": "...",
  "website": "...", "opening_hours": "...", "languages": ["de", "en"] }
```
Any field may be null. Extra fields may appear (for example `cost`, `appointment_needed`, `target_group`):
render them as simple label/value rows instead of hiding them.

## Mock mode (`js/mock.js`)
| Page URL parameter | Effect |
|---|---|
| `?mock=1` | Canned replies; no backend needed |
| `&scenario=<id>` | Scenario for voice turns: `gambling`, `care`, `jobcenter`, `pregnancy`, `crisis`, `unclear` (default `care`). Typed text picks a scenario by keywords. |
| `&error=<code>` | Every `/talk` call fails with that code |
| `&health=down` | `GET /health` fails |
| `&delay=<ms>` | Simulated thinking time, default 1500 |

In mock mode `reply_audio_url` is `null`; `js/player.js` may read `reply_text` aloud with the browser's
speechSynthesis so the speaking state can be tested. All mock services are fictional examples, except the
real crisis line (Krisendienste Bayern, 0800 655 3000).
