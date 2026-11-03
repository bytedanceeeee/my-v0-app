
// Source only. Run build.js to create dist/_worker.js.
// Accounts, nicknames and direct messages were removed in this release.
const MIN = 60000,
  enc = new TextEncoder(),
  CID = /^[a-z0-9]{16,64}$/,
  TAGS = ["funny", "crush", "rant", "advice", "wholesome", "exams", "canteen", "shoutout", "other"],
  REACTIONS = ["like", "laugh", "wow", "sad", "up"],
  MOODS = ["stressed", "tired", "hopeful", "chaotic"],
  RANGES = { day: 86400000, week: 7 * 86400000 },
  SITE_NAME = "St. Xavier's College (SXC)",
  SITE_BRAND = "Inert Gas",
  OLD_HELPLINES = '["Local support contact: add a verified number in Admin settings"]',
  DEFAULT_HELPLINES = JSON.stringify([
    "1166 National Suicide Prevention Helpline (११६६ आत्महत्या रोकथामको लागि राष्ट्रिय हेल्पलाईन) | 1166 | Free, confidential, open 24/7",
    "Khabar Garaun 1145 Helpline | 1145 | Free and confidential, 24/7, by phone and SMS",
  ]);
const HTML_HEADERS = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "content-security-policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; frame-src 'none'; connect-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'self'",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
};

// ---------- Editable site content (defaults; the admin can change all of it under Admin > Content) ----------
const DEFAULT_SITE_RULES = [
  "No real names, nicknames, initials or descriptions that point to a person.",
  "No staff. Do not mention or describe teachers, staff or administrators.",
  "No accusations of crimes, cheating or misconduct against anyone.",
  "No phone numbers, emails, social handles, room numbers or roll numbers.",
  "No links of any kind.",
  "No bullying, mocking or targeting anyone.",
  "No hate based on religion, caste, ethnicity, gender, sexuality or disability.",
  "No sexual content. Keep crushes sweet and general.",
  "Nothing involving minors in any unsafe situation.",
  "No threats, even as a joke.",
  "No self-harm content. If you are struggling, open Helplines.",
  "No doxxing or hints about where someone lives or sits.",
  "No impersonating another student, group or club.",
  "No spam, chain posts or repeated posts.",
  "No selling, ads or promotions.",
  "No leaked exam papers, answers or private documents.",
  "No sharing other people\u2019s secrets or private chats.",
  "Be kind in comments. Disagree without insults.",
  "Report instead of retaliating.",
  "Do not try to work out who wrote a confession.",
  "Do not ask people to reveal themselves.",
  "Keep it about campus life, feelings and funny moments.",
  "Write in a way you would be okay with anyone reading.",
  "Posts that break the rules are held for review or removed.",
];
const DEFAULT_PROMPTS = [
  "The most chaotic thing I did this semester was",
  "Something I have never told my friends is",
  "My biggest exam day mistake was",
  "I secretly love it when",
  "The canteen moment I will never forget is",
  "If I could redo first year, I would",
  "A small thing that made my week better was",
  "My unpopular opinion about college life is",
  "I pretend to understand, but honestly",
  "The thing I am weirdly proud of is",
  "My most embarrassing moment on the way to class was",
  "Advice I wish someone had given me earlier is",
];
const DEFAULT_REPORT_REASONS = ["Names or identifying details", "Mentions staff", "Bullying or hate", "Sexual content", "Worried about someone\u2019s safety", "Spam or selling", "Something else"];
const DEFAULT_PRIVACY = `This page explains exactly what Inert Gas stores about you, and what it does not.

## Your name

There are no accounts. Your name is never asked for and never shown. Nobody on the site can see who wrote a confession, a comment or a message.

## IP addresses are logged

Like almost every website, this one logs the IP address that sent each confession, comment, poll idea and message to the admin. It exists for one reason: so the admin can stop serious abuse such as threats, harassment, or someone flooding the site.

Here is what that means for you. The address is never shown on the site. Other students cannot see it. Moderators cannot see it. It is not shared with the college, with clubs, or with anyone who asks out of curiosity. It is not used to work out who wrote a confession, and it is only looked at when there is a real problem, such as a threat or a person in danger. The one thing that can override this is a formal legal order from the police or a court. Without that, it is not handed to anyone.

If you write something kind, funny or honest and follow the rules, nothing about the address will ever matter.

## Reactions, votes and reports

These use a scrambled code made on your device, not your IP address, so they cannot be tied to you.

## Visit counts

A private daily visit count keeps only a scrambled code that changes every day. A device cannot be followed from one day to the next.

## On your device

Your draft, your reactions and the private code for your messages to the admin are stored in this browser only. Clearing your browsing data removes them.

## Moderator applications

These are different, because they are not anonymous. The admin sees your details and ID photo, nobody else does, and the ID photo is deleted as soon as the admin decides.`;
const jparse = (v, d) => {
  try {
    const x = JSON.parse(v);
    return x === null || x === undefined ? d : x;
  } catch {
    return d;
  }
};
const listOr = (v, def) => {
  const a = jparse(v, null);
  return Array.isArray(a) && a.length ? a.map(String) : def;
};
function siteContent(set) {
  return {
    rules: listOr(set.rules_list, DEFAULT_SITE_RULES),
    prompts: listOr(set.prompts_list, DEFAULT_PROMPTS),
    report_reasons: listOr(set.report_reasons, DEFAULT_REPORT_REASONS),
    privacy: set.privacy_text && set.privacy_text.trim() ? set.privacy_text : DEFAULT_PRIVACY,
    texts: jparse(set.texts_json, {}) || {},
    announce:
      set.announce_on === "1" && (set.announce_title || set.announce_body)
        ? { title: set.announce_title || "", body: set.announce_body || "", v: set.announce_v || "0" }
        : null,
  };
}
// Time zone used for the daily limits and the downtime schedule (minutes from UTC; Nepal is +345).
const tzMin = (set) => {
  const sc = jparse(set.sched_json, {});
  const n = Number(sc && sc.tz);
  return Number.isFinite(n) && n >= -720 && n <= 840 ? n : 345;
};
const localDay = (set, now = Date.now()) => new Date(now + tzMin(set) * 60000).toISOString().slice(0, 10);
// Weekly routine and one-off windows when the site goes dark. Times are in the schedule's own time zone.
function schedDown(set, now = Date.now()) {
  const sc = jparse(set.sched_json, null);
  if (!sc || sc.on === false) return false;
  const lt = new Date(now + tzMin(set) * 60000),
    dow = lt.getUTCDay(),
    mins = lt.getUTCHours() * 60 + lt.getUTCMinutes(),
    hm = (s) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || ""));
      return m ? +m[1] * 60 + +m[2] : null;
    };
  for (const w of Array.isArray(sc.weekly) ? sc.weekly : []) {
    const f = hm(w.from),
      t = hm(w.to),
      days = Array.isArray(w.days) ? w.days.map(Number) : [];
    if (f === null || t === null) continue;
    if (f === t) {
      if (days.includes(dow)) return true;
    } else if (f < t) {
      if (days.includes(dow) && mins >= f && mins < t) return true;
    } else if ((days.includes(dow) && mins >= f) || (days.includes((dow + 6) % 7) && mins < t)) return true;
  }
  const stamp = (s) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(s || ""));
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - tzMin(set) * 60000 : null;
  };
  for (const o of Array.isArray(sc.once) ? sc.once : []) {
    const a = stamp(o.from),
      b = stamp(o.to);
    if (a !== null && b !== null && now >= a && now < b) return true;
  }
  return false;
}
// A copy of the browser's own "site can't be reached" page, so a closed site looks like it does not exist.
function cantReach(req) {
  const host = escAttr(new URL(req.url).hostname),
    ua = req.headers.get("user-agent") || "",
    diag = /Windows/i.test(ua)
      ? "<li>If spelling is correct, try <a href=\"#\" onclick=\"return false\">running Windows Network Diagnostics</a>.</li>"
      : /Macintosh|Mac OS/i.test(ua)
        ? "<li>If spelling is correct, try <a href=\"#\" onclick=\"return false\">running Network Diagnostics</a>.</li>"
        : "";
  const page = `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no"><meta name="robots" content="noindex,nofollow"><title>${host}</title><style>
html{-webkit-text-size-adjust:100%}body{margin:0;background:#fff;color:#202124;font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;font-size:1em;line-height:1.6em}
.w{max-width:600px;margin:0 auto;padding:0 20px}.top{padding-top:calc(14vh)}
.ic{width:72px;height:72px;margin:0 0 40px;display:block}
h1{font-size:1.6em;font-weight:500;line-height:1.25em;margin:0 0 16px;color:#202124}
p,ul{font-size:1em;color:#5f6368;margin:0 0 .6em}ul{padding-left:1.4em}li{margin:0 0 .3em}a{color:#1a0dab;text-decoration:none}b{color:#202124;font-weight:600}
.code{font-size:.8em;color:#5f6368;margin:24px 0 0;text-transform:none;letter-spacing:.01em}
.btns{margin-top:40px;display:flex;justify-content:flex-end}button{background:#1a73e8;color:#fff;border:0;border-radius:4px;padding:9px 24px;font:inherit;font-size:.875em;font-weight:500;cursor:pointer}
button:hover{background:#1b66c9}
@media(prefers-color-scheme:dark){body{background:#202124;color:#e8eaed}h1,b{color:#e8eaed}p,ul,.code{color:#9aa0a6}a{color:#8ab4f8}button{background:#8ab4f8;color:#202124}button:hover{background:#a1c2fa}}
@media(max-width:480px){.top{padding-top:10vh}.btns{justify-content:flex-start}}
</style></head><body><div class="w top"><svg class="ic" viewBox="0 0 72 72" aria-hidden="true"><path d="M12 6h32l16 16v42a2 2 0 0 1-2 2H12a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" fill="#9aa0a6"/><path d="M44 6l16 16H46a2 2 0 0 1-2-2z" fill="#bdc1c6"/><circle cx="26" cy="38" r="3" fill="#fff"/><circle cx="44" cy="38" r="3" fill="#fff"/><path d="M24 54c3-6 15-6 18 0" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>
<h1>This site can\u2019t be reached</h1><p>Check if there is a typo in <b>${host}</b>.</p><ul>${diag}</ul><div class="code">DNS_PROBE_FINISHED_NXDOMAIN</div><div class="btns"><button type="button" onclick="location.reload()">Reload</button></div></div></body></html>`;
  return new Response(page, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, max-age=0",
      "x-robots-tag": "noindex, nofollow",
      "x-content-type-options": "nosniff",
    },
  });
}

