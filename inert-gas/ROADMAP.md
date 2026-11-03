# Roadmap

All items approved by the owner earlier are BUILT and tested (see README status). Nothing from the
old list is pending in code. What is left is owner-side checking, and optional ideas.

## Owner checks before promoting the site (cannot be done outside Cloudflare)
1. Deploy `dist/_worker.js` (see `docs/OWNER_DEPLOY.md`) and test posting, the ALTCHA tick box on phone and desktop, and the Message the admin dialog.
2. Confirm the moderator pages are fast enough on the Workers FREE plan. If you see Error 1102,
   upgrade the plan or ask for a lighter moderator login.
3. Paste a `/p/<id>` link into WhatsApp and Telegram to confirm the preview card shows.
4. On a phone, add the site to the home screen and check the icon.
5. Confirm the two helplines are still correct (1166, 1145).
6. Decide whether talk-to-admin should keep logging the network address (it does now, with a
   visible notice). Changing it means editing the worker and the three notice texts.
7. Set a weekly theme and prompt in Admin Settings, and decide who answers Messages and how often.

8. Admin > Settings: turn on moderator applications, set the college email domain (strongly recommended),
   optionally a roll-number pattern and an access code. Test one application end to end, including the ID photo.
9. Admin > Filters: read the built-in lists once, add Nepali and campus-specific words, add always-allowed phrases.
10. Admin > Settings: confirm the message flood numbers (100 messages in 200 seconds).

11. Admin > Content: read the privacy policy and rules once. Admin > Schedule: set the time zone, then test a one-off break.
12. Admin > Mod chat: post one announcement and confirm a test moderator sees it.

## Developer to-do (code side)
- Rebuild automated tests for Schedule, Content editor, mod chat and the share limit (earlier versions were lost).
- Review the moderator sign-in and the Content editor's "Reset to default" in a real browser.
- Package the source (`src/`, `tests/`, `build.js`) in version control or a zip after each change.

## Optional ideas (not approved, not built)
- Admin email or push alert for urgent messages (needs a third party, so it conflicts with the
  no-third-party rule unless the owner allows it).
- Softer wording for the urgent flag (now editable in Admin > Filters).
- Auto-close conversations after 30 days of silence.

## Reminder when adding anything new
Extend `TAGS` in both the worker and `src/web/app.js`, mirror new endpoints in the demo backend inside
`src/web/app.js`, add any dialog with a captcha to the `NM` set, and extend the tests. No em dashes.
