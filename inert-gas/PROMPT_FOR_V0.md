# Paste this into v0.app (then attach the zip, or open the project)

You are the lead product designer and front-end engineer for **Inert Gas**, an anonymous confession wall for
St. Xavier's College (SXC), Maitighar, Kathmandu. The backend is finished, tested and frozen. **Your only job is to
make the front end the best it can be.** Premium, distinctive, unmistakably designed by a human with taste. Not a template.

**Read `DESIGN_BRIEF.md` first. It is the full spec and it is binding.** Then work in `src/web/` only:
`style.css` (the design), `body.html` (the markup), `head.html`, and the render templates inside `app.js`.

Hard rules (the full list is in the brief):
1. Keep it **vanilla HTML, CSS and JS**. Do NOT convert to React, Next.js, Tailwind or any framework. Do not add npm packages.
2. **Do not change app logic** (fetching, state, captcha, timers, dialogs). You may restyle and restructure markup, and edit
   the HTML strings inside the render functions of `app.js`, but every `id`, every `data-*` hook and every `data-tx` / `data-ph` / `T('key')` must survive.
3. **Nothing from the internet**: no Google Fonts, no CDNs, no remote images. Use only the fonts in `assets/fonts/` via
   `url(@font/NAME.woff2)`, inline SVG, and CSS. The site's security policy blocks everything else.
4. Both **dark and light** themes must be fully designed (not an inversion). Mobile first, then desktop. Respect `prefers-reduced-motion`.
5. After editing run `node tools/contract-check.mjs`. It must print "All contract checks passed".
6. Do not touch `src/worker.src.js`, `src/review.src.js`, `tests/`, or `src/admin.html` / `src/mod.html`.

Art direction in one breath: **a late-night confession booth, typeset like a literary magazine, lit by a single noble-gas
tube.** Warm near-black, paper-warm light mode, one hot discharge-lamp accent, a characterful serif for confessions,
a mono for metadata, generous negative space, tactile cards, and motion that feels like a lamp flickering on.
Absolutely none of: purple/indigo gradients, glassmorphism everywhere, centered hero with a blurry blob, identical rounded
shadow cards, emoji as icons, Inter-everything, "Welcome to the future of..." copy.

Deliver finished work: every state, every dialog, empty/loading/error states, hover/focus/active, both themes, 360px to 1440px.
When done, summarise the design system you built (tokens, type scale, spacing, motion) in 10 lines.
