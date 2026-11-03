# How to use this zip with v0.app

1. Go to v0.app, start a new chat, and attach **this zip** (or import it as a project).
2. Paste the contents of **`PROMPT_FOR_V0.md`** as your message.
3. Let v0 work. If v0 tries to rebuild the site in Next.js/React, reply: *"No. Keep vanilla HTML/CSS/JS in src/web/ exactly as the brief says."*
4. Download v0's result and copy the changed files back over this project (`src/web/*`, `assets/fonts/*` if added).
5. On your computer run:

```
npm install            # only needed once, for the tests
node tools/contract-check.mjs   # must say: All contract checks passed
node build.js          # makes dist/_worker.js and demo/*.html
```
6. **Open `demo/wall-demo.html` by double-clicking it.** It runs the whole wall with a fake backend, no server needed. That is your preview.
7. Upload `dist/_worker.js` to Cloudflare Pages as described in `docs/OWNER_DEPLOY.md`.

## What is in here
| Path | What it is |
|---|---|
| `PROMPT_FOR_V0.md` | The message to paste into v0 |
| `DESIGN_BRIEF.md` | The full binding design spec (art direction, tokens, screens, rules) |
| `src/web/style.css` | **The design.** All CSS of the public Wall |
| `src/web/body.html` | The markup (header, feed, widgets, bottom nav, 14 dialogs) |
| `src/web/head.html` | `<head>`: meta tags, theme bootstrap. Keep the markers |
| `src/web/app.js` | App logic and the render templates. Logic is frozen |
| `assets/fonts/` | 10 bundled open-licence fonts + `FONTS.md` (how to use) |
| `tools/contract-check.mjs` | Guard: fails if the redesign breaks the site |
| `tools/contract-baseline.json` | Snapshot of every id / text key / hook that must survive |
| `demo/wall-demo.html` | Current look, double-click preview (rebuilt by `node build.js`) |
| `dist/_worker.js` | The deployable single file (backend + current front end) |
| `src/worker.src.js`, `src/review.src.js` | Backend. Frozen. 338 backend tests pass |
| `tests/` | Test suites (Miniflare + Chromium) |

The Wall is now split into four source files so v0 can edit CSS and markup separately. `node build.js` glues them back into the one file.
`src/index.html` no longer exists, on purpose.