const brand = (s) =>
  s
    .replaceAll("Saint JBS College Confession Wall", SITE_NAME + " Confession Wall")
    .replaceAll("Saint JBS College", SITE_NAME)
    .replaceAll("Saint JBS", SITE_NAME);
const html = (s) => new Response(brand(s), { headers: HTML_HEADERS });
const J = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
const NF = () => new Response("Not Found", { status: 404 });

let schemaPromise;
async function ensureSchema(db) {
  if (schemaPromise) return schemaPromise;
  schemaPromise = (async () => {
    const sql = [
      `CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT NOT NULL,status TEXT NOT NULL,reason TEXT,publish_at INTEGER NOT NULL,threshold INTEGER NOT NULL DEFAULT 1,ip TEXT,created_at INTEGER,tag TEXT DEFAULT 'other',edited_text TEXT)`,
      `CREATE TABLE IF NOT EXISTS reports (post_id INTEGER,rid TEXT,reason TEXT,details TEXT,PRIMARY KEY(post_id,rid))`,
      `CREATE TABLE IF NOT EXISTS limits (k TEXT PRIMARY KEY,n INTEGER NOT NULL,exp INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY,v TEXT)`,
      `CREATE TABLE IF NOT EXISTS reactions (post_id INTEGER,type TEXT,rid TEXT,created_at INTEGER,PRIMARY KEY(post_id,type,rid))`,
      `CREATE TABLE IF NOT EXISTS reaction_counts (post_id INTEGER,type TEXT,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(post_id,type))`,
      `CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT,post_id INTEGER,text TEXT NOT NULL,status TEXT NOT NULL,reason TEXT,publish_at INTEGER NOT NULL,ip TEXT,created_at INTEGER,threshold INTEGER NOT NULL DEFAULT 1)`,
      `CREATE TABLE IF NOT EXISTS comment_reports (comment_id INTEGER,rid TEXT,reason TEXT,details TEXT,PRIMARY KEY(comment_id,rid))`,
      `CREATE TABLE IF NOT EXISTS polls (id INTEGER PRIMARY KEY AUTOINCREMENT,question TEXT NOT NULL,options_json TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'live',created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS poll_votes (poll_id INTEGER,rid TEXT,option_n INTEGER,PRIMARY KEY(poll_id,rid))`,
      `CREATE TABLE IF NOT EXISTS poll_requests (id INTEGER PRIMARY KEY AUTOINCREMENT,text TEXT,status TEXT,reason TEXT,ip TEXT,created_at INTEGER)`,
      `CREATE TABLE IF NOT EXISTS moods (day TEXT,mood TEXT,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(day,mood))`,
      `CREATE TABLE IF NOT EXISTS mood_votes (day TEXT,rid TEXT,mood TEXT,PRIMARY KEY(day,rid))`,
      `CREATE TABLE IF NOT EXISTS mods (id INTEGER PRIMARY KEY AUTOINCREMENT,username TEXT NOT NULL UNIQUE,pw_hash TEXT NOT NULL,salt TEXT NOT NULL,iters INTEGER NOT NULL,created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS visits (day TEXT NOT NULL,rid TEXT NOT NULL,PRIMARY KEY(day,rid))`,
      `CREATE TABLE IF NOT EXISTS threads (id INTEGER PRIMARY KEY AUTOINCREMENT,code_hash TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'open',urgent INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,last_at INTEGER NOT NULL,last_from TEXT NOT NULL,ip TEXT)`,
      `CREATE TABLE IF NOT EXISTS thread_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT,thread_id INTEGER NOT NULL,from_admin INTEGER NOT NULL DEFAULT 0,body TEXT NOT NULL,created_at INTEGER NOT NULL,ip TEXT)`,
      `CREATE TABLE IF NOT EXISTS mod_apps (id INTEGER PRIMARY KEY AUTOINCREMENT,status TEXT NOT NULL DEFAULT 'pending',name TEXT,roll TEXT,program TEXT,year TEXT,email TEXT,phone TEXT,answers_json TEXT,ip TEXT,dedupe TEXT,has_id INTEGER NOT NULL DEFAULT 0,mod_username TEXT,note TEXT,created_at INTEGER NOT NULL,decided_at INTEGER)`,
      `CREATE TABLE IF NOT EXISTS mod_app_ids (app_id INTEGER PRIMARY KEY,mime TEXT NOT NULL,data TEXT NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS flags (id INTEGER PRIMARY KEY AUTOINCREMENT,ih TEXT NOT NULL,ip TEXT,kind TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 0,window_sec INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'flagged',created_at INTEGER NOT NULL,cleared_at INTEGER)`,
      `CREATE TABLE IF NOT EXISTS comment_reactions (comment_id INTEGER,type TEXT,rid TEXT,created_at INTEGER,PRIMARY KEY(comment_id,type,rid))`,
      `CREATE TABLE IF NOT EXISTS comment_reaction_counts (comment_id INTEGER,type TEXT,n INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(comment_id,type))`,
      `CREATE TABLE IF NOT EXISTS share_log (day TEXT NOT NULL,rid TEXT NOT NULL,post_id INTEGER NOT NULL,PRIMARY KEY(day,rid,post_id))`,
      `CREATE TABLE IF NOT EXISTS mod_msgs (id INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,mod_id INTEGER NOT NULL DEFAULT 0,sender TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS mod_seen (msg_id INTEGER NOT NULL,mod_id INTEGER NOT NULL,seen_at INTEGER NOT NULL,PRIMARY KEY(msg_id,mod_id))`,
      `CREATE TABLE IF NOT EXISTS mod_admin_reads (k TEXT PRIMARY KEY,last_id INTEGER NOT NULL DEFAULT 0)`,
    ];
    for (const q of sql) await db.prepare(q).run();
    for (const q of [
      `CREATE INDEX IF NOT EXISTS posts_feed ON posts(status,publish_at,id)`,
      `CREATE INDEX IF NOT EXISTS comments_post ON comments(post_id,status,publish_at)`,
      `CREATE INDEX IF NOT EXISTS thread_msgs_t ON thread_msgs(thread_id,id)`,
      `CREATE INDEX IF NOT EXISTS threads_list ON threads(status,urgent,last_at)`,
      `CREATE INDEX IF NOT EXISTS thread_msgs_ip ON thread_msgs(ip,created_at)`,
      `CREATE INDEX IF NOT EXISTS flags_ih ON flags(ih,status)`,
      `CREATE INDEX IF NOT EXISTS mod_apps_list ON mod_apps(status,id)`,
      `CREATE INDEX IF NOT EXISTS mod_msgs_room ON mod_msgs(room,mod_id,id)`,
      `CREATE INDEX IF NOT EXISTS comment_reactions_c ON comment_reactions(comment_id)`,
    ])
      await db.prepare(q).run();
    for (const q of [
      `ALTER TABLE posts ADD COLUMN tag TEXT DEFAULT 'other'`,
      `ALTER TABLE posts ADD COLUMN edited_text TEXT`,
      `ALTER TABLE reports ADD COLUMN reason TEXT`,
      `ALTER TABLE reports ADD COLUMN details TEXT`,
      `ALTER TABLE comment_reports ADD COLUMN details TEXT`,
      `ALTER TABLE thread_msgs ADD COLUMN seen_at INTEGER`,
    ])
      try {
        await db.prepare(q).run();
      } catch {}
    const defaults = {
      delay_min: "2",
      delay_max: "3",
      post_cooldown_min: "30",
      comment_cooldown_min: "2",
      report_threshold: "1",
      banner: "",
      helplines: DEFAULT_HELPLINES,
      comments_on: "1",
      cotd_id: "",
      mod_path: "review",
      rules_json: "",
      weekly_theme: "",
      weekly_prompt: "",
      rules_v2: "",
      urgent_words: "",
      mod_apply_on: "0",
      mod_apply_domains: "",
      mod_apply_id_regex: "",
      mod_apply_code: "",
      flood_on: "1",
      flood_max: "100",
      flood_window_sec: "200",
      rules_list: "",
      prompts_list: "",
      report_reasons: "",
      privacy_text: "",
      texts_json: "",
      announce_on: "0",
      announce_title: "",
      announce_body: "",
      announce_v: "0",
      sched_json: "",
      apply_questions: "",
      apply_consents: "",
      share_limit: "20",
    };
    for (const [k, v] of Object.entries(defaults))
      await db
        .prepare("INSERT OR IGNORE INTO settings(k,v) VALUES(?,?)")
        .bind(k, v)
        .run();
    // One-time migration: replace the old placeholder with the real helplines.
    await db
      .prepare("UPDATE settings SET v=? WHERE k='helplines' AND v=?")
      .bind(DEFAULT_HELPLINES, OLD_HELPLINES)
      .run();
  })();
  schemaPromise.catch(() => (schemaPromise = null));
  return schemaPromise;
}

