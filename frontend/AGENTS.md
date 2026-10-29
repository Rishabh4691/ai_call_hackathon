# AGENTS.md — rules for every AI working in this folder

## Project
AI Service Navigator for the Caritas challenge "No wrong door to support" (InclusivAI Hackathon, 29 Oct 2026).
A single web page where a person speaks German or English and is guided to the one support service that fits,
with a short reason why. The assistant never counsels; it only routes.

- Full requirements: `SPEC.md`
- Interface between the two halves of the code: `CONTRACT.md`

## Team and file ownership (most important rule)
| Person | Tool | Owns |
|---|---|---|
| A — Engine | Claude Code | `app.js`, `js/api.js`, `js/recorder.js`, `js/player.js`, `js/mock.js`, shared docs |
| B — Interface | Gemini | `index.html`, `styles.css`, `js/i18n.js`, `js/ui.js` |

- Only edit files your person owns. If a change is needed in the other person's file, stop and describe the
  change instead of making it.
- Never change `CONTRACT.md` on your own; A and B agree first.
- `js/ui.js` is the only code that touches the DOM. `app.js` imports `js/ui.js`; `js/ui.js` never imports `app.js`.

## Hard constraints (SPEC.md §2 and §9)
- Plain HTML, CSS and JavaScript ES modules. No build step, no npm packages, no frameworks.
- No CDN, no web fonts, no external requests except the backend at `API_BASE`. System fonts, inline SVG icons.
- Serve over localhost: `python3 -m http.server 5500` in this folder, then open http://localhost:5500/?mock=1
  (ES modules and the microphone do not work from file://).
- Never invent service data, phone numbers or addresses. Contacts come only from the backend, or from
  `js/mock.js` in mock mode.
- The notice banner (no counselling; 112; Telefonseelsorge) stays visible in every state.

## Code style
- ES2020+, `const`/`let`, small functions, JSDoc on every exported function.
- Modules only, no globals. `localStorage` access always inside try/catch.
- Every user-facing string lives in `js/i18n.js` (`de` and `en`). No visible text in markup or in A's files.
- Accessibility (SPEC.md §8) is part of "done", not polish.

## Workflow
- Small commits that say what works, e.g. `ui: service card renders unknown fields`.
- A works on branch `engine`, B on `interface`. Merges into `main` at 12:30, 14:00, 14:30 and 15:30.
- Before every new task: `git fetch origin && git merge origin/main`.
- After every change: test with `?mock=1` and keep the browser console free of errors.
