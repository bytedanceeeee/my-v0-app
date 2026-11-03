# Inert Gas: St. Xavier's College (SXC) Confession Wall

An anonymous confession wall that runs as ONE Cloudflare Pages Worker file
(`dist/_worker.js`) with a D1 database. No accounts, no uploads, no third-party
code at all. The owner deploys by dragging `_worker.js` into the
Cloudflare Pages dashboard (Tor Browser + dashboard only, no command line).

Read this file first, then `ROADMAP.md` (what is built, and what is left for the owner).

## Status at hand-over

- `dist/_worker.js` is the current build. It matches `node build.js` output.
- hCaptcha is gone. The captcha is ALTCHA (self-hosted proof of work): `/api/altcha` issues a signed
  puzzle, the browser solves it in about a second, the server checks it once (replay blocked). No third
  party code, requests or variables. Secret is derived from `SALT` + `ADMIN_PASSWORD` (or optional `ALTCHA_HMAC_KEY`).
- New: no cap on messages to the admin. A network address is flagged and blocked only if it sends
  `flood_max` messages within `flood_window_sec` (default 100 in 200 s, editable, can be switched off).
  Admin deflags under Messages > Flagged, which resets the count. Address is logged.
- New: Admin > Filters. Editable word lists (trailing * = word endings, whole-word, Nepali works),
  on/off per rule, always-allowed phrases, urgent words for messages, per-rule "admin only" approval
  (moderators follow it), live sentence tester, reset to built-ins. Stored in settings `rules_v2`,
  `urgent_words`. Old `rules_json` terms are still imported.
- New: optional moderator applications (Settings toggle `mod_apply_on`). Apply button under the poll.
  SXC only: allowed email domains, optional roll-number pattern, optional access code, ID photo.
  Admin reviews under Team. ID photo deleted on accept or reject. Erase button wipes personal data.
- New: the site is called Inert Gas (SXC is kept in the text). Admin and moderator pages use the same indigo look.
- New: Admin > Content. Edit the rules, confess prompts, report reasons, privacy policy, announcement, moderator
  application questions and about 120 public texts. The text list lives in `src/text_registry.line.js`;
  `build.js` warns if the Wall (`src/web/`) uses a `data-tx`, `data-ph` or `T('key')` that is missing from it.
  Any new hard-coded visitor text must be tagged or wrapped in `T()` to be editable.
- New: Admin > Schedule. Weekly routines and one-off breaks in a chosen time zone. While the site is down,
  visitors get the "can't be reached" page. The admin path stays live. Uses the server clock, not the visitor's.
- New: daily share limit (`share_limit`, default 20 confessions per browser per day, editable in Settings).
- New: moderator chat. Rooms: Announcements (admin writes, moderators read), Moderator lounge, and a private line
  from each moderator to the admin. No moderator-to-moderator DMs. The admin sees ticks and who has seen each
  message; moderators never see read receipts. Polling is about every 2.5 s.
- New: Message the admin is a chat. The visitor sees double ticks on the admin's messages once the chat is opened.
- Reactions are five: heart (`like`), laughing, surprised (`wow`), sad, thumbs up (`up`).
- Tests (Miniflare + real D1 + headless Chromium), all pass:
  `backend` 105, `features` 109, `newfeatures` 124, `browser` 49, `features.browser` 86,
  `captcha` 6 (ALTCHA in a browser), `demo` 9.
- Gap: the earlier e2e and UI suites (schedule, content editor, mod chat, limits) were lost when a previous
  session ended. Mod chat, Schedule and Content have no dedicated automated tests yet. See ROADMAP.
- NOT tested (check on the real deployment):
  1. Moderator speed on the Workers FREE plan (see ROADMAP). 2. Real variables and D1 binding.
  3. Link previews in WhatsApp/Telegram. 4. Add to Home Screen on real phones.
  5. ID photo upload from real phone cameras (resized in the browser to about 1400 px JPEG).
  6. The email-domain check cannot prove mailbox ownership. The ID photo is the real proof.

## Layout

```
src/web/             Public Wall, 4 parts: head.html, style.css, body.html, app.js (vanilla JS, safe text-node rendering).
                     build.js glues them into one page. Fonts: assets/fonts/ via url(@font/NAME.woff2)
src/admin.html       Hidden admin page (path = ADMIN_PATH variable)
src/mod.html         Moderator page (default path /review, editable in admin Settings)
src/text_registry.line.js  One line: the list of editable public texts (see Admin > Content)
src/worker.src.js    Worker backend: routes, schema self-upgrade, filters, public API
src/review.src.js    Admin and moderator APIs (appended after worker.src.js by build.js)
build.js             Embeds the HTML into one file: dist/_worker.js, syntax-checks it,
                     and writes demo/*-demo.html (data-mode="demo")
dist/_worker.js      THE FILE THE OWNER UPLOADS
demo/                Double-click demos with fake data (share data through localStorage)
assets/              Home-screen icons (180, 192, 512 px), embedded as base64 by build.js
docs/OWNER_DEPLOY.md Owner-facing deploy steps
tests/               Backend, feature, browser, captcha-dialog and demo tests (Miniflare + Playwright)
```

The old `schema.sql` was removed on purpose. It was out of date. The real schema is the
`ensureSchema()` function in `src/worker.src.js` (tables are created and upgraded on the
first request, so the owner never pastes SQL).