async function hmac(key, msg) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key || "salt"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const s = await crypto.subtle.sign("HMAC", k, enc.encode(msg));
  return [...new Uint8Array(s)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
const same = async (a, b) =>
  (await hmac("compare", String(a))) === (await hmac("compare", String(b)));
const b64 = (a) =>
  btoa(String.fromCharCode(...new Uint8Array(a)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const unb64 = (s) =>
  Uint8Array.from(atob(s.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
async function passwordHash(pass, salt, iters = 100000) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(pass),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return b64(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt: unb64(salt), iterations: iters },
      k,
      256,
    ),
  );
}
const rnd = (n) => b64(crypto.getRandomValues(new Uint8Array(n)));

async function hit(db, k, max, ttl) {
  const now = Date.now(),
    exp = now + ttl;
  const r = await db
    .prepare(
      `INSERT INTO limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=CASE WHEN exp<? THEN 1 ELSE n+1 END,exp=CASE WHEN exp<? THEN ? ELSE exp END WHERE exp<? OR n<? RETURNING n`,
    )
    .bind(k, exp, now, now, exp, now, max)
    .first();
  return !!r;
}

// ---------- Filter rules (editable by the admin in Admin > Filters) ----------
// Word lists: one word or phrase per entry. A trailing * matches the rest of the word (cheat* matches cheating).
// Matching is case-insensitive, whole-word, and works for any script (Nepali included).
// Built-in "pattern" rules keep a fixed expression; the admin can only switch them on or off.
const WCH = "[\\p{L}\\p{N}\\p{M}_]";
const DEFAULT_RULES = [
  { id: "phone", type: "pattern", re: "([+]?\\d[\\s-]?){8,}", reason: "doxxing", label: "Phone-number-like digits", admin_only: true },
  { id: "link", type: "pattern", re: "https?:\\/\\/|www\\.", reason: "link", label: "Web links", admin_only: false },
  { id: "handle", type: "pattern", re: "@\\w{2,}", cs: true, reason: "handle", label: "@handles", admin_only: false },
  { id: "email", type: "pattern", re: "[\\w.+-]+@[\\w-]+\\.[\\w.-]+", cs: true, reason: "email", label: "Email addresses", admin_only: false },
  { id: "staff", type: "words", reason: "staff", label: "Staff and teachers", admin_only: false, words: ["prof", "professor", "sir", "madam", "mam", "hod", "principal", "dean", "lecturer", "teacher"] },
  { id: "accusation", type: "words", reason: "accusation", label: "Accusations", admin_only: true, words: ["cheat*", "rape*", "assault*", "harass*", "bribe*", "drug", "drugs", "stole", "steal*", "leak*", "scam*"] },
  { id: "self-harm", type: "words", reason: "self-harm", label: "Self-harm", admin_only: true, words: ["suicid*", "kill myself", "self-harm", "end it all", "want to die", "cut myself"] },
  { id: "minor", type: "words", reason: "minor", label: "Minors", admin_only: true, words: ["underage", "minor"] },
  { id: "minor_age", type: "pattern", re: "\\b(grade [1-9]|[1-9][0-7] years old)\\b", reason: "minor", label: "Grades 1-9 and ages up to 17", admin_only: true },
  { id: "doxxing", type: "words", reason: "doxxing", label: "Identifying details", admin_only: true, words: ["address", "roll no", "student id", "id number"] },
  { id: "room", type: "pattern", re: "\\broom ?\\d+\\b", reason: "doxxing", label: "Room numbers", admin_only: true },
  { id: "abuse", type: "words", reason: "abuse", label: "Abuse", admin_only: false, words: ["fuck*", "bitch*", "slut*", "whore*", "bastard", "randi", "machikne"] },
  { id: "threat", type: "words", reason: "threat", label: "Threats", admin_only: true, words: ["kill you", "hurt you", "bomb", "shoot"] },
  { id: "sexual", type: "words", reason: "sexual", label: "Sexual content", admin_only: true, words: ["nude", "nudes", "porn", "sexual"] },
];
const DEFAULT_URGENT = ["suicid*", "kill myself", "self-harm", "end it all", "want to die", "cut myself", "no reason to live", "hurt myself"];
const UNSAFE_RE = /[+*}][+*{]|\([^)]*[+*][^)]*\)[+*{]/;
const escRe = (w) => w.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&");
function wordPart(w) {
  const wild = w.endsWith("*");
  const core = escRe(wild ? w.slice(0, -1) : w).replace(/(\\?[\s-])+/g, "[\\s-]*");
  return core + (wild ? WCH + "*" : "");
}
function wordsRe(words) {
  const parts = words.map(wordPart).filter(Boolean);
  if (!parts.length) return null;
  return new RegExp("(?<!" + WCH + ")(?:" + parts.join("|") + ")(?!" + WCH + ")", "iu");
}
const cleanWords = (a, max) =>
  [...new Set((Array.isArray(a) ? a : []).map((x) => String(x ?? "").trim().replace(/\s+/g, " ")).filter((x) => x && x.length <= 60 && x !== "*"))].slice(0, max);
function cleanRules(input) {
  if (!input || !Array.isArray(input.rules)) return { error: "Rules are missing." };
  if (input.rules.length > 60) return { error: "Too many rules (60 at most)." };
  const defaults = Object.fromEntries(DEFAULT_RULES.map((r) => [r.id, r])),
    seen = new Set(),
    rules = [];
  for (const x of input.rules) {
    let id = String(x?.id || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40);
    if (!id || seen.has(id)) id = "r" + Math.random().toString(36).slice(2, 9);
    seen.add(id);
    const reason = String(x?.reason ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 40);
    if (!reason) return { error: "Every rule needs a reason label." };
    const r = {
      id,
      type: ["words", "pattern", "regex"].includes(x.type) ? x.type : "words",
      reason,
      label: String(x.label || "").trim().slice(0, 60),
      enabled: x.enabled !== false,
      admin_only: !!x.admin_only,
    };
    if (r.type === "pattern") {
      const d = defaults[id];
      if (!d || d.type !== "pattern") return { error: "Unknown built-in rule." };
      r.re = d.re;
      if (d.cs) r.cs = true;
    } else if (r.type === "regex") {
      r.re = String(x.re || "").slice(0, 120);
      if (!r.re || UNSAFE_RE.test(r.re)) return { error: "The advanced pattern in \"" + reason + "\" is empty or too risky. Use a word list instead." };
      try { new RegExp(r.re, "iu"); } catch { return { error: "The advanced pattern in \"" + reason + "\" is not valid." }; }
    } else {
      r.words = cleanWords(x.words, 400);
    }
    rules.push(r);
  }
  return { rules, allow: cleanWords(input.allow, 200) };
}
function legacyRules(raw) {
  try {
    const a = JSON.parse(raw);
    if (!Array.isArray(a)) return [];
    return a
      .filter((x) => typeof x?.term === "string" && x.term && x.term.length <= 60 && !UNSAFE_RE.test(x.term))
      .slice(0, 40)
      .map((x, i) => ({ id: "legacy" + i, type: "regex", re: x.term, reason: String(x.reason || "custom rule").slice(0, 40).toLowerCase(), label: "Imported custom term", enabled: true, admin_only: false }));
  } catch { return []; }
}
function compileRuleset(rs) {
  const list = [];
  for (const r of rs.rules) {
    if (r.enabled === false) continue;
    try {
      const re = r.type === "words" ? wordsRe(r.words || []) : new RegExp(r.re, r.type === "pattern" ? (r.cs ? "" : "i") : "iu");
      if (re) list.push({ id: r.id, reason: r.reason, re });
    } catch {}
  }
  const allow = (rs.allow || []).map((w) => new RegExp("(?<!" + WCH + ")" + wordPart(w) + "(?!" + WCH + ")", "giu"));
  return { list, allow };
}
let rulesCache = { key: null, val: null };
async function getRuleset(db) {
  const { results } = await db.prepare("SELECT k,v FROM settings WHERE k IN ('rules_v2','rules_json')").all();
  const m = Object.fromEntries(results.map((x) => [x.k, x.v || ""])),
    key = (m.rules_v2 || "") + "\u0001" + (m.rules_json || "");
  if (rulesCache.key === key) return rulesCache.val;
  let rs = null, custom = false;
  if (m.rules_v2) {
    try {
      const c = cleanRules(JSON.parse(m.rules_v2));
      if (!c.error) { rs = { rules: c.rules, allow: c.allow }; custom = true; }
    } catch {}
  }
  if (!rs) rs = { rules: DEFAULT_RULES.map((r) => ({ ...r, enabled: true })).concat(legacyRules(m.rules_json)), allow: [] };
  const val = { ...rs, custom, compiled: compileRuleset(rs) };
  rulesCache = { key, val };
  return val;
}
function firstHit(compiled, text) {
  let t = String(text);
  for (const a of compiled.allow) t = t.replace(a, " ");
  return compiled.list.find((x) => x.re.test(t)) || null;
}
async function matchRule(db, text) {
  const h = firstHit((await getRuleset(db)).compiled, text);
  return h ? { reason: h.reason, id: h.id } : null;
}
async function ruleFor(db, text) {
  return (await matchRule(db, text))?.reason || "";
}
async function adminOnlyReasons(db) {
  const rs = await getRuleset(db);
  return [...new Set(rs.rules.filter((r) => r.admin_only).map((r) => r.reason))];
}
async function urgentList(db) {
  const raw = (await db.prepare("SELECT v FROM settings WHERE k='urgent_words'").first())?.v || "";
  try { const a = cleanWords(JSON.parse(raw), 200); if (raw && a.length) return a; } catch {}
  return DEFAULT_URGENT;
}
let urgentCache = { key: null, re: null };
async function isUrgent(db, text) {
  const words = await urgentList(db), key = words.join("\u0001");
  if (urgentCache.key !== key) urgentCache = { key, re: wordsRe(words) };
  return !!urgentCache.re && urgentCache.re.test(String(text));
}

// ---------- ALTCHA: self-hosted proof-of-work captcha (no third-party code, no tracking) ----------
// The server signs a SHA-256 puzzle, the browser finds the hidden number, the server checks it once.
const ALT_MAX = 50000,
  ALT_TTL = 10 * MIN;
const toHex = (buf) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
const sha256hex = async (s) => toHex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
const altSecret = (env) =>
  env.ALTCHA_HMAC_KEY || (env.SALT && env.ADMIN_PASSWORD ? "altcha|" + env.SALT + "|" + env.ADMIN_PASSWORD : "");
async function altChallenge(env) {
  const secret = altSecret(env);
  if (!secret) return null;
  const salt = toHex(crypto.getRandomValues(new Uint8Array(12))) + "?expires=" + Math.floor((Date.now() + ALT_TTL) / 1000),
    n = crypto.getRandomValues(new Uint32Array(1))[0] % (ALT_MAX + 1),
    challenge = await sha256hex(salt + n);
  return { algorithm: "SHA-256", challenge, salt, signature: await hmac(secret, challenge), maxnumber: ALT_MAX };
}
async function verifyCaptcha(env, token) {
  try {
    const secret = altSecret(env);
    if (!secret || typeof token !== "string" || token.length > 600) return false;
    const p = JSON.parse(atob(token));
    if (
      p.algorithm !== "SHA-256" ||
      !Number.isInteger(p.number) || p.number < 0 || p.number > ALT_MAX ||
      !/^[0-9a-f]{64}$/.test(String(p.challenge)) ||
      !/^[0-9a-f]{24}\?expires=\d{1,12}$/.test(String(p.salt)) ||
      !/^[0-9a-f]{64}$/.test(String(p.signature))
    ) return false;
    if (Number(p.salt.split("=")[1]) * 1000 < Date.now()) return false;
    if (!(await same(p.signature, await hmac(secret, p.challenge)))) return false;
    if ((await sha256hex(p.salt + p.number)) !== p.challenge) return false;
    return await hit(env.DB, "alt:" + p.challenge, 1, ALT_TTL + MIN); // each answer works once
  } catch {
    return false;
  }
}

// ---------- Message flood flag (messages to the admin) ----------
// There is NO cap on how many messages the admin can receive. Only a sender who sends too many
// too fast (default 100 in 200 seconds) is flagged and blocked until the admin deflags them.
const clampN = (v, lo, hi, d) => Math.min(hi, Math.max(lo, Math.round(+v) || d));
async function bump(db, k, ttl) {
  const now = Date.now(),
    r = await db
      .prepare(`INSERT INTO limits(k,n,exp) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=CASE WHEN exp<? THEN 1 ELSE n+1 END,exp=CASE WHEN exp<? THEN ? ELSE exp END RETURNING n`)
      .bind(k, now + ttl, now, now, now + ttl)
      .first();
  return r ? +r.n : 1;
}
const FLAGGED_MSG = "Sending messages from this connection is paused while the admin reviews it. You can still read replies.";
async function floodCheck(env, set, ip) {
  const db = env.DB,
    ih = await hmac(env.SALT, "ip" + ip);
  if (await db.prepare("SELECT id FROM flags WHERE ih=? AND status='flagged' LIMIT 1").bind(ih).first())
    return { blocked: true, ih };
  if (set.flood_on === "0") return { blocked: false, ih, n: 0, max: Infinity };
  const max = clampN(set.flood_max, 2, 100000, 100),
    win = clampN(set.flood_window_sec, 10, 86400, 200);
  return { blocked: false, ih, n: await bump(db, "fl:" + ih, win * 1000), max, win };
}
async function floodAfter(env, g, ip) {
  if (g.n >= g.max)
    await env.DB
      .prepare("INSERT INTO flags(ih,ip,kind,count,window_sec,status,created_at) VALUES(?,?,'message_flood',?,?,'flagged',?)")
      .bind(g.ih, ip, g.n, g.win, Date.now())
      .run();
}
const safeText = (x) => String(x || "").trim();
const ipOf = (req) => req.headers.get("CF-Connecting-IP") || "";
async function settings(db) {
  const { results } = await db.prepare("SELECT k,v FROM settings").all();
  return Object.fromEntries(results.map((x) => [x.k, x.v]));
}
const today = () => new Date().toISOString().slice(0, 10);

const RC = (t) => `COALESCE(MAX(CASE WHEN rc.type='${t}' THEN rc.n END),0)`;
const POST_SELECT = `SELECT p.*,COALESCE(SUM(rc.n),0) score,${RC("like")} likes,${RC("laugh")} laughs,${RC("relate")} relates,${RC("hug")} hugs,${RC("wow")} wows,${RC("sad")} sads,${RC("up")} ups,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id AND c.status='live' AND c.publish_at<=?) comments FROM posts p LEFT JOIN reaction_counts rc ON rc.post_id=p.id`;
function publicPost(r) {
  return {
    id: r.id,
    text: r.edited_text || r.text,
    tag: TAGS.includes(r.tag) ? r.tag : "other",
    publish_at: r.publish_at,
    reactions: {
      like: (+r.likes || 0) + (+r.hugs || 0),
      laugh: +r.laughs || 0,
      wow: +r.wows || 0,
      sad: +r.sads || 0,
      up: (+r.ups || 0) + (+r.relates || 0),
    },
    comments: +r.comments || 0,
    score: +r.score || 0,
  };
}
async function feed(db, url) {
  const beforeT = Number(url.searchParams.get("before") || 0),
    beforeI = Number(url.searchParams.get("before_id") || 0),
    sortQ = url.searchParams.get("sort"),
    sort = ["top", "trending", "random"].includes(sortQ) ? sortQ : "latest",
    tag = url.searchParams.get("tag");
  const now = Date.now();
  let where = "p.status='live' AND p.publish_at<=?",
    args = [now, now];
  if (tag && TAGS.includes(tag)) {
    where += " AND p.tag=?";
    args.push(tag);
  }
  if (sort === "top") {
    const rq = url.searchParams.get("range"),
      range = rq === "day" || rq === "all" ? rq : "week";
    if (range !== "all") {
      where += " AND p.publish_at>?";
      args.push(now - RANGES[range]);
    }
  }
  if (beforeT && sort === "latest") {
    where += " AND (p.publish_at<? OR (p.publish_at=? AND p.id<?))";
    args.push(beforeT, beforeT, beforeI);
  }
  const offset =
    sort === "top" || sort === "trending"
      ? Math.max(0, Math.min(2000, Number(url.searchParams.get("offset") || 0)))
      : 0;
  let order = "p.publish_at DESC,p.id DESC";
  if (sort === "top") order = "score DESC,p.publish_at DESC,p.id DESC";
  if (sort === "trending") {
    order =
      "(score*1.0/(1+((?-p.publish_at)/3600000))) DESC,p.publish_at DESC,p.id DESC";
  }
  if (sort === "random") order = "RANDOM()";
  const q = `${POST_SELECT} WHERE ${where} GROUP BY p.id ORDER BY ${order} LIMIT 21 OFFSET ${offset}`;
  if (sort === "trending") args.push(now);
  const { results } = await db
    .prepare(q)
    .bind(...args)
    .all();
  const items = results.slice(0, 20).map(publicPost),
    last = items.at(-1);
  let next = null;
  if (results.length > 20 && last) {
    if (sort === "latest")
      next = { before: last.publish_at, before_id: last.id };
    else if (sort !== "random") next = { offset: offset + 20 };
  }
  return { items, next };
}
async function onePost(db, id) {
  const now = Date.now();
  const r = await db
    .prepare(
      `${POST_SELECT} WHERE p.id=? AND p.status='live' AND p.publish_at<=? GROUP BY p.id`,
    )
    .bind(now, id, now)
    .first();
  return r ? publicPost(r) : null;
}
async function confessionOfDay(db, set) {
  const pick = +set.cotd_id;
  if (pick) {
    const p = await onePost(db, pick);
    if (p) return p;
  }
  const now = Date.now();
  const r = await db
    .prepare(
      `${POST_SELECT} WHERE p.status='live' AND p.publish_at<=? AND p.publish_at>? GROUP BY p.id HAVING score>0 ORDER BY score DESC,p.id DESC LIMIT 1`,
    )
    .bind(now, now, now - 86400000)
    .first();
  return r ? publicPost(r) : null;
}
async function moodCounts(db) {
  const { results } = await db
    .prepare("SELECT mood,n FROM moods WHERE day=?")
    .bind(today())
    .all();
  const out = Object.fromEntries(MOODS.map((m) => [m, 0]));
  for (const r of results) if (MOODS.includes(r.mood)) out[r.mood] = +r.n;
  return out;
}
async function weekMoods(db) {
  const days = [];
  for (let i = 6; i >= 0; i--)
    days.push(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10));
  const { results } = await db
    .prepare("SELECT day,mood,n FROM moods WHERE day>=? AND day<=?")
    .bind(days[0], days[6])
    .all();
  const byDay = Object.fromEntries(
    days.map((d) => [d, Object.fromEntries(MOODS.map((m) => [m, 0]))]),
  );
  const totals = Object.fromEntries(MOODS.map((m) => [m, 0]));
  for (const r of results)
    if (byDay[r.day] && MOODS.includes(r.mood)) {
      byDay[r.day][r.mood] = +r.n;
      totals[r.mood] += +r.n;
    }
  return { days: days.map((d) => ({ day: d, ...byDay[d] })), totals };
}
async function pollData(db) {
  const p = await db
    .prepare(
      "SELECT * FROM polls WHERE status='live' ORDER BY id DESC LIMIT 1",
    )
    .first();
  if (!p) return null;
  const opts = JSON.parse(p.options_json || "[]"),
    { results } = await db
      .prepare(
        "SELECT option_n,COUNT(*) n FROM poll_votes WHERE poll_id=? GROUP BY option_n",
      )
      .bind(p.id)
      .all();
  return {
    id: p.id,
    question: p.question,
    options: opts,
    counts: Object.fromEntries(results.map((x) => [x.option_n, x.n])),
  };
}
async function authAdmin(req, env) {
  const val = (req.headers.get("authorization") || "").replace(/^Bearer /, "");
  return env.ADMIN_PASSWORD && (await same(val, env.ADMIN_PASSWORD));
}
async function authModerator(req, env) {
  const username = safeText(req.headers.get("x-jbs-mod-user")).toLowerCase();
  const password = req.headers.get("x-jbs-mod-password") || "";
  if (!username || !password) return null;
  const mod = await env.DB.prepare("SELECT * FROM mods WHERE lower(username)=?")
    .bind(username)
    .first();
  if (!mod) return null;
  if (mod.iters > 0) {
    // Legacy PBKDF2 record (slow, can exceed the free plan CPU limit). Verify once,
    // then upgrade the row to the fast keyed hash so later requests are cheap.
    const hash = await passwordHash(password, mod.salt, mod.iters);
    if (!(await same(hash, mod.pw_hash))) return null;
    await env.DB.prepare("UPDATE mods SET pw_hash=?,iters=0 WHERE id=?")
      .bind(await modHash(password, mod.salt), mod.id)
      .run();
    return mod;
  }
  return (await same(await modHash(password, mod.salt), mod.pw_hash))
    ? mod
    : null;
}
// Moderator passwords are 112-bit random values generated by the server, so a fast
// keyed hash (per-moderator salt) is sufficient and keeps every request under the
// free plan CPU limit. iters=0 marks this format in the mods table.
const modHash = (pass, salt) => hmac(salt, "modpw" + pass);

