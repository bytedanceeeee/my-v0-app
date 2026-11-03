// Backend checks for the roadmap features: link previews, home screen, flairs, top range,
// weekly mood, weekly prompt, visitor counter, helplines, talk-to-admin.
import { Miniflare } from "miniflare";
import { solveToken } from "./_altcha.mjs";
import fs from "fs";
const PERSIST = "/tmp/feat-d1-" + process.pid; fs.rmSync(PERSIST, { recursive: true, force: true });
const script = fs.readFileSync(new URL("../dist/_worker.js", import.meta.url), "utf8");
let captchaOk = true;
const mf = new Miniflare({
  modules: true, script, compatibilityDate: "2024-09-01",
  d1Databases: { DB: "featdb" }, d1Persist: PERSIST,
  bindings: { ADMIN_PASSWORD: "adm-pass-123", ADMIN_PATH: "secret-admin-x", KILL_PHRASE: "kill me now please", REVIVE_PHRASE: "revive me now please", SALT: "testsalt" },
  outboundService: async () => new Response(JSON.stringify({ success: captchaOk }), { headers: { "content-type": "application/json" } }),
});
const db = await mf.getD1Database("DB");
let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; fails.push(name + " " + extra); } console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  " + extra)); };
let ipc = 1;
const req0 = async (path, { method = "GET", body, headers = {}, ip } = {}) => {
  const r = await mf.dispatchFetch("http://localhost" + path, { method, headers: { "CF-Connecting-IP": ip || "8.8.8." + (ipc++ % 250), ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch {}
  return { s: r.status, h: r.headers, t, j };
};
const altFetch = (path) => mf.dispatchFetch("http://localhost" + path, { headers: { "CF-Connecting-IP": "4.4.4." + (1 + Math.floor(Math.random() * 200)) } });
const req = async (path, o = {}) => { if (o.body && o.body.captcha) o = { ...o, body: { ...o.body, captcha: captchaOk ? await solveToken(altFetch) : "invalid" } }; return req0(path, o); };
const cid = (n) => ("abcdef0123456789xyz" + n).slice(0, 24).padEnd(24, "q") + String(n).padStart(4, "0");
const A = { authorization: "Bearer adm-pass-123" };
const sub = (n, text, extra = {}) => req("/api/submit", { method: "POST", body: { text, cid: cid(n), captcha: "tok", tag: "rant", ...extra }, ip: "6.6.6." + n });
const makeLive = () => db.prepare("UPDATE posts SET publish_at=? WHERE status='live'").bind(Date.now() - 1000).run();

// ---- seed posts
await sub(1, "Exam week is crushing me, anyone else <b>feeling</b> it?", { tag: "exams" });
await sub(2, "The canteen momo is the best thing on campus honestly", { tag: "canteen" });
await sub(3, "Shoutout to the library staff for staying open late", { tag: "shoutout" });
await makeLive();
const live = (await req("/api/feed")).j.items;
const pid = live.find((x) => x.text.includes("Exam week")).id;
const secondId = live.find((x) => x.text.includes("canteen")).id;

// ---- 1 link previews
let r = await req("/p/" + pid);
ok("preview: /p/<id> 200 html", r.s === 200 && r.h.get("content-type").includes("text/html"));
ok("preview: og:title has id", r.t.includes('property="og:title" content="Confession #' + pid + ' | Inert Gas"'));
ok("preview: description escaped, no raw <b>", r.t.includes("og:description") && !/og:description"[^>]*<b>/.test(r.t) && r.t.includes("&lt;b&gt;"));
ok("preview: marker replaced", !r.t.includes("<!--og-->"));
ok("preview: no og:image (owner rule)", !r.t.includes("og:image"));
ok("preview page has no hCaptcha", !/hcaptcha/i.test(r.t));
r = await req("/p/999999"); ok("preview: unknown id gets generic tags", r.s === 200 && r.t.includes("og:title") && !r.t.includes("Confession #999999"));
await sub(4, "call me on 9841234567 please"); const hid = (await db.prepare("SELECT id FROM posts ORDER BY id DESC LIMIT 1").first()).id;
r = await req("/p/" + hid); ok("preview: archived post never leaks text", r.s === 200 && !r.t.includes("9841234567") && !r.t.includes("Confession #" + hid));
await sub(5, "Delayed post that is not public yet ok"); const did = (await db.prepare("SELECT id FROM posts ORDER BY id DESC LIMIT 1").first()).id;
r = await req("/p/" + did); ok("preview: unpublished post not leaked", !r.t.includes("Delayed post") && !r.t.includes("Confession #" + did));
r = await req("/"); ok("preview: / has default tags", r.t.includes("og:title") && !r.t.includes("<!--og-->"));
r = await req("/p/abc"); ok("preview: non numeric path 404", r.s === 404);
ok("preview: security headers kept", (await req("/p/" + pid)).h.get("x-frame-options") === "DENY");

// ---- 2 home screen
r = await req("/manifest.webmanifest");
ok("manifest: json fields", r.s === 200 && r.j.short_name === "Inert Gas" && r.j.display === "standalone" && r.j.start_url === "/" && r.j.theme_color === "#0e1014", r.t.slice(0, 200));
ok("manifest: maskable icons 192 + 512", r.j.icons.length === 2 && r.j.icons.every((i) => i.purpose === "any maskable"));
for (const [p, size] of [["/icon-192.png", 192], ["/icon-512.png", 512], ["/apple-touch-icon.png", 180]]) {
  const rr = await mf.dispatchFetch("http://localhost" + p, { headers: { "CF-Connecting-IP": "8.1.1.1" } });
  const buf = Buffer.from(await rr.arrayBuffer());
  ok("icon " + p + " is a PNG of " + size + "px", rr.status === 200 && rr.headers.get("content-type") === "image/png" && buf.slice(1, 4).toString() === "PNG" && buf.readUInt32BE(16) === size);
}
r = await req("/"); ok("home page links manifest + apple icon", r.t.includes('rel="manifest"') && r.t.includes('rel="apple-touch-icon"'));
ok("no service worker file", (await req("/sw.js")).s === 404);

// ---- 3 flairs
r = await req("/api/feed?tag=canteen"); ok("flair filter canteen", r.j.items.length === 1 && r.j.items[0].tag === "canteen");
r = await req("/api/feed?tag=shoutout"); ok("flair filter shoutout", r.j.items.length === 1);
r = await req("/api/feed?tag=exams"); ok("flair filter exams", r.j.items.length === 1);
await sub(6, "Made up flair post goes here okay", { tag: "hackerman" }); await makeLive();
r = await req("/api/feed"); ok("unknown flair falls back to other", r.j.items.some((x) => x.tag === "other" && x.text.includes("Made up flair")));
r = await req("/api/feed?tag=nonsense"); ok("unknown flair filter no 500", r.s === 200);

// ---- 4 top range
const now = Date.now();
await db.prepare("UPDATE posts SET publish_at=? WHERE id=?").bind(now - 3 * 3600e3, pid).run();
await db.prepare("UPDATE posts SET publish_at=? WHERE id=?").bind(now - 3 * 86400e3, secondId).run();
const old = (await req("/api/feed")).j.items.find((x) => x.text.includes("library"));
await db.prepare("UPDATE posts SET publish_at=? WHERE id=?").bind(now - 30 * 86400e3, old.id).run();
const ids = async (q) => (await req("/api/feed?sort=top" + q)).j.items.map((x) => x.id);
let d = await ids("&range=day"), w = await ids("&range=week"), dflt = await ids(""), all = await ids("&range=all"), bad = await ids("&range=zzz");
ok("top day: only last 24h", d.includes(pid) && !d.includes(secondId) && !d.includes(old.id), JSON.stringify(d));
ok("top week: 3 day old included, 30 day old not", w.includes(pid) && w.includes(secondId) && !w.includes(old.id));
ok("top default is week", JSON.stringify(dflt) === JSON.stringify(w));
ok("top all: includes oldest", all.includes(old.id));
ok("top bad range falls back to week", JSON.stringify(bad) === JSON.stringify(w));
r = await req("/api/feed?sort=top&range=day&tag=exams"); ok("top range + flair combine", r.j.items.length === 1 && r.j.items[0].id === pid);
r = await req("/api/feed?sort=latest&range=day"); ok("range ignored outside top", r.j.items.some((x) => x.id === old.id));

// ---- 5 weekly mood
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
r = await req("/api/public"); ok("week_moods empty shape", r.j.week_moods.days.length === 7 && Object.values(r.j.week_moods.totals).every((n) => n === 0));
const moods = Object.keys(r.j.week_moods.totals);
ok("week_moods has four moods", moods.length === 4, moods.join());
await db.prepare("INSERT OR REPLACE INTO moods(day,mood,n) VALUES(?,?,?)").bind(day(0), moods[0], 5).run();
await db.prepare("INSERT OR REPLACE INTO moods(day,mood,n) VALUES(?,?,?)").bind(day(6), moods[0], 2).run();
await db.prepare("INSERT OR REPLACE INTO moods(day,mood,n) VALUES(?,?,?)").bind(day(7), moods[0], 99).run();
r = await req("/api/public");
ok("week_moods totals last 7 days only", r.j.week_moods.totals[moods[0]] === 7, JSON.stringify(r.j.week_moods.totals));
ok("week_moods days ordered oldest to newest", r.j.week_moods.days[0].day === day(6) && r.j.week_moods.days[6].day === day(0));

// ---- 7 weekly prompt
r = await req("/api/public"); ok("weekly fields default empty", r.j.weekly_theme === "" && r.j.weekly_prompt === "");
r = await req("/api/admin/settings", { method: "POST", headers: A, body: { weekly_theme: "Exam <i>season</i>" + "x".repeat(100), weekly_prompt: "What got you through this week? " + "y".repeat(300) } });
r = await req("/api/public");
ok("weekly theme capped at 60", r.j.weekly_theme.length > 0 && r.j.weekly_theme.length <= 60, String(r.j.weekly_theme.length));
ok("weekly prompt capped at 200", r.j.weekly_prompt.startsWith("What got you") && r.j.weekly_prompt.length <= 200, String(r.j.weekly_prompt.length));
r = await req("/api/admin/settings", { method: "POST", body: { weekly_theme: "hack" } }); ok("weekly settings need admin", r.s === 401);
await req("/api/admin/settings", { method: "POST", headers: A, body: { weekly_theme: "", weekly_prompt: "" } });
r = await req("/api/public"); ok("weekly theme can be cleared", r.j.weekly_theme === "" && r.j.weekly_prompt === "");

// ---- 8 visitor counter
r = await req("/api/visit", { method: "POST", body: { cid: "bad" } }); ok("visit bad cid 400", r.s === 400);
await req("/api/visit", { method: "POST", body: { cid: cid(900) }, ip: "7.7.7.1" });
await req("/api/visit", { method: "POST", body: { cid: cid(900) }, ip: "7.7.7.1" });
await req("/api/visit", { method: "POST", body: { cid: cid(901) }, ip: "7.7.7.2" });
let vrows = (await db.prepare("SELECT * FROM visits").all()).results;
ok("visit: same browser counted once per day", vrows.length === 2, JSON.stringify(vrows));
ok("visit: row holds only day + hash, not cid or ip", vrows.every((v) => Object.keys(v).sort().join() === "day,rid" && !v.rid.includes(cid(900)) && !v.rid.includes("7.7.7")));
await db.prepare("INSERT INTO visits(day,rid) VALUES(?,?)").bind(day(1), "yesterdayhash").run();
r = await req("/api/admin/dashboard", { headers: A });
const vt = r.j.visits.find((x) => x.d === day(0));
ok("dashboard shows today's visitors", vt && vt.n === 2, JSON.stringify(r.j.visits));
ok("dashboard shows yesterday", r.j.visits.some((x) => x.d === day(1) && x.n === 1));
await db.prepare("INSERT INTO visits(day,rid) VALUES(?,?)").bind(day(20), "oldhash").run();
r = await req("/api/admin/dashboard", { headers: A }); ok("dashboard only last 14 days", !r.j.visits.some((x) => x.d === day(20)));
r = await req("/api/admin/dashboard"); ok("visits not visible without admin", r.s === 401);
r = await req("/api/public"); ok("visitor counts never in public api", !/"visits?"|visit_?count|"visitors?"\s*:/i.test(r.t) && !Object.keys(r.j).some((k) => /visit/i.test(k)));

// ---- helplines
r = await req("/api/public"); const hl = r.j.helplines;
ok("helplines: both real lines", hl.length === 2 && hl[0].includes("| 1166 |") && hl[1].includes("| 1145 |"), JSON.stringify(hl));
ok("helplines: placeholder gone", !/add a verified number/i.test(r.t));
await db.prepare("UPDATE settings SET v=? WHERE k='helplines'").bind(JSON.stringify(["Local support contact: add a verified number in Admin settings"])).run();
// force migration path by checking a fresh worker instance
const mf2 = new Miniflare({ modules: true, script, compatibilityDate: "2024-09-01", d1Databases: { DB: "featdb" }, d1Persist: PERSIST, bindings: { ADMIN_PASSWORD: "adm-pass-123", ADMIN_PATH: "secret-admin-x", KILL_PHRASE: "k k k k k k", REVIVE_PHRASE: "r r r r r r", SALT: "testsalt" } });
const r2 = await (await mf2.dispatchFetch("http://localhost/api/public", { headers: { "CF-Connecting-IP": "8.2.2.2" } })).json();
ok("helplines: old placeholder is migrated", JSON.stringify(r2.helplines).includes("1166"), JSON.stringify(r2.helplines));
await mf2.dispose();
await db.prepare("UPDATE settings SET v=? WHERE k='helplines'").bind(JSON.stringify(["My custom line | 100 | note"])).run();
const mf3 = new Miniflare({ modules: true, script, compatibilityDate: "2024-09-01", d1Databases: { DB: "featdb" }, d1Persist: PERSIST, bindings: { ADMIN_PASSWORD: "adm-pass-123", ADMIN_PATH: "secret-admin-x", KILL_PHRASE: "k k k k k k", REVIVE_PHRASE: "r r r r r r", SALT: "testsalt" } });
const r3 = await (await mf3.dispatchFetch("http://localhost/api/public", { headers: { "CF-Connecting-IP": "8.3.3.3" } })).json();
ok("helplines: admin custom value is NOT overwritten", r3.helplines[0] === "My custom line | 100 | note", JSON.stringify(r3.helplines));
await mf3.dispose();
await db.prepare("UPDATE settings SET v=? WHERE k='helplines'").bind(JSON.stringify(hl)).run();

// ---- 9 talk to admin
const start = (n, text, extra = {}) => req("/api/talk/start", { method: "POST", body: { cid: cid(n), text, captcha: "t", ...extra }, ip: "9.9.0." + n });
captchaOk = false; r = await start(10, "I need someone to talk to please"); ok("talk: captcha required", r.s === 400); captchaOk = true;
r = await start(10, ""); ok("talk: empty rejected", r.s === 400);
r = await start(10, "x".repeat(1001)); ok("talk: too long rejected", r.s === 400);
r = await req("/api/talk/start", { method: "POST", body: { cid: "bad", text: "hello there friend", captcha: "t" } }); ok("talk: bad cid rejected", r.s === 400);
r = await start(10, "I have been feeling very low about exams lately");
const code = r.j && r.j.code;
ok("talk: start returns code once + helplines", r.s === 200 && /^[A-Za-z0-9_-]{20,30}$/.test(code) && r.j.helplines.length === 2 && r.j.urgent === false, r.t);
let th = await db.prepare("SELECT * FROM threads ORDER BY id DESC LIMIT 1").first();
ok("talk: only a hash of the code is stored", th.code_hash && !th.code_hash.includes(code) && th.status === "open" && th.last_from === "visitor");
ok("talk: not linked to any post or cid", !JSON.stringify(th).includes(cid(10)));
r = await start(10, "second thread too soon from same browser"); ok("talk: one start per 10 min per browser", r.s === 429);
r = await req("/api/talk/thread", { method: "POST", body: { code } });
ok("talk: thread readable with code", r.s === 200 && r.j.messages.length === 1 && r.j.messages[0].from_admin === false && r.j.status === "open", r.t);
ok("talk: thread response exposes no ip", !/"ip"/.test(r.t));
r = await req("/api/talk/thread", { method: "POST", body: { code: "A".repeat(22) } }); ok("talk: wrong code 404", r.s === 404);
r = await req("/api/talk/thread", { method: "POST", body: { code: "short" } }); ok("talk: malformed code 404", r.s === 404);
let lim = false; for (let i = 0; i < 35; i++) { const x = await req("/api/talk/thread", { method: "POST", body: { code: "B".repeat(22) }, ip: "9.9.9.9" }); if (x.s === 429) lim = true; }
ok("talk: code guessing is rate limited", lim);
r = await req("/api/talk/send", { method: "POST", body: { code, text: "Thanks for reading this" } }); ok("talk: visitor can send", r.s === 200);
r = await req("/api/talk/send", { method: "POST", body: { code, text: "" } }); ok("talk: send empty rejected", r.s === 400);
r = await req("/api/talk/send", { method: "POST", body: { code: "C".repeat(22), text: "hello hello" } }); ok("talk: send with wrong code 404", r.s === 404);

// admin side
r = await req("/api/admin/threads"); ok("talk admin: threads need auth", r.s === 401);
r = await req("/api/admin/threads", { headers: A });
ok("talk admin: list shows waiting thread", r.s === 200 && r.j.items.length === 1 && r.j.items[0].waiting === true && r.j.items[0].msgs === 2, r.t);
const tid = r.j.items[0].id;
r = await req("/api/admin/dashboard", { headers: A }); ok("talk admin: dashboard badge counts waiting", r.j.threads_waiting === 1);
r = await req("/api/admin/thread?id=" + tid, { headers: A }); ok("talk admin: thread detail with messages", r.s === 200 && r.j.messages.length === 2);
r = await req("/api/admin/thread?id=99999", { headers: A }); ok("talk admin: missing thread 404", r.s === 404);
r = await req("/api/admin/thread/reply", { method: "POST", headers: A, body: { id: tid, text: "Hi, I am a volunteer. I am here." } }); ok("talk admin: reply works", r.s === 200);
r = await req("/api/talk/thread", { method: "POST", body: { code } });
ok("talk: visitor sees admin reply", r.j.messages.length === 3 && r.j.messages[2].from_admin === true && r.j.messages[2].body.includes("volunteer"));
r = await req("/api/admin/dashboard", { headers: A }); ok("talk admin: badge clears after reply", r.j.threads_waiting === 0);
r = await req("/api/admin/threads", { headers: A }); ok("talk admin: thread no longer waiting", r.j.items[0].waiting === false);
r = await req("/api/admin/thread/reply", { method: "POST", headers: A, body: { id: tid, text: "" } }); ok("talk admin: empty reply rejected", r.s === 400);
r = await req("/api/admin/thread/status", { method: "POST", headers: A, body: { id: tid, status: "bogus" } }); ok("talk admin: bad status rejected", r.s === 400);
r = await req("/api/admin/thread/status", { method: "POST", headers: A, body: { id: tid, status: "closed" } }); ok("talk admin: close works", r.s === 200);
r = await req("/api/talk/send", { method: "POST", body: { code, text: "Are you still there?" } }); ok("talk: send blocked while closed", r.s === 403 && r.j.closed === true);
r = await req("/api/talk/thread", { method: "POST", body: { code } }); ok("talk: closed thread still readable", r.s === 200 && r.j.status === "closed");
r = await req("/api/admin/thread/reply", { method: "POST", headers: A, body: { id: tid, text: "reply while closed" } }); ok("talk admin: reply blocked while closed", r.s === 400);
r = await req("/api/admin/threads?status=closed", { headers: A }); ok("talk admin: closed list", r.j.items.length === 1);
r = await req("/api/admin/thread/status", { method: "POST", headers: A, body: { id: tid, status: "open" } }); ok("talk admin: reopen works", r.s === 200);
ok("talk: nothing is hard deleted", (await db.prepare("SELECT COUNT(*) c FROM thread_msgs").first()).c === 3);

// urgent + ordering
r = await start(11, "I want to die, I can't do this anymore");
ok("talk: self-harm wording marks urgent + returns helplines", r.s === 200 && r.j.urgent === true && r.j.helplines.length === 2, r.t);
const code2 = r.j.code;
r = await req("/api/admin/threads", { headers: A }); ok("talk admin: urgent sorted first", r.j.items[0].urgent === 1 && r.j.items.length === 2, r.t);
r = await req("/api/admin/dashboard", { headers: A }); ok("talk admin: dashboard urgent count", r.j.threads_urgent === 1);
r = await req("/api/talk/send", { method: "POST", body: { code, text: "Some days I just want to die" } }); r = await req("/api/admin/threads", { headers: A });
ok("talk: urgent set by later message too", r.j.items.filter((x) => x.urgent === 1).length === 2);

// no per-conversation message cap (admin can receive unlimited messages)
r = await start(12, "A thread to test there is no message cap"); const code3 = r.j.code; const t3 = (await db.prepare("SELECT id FROM threads ORDER BY id DESC LIMIT 1").first()).id;
await db.batch(Array.from({ length: 250 }, (_, i) => db.prepare("INSERT INTO thread_msgs(thread_id,from_admin,body,created_at) VALUES(?,?,?,?)").bind(t3, 0, "filler " + i, Date.now())));
r = await req("/api/talk/send", { method: "POST", body: { code: code3, text: "one more message" } }); ok("talk: no 100 message cap, stays open", r.s === 200 && r.j.ok === true, r.t);
r = await req("/api/talk/thread", { method: "POST", body: { code: code3 } }); ok("talk: visitor sees the NEWEST 200 messages", r.j.messages.length === 200 && r.j.messages.at(-1).body === "one more message");

// per-thread rate limit
r = await start(13, "A thread to test send rate limiting ok"); const code4 = r.j.code; let rl = false;
for (let i = 0; i < 45; i++) { const x = await req("/api/talk/send", { method: "POST", body: { code: code4, text: "message number " + i }, ip: "9.9.5." + i }); if (x.s === 429) rl = true; }
ok("talk: per-thread send rate limit", rl);

// moderators have no access
await req("/api/admin/settings", { method: "POST", headers: A, body: { mod_path: "review" } });
const mr = await req("/api/admin/mod", { method: "POST", headers: A, body: { username: "mod_feat" } });
const mpw = mr.j && mr.j.password;
ok("moderator created for access checks", !!mpw, mr.t);
const M = { "x-jbs-mod-user": "mod_feat", "x-jbs-mod-password": mpw || "x" };
if (mpw) { r = await req("/api/mod/me", { headers: M, ip: "4.4.4.9" }); ok("mod account works (precondition)", r.s === 200, r.t); }
r = await req("/api/admin/threads", { headers: M, ip: "4.4.4.9" }); ok("talk: moderator blocked from admin threads", r.s === 401);
r = await req("/api/admin/thread?id=" + tid, { headers: M, ip: "4.4.4.9" }); ok("talk: moderator blocked from thread detail", r.s === 401);
r = await req("/api/mod/threads", { headers: M, ip: "4.4.4.9" }); ok("talk: no moderator thread route", r.s === 404);
r = await req("/api/mod/list", { headers: M, ip: "4.4.4.9" }); ok("talk: moderator list contains no threads", !/thread/i.test(r.t));

// kill switch
await req("/api/admin/kill", { method: "POST", headers: A, body: { on: true } });
r = await req("/api/talk/thread", { method: "POST", body: { code } }); ok("kill: talk/thread 404", r.s === 404);
r = await req("/api/talk/send", { method: "POST", body: { code, text: "still here?" } }); ok("kill: talk/send 404", r.s === 404);
r = await start(14, "starting a thread while the site is off"); ok("kill: talk/start 404", r.s === 404);
ok("kill: /p/<id> 404", (await req("/p/" + pid)).s === 404);
ok("kill: manifest 404", (await req("/manifest.webmanifest")).s === 404);
ok("kill: icon 404", (await req("/icon-192.png")).s === 404);
ok("kill: visit 404", (await req("/api/visit", { method: "POST", body: { cid: cid(950) } })).s === 404);
r = await req("/api/admin/threads", { headers: A }); ok("kill: admin can still read messages", r.s === 200);
await req("/api/admin/kill", { method: "POST", headers: A, body: { on: false } });
ok("kill off again: manifest back", (await req("/manifest.webmanifest")).s === 200);

// no em dashes in served pages and manifest
const pages = [(await req("/")).t, (await req("/secret-admin-x")).t, (await req("/review")).t, (await req("/manifest.webmanifest")).t];
ok("no em dashes in served pages", pages.every((t) => !t.includes("\u2014")));

console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log("FAILURES:\n" + fails.join("\n"));
await mf.dispose(); fs.rmSync(PERSIST, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
