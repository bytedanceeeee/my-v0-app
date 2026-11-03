import { Miniflare } from "miniflare";
import { solveToken } from "./_altcha.mjs";
import fs from "fs";
const OUT = new URL("./out/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const script = fs.readFileSync(new URL("../dist/_worker.js", import.meta.url), "utf8");
let captchaOk = true, outbound = [];
const mf = new Miniflare({
  modules: true, script, compatibilityDate: "2024-09-01",
  d1Databases: { DB: "testdb" },
  bindings: { ADMIN_PASSWORD: "adm-pass-123", ADMIN_PATH: "secret-admin-x", KILL_PHRASE: "kill me now please", REVIVE_PHRASE: "revive me now please", SALT: "testsalt" },
  outboundService: async (req) => { outbound.push(req.url); return new Response(JSON.stringify({ success: captchaOk }), { headers: { "content-type": "application/json" } }); },
});
const db = await mf.getD1Database("DB");
let pass = 0, fail = 0; const fails = [];
const ok = (name, cond, extra = "") => { if (cond) pass++; else { fail++; fails.push(name + " " + extra); } console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  " + extra)); };
const U = "http://localhost";
let ipc = 1;
const req0 = async (path, { method = "GET", body, headers = {}, ip } = {}) => {
  const r = await mf.dispatchFetch(U + path, { method, headers: { "CF-Connecting-IP": ip || "9.9.9." + (ipc), ...(body ? { "content-type": "application/json" } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch {}
  return { s: r.status, h: r.headers, t, j };
};
const altFetch = (path) => mf.dispatchFetch("http://localhost" + path, { headers: { "CF-Connecting-IP": "4.4.4." + (1 + Math.floor(Math.random() * 200)) } });
const req = async (path, o = {}) => { if (o.body && o.body.captcha) o = { ...o, body: { ...o.body, captcha: captchaOk ? await solveToken(altFetch) : "invalid" } }; return req0(path, o); };
const cid = (n) => ("abcdef0123456789xyz" + n).slice(0, 24).padEnd(24, "q") + String(n).padStart(4, "0");
const A = { authorization: "Bearer adm-pass-123" };
const makeLive = async () => { await db.prepare("UPDATE posts SET publish_at=? WHERE status='live'").bind(Date.now() - 1000).run(); };

// 1 pages
let r = await req("/");
ok("root 200 html", r.s === 200 && r.h.get("content-type").includes("text/html"));
ok("no hCaptcha anywhere in the page", !/hcaptcha/i.test(r.t));
ok("CSP present, NO external hosts", /content-security-policy/i.test([...r.h.keys()].join()) && !/https?:\/\//.test(r.h.get("content-security-policy")));
ok("security headers", r.h.get("x-content-type-options") === "nosniff" && r.h.get("x-frame-options") === "DENY" && r.h.get("referrer-policy") === "no-referrer");
ok("branding Inert Gas, St. Xavier's, no JBS visible", r.t.includes("St. Xavier") && r.t.includes("Inert Gas") && !/Saint JBS/.test(r.t));
ok("IP logging notice visible", /network address|IP address/i.test(r.t));
ok("/demo served", (await req("/demo")).s === 200);
ok("/unknown 404", (await req("/nope")).s === 404);
ok("/admin 404", (await req("/admin")).s === 404);
r = await req("/secret-admin-x"); ok("hidden admin path serves page", r.s === 200 && r.t.length > 1000);
r = await req("/review"); ok("mod page at /review", r.s === 200);

// 2 empty api
r = await req("/api/public"); ok("api/public", r.s === 200 && r.j && r.j.delay_min === 2 && r.j.delay_max === 3, r.t.slice(0,200));
r = await req("/api/feed"); ok("empty feed", r.s === 200 && r.j.items.length === 0 && r.j.next === null);

// 3 submit
const sub = (n, text, extra = {}) => req("/api/submit", { method: "POST", body: { text, cid: cid(n), captcha: "tok", tag: "rant", ...extra }, ip: "5.5.5." + n });
captchaOk = false; r = await sub(1, "hello this is clean text"); ok("captcha fail rejected", r.s === 400); captchaOk = true;
r = await sub(1, "hi"); ok("too short rejected", r.s === 400);
r = await sub(1, "x".repeat(1001)); ok("too long rejected", r.s === 400);
r = await req("/api/submit", { method: "POST", body: { text: "hello clean text", cid: "bad", captcha: "t" } }); ok("bad cid rejected", r.s === 400);
r = await sub(1, "I am so tired of the canteen queue lately"); ok("clean post accepted", r.s === 200 && r.j.ok, r.t);
let row = await db.prepare("SELECT * FROM posts ORDER BY id DESC LIMIT 1").first();
ok("clean post live + delayed 2-3min", row.status === "live" && row.publish_at - row.created_at >= 119000 && row.publish_at - row.created_at <= 181000, JSON.stringify(row));
ok("IP logged on post", row.ip === "5.5.5.1");
r = await req("/api/feed"); ok("post hidden before delay", r.j.items.length === 0);
r = await sub(1, "another post from same browser"); ok("cooldown 429", r.s === 429);
r = await sub(2, "call me on 9841234567 please"); ok("filtered accepted (generic OK reply)", r.s === 200);
row = await db.prepare("SELECT * FROM posts ORDER BY id DESC LIMIT 1").first();
ok("filtered -> archived w/ reason, ip kept", row.status === "archived" && row.reason === "doxxing" && row.ip === "5.5.5.2", JSON.stringify(row));
const filt = { 3: ["check https://evil.com now", "link"], 4: ["my prof is annoying", "staff"], 5: ["I want to die honestly", "self-harm"], 6: ["he is a bitch", "abuse"], 7: ["add me @someone", "handle"] };
for (const [n, [t, why]] of Object.entries(filt)) { await sub(+n, t); const rr = await db.prepare("SELECT status,reason FROM posts ORDER BY id DESC LIMIT 1").first(); ok(`filter ${why}`, rr.status === "archived" && rr.reason === why, JSON.stringify(rr)); }
await makeLive();
r = await req("/api/feed"); ok("clean post visible after delay", r.j.items.length === 1 && !JSON.stringify(r.j).includes("ip") && !r.j.items.some(x=>x.text.includes("9841234567")), r.t.slice(0,300));
ok("archived never public", !r.t.includes("evil.com") && !r.t.includes("someone"));
const pid = r.j.items[0].id;

// 4 xss stored raw as JSON
await sub(20, "<img src=x onerror=alert(1)> hello world ok"); await makeLive();
r = await req("/api/feed"); ok("html payload returned as data (client must use textContent)", r.j.items.some(x => x.text.includes("<img")) && r.h.get("content-type").includes("json"));

// 5 reactions
const react = (c, type, on) => req("/api/reaction", { method: "POST", body: { id: pid, cid: cid(c), type, ...(on === undefined ? {} : { on }) } });
await react(100, "like"); await react(100, "like", true); await react(101, "like"); await react(102, "laugh");
r = await req("/api/feed"); let it = r.j.items.find(x => x.id === pid);
ok("reaction counts, idempotent per browser", it.reactions.like === 2 && it.reactions.laugh === 1, JSON.stringify(it.reactions));
await react(101, "laugh"); r = await req("/api/feed"); it = r.j.items.find(x => x.id === pid);
ok("one reaction per browser: laugh replaces like", it.reactions.like === 1 && it.reactions.laugh === 2, JSON.stringify(it.reactions));
await react(101, "like"); r = await req("/api/feed"); it = r.j.items.find(x => x.id === pid);
ok("one reaction per browser: like replaces laugh", it.reactions.like === 2 && it.reactions.laugh === 1, JSON.stringify(it.reactions));
await react(101, "like", false); r = await req("/api/feed"); it = r.j.items.find(x => x.id === pid);
ok("reaction toggle off", it.reactions.like === 1, JSON.stringify(it.reactions));
await react(101, "like", false); r = await req("/api/feed"); it = r.j.items.find(x => x.id === pid); ok("no negative/double decrement", it.reactions.like === 1);
r = await req("/api/reaction", { method: "POST", body: { id: pid, cid: cid(100), type: "hack" } }); ok("invalid reaction type 400", r.s === 400);
r = await req("/api/post?id=" + pid); ok("single post fetch", r.s === 200 && r.j.post.id === pid);
r = await req("/api/post?id=99999"); ok("missing post 404", r.s === 404);

// 6 comments
const com = (n, text, post = pid) => req("/api/comment", { method: "POST", body: { post, text, cid: cid(n), captcha: "t" }, ip: "6.6.6." + n });
r = await com(200, "nice relatable one"); ok("comment accepted", r.s === 200, r.t);
r = await com(200, "second one too fast"); ok("comment cooldown", r.s === 429);
r = await com(201, "ping me 9841234567 now"); ok("filtered comment accepted", r.s === 200);
const cs = await db.prepare("SELECT status,reason,ip FROM comments ORDER BY id").all();
ok("comment states + ip logged", cs.results[0].status === "live" && cs.results[1].status === "archived" && cs.results[1].ip === "6.6.6.201", JSON.stringify(cs.results));
await db.prepare("UPDATE comments SET publish_at=? WHERE status='live'").bind(Date.now() - 1).run();
r = await req("/api/comments?post=" + pid); ok("comments list shows only live", r.j.length === 1 && r.j[0].text.includes("relatable") && !JSON.stringify(r.j).includes("ip"));
r = await com(202, "x", pid); ok("comment too short", r.s === 400);
r = await com(203, "valid comment text", 9999); ok("comment on missing post 404", r.s === 404);

// 7 reports
r = await req("/api/report", { method: "POST", body: { id: pid, cid: cid(300), reason: "spam" } }); ok("report without details is refused", r.s === 400);
r = await req("/api/report", { method: "POST", body: { id: pid, cid: cid(300), reason: "Spam or selling", details: "Selling notes in the second line" } }); ok("report ok", r.s === 200);
row = await db.prepare("SELECT reason,details FROM reports WHERE post_id=?").bind(pid).first();
ok("report details stored", row.reason === "Spam or selling" && row.details.includes("Selling notes"), JSON.stringify(row));
row = await db.prepare("SELECT status,reason FROM posts WHERE id=?").bind(pid).first();
ok("report threshold(1) archives for review (not deleted)", row.status === "archived" && row.reason === "reported", JSON.stringify(row));

// 8 moods / poll
r = await req("/api/mood", { method: "POST", body: { mood: "tired", cid: cid(400) } }); ok("mood", r.s === 200 && r.j.moods.tired === 1);
r = await req("/api/mood", { method: "POST", body: { mood: "tired", cid: cid(400) } }); ok("mood once/day", r.j.already === true && r.j.moods.tired === 1);
r = await req("/api/admin/poll", { method: "POST", headers: A, body: { question: "Best canteen item?", options: ["Momo", "Chowmein"] } }); ok("admin create poll", r.s === 200);
r = await req("/api/poll"); const poll = r.j.poll; ok("poll live", poll && poll.options.length === 2);
r = await req("/api/poll/vote", { method: "POST", body: { poll: poll.id, option: 1, cid: cid(500) } }); ok("vote", r.s === 200 && r.j.poll.counts[1] === 1);
r = await req("/api/poll/vote", { method: "POST", body: { poll: poll.id, option: 0, cid: cid(500) } }); ok("one vote per browser", (r.j.poll.counts[1] === 1) && !r.j.poll.counts[0]);
r = await req("/api/poll/vote", { method: "POST", body: { poll: poll.id, option: 9, cid: cid(501) } }); ok("invalid option 400", r.s === 400);
r = await req("/api/poll/request", { method: "POST", body: { text: "Poll about exams please", cid: cid(502), captcha: "t" } }); ok("poll request", r.s === 200);

// 9 admin auth
r = await req("/api/admin/dashboard"); ok("admin no auth 401", r.s === 401);
r = await req("/api/admin/dashboard", { headers: { authorization: "Bearer wrong" }, ip: "7.7.7.7" }); ok("admin wrong pw 401", r.s === 401);
let locked = false; for (let i = 0; i < 12; i++) { const x = await req("/api/admin/dashboard", { headers: { authorization: "Bearer wrong" }, ip: "7.7.7.8" }); if (x.s === 429) locked = true; }
ok("admin brute-force lockout", locked);
r = await req("/api/admin/dashboard", { headers: { authorization: "Bearer wrong" }, ip: "7.7.7.8" });
r = await req("/api/admin/dashboard", { headers: A, ip: "8.8.8.8" }); ok("admin dashboard", r.s === 200 && r.j.posts && r.j.settings, r.t.slice(0, 200));
r = await req("/api/admin/list?kind=posts&status=archived", { headers: A }); ok("admin list shows IP", r.s === 200 && r.j.items.length > 0 && r.j.items.every(x => "ip" in x));
const arch = r.j.items.find(x => x.reason === "reported");
r = await req("/api/admin/action", { method: "POST", headers: A, body: { kind: "posts", action: "approve", ids: [arch.id] } }); ok("admin approve", r.s === 200);
row = await db.prepare("SELECT status,threshold FROM posts WHERE id=?").bind(arch.id).first(); ok("approved -> live", row.status === "live");
r = await req("/api/admin/action", { method: "POST", headers: A, body: { kind: "posts", action: "edit", ids: [arch.id], text: "edited text by admin" } });
r = await req("/api/feed"); ok("edited text shown publicly", r.j.items.some(x => x.text === "edited text by admin"), r.t.slice(0,300));
r = await req("/api/admin/action", { method: "POST", headers: A, body: { kind: "posts", action: "delete", ids: [arch.id] } });
row = await db.prepare("SELECT status,ip,text FROM posts WHERE id=?").bind(arch.id).first(); ok("delete is soft (row+ip kept)", row && row.status === "deleted" && row.ip && row.text);
r = await req("/api/feed"); ok("deleted not public", !r.j.items.some(x => x.id === arch.id));
r = await req("/api/admin/action", { method: "POST", headers: A, body: { kind: "posts", action: "bogus", ids: [1] } }); ok("invalid action 400", r.s === 400);
r = await req("/api/admin/export", { headers: A }); ok("export", r.s === 200 && r.j.posts.length > 0);
r = await req("/api/admin/settings", { method: "POST", headers: A, body: { banner: "Exams <b>week</b>", delay_min: "2", mod_path: "Mods-Path!" } });
r = await req("/api/admin/settings", { headers: A }); ok("settings saved + mod_path sanitized", r.j.banner.includes("Exams") && r.j.mod_path === "mods-path", JSON.stringify(r.j));
r = await req("/mods-path"); ok("mod path changed works", r.s === 200); r = await req("/review"); ok("old /review now 404", r.s === 404);
await req("/api/admin/settings", { method: "POST", headers: A, body: { mod_path: "review" } });

// 10 moderators
r = await req("/api/admin/mod", { method: "POST", headers: A, body: { username: "mod_one" } }); ok("create moderator returns password once", r.s === 200 && r.j.password);
const mpw = r.j.password;
r = await req("/api/admin/mod", { method: "POST", headers: A, body: { username: "mod_one" } }); ok("dup mod 409", r.s === 409);
const M = { "x-jbs-mod-user": "mod_one", "x-jbs-mod-password": mpw };
r = await req("/api/mod/me", { headers: M, ip: "4.4.4.4" }); ok("mod login", r.s === 200 && r.j.username === "mod_one", r.t);
r = await req("/api/mod/me", { headers: { ...M, "x-jbs-mod-password": "bad" }, ip: "4.4.4.5" }); ok("mod bad pw 401", r.s === 401);
r = await req("/api/mod/list", { headers: M }); ok("mod list has NO ip", r.s === 200 && r.j.items.length > 0 && r.j.items.every(x => !("ip" in x)), r.t.slice(0,200));
const sh = r.j.items.find(x => x.reason === "self-harm"), lk = r.j.items.find(x => x.reason === "link");
r = await req("/api/mod/action", { method: "POST", headers: M, body: { id: sh.id, kind: "posts", action: "approve" } }); ok("mod cannot approve self-harm", r.s === 403);
r = await req("/api/mod/action", { method: "POST", headers: M, body: { id: lk.id, kind: "posts", action: "approve" } }); ok("mod can approve low-risk", r.s === 200);
r = await req("/api/mod/action", { method: "POST", headers: M, body: { id: lk.id, kind: "posts", action: "edit" } }); ok("mod cannot edit", r.s === 400);
r = await req("/api/mod/me"); ok("mod no creds 401", r.s === 401);

// 11 injection / abuse
r = await req("/api/feed?sort=top';DROP TABLE posts;--&tag=x'"); ok("sort/tag injection safe", r.s === 200);
r = await req("/api/feed?sort=trending&tag=rant&before=1&offset=99999999"); ok("trending+tag works", r.s === 200, r.t.slice(0,150));
r = await req("/api/feed?sort=random"); ok("random works", r.s === 200);
r = await req("/api/feed?sort=top&offset=20"); ok("top paging works", r.s === 200);
r = await req("/api/submit", { method: "POST", body: "not json{", headers: {} }); ok("malformed body no 500", r.s < 500, String(r.s));
r = await req("/api/comments?post=abc"); ok("bad param no 500", r.s < 500);
r = await req("/api/submit", { method: "GET" }); ok("GET /api/submit 404 not 500", r.s === 404 || r.s === 405);
const cnt = await db.prepare("SELECT COUNT(*) c FROM posts").first(); ok("tables intact", cnt.c > 5);
// IP rate limit
let limited = false; for (let i = 0; i < 28; i++) { const x = await req("/api/submit", { method: "POST", body: { text: "spam spam spam spam " + i, cid: cid(1000 + i), captcha: "t" }, ip: "3.3.3.3" }); if (x.s === 429) limited = true; }
ok("per-IP post limit (25/30min)", limited);

// 12 kill / revive
r = await req("/api/submit", { method: "POST", body: { text: "kill me now please", cid: cid(2000), captcha: "t" }, ip: "2.2.2.2" }); ok("kill phrase accepted", r.s === 200);
ok("site off: / is 404", (await req("/")).s === 404);
ok("site off: api/feed 404", (await req("/api/feed")).s === 404);
ok("site off: /review 404", (await req("/review")).s === 404);
ok("site off: /demo 404", (await req("/demo")).s === 404);
r = await req("/api/submit", { method: "POST", body: { text: "wrong phrase here", cid: cid(2001), captcha: "t" }, ip: "2.2.2.3" }); ok("site off: wrong revive 404", r.s === 404);
ok("site off: hidden admin page still reachable", (await req("/secret-admin-x")).s === 200);
r = await req("/api/submit", { method: "POST", body: { text: "revive me now please", cid: cid(2002) }, ip: "2.2.2.4" }); ok("revive phrase works", r.s === 200);
ok("site back on", (await req("/")).s === 200);
r = await req("/api/admin/kill", { method: "POST", headers: A, body: { on: true } }); ok("admin kill toggle", (await req("/")).s === 404);
await req("/api/admin/kill", { method: "POST", headers: A, body: { on: false } }); ok("admin revive toggle", (await req("/")).s === 200);

// 13 misc
ok("worker makes no outbound requests", outbound.length === 0, outbound.join());
// fresh DB self-upgrade check
const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()).results.map(x => x.name);
ok("schema self-created", ["posts","comments","reports","reactions","mods","polls","poll_requests","settings"].every(t => tables.includes(t)), tables.join());
console.log(`\n${pass} passed, ${fail} failed`); if (fail) console.log("FAILURES:\n" + fails.join("\n"));
await mf.dispose();
