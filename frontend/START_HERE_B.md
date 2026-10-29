# Start here — B · Interface (Gemini)

You own four files: `index.html`, `styles.css`, `js/i18n.js`, `js/ui.js`.
Don't edit any other file; if you need a change there, tell Aryan (A, engine).
Full task list: `AI_Service_Navigator_Task_Split.pdf`, page 1, column B.

## 1. Get the code
**Option 1 — Git (preferred: you can pull and push).** Accept the GitHub invite from Aryan, then:
```bash
git clone https://github.com/ARYANS-USERNAME/ai-service-navigator.git
cd ai-service-navigator
git checkout -b interface
```
You don't need this zip if you use Git.

**Option 2 — Start right now from this zip.** Unzip it and open a terminal in the `ai-service-navigator` folder.
Once you have repo access, clone as in Option 1 and copy your four files across.

## 2. Run it
```bash
python3 -m http.server 5500        # Windows: py -m http.server 5500
```
Open http://localhost:5500/?mock=1 and type "Ich zock zu viel" to see the whole flow, no backend needed.

| Test this | URL |
|---|---|
| Error state | `?mock=1&error=server_busy` |
| Backend down banner | `?mock=1&health=down` |
| Slow backend | `?mock=1&delay=6000` |
| Extra service fields | type "Meine Mutter ist pflegebedürftig", then "Ja, in Ochsenfurt" |
| Crisis | type "Ich will nicht mehr leben" |

## 3. Start Gemini
In a second terminal, in the same folder, run `gemini`. It reads `GEMINI.md` and `AGENTS.md` automatically.
First message:

> Read GEMINI.md, AGENTS.md, CONTRACT.md and SPEC.md (sections 4, 7, 8). index.html, styles.css and js/ui.js
> are plain skeletons: replace them with the real interface. Keep js/ui.js exporting exactly the functions in
> CONTRACT.md and keep every string in js/i18n.js. Vanilla HTML, CSS and JS: no build step, no CDN, no web fonts,
> inline SVG icons. Meet SPEC.md §8: 18 px base text, A−/A+ up to 200 %, 48 px touch targets, a 96 px talk button
> with icon, label and colour for each state, an aria-live conversation list, aria-pressed with state-based
> labels, visible focus, light and dark mode, reduced motion, no horizontal scroll at 360 px. Test with
> http://localhost:5500/?mock=1. Never edit app.js, js/api.js, js/mock.js, js/recorder.js or js/player.js.

## 4. Stay in sync
- Every 20–30 minutes: `git add -A && git commit -m "ui: what works now" && git push origin interface`
- Merge points 12:30 · 14:00 · 14:30 · 15:30: Aryan merges into `main`; then you run
  `git fetch origin && git merge origin/main`.
- No Git yet? At each merge point, send Aryan your four files.

## 5. Must-knows
- `js/ui.js` is the only code that touches the page; the engine calls its functions (see `CONTRACT.md`).
- Every visible text goes into `js/i18n.js`, German and English.
- The notice banner with 112 and the Telefonseelsorge number stays visible in every state.