## Build and test

```
npm install            # installs miniflare for the tests
node build.js          # or: npm run build   (no dependencies needed to build)
npm test               # build + all suites
```

Browser tests need Playwright with Chromium installed globally
(`npm root -g` must contain `playwright`; set `PLAYWRIGHT_BROWSERS_PATH` if needed).
Screenshots are written to `tests/out/`. The captcha test can also be pointed at an
older worker file to reproduce the bug it guards against:
`node tests/captcha.test.mjs path/to/old/_worker.js OLD`.

If `node` is blocked in your environment, call the runtime by its full path.
Never give the owner command-line steps. Owner flow is dashboard upload only.

## Deploy (owner, Cloudflare Pages dashboard)

1. Keep the previous `_worker.js` as a rollback copy.
2. Put the new `dist/_worker.js` alone in an empty folder (Windows must not add `.txt`).
3. Pages project > Deployments > Create deployment > drag the folder in.
4. Test: public Wall, `/demo`, hidden admin path, clean post, filtered post, report,
   moderator login at `/review`, kill switch, with the real ALTCHA check.

Required in the Pages project (Settings > Variables, production): `ADMIN_PASSWORD`, `ADMIN_PATH`,
`KILL_PHRASE`, `REVIVE_PHRASE`, `SALT`, and a D1 binding named exactly `DB`. `HCAPTCHA_*` are no longer
used and can be deleted. Variables apply only after a new deployment. Never ask for, store or commit the
owner's secrets. Do not run `wrangler login/deploy`.

## How it behaves (verified by tests)

- Visitors: post (captcha, 5-1000 chars, 30 min cooldown per browser, 25 posts / 30 min per
  network address), react (heart, laugh, surprised, sad, thumbs up), comment (2-300 chars, 2 min cooldown),
  report, daily mood vote, poll vote, poll idea. Clean posts appear after a random 2-3 minute
  delay. Posts matching the filter are archived for review, never published or silently removed.
- Filter (default rules in `DEFAULT_RULES`, editable in Admin > Filters): phone numbers, links, handles, emails, staff words, accusations,
  self-harm, minors, doxxing, abuse, threats, sexual. Admin can add more terms in Settings.
- One report hides a post for review by default (report threshold = 1, editable).
- Deletion is soft everywhere (row and IP kept). Network address is logged for posts, comments,
  poll ideas and messages, and the privacy policy says so. Admin sees addresses; moderators never do.
- Moderators can approve, archive or delete held items, but cannot approve items whose reason is
  self-harm, minor, doxxing, accusation, threat or sexual (admin only).
- Admin and moderator logins lock out for 15 minutes after 10 failures per network address.
- Kill switch: typing KILL_PHRASE as a confession turns the whole site into a 404. REVIVE_PHRASE
  posted to `/api/submit` while off turns it back on. The hidden admin page still loads while off.
- Security headers on every page: strict CSP (nothing allowed externally), nosniff,
  no-referrer, frame deny. All visitor text is rendered with text nodes, never as HTML.

## The captcha dialog note

The old hCaptcha pop-up forced `#composer`, `#suggest` and `#talk` to open as non-modal panels (`NM` set in
`src/web/app.js`). ALTCHA has no pop-up, so this is harmless and kept. Add any new dialog with a captcha to `NM`
anyway, for consistency.

## Known issues and decisions for the owner

- Helplines are the real Nepal lines (1166 and 1145, from findahelpline.com). If the owner already
  edited the helplines in Admin Settings, that edit is kept. Check the numbers once more before
  promotion, because lines can change.
- Talk-to-admin stores the network address with each message (same as confessions). The privacy policy
  says so (section "IP addresses are logged", editable in Admin > Content). If the owner prefers not to log it,
  remove the `ip` writes in `talkStart`/`talkSend` and edit the privacy policy text.
- A single character is accepted as a message to the admin (people may start with "hi"). An empty message is rejected.
- The urgent flag uses the same self-harm wording list as the filter, so softer phrases such as
  "I wish I was gone" are not flagged. Read every message, not only the urgent ones.
- Per-network-address limits could hit many students at once if the campus shares one address.
- The kill phrase needs a passing captcha. If the captcha ever fails, use the admin Kill toggle.
- Internal names such as `jbs_admin` (sessionStorage key) and the `x-jbs-mod-user` header still
  say "jbs". Not visible to visitors. The Worker rewrites old visible labels to the new college
  name in `brand()`.
- The three demo pages link to each other with absolute paths (`/wall-demo.html`), which only
  work when served from a site root, not when double-clicked from disk.
- Accounts, profiles and direct messages were removed from this version (the worker comments
  say so). The older notes that described them were deleted from this package.

## Hard rules from the owner (keep them)

1. No secrets in the project. 2. No third-party code, requests, fonts, analytics, images or
embeds at all (hCaptcha was removed). 3. Keep the visible notice (privacy policy) that the network address of confession,
comment, poll-idea and message senders is logged and may be given for a legitimate legal request.
4. Filtered writing is archived for review. 5. Soft deletion only. 6. Keep the hidden admin path,
kill and revive phrases and the 404 behaviour. 7. Render visitor text with text nodes only.
8. No uploads or location features. 9. No em dashes anywhere (code, docs, UI).
