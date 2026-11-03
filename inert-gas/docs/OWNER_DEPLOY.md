# Deploying Inert Gas (SXC Confession Wall)

Use Tor Browser and the Cloudflare Pages dashboard only. Do not use the command line or connect this project to a personal code account.

1. Keep the previous `_worker.js` somewhere safe as a rollback copy.
2. Put the new `dist/_worker.js` in an empty folder. Confirm Windows did not add `.txt` to the filename.
3. In Cloudflare Pages, open the project, choose **Deployments**, then **Create deployment**.
4. Drag in the folder containing `_worker.js`, then deploy it.
5. The Worker upgrades the database itself. You do not need to run SQL in D1.
6. Test the public Wall, `/demo`, the hidden admin path, clean posting, filtered posting, reporting and the kill switch before sharing the link.

The existing production variables (except the hCaptcha ones, which you can delete) and the D1 binding `DB` are still required. Variables apply only after a new deployment.

## New in this version
- Shared links look like `/p/<number>` and show a preview card in chat apps.
- The site can be added to a phone home screen.
- Admin has a new Messages tab. Visitors can write to you privately, so check it regularly.
- Admin Settings has a weekly theme and prompt. Leave them empty to hide the card.
- hCaptcha is replaced by a private check built into the site. No keys needed.
- Messages to you have no cap. Anyone sending 100 messages in 200 seconds is flagged; deflag under Messages > Flagged.
- New Filters tab: you control what gets held. New optional moderator applications (Settings, then Team).
- Test posting, a message, and one test application before sharing the link.
- The site is now called Inert Gas. Admin and moderator pages match its colours.
- Admin > Content: edit the rules, prompts, report reasons, privacy policy, announcement, application questions and most public wording without touching code. Each item has a Reset to default button.
- Admin > Schedule: set weekly opening hours or one-off breaks. When the site is closed, visitors see the "can't be reached" page. Your admin page still works. Set the time zone first (Nepal is UTC+5:45).
- Admin > Settings: daily share limit per person (default 20).
- Admin > Mod chat: post announcements to moderators, read the lounge, and talk privately with each moderator. You can see who has read a message. Moderators cannot see each other's private chats with you.
- Visitors see double ticks on your replies once they open the chat.
- Test the schedule, one announcement and one moderator login before sharing the link.
