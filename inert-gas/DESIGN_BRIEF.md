# Inert Gas: Front-end Redesign Brief (binding)

**Mission: make the front end the best it can be.** Premium, finished to the last pixel, with a point of view.
The current UI is a generic dark-indigo card feed that reads as machine-made. Replace it with something a design-literate
student would screenshot and share. The backend is done and frozen.

---
## 1. What this product is
Inert Gas is an anonymous confession wall for **St. Xavier's College (SXC), Maitighar, Kathmandu**. Students write a
confession, nobody sees who wrote it, moderators approve it, the community reacts. Also: a private chat with the admin,
a daily poll, a mood check-in, helplines, and optional moderator applications.

Audience: 17-24 year olds, mostly **on mid-range Android phones**, often on slow or metered data, some on **Tor Browser**
(privacy is the product). Text is English with some Nepali (Devanagari). Tone: honest, a little tender, a little funny, never corporate.
The name: noble gases are inert, they do not react, they sit quietly, and glow only when you pass a current through them.
A confession wall is the same: quiet until someone says something true.

## 2. Art direction (the idea; you own the execution)
**"A late-night confession booth, typeset like a literary magazine, lit by one noble-gas tube."**

- **Dark theme = the night.** Warm near-black (think ink with a trace of brown or green, NOT blue-black and NOT #000), never a flat grey.
  Surfaces differ by tone and fine hairlines, not drop shadows. One hot **discharge-lamp accent** (neon orange-red, argon lilac-pink,
  or xenon ice, pick ONE hero colour and defend it) that appears sparingly and can *glow* (soft `box-shadow`/`text-shadow` bloom) on the primary action,
  the focused field, a new-confession marker and the live dot.
- **Light theme = the paper.** Warm uncoated-paper off-white (not #fff, not cool grey), ink-black text with real contrast,
  the same accent deepened so it passes contrast on paper. It should feel like a printed zine, not "dark mode inverted".
- **Confessions are the hero.** A confession is a typeset slip: generous measure (about 60-68ch), large serif with good leading,
  a small mono caption row (time, flair, number), reactions as a quiet row beneath. Think index card, ticket stub, pinned note, or magazine pull-quote. Vary rhythm: not every post is an identical rounded box.
  Consider a drop-cap or oversized opening quote mark on long ones, a hairline "perforation" or notch, a slightly different treatment for the Confession of the Day.
- **Typography does the heavy lifting.** One characterful display/serif for confessions and headings, one clean UI sans, one mono for metadata.
  Use `assets/fonts/` (see `assets/fonts/FONTS.md`). Real type scale (e.g. 12 / 14 / 16 / 19 / 24 / 34 / 52), optical sizing, tight display tracking, proper small-caps/mono labels, tabular numerals for counts.
  Nepali text must still look good: keep a Devanagari-capable fallback and avoid negative letter-spacing on body text.
- **Brand mark.** Replace the plain rounded "IG" square with a real wordmark/mark drawn in inline SVG (an "Ig" ligature, a tube/electrode glyph, a glowing dot,
  a stylised noble-gas "atom with a closed shell"). Small, crisp, works at 20px and on the home-screen icon colour.
- **Texture, tastefully.** A barely-there grain (inline SVG `feTurbulence` as a data-URI background at 3-6% opacity), a vignette, hairline rules, a faint
  scanline or "glass tube" highlight on the primary button. Never noisy, never hurting text contrast or scroll performance.
- **Motion = a lamp warming up.** New items fade/rise with a brief flicker-in; the reaction you tap gets a tiny glow pulse; dialogs ease from the bottom on mobile; skeletons shimmer slowly.
  120-260 ms, ease-out curves, no bounce. Everything wrapped in `@media (prefers-reduced-motion:reduce)` to be instant.

### Banned (this is what "AI-generated" looks like)
Purple/indigo-to-blue gradients, gradient text, glassmorphism on everything, a blurred colour blob behind a centred hero, a grid of identical `border-radius:16px`
shadowed cards, emoji as UI icons, Inter/system-ui only, `box-shadow: 0 4px 6px rgba(0,0,0,.1)` look, pill buttons everywhere, 3-column feature grids, fake testimonials/stats,
corporate microcopy ("Unlock", "Seamless", "Empower"), neon-on-black cyberpunk cliché, stock gradients from Tailwind docs. If a choice is the default one, make a better one.

## 3. Hard constraints (breaking these breaks the site)
1. **Vanilla only.** HTML + CSS + JS in `src/web/`. No React/Next/Tailwind/npm packages. The result is embedded into one Cloudflare Worker file.
2. **No network assets.** The server sends `default-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-src 'none'`.
   No Google Fonts, CDNs, remote images, analytics, or `@import`. Icons and art = inline SVG / CSS. Fonts = `url(@font/NAME.woff2)` from `assets/fonts/` (embedded at build time). **Font budget 260 KB total** (aim 100-150 KB).
3. **Do not change behaviour.** Logic in `app.js` (state, fetch, captcha, polling, dialogs, keyboard shortcuts) is frozen. You MAY edit:
   `style.css` freely; `body.html` markup/structure; `head.html` (keep markers); and the **HTML strings in render functions** of `app.js` (post card, comments, widgets, toasts, skeletons) to give new markup.
   If you rename/restructure markup, update every selector in `app.js` that targets it.
4. **Every `id`, every `data-*` hook, every `data-tx` / `data-ph` / `T('key')` must survive.** `tools/contract-baseline.json` lists them (177 ids, 122 editable-text keys, 9 data hooks). Visitor-facing text is editable by the admin through those keys, so never hard-code a new visitor string; wrap it with `data-tx="key"` and add the key to `src/text_registry.line.js`, or leave existing copy as is.
5. Keep in `head.html`: `<!--og-->`, `data-mode="live"`, the `xv_theme` bootstrap script, manifest and apple-touch-icon links, `viewport-fit=cover`, `theme-color` (update the colour to match your dark background; the JS may also set it).
6. Keep `[hidden]{display:none!important}`, `.sr-only`, `:focus-visible` styling, `prefers-reduced-motion` handling, both `data-theme` values (`dark` default, `light`).
7. Accessibility is a feature: WCAG AA contrast for all text in both themes (4.5:1 body, 3:1 large/UI), visible focus rings that fit the style, touch targets at least 44x44px, dialogs keep `aria-labelledby`, never rely on colour alone (reactions and flairs need icon or text too).
8. Performance: whole page must stay snappy on a 3-year-old Android. Avoid `backdrop-filter` on large/scrolling areas, animate only `transform`/`opacity`, no JS animation libraries, no huge SVG filters on scrolling content (apply grain to a single fixed pseudo-element).
9. Do not edit: `src/worker.src.js`, `src/review.src.js`, `tests/*`, `src/admin.html`, `src/mod.html`, `build.js`.

## 4. Screens and components to design (all of them, with states)
Read `src/web/body.html` (markup) and the render functions in `src/web/app.js`. Design each at **360px, 768px, 1280px+**, **dark and light**.

**A. Header / top bar**: brand mark + "Inert Gas" + "Confessions - St. Xavier's College (SXC)", Rules, Helplines, keyboard-help, theme toggle, "Message the admin" (with unread dot `#talk-dot`), primary **Confess**. On mobile, collapses to brand + theme toggle.
**B. Mobile bottom nav** (`.bnav`): Wall, Today, centre **FAB** (Confess), Message (with dot), Rules. Safe-area aware. Make the FAB a signature element (the glowing tube).
**C. Hero / quick composer** (`#quick`, `.prompt-card` `#w-prompt`): the daily prompt and a tap-to-write field. This is the front door. Make it feel like opening a confession slip, not a chat input. No marketing hero.
**D. Feed controls**: sort tabs (Latest / Trending / Top / Random), flair filter (`#flair-f`), range select (`#range-f`, shows only for Top). Sticky on scroll, compact. Style the native `<select>`s to match without breaking them.
**E. Confession card**: the hero component. Time, flair (Exams, Canteen, Shout-out and more: each needs a distinct but harmonious colour in both themes, tokens `--f-*`), body text (preserve line breaks, Nepali, long words; "Read more" for long posts), the five reactions (heart `like`, laugh, surprised `wow`, sad, thumbs-up `up`, colours `--r-*`, with counts and an active state), comments count/thread, share, report. Plus states: new, hot/trending, pinned, own-post marker, reacted, skeleton loading, empty feed, end of feed, load-more, error and offline.
**F. Aside widgets** (desktop right column, mobile "Today" view): Announcement (`#w-ann`), **Confession of the Day** (`#w-cotd`, make it special), Mood check-in (stressed / tired / hopeful / chaotic, with live bars), Weekly mood (`#w-week`), Poll with results bars, moderator-apply button.
**G. Dialogs / sheets** (14, all `<dialog>`): composer (flair picker, prompts, char counter, ALTCHA captcha row, send/anon reassurance), report, share (image/link), single-confession view, suggest, moderator apply (multi-field + photo), rules, privacy, talk-to-admin **chat** (bubbles, double ticks), helplines (serious, calm, high-trust styling: this one is for people in distress), announcement, flair-ask, keyboard help. Bottom sheets on mobile with grab-handle, centred modals on desktop, tasteful `::backdrop`.
**H. Feedback**: toasts (`#toasts`), validation errors, captcha solving state, rate-limit and "site is down" screens, loading skeletons, the `noscript` notice.
**I. Details**: favicon-colour consistency (`theme-color`), selection colour, scrollbar styling, custom caret colour, subtle link style, form controls (inputs, textareas, checkboxes, radios, range) all restyled, custom focus ring.

## 5. Content and voice
Keep all existing copy unless it is clearly bad. If you improve microcopy, edit the registry default so admin editing still works, and keep it plain, warm, short, human. Never joke on helplines, reports, or privacy.
Trust is the product: wherever you can, quietly reinforce *"nobody sees who wrote this"* through design (a small lock/hush glyph, calm language), without lecturing.

## 6. Design system to produce (inside `style.css`, at the top)
Tokens as CSS custom properties for both themes: colour (bg, surface 1-3, hairline, text, muted, accent + accent-soft + accent-glow, danger, ok, flair, reaction),
type (families, 7-step scale, line-heights), space (4px base, 8-step), radius (2-3 values, with a point of view, e.g. mostly small radius + a few notched/clipped shapes), elevation (tone-based), motion (durations and easings), z-index layers.
Keep the existing token **names** that `app.js` or other pages read (`--accent`, `--accent-text`, `--bg`, `--surface`, `--surface-2`, `--line`, `--text`, `--muted`, `--danger`, `--ok`, `--r-*`, `--f-*`, `--sans`, `--serif`, `--radius`, `--nav-h`); add new ones freely.

## 7. Definition of done (check every line)
- [ ] `node tools/contract-check.mjs` prints **All contract checks passed**
- [ ] No request leaves the page: no `http(s)://` in CSS/HTML/JS assets, fonts all via `@font/`
- [ ] Dark and light are both finished, each with their own personality and passing AA contrast
- [ ] 360px, 390px, 768px, 1024px, 1280px, 1440px all look intentional; no horizontal scroll; safe-area insets handled
- [ ] Every dialog and every state in section 4 is designed (empty, loading, error, offline, disabled, active, focus, hover)
- [ ] Keyboard: tab order sane, focus ring visible everywhere, `Esc` closes dialogs, shortcuts overlay still works
- [ ] `prefers-reduced-motion` removes all non-essential animation
- [ ] A 12-line summary at the end: palette (hex), fonts used and total KB, type scale, spacing, motion, and what you changed in `app.js` templates
- [ ] Looks like nothing else on the internet, and nobody would guess an AI made it

## 8. How it gets verified after you finish
The owner runs `node build.js`, opens `demo/wall-demo.html`, then runs the full test suite (backend 338 checks plus Chromium UI tests that click through the real DOM by id and class).
Anything that renames a hook without updating `app.js` will fail those tests, so run the contract check before you hand back.