// ---------- Link previews (Open Graph) and Add to Home Screen ----------
const escAttr = (s) =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
const SITE_DESC = SITE_BRAND + ": anonymous confessions from " + SITE_NAME + ". Nobody sees who wrote a confession.";
function snippet(text) {
  const chars = Array.from(String(text || "").replace(/\s+/g, " ").trim());
  return chars.slice(0, 160).join("") + (chars.length > 160 ? "..." : "");
}
function ogTags(origin, path, title, desc) {
  const t = escAttr(title),
    d = escAttr(desc);
  return [
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="Inert Gas">`,
    `<meta property="og:title" content="${t}">`,
    `<meta property="og:description" content="${d}">`,
    `<meta property="og:url" content="${escAttr(origin + path)}">`,
    `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${t}">`,
    `<meta name="twitter:description" content="${d}">`,
  ].join("\n");
}
const defaultOg = (origin) =>
  ogTags(origin, "/", SITE_BRAND + " | Confessions, " + SITE_NAME, SITE_DESC);
const indexPage = (env, og) => INDEX_HTML.replace("<!--og-->", () => og);
const MANIFEST = JSON.stringify({
  name: "Inert Gas",
  short_name: "Inert Gas",
  description: SITE_DESC,
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#0e1014",
  theme_color: "#0e1014",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
  ],
});
const ICON_ROUTES = {
  "/icon-192.png": () => ICON_192_B64,
  "/icon-512.png": () => ICON_512_B64,
  "/apple-touch-icon.png": () => ICON_180_B64,
};
function iconResponse(b64str) {
  const bin = atob(b64str),
    bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, {
    headers: {
      "content-type": "image/png",
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url),
      p = url.pathname,
      db = env.DB;
    await ensureSchema(db);
    if (Math.random() < 0.02) {
      db.prepare("DELETE FROM limits WHERE exp<?")
        .bind(Date.now())
        .run()
        .catch(() => {});
      db.prepare("DELETE FROM share_log WHERE day<?")
        .bind(new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10))
        .run()
        .catch(() => {});
      db.prepare("DELETE FROM visits WHERE day<?")
        .bind(new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10))
        .run()
        .catch(() => {});
    }
    if (p.startsWith("/api/admin/")) return admin(req, env, p, url);
    const set = await settings(db),
      killed = set.killed === "1",
      ip = ipOf(req);
    // The admin page and its API always load, even while the site is switched off or on a break.
    if (env.ADMIN_PATH && p === "/" + env.ADMIN_PATH) return html(ADMIN_HTML);
    const down = killed || schedDown(set);
    if (p.startsWith("/api/mod/")) return down ? cantReach(req) : moderator(req, env, p, set);
    if (p === "/" + set.mod_path && !down) return html(MOD_HTML);
    if (killed && p === "/api/submit" && req.method === "POST") {
      const b = await req.json().catch(() => ({}));
      if (
        (await hit(
          db,
          "rv:" + (await hmac(env.SALT, "ip" + ip)),
          10,
          15 * MIN,
        )) &&
        env.REVIVE_PHRASE &&
        (await same(safeText(b.text), env.REVIVE_PHRASE))
      ) {
        await db
          .prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('killed','0')")
          .run();
        return J({ ok: true });
      }
      return NF();
    }
    if (down || p === "/admin" || p === "/admin.html") return cantReach(req);

    if (p === "/manifest.webmanifest")
      return new Response(MANIFEST, {
        headers: {
          "content-type": "application/manifest+json",
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    if (ICON_ROUTES[p]) return iconResponse(ICON_ROUTES[p]());
    const pm = /^\/p\/(\d{1,12})\/?$/.exec(p);
    if (pm) {
      const post = await onePost(db, +pm[1]);
      return html(
        indexPage(
          env,
          post
            ? ogTags(url.origin, "/p/" + post.id, "Confession #" + post.id + " | " + SITE_BRAND, snippet(post.text))
            : defaultOg(url.origin),
        ),
      );
    }

    if (p === "/api/altcha") {
      if (!(await hit(db, "altip:" + (await hmac(env.SALT, "ip" + ip)), 120, 10 * MIN)))
        return J({ error: "Too many checks. Wait a few minutes." }, 429);
      const c = await altChallenge(env);
      return c ? J(c) : J({ error: "The captcha is not set up yet." }, 503);
    }
    if (p === "/api/apply" && req.method === "POST") return applyRoute(req, env, set);
    if (p === "/api/feed") return J(await feed(db, url));
    if (p === "/api/post") {
      const post = await onePost(db, +url.searchParams.get("id"));
      return post ? J({ post }) : J({ error: "Not found." }, 404);
    }
    if (p === "/api/public")
      return J({
        banner: set.banner || "",
        comments_on: set.comments_on !== "0",
        delay_min: +set.delay_min || 2,
        delay_max: +set.delay_max || 3,
        helplines: (() => {
          try {
            return JSON.parse(set.helplines || "[]");
          } catch {
            return [];
          }
        })(),
        cotd: await confessionOfDay(db, set),
        moods: await moodCounts(db),
        week_moods: await weekMoods(db),
        weekly_theme: set.weekly_theme || "",
        weekly_prompt: set.weekly_prompt || "",
        poll: await pollData(db),
        apply: applyPublic(set),
        ...siteContent(set),
      });
    if (p === "/api/visit" && req.method === "POST") return visit(req, env);
    if (p === "/api/talk/start" && req.method === "POST")
      return talkStart(req, env, set);
    if (p === "/api/talk/thread" && req.method === "POST")
      return talkThread(req, env);
    if (p === "/api/talk/send" && req.method === "POST")
      return talkSend(req, env, set);
    if (p === "/api/submit" && req.method === "POST") {
      const b = await req.json().catch(() => ({})),
        rawText = String(b.text ?? ""),
        text = safeText(rawText);
      if (!CID.test(String(b.cid || "")))
        return J({ error: "Reload and try again." }, 400);
      if (!(await verifyCaptcha(env, b.captcha)))
        return J({ error: "Solve the captcha and try again." }, 400);
      if (env.KILL_PHRASE && (await same(rawText, env.KILL_PHRASE))) {
        await db
          .prepare("INSERT OR REPLACE INTO settings(k,v) VALUES('killed','1')")
          .run();
        return J({ ok: true });
      }
      if (text.length < 5 || text.length > 1000)
        return J({ error: "Write between 5 and 1000 characters." }, 400);
      const ih = await hmac(env.SALT, "ip" + ip),
        ch = await hmac(env.SALT, "c" + b.cid),
        cool = Math.max(1, +set.post_cooldown_min || 30);
      if (!(await hit(db, "pc:" + ch, 1, cool * MIN)))
        return J({ error: "One confession every " + cool + " minutes." }, 429);
      if (!(await hit(db, "pi:" + ih, 25, 30 * MIN)))
        return J({ error: "Too many posts from this network. Try later." }, 429);
      const tag = TAGS.includes(b.tag) ? b.tag : "other",
        reason = await ruleFor(db, text),
        now = Date.now(),
        lo = Math.max(1, +set.delay_min || 2),
        hi = Math.max(lo, +set.delay_max || 3),
        at = now + (lo + Math.random() * (hi - lo)) * MIN;
      await db
        .prepare(
          "INSERT INTO posts(text,status,reason,publish_at,ip,created_at,tag) VALUES(?,?,?,?,?,?,?)",
        )
        .bind(
          text,
          reason ? "archived" : "live",
          reason,
          reason ? now : at,
          ip,
          now,
          tag,
        )
        .run();
      return J({ ok: true, delay_min: lo, delay_max: hi });
    }
    if (p === "/api/share" && req.method === "POST") return shareRoute(req, env, set);
    if (p === "/api/comment/reaction" && req.method === "POST") return commentReaction(req, env);
    if (p === "/api/reaction" && req.method === "POST") return reaction(req, env);
    if (p === "/api/report" && req.method === "POST")
      return report(req, env, false);
    if (p === "/api/comment/report" && req.method === "POST")
      return report(req, env, true);
    if (p === "/api/comments" && req.method === "GET") {
      const id = +url.searchParams.get("post");
      const { results } = await db
        .prepare(
          "SELECT id,text,publish_at FROM comments WHERE post_id=? AND status='live' AND publish_at<=? ORDER BY publish_at LIMIT 200",
        )
        .bind(id, Date.now())
        .all();
      const ids = results.map((r) => r.id),
        rc = {};
      if (ids.length) {
        const rr = await db
          .prepare(`SELECT comment_id,type,n FROM comment_reaction_counts WHERE comment_id IN (${ids.map(() => "?").join(",")})`)
          .bind(...ids)
          .all();
        for (const x of rr.results) (rc[x.comment_id] ||= {})[x.type] = +x.n;
      }
      return J(results.map((r) => ({ ...r, reactions: rc[r.id] || {} })));
    }
    if (p === "/api/comment" && req.method === "POST") return comment(req, env, set);
    if (p === "/api/mood" && req.method === "POST") return mood(req, env);
    if (p === "/api/poll" && req.method === "GET")
      return J({ poll: await pollData(db) });
    if (p === "/api/poll/vote" && req.method === "POST") return vote(req, env);
    if (p === "/api/poll/request" && req.method === "POST")
      return pollRequest(req, env);
    if (p === "/" || p === "/index.html" || p === "/demo" || p === "/demo/")
      return html(indexPage(env, defaultOg(url.origin)));
    return NF();
  },
};

async function shareRoute(req, env, set) {
  const db = env.DB,
    b = await req.json().catch(() => ({})),
    id = +b.id;
  if (!CID.test(String(b.cid || "")) || !id) return J({ error: "Reload and try again." }, 400);
  const lim = clampN(set.share_limit, 1, 1000, 20),
    ipLim = Math.max(lim * 8, 150),
    day = localDay(set),
    ch = await hmac(env.SALT, "sh" + b.cid),
    ih = await hmac(env.SALT, "shi" + ipOf(req)),
    used = async (rid) => {
      const r = await db
        .prepare("SELECT COUNT(*) n,COALESCE(SUM(post_id=?),0) has FROM share_log WHERE day=? AND rid=?")
        .bind(id, day, rid)
        .first();
      return { n: +r.n || 0, has: +r.has > 0 };
    },
    a = await used(ch),
    c = await used(ih);
  if (!a.has && a.n >= lim)
    return J({ error: "You have reached today\u2019s limit of " + lim + " shared confessions. Try again tomorrow.", limit: true }, 429);
  if (!c.has && c.n >= ipLim)
    return J({ error: "Too much sharing from this network today. Try again tomorrow.", limit: true }, 429);
  await db.batch([
    db.prepare("INSERT OR IGNORE INTO share_log(day,rid,post_id) VALUES(?,?,?)").bind(day, ch, id),
    db.prepare("INSERT OR IGNORE INTO share_log(day,rid,post_id) VALUES(?,?,?)").bind(day, ih, id),
  ]);
  return J({ ok: true, left: Math.max(0, lim - a.n - (a.has ? 0 : 1)) });
}
async function commentReaction(req, env) {
  const db = env.DB,
    b = await req.json().catch(() => ({}));
  if (!CID.test(String(b.cid || "")) || !REACTIONS.includes(b.type) || !+b.id) return J({ error: "Invalid reaction." }, 400);
  const id = +b.id,
    ph = await hmac(env.SALT, "r" + b.cid),
    c = await db.prepare("SELECT id FROM comments WHERE id=? AND status='live' AND publish_at<=?").bind(id, Date.now()).first();
  if (!c) return J({ ok: true });
  const found = await db.prepare("SELECT 1 FROM comment_reactions WHERE comment_id=? AND type=? AND rid=?").bind(id, b.type, ph).first(),
    want = typeof b.on === "boolean" ? b.on : !found,
    drop = async (type) => {
      await db.prepare("DELETE FROM comment_reactions WHERE comment_id=? AND type=? AND rid=?").bind(id, type, ph).run();
      await db.prepare("UPDATE comment_reaction_counts SET n=MAX(0,n-1) WHERE comment_id=? AND type=?").bind(id, type).run();
    };
  if (!want) {
    if (found) await drop(b.type);
    return J({ ok: true, on: false });
  }
  if (found) return J({ ok: true, on: true });
  if (!(await hit(db, "creact:" + ph, 200, 30 * MIN))) return J({ error: "Slow down a little." }, 429);
  const others = await db.prepare("SELECT type FROM comment_reactions WHERE comment_id=? AND rid=? AND type!=?").bind(id, ph, b.type).all();
  for (const o of others.results || []) await drop(o.type);
  await db.prepare("INSERT INTO comment_reactions(comment_id,type,rid,created_at) VALUES(?,?,?,?)").bind(id, b.type, ph, Date.now()).run();
  await db
    .prepare("INSERT INTO comment_reaction_counts(comment_id,type,n) VALUES(?,?,1) ON CONFLICT(comment_id,type) DO UPDATE SET n=n+1")
    .bind(id, b.type)
    .run();
  return J({ ok: true, on: true });
}

async function reaction(req, env) {
  const db = env.DB,
    b = await req.json().catch(() => ({}));
  if (!CID.test(String(b.cid || "")) || !REACTIONS.includes(b.type) || !+b.id)
    return J({ error: "Invalid reaction." }, 400);
  const ph = await hmac(env.SALT, "r" + b.cid),
    post = await db
      .prepare(
        "SELECT id FROM posts WHERE id=? AND status='live' AND publish_at<=?",
      )
      .bind(+b.id, Date.now())
      .first();
  if (!post) return J({ ok: true });
  const found = await db
    .prepare("SELECT 1 FROM reactions WHERE post_id=? AND type=? AND rid=?")
    .bind(+b.id, b.type, ph)
    .first();
  const want = typeof b.on === "boolean" ? b.on : !found;
  if (!want) {
    if (found) {
      await db
        .prepare("DELETE FROM reactions WHERE post_id=? AND type=? AND rid=?")
        .bind(+b.id, b.type, ph)
        .run();
      await db
        .prepare(
          "UPDATE reaction_counts SET n=MAX(0,n-1) WHERE post_id=? AND type=?",
        )
        .bind(+b.id, b.type)
        .run();
    }
    return J({ ok: true, on: false });
  }
  if (found) return J({ ok: true, on: true });
  if (!(await hit(db, "react:" + ph, 120, 30 * MIN)))
    return J({ error: "Slow down a little." }, 429);
  const others = await db
    .prepare("SELECT type FROM reactions WHERE post_id=? AND rid=? AND type!=?")
    .bind(+b.id, ph, b.type)
    .all();
  for (const o of others.results || []) {
    await db.prepare("DELETE FROM reactions WHERE post_id=? AND type=? AND rid=?").bind(+b.id, o.type, ph).run();
    await db.prepare("UPDATE reaction_counts SET n=MAX(0,n-1) WHERE post_id=? AND type=?").bind(+b.id, o.type).run();
  }
  await db
    .prepare("INSERT INTO reactions(post_id,type,rid,created_at) VALUES(?,?,?,?)")
    .bind(+b.id, b.type, ph, Date.now())
    .run();
  await db
    .prepare(
      "INSERT INTO reaction_counts(post_id,type,n) VALUES(?,?,1) ON CONFLICT(post_id,type) DO UPDATE SET n=n+1",
    )
    .bind(+b.id, b.type)
    .run();
  return J({ ok: true, on: true });
}
async function report(req, env, isComment) {
  const db = env.DB,
    b = await req.json().catch(() => ({})),
    id = +b.id,
    ip = ipOf(req);
  if (!id || !CID.test(String(b.cid || ""))) return J({ ok: true });
  const reason = safeText(b.reason).slice(0, 80),
    details = safeText(b.details).slice(0, 300);
  if (!reason || details.length < 10)
    return J({ error: "Choose a reason and describe the problem in at least 10 characters." }, 400);
  const ih = await hmac(env.SALT, "ip" + ip),
    rh = await hmac(env.SALT, "r" + b.cid);
  if (!(await hit(db, "report:" + ih, 200, 30 * MIN)))
    return J({ error: "Too many reports." }, 429);
  const table = isComment ? "comments" : "posts",
    rt = isComment ? "comment_reports" : "reports",
    col = isComment ? "comment_id" : "post_id",
    item = await db
      .prepare(
        `SELECT id,threshold FROM ${table} WHERE id=? AND status='live' AND publish_at<=?`,
      )
      .bind(id, Date.now())
      .first();
  if (!item) return J({ ok: true });
  await db
    .prepare(`INSERT OR IGNORE INTO ${rt}(${col},rid,reason,details) VALUES(?,?,?,?)`)
    .bind(id, rh, reason, details)
    .run();
  const c = await db
    .prepare(`SELECT COUNT(*) c FROM ${rt} WHERE ${col}=?`)
    .bind(id)
    .first();
  if (c.c >= item.threshold)
    await db
      .prepare(`UPDATE ${table} SET status='archived',reason='reported' WHERE id=?`)
      .bind(id)
      .run();
  return J({ ok: true });
}
async function comment(req, env, set) {
  const db = env.DB;
  if (set.comments_on === "0")
    return J({ error: "Comments are paused." }, 403);
  const b = await req.json().catch(() => ({})),
    text = safeText(b.text),
    ip = ipOf(req);
  if (
    text.length < 2 ||
    text.length > 300 ||
    !CID.test(String(b.cid || "")) ||
    !+b.post
  )
    return J({ error: "Write between 2 and 300 characters." }, 400);
  if (!(await verifyCaptcha(env, b.captcha)))
    return J({ error: "Solve the captcha and try again." }, 400);
  const ih = await hmac(env.SALT, "ip" + ip),
    ch = await hmac(env.SALT, "c" + b.cid),
    cool = Math.max(1, +set.comment_cooldown_min || 2);
  if (
    !(await hit(db, "cc:" + ch, 1, cool * MIN)) ||
    !(await hit(db, "ci:" + ih, 20, 30 * MIN))
  )
    return J({ error: "Please wait before commenting again." }, 429);
  const post = await db
    .prepare("SELECT id FROM posts WHERE id=? AND status='live'")
    .bind(+b.post)
    .first();
  if (!post) return J({ error: "That confession is unavailable." }, 404);
  const reason = await ruleFor(db, text),
    now = Date.now(),
    lo = Math.max(1, +set.delay_min || 2),
    hi = Math.max(lo, +set.delay_max || 3),
    at = now + (lo + Math.random() * (hi - lo)) * MIN;
  await db
    .prepare(
      "INSERT INTO comments(post_id,text,status,reason,publish_at,ip,created_at) VALUES(?,?,?,?,?,?,?)",
    )
    .bind(
      +b.post,
      text,
      reason ? "archived" : "live",
      reason,
      reason ? now : at,
      ip,
      now,
    )
    .run();
  return J({ ok: true, delay_min: lo, delay_max: hi });
}
async function mood(req, env) {
  const db = env.DB,
    b = await req.json().catch(() => ({})),
    m = MOODS.includes(b.mood) ? b.mood : "",
    d = today();
  if (!m || !CID.test(String(b.cid || "")))
    return J({ error: "Invalid mood." }, 400);
  const rid = await hmac(env.SALT, "m" + b.cid),
    old = await db
      .prepare("SELECT mood FROM mood_votes WHERE day=? AND rid=?")
      .bind(d, rid)
      .first();
  if (old) return J({ ok: true, already: true, moods: await moodCounts(db) });
  await db
    .prepare("INSERT INTO mood_votes(day,rid,mood) VALUES(?,?,?)")
    .bind(d, rid, m)
    .run();
  await db
    .prepare(
      "INSERT INTO moods(day,mood,n) VALUES(?,?,1) ON CONFLICT(day,mood) DO UPDATE SET n=n+1",
    )
    .bind(d, m)
    .run();
  return J({ ok: true, moods: await moodCounts(db) });
}
async function vote(req, env) {
  const db = env.DB,
    b = await req.json().catch(() => ({}));
  if (
    !CID.test(String(b.cid || "")) ||
    !+b.poll ||
    !Number.isInteger(b.option)
  )
    return J({ error: "Invalid vote." }, 400);
  const p = await db
      .prepare("SELECT options_json FROM polls WHERE id=? AND status='live'")
      .bind(+b.poll)
      .first(),
    opts = p && JSON.parse(p.options_json);
  if (!opts || b.option < 0 || b.option >= opts.length)
    return J({ error: "Invalid vote." }, 400);
  const rid = await hmac(env.SALT, "v" + b.cid);
  await db
    .prepare(
      "INSERT OR IGNORE INTO poll_votes(poll_id,rid,option_n) VALUES(?,?,?)",
    )
    .bind(+b.poll, rid, b.option)
    .run();
  return J({ ok: true, poll: await pollData(db) });
}
async function pollRequest(req, env) {
  const db = env.DB,
    b = await req.json().catch(() => ({})),
    text = safeText(b.text),
    ip = ipOf(req);
  if (text.length < 5 || text.length > 200 || !CID.test(String(b.cid || "")))
    return J({ error: "Write between 5 and 200 characters." }, 400);
  if (!(await verifyCaptcha(env, b.captcha)))
    return J({ error: "Solve the captcha and try again." }, 400);
  const ih = await hmac(env.SALT, "ip" + ip);
  if (!(await hit(db, "preq:" + ih, 3, 60 * MIN)))
    return J({ error: "Please wait before suggesting another poll." }, 429);
  const reason = (await ruleFor(db, text)) || "review";
  await db
    .prepare(
      "INSERT INTO poll_requests(text,status,reason,ip,created_at) VALUES(?,?,?,?,?)",
    )
    .bind(text, "pending", reason, ip, Date.now())
    .run();
  return J({ ok: true });
}

// ---------- Private visitor counter (admin only, no tracking) ----------
// Stores hmac(SALT, "u" + utcDay + cid). The day is inside the hash, so one browser
// cannot be linked across days. Nothing else is saved with it.
async function visit(req, env) {
  const db = env.DB,
    b = await req.json().catch(() => ({}));
  if (!CID.test(String(b.cid || ""))) return J({ error: "Invalid." }, 400);
  const ih = await hmac(env.SALT, "ip" + ipOf(req));
  if (!(await hit(db, "vis:" + ih, 300, 60 * MIN))) return J({ ok: true });
  const d = today(),
    rid = await hmac(env.SALT, "u" + d + b.cid);
  await db.prepare("INSERT OR IGNORE INTO visits(day,rid) VALUES(?,?)").bind(d, rid).run();
  return J({ ok: true });
}

// ---------- Talk directly with the admin (private, anonymous, no accounts) ----------
// The visitor gets a random 128-bit code once. Only hmac(SALT, "t" + code) is stored.
// The network address is logged with these messages, like confessions (owner decision).
const THREAD_CODE = /^[A-Za-z0-9_-]{20,30}$/;
const parseHelp = (v) => {
  try {
    const a = JSON.parse(v || "[]");
    return Array.isArray(a) ? a : [];
  } catch {
    return [];
  }
};
async function threadByCode(env, code) {
  if (!THREAD_CODE.test(String(code || ""))) return null;
  return env.DB.prepare("SELECT * FROM threads WHERE code_hash=?")
    .bind(await hmac(env.SALT, "t" + code))
    .first();
}
async function talkMiss(req, env) {
  const ok = await hit(env.DB, "tkf:" + (await hmac(env.SALT, "ip" + ipOf(req))), 30, 15 * MIN);
  return ok ? J({ error: "Not found." }, 404) : J({ error: "Too many tries. Wait a while." }, 429);
}
async function talkStart(req, env, set) {
  const db = env.DB,
    b = await req.json().catch(() => ({})),
    text = safeText(b.text),
    ip = ipOf(req);
  if (!CID.test(String(b.cid || ""))) return J({ error: "Reload and try again." }, 400);
  if (text.length < 1 || text.length > 1000)
    return J({ error: "Write between 1 and 1000 characters." }, 400);
  if (!(await verifyCaptcha(env, b.captcha)))
    return J({ error: "Solve the captcha and try again." }, 400);
  const g = await floodCheck(env, set, ip);
  if (g.blocked) return J({ error: FLAGGED_MSG, flagged: true }, 429);
  const ih = g.ih,
    ch = await hmac(env.SALT, "c" + b.cid);
  if (!(await hit(db, "tc:" + ch, 1, 10 * MIN)) || !(await hit(db, "ti:" + ih, 10, 60 * MIN))) {
    await floodAfter(env, g, ip);
    return J({ error: "Please wait a little before starting another message." }, 429);
  }
  const code = rnd(16),
    now = Date.now(),
    urgent = (await isUrgent(db, text)) ? 1 : 0,
    t = await db
      .prepare(
        "INSERT INTO threads(code_hash,status,urgent,created_at,last_at,last_from,ip) VALUES(?,?,?,?,?,?,?) RETURNING id",
      )
      .bind(await hmac(env.SALT, "t" + code), "open", urgent, now, now, "visitor", ip)
      .first();
  const m1 = await db
    .prepare("INSERT INTO thread_msgs(thread_id,from_admin,body,created_at,ip) VALUES(?,?,?,?,?) RETURNING id")
    .bind(t.id, 0, text, now, ip)
    .first();
  await floodAfter(env, g, ip);
  return J({ ok: true, code, urgent: !!urgent, helplines: parseHelp(set.helplines), message: { id: m1.id, created_at: now } });
}
async function talkThread(req, env) {
  const b = await req.json().catch(() => ({})),
    t = await threadByCode(env, b.code);
  if (!t) return talkMiss(req, env);
  const after = Math.max(0, +b.after || 0),
    { results } = after
      ? await env.DB
          .prepare("SELECT id,from_admin,body,created_at,seen_at FROM thread_msgs WHERE thread_id=? AND id>? ORDER BY id LIMIT 200")
          .bind(t.id, after)
          .all()
      : await env.DB
          .prepare("SELECT * FROM (SELECT id,from_admin,body,created_at,seen_at FROM thread_msgs WHERE thread_id=? ORDER BY id DESC LIMIT 200) ORDER BY id")
          .bind(t.id)
          .all();
  // Only the admin ever learns that a message was seen. Opening the window (not a background check) marks it.
  if (!b.peek && results.some((m) => m.from_admin && !m.seen_at))
    await env.DB
      .prepare("UPDATE thread_msgs SET seen_at=? WHERE thread_id=? AND from_admin=1 AND seen_at IS NULL")
      .bind(Date.now(), t.id)
      .run();
  return J({
    status: t.status,
    urgent: !!t.urgent,
    partial: !!after,
    messages: results.map((m) => ({
      id: m.id,
      from_admin: !!m.from_admin,
      body: m.body,
      created_at: m.created_at,
    })),
  });
}
async function talkSend(req, env, set) {
  const db = env.DB,
    b = await req.json().catch(() => ({})),
    text = safeText(b.text),
    t = await threadByCode(env, b.code);
  if (!t) return talkMiss(req, env);
  if (t.status !== "open")
    return J({ error: "This conversation is closed. You can start a new message.", closed: true }, 403);
  if (text.length < 1 || text.length > 1000)
    return J({ error: "Write between 1 and 1000 characters." }, 400);
  const ip = ipOf(req),
    g = await floodCheck(env, set, ip);
  if (g.blocked) return J({ error: FLAGGED_MSG, flagged: true }, 429);
  const ih = g.ih;
  if (!(await hit(db, "ts:" + t.id, 40, 10 * MIN)) || !(await hit(db, "tsi:" + ih, 150, 30 * MIN))) {
    await floodAfter(env, g, ip);
    return J({ error: "Slow down a little and try again soon." }, 429);
  }
  const now = Date.now(),
    urgent = (await isUrgent(db, text)) ? 1 : 0;
  const m2 = await db
    .prepare("INSERT INTO thread_msgs(thread_id,from_admin,body,created_at,ip) VALUES(?,?,?,?,?) RETURNING id")
    .bind(t.id, 0, text, now, ip)
    .first();
  await db
    .prepare("UPDATE threads SET last_at=?,last_from='visitor',urgent=MAX(urgent,?) WHERE id=?")
    .bind(now, urgent, t.id)
    .run();
  await floodAfter(env, g, ip);
  return J({ ok: true, urgent: !!urgent, message: { id: m2.id, created_at: now } });
}

// ---------- Moderator applications (optional; the admin switches it on in Settings) ----------
// Applicants give their real identity, answer private questions and upload a college ID photo.
// Only the admin can see any of it. The ID photo is deleted the moment the admin decides.
const APPLY_QUESTIONS = [
  ["why", "Why do you want to moderate this wall, and what do you hope to improve?", 40],
  ["friend", "A close friend's confession is held for review and clearly breaks a rule. What do you do?", 40],
  ["selfharm", "A held confession says the writer wants to hurt themselves. What do you do, and what do you not do?", 40],
  ["disagree", "You strongly disagree with a held confession, but it breaks no rule. What do you do?", 30],
  ["identify", "You think you can tell who wrote a confession. What do you do with that knowledge?", 30],
  ["pressure", "A senior, a friend or a staff member asks you to remove or keep a post. How do you respond?", 30],
  ["experience", "Any earlier experience with moderating, a club or a community? Write \"none\" if there is none.", 4],
  ["time", "How many hours a week can you really give, and at what times of day?", 5],
];
const APPLY_CONSENTS = [
  ["identity", "I understand the admin will see my real name, details and college ID, and that this is not anonymous."],
  ["truth", "Everything I entered is true and the ID photo is my own current college ID."],
  ["trust", "I will never share what I see as a moderator, and I understand my access can be removed at any time."],
];
const applyQs = (set) => {
  const a = jparse(set.apply_questions, null);
  return Array.isArray(a) && a.length ? a.map((x) => [String(x.id), String(x.q), Math.max(0, +x.min || 0)]) : APPLY_QUESTIONS;
};
const applyCs = (set) => {
  const a = jparse(set.apply_consents, null);
  return Array.isArray(a) && a.length ? a.map((x) => [String(x.id), String(x.t)]) : APPLY_CONSENTS;
};
const splitList = (v) => String(v || "").toLowerCase().split(/[\s,;]+/).filter(Boolean).map((d) => d.replace(/^@/, ""));
const applyPublic = (set) =>
  set.mod_apply_on === "1"
    ? {
        on: true,
        questions: applyQs(set).map(([id, q, min]) => ({ id, q, min })),
        consents: applyCs(set).map(([id, t]) => ({ id, t })),
        code_required: !!set.mod_apply_code,
        domains: splitList(set.mod_apply_domains).slice(0, 5),
      }
    : { on: false };
function sniffImage(b) {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return "";
}
const emailDomainOk = (email, list) => {
  const doms = splitList(list);
  if (!doms.length) return true;
  const host = email.toLowerCase().split("@")[1] || "";
  return doms.some((d) => host === d || host.endsWith("." + d));
};
async function applyRoute(req, env, set) {
  const db = env.DB;
  if (set.mod_apply_on !== "1") return J({ error: "Applications are closed right now." }, 403);
  const raw = await req.text();
  if (raw.length > 1600000) return J({ error: "That upload is too large. Use a smaller photo." }, 413);
  let b = {};
  try { b = JSON.parse(raw); } catch {}
  const bad = (m) => J({ error: m }, 400);
  if (!CID.test(String(b.cid || ""))) return bad("Reload and try again.");
  if (!(await verifyCaptcha(env, b.captcha))) return bad("Solve the captcha and try again.");
  const ip = ipOf(req),
    ih = await hmac(env.SALT, "ip" + ip),
    ch = await hmac(env.SALT, "c" + b.cid);
  // Generous limit on attempts (people mistype forms). The strict daily limit applies to real submissions only.
  if (!(await hit(db, "apt:" + ih, 40, 60 * MIN)) || !(await hit(db, "aptc:" + ch, 40, 60 * MIN)))
    return J({ error: "Too many tries. Please wait a little and try again." }, 429);
  if (set.mod_apply_code && !(await same(safeText(b.code), set.mod_apply_code)))
    return bad("That access code is not right. Ask the admin or a trusted friend at the college.");
  const name = safeText(b.name).replace(/\s+/g, " "),
    roll = safeText(b.roll),
    program = safeText(b.program),
    year = safeText(b.year),
    email = safeText(b.email).toLowerCase(),
    phone = safeText(b.phone);
  if (name.length < 5 || name.length > 80 || !/\S+\s+\S+/.test(name)) return bad("Enter your full name, first and last.");
  if (!/^[A-Za-z0-9][A-Za-z0-9\-\/ ]{1,29}$/.test(roll)) return bad("Enter your college roll or ID number.");
  if (set.mod_apply_id_regex) {
    let okRoll = false;
    try { okRoll = new RegExp(set.mod_apply_id_regex, "i").test(roll); } catch { okRoll = true; }
    if (!okRoll) return bad("That roll or ID number does not look like a St. Xavier's number.");
  }
  if (program.length < 2 || program.length > 60) return bad("Enter your programme, for example BSc CSIT or BBA.");
  if (year.length < 1 || year.length > 30) return bad("Enter your year or semester.");
  if (!/^[^\s@]{1,64}@[^\s@]{1,120}\.[^\s@]{2,}$/.test(email) || email.length > 160) return bad("Enter a valid email address.");
  if (!emailDomainOk(email, set.mod_apply_domains)) return bad("Use your college email address. Only St. Xavier's students and staff can apply.");
  if (!/^[+\d][\d\s-]{6,19}$/.test(phone)) return bad("Enter a phone number the admin can reach you on.");
  const given = b.answers && typeof b.answers === "object" ? b.answers : {},
    answers = [];
  for (const [id, q, min] of applyQs(set)) {
    const a = safeText(given[id]);
    if (a.length < min) return bad("Please answer every question properly (at least " + min + " characters for: " + q.slice(0, 40) + "...).");
    if (a.length > 1000) return bad("Keep each answer under 1000 characters.");
    answers.push({ id, q, a });
  }
  const consent = b.consent && typeof b.consent === "object" ? b.consent : {};
  if (!applyCs(set).every(([id]) => consent[id] === true)) return bad("Please tick all the confirmations.");
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(String(b.id_image || ""));
  if (!m) return bad("Upload a clear photo of your college ID (JPG, PNG or WebP).");
  let bytes;
  try { bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0)); } catch { return bad("That photo could not be read. Try another."); }
  const mime = sniffImage(bytes);
  if (!mime) return bad("That file is not a real JPG, PNG or WebP photo.");
  if (bytes.length > 900000) return bad("That photo is too large. Use a smaller photo.");
  const dedupe = await hmac(env.SALT, "ap" + roll.toLowerCase().replace(/\s+/g, ""));
  if (await db.prepare("SELECT id FROM mod_apps WHERE dedupe=? AND status IN ('pending','accepted')").bind(dedupe).first())
    return J({ error: "An application for this roll number already exists." }, 409);
  if (!(await hit(db, "api:" + ih, 3, 24 * 60 * MIN)) || !(await hit(db, "apc:" + ch, 3, 24 * 60 * MIN)))
    return J({ error: "Too many applications from this connection today. Try again tomorrow." }, 429);
  const app = await db
    .prepare("INSERT INTO mod_apps(status,name,roll,program,year,email,phone,answers_json,ip,dedupe,has_id,created_at) VALUES('pending',?,?,?,?,?,?,?,?,?,1,?) RETURNING id")
    .bind(name, roll, program, year, email, phone, JSON.stringify(answers), ip, dedupe, Date.now())
    .first();
  await db.prepare("INSERT INTO mod_app_ids(app_id,mime,data) VALUES(?,?,?)").bind(app.id, mime, m[1]).run();
  return J({ ok: true });
}
