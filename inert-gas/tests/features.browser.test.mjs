// Browser checks for the roadmap features (real worker via Miniflare + headless Chromium).
import { createRequire } from "module";
import { execSync } from "child_process";
import fs from "fs";
import { Miniflare } from "miniflare";
const OUT = new URL("./out/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");
const script = fs.readFileSync(new URL("../dist/_worker.js", import.meta.url), "utf8");
const mf = new Miniflare({
  modules: true, script, compatibilityDate: "2024-09-01", port: 8798, host: "127.0.0.1",
  d1Databases: { DB: "fbdb" },
  bindings: { ADMIN_PASSWORD: "adm-pass-123", ADMIN_PATH: "secret-admin-x", KILL_PHRASE: "kill me now please", REVIVE_PHRASE: "revive me now please", SALT: "s" },
  outboundService: async () => new Response(JSON.stringify({ success: true })),
});
await mf.ready;
const db = await mf.getD1Database("DB");
const B = "http://127.0.0.1:8798";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); };
const browser = await chromium.launch();
async function newPage(vp, mobile) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, userAgent: mobile ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1" : undefined });
  await ctx.addInitScript(() => { new MutationObserver(() => document.querySelectorAll('.demo-check input:not(:checked):not(:disabled)').forEach((c) => c.click())).observe(document, { childList: true, subtree: true }); });
  const page = await ctx.newPage(); const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.__errs = errs; page.__ctx = ctx; return page;
}
const A = { authorization: "Bearer adm-pass-123", "content-type": "application/json" };
const adminPost = (p, body) => fetch(B + p, { method: "POST", headers: A, body: JSON.stringify(body) }).then((r) => r.json());
const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

// seed (first request creates the schema)
await fetch(B + "/api/public").then((r) => r.text());
const now = Date.now();
const seed = [["Exam stress is real this week, hang in there", "exams", 3 * 3600e3], ["The canteen samosa is elite, fight me", "canteen", 3 * 86400e3], ["Shoutout to the guard at the main gate", "shoutout", 30 * 86400e3]];
for (const [t, tag, age] of seed)
  await db.prepare("INSERT INTO posts(text,tag,status,reason,created_at,publish_at,ip) VALUES(?,?,?,?,?,?,?)").bind(t, tag, "live", "", now - age, now - age, "1.1.1.1").run();
const ids = (await db.prepare("SELECT id,tag FROM posts ORDER BY id").all()).results;
const examId = ids.find((x) => x.tag === "exams").id;
await adminPost("/api/admin/settings", { weekly_theme: "Exam season", weekly_prompt: "What got you through this week?" });
await db.prepare("INSERT OR REPLACE INTO moods(day,mood,n) VALUES(?,?,?)").bind(day(0), "stressed", 6).run();
await db.prepare("INSERT OR REPLACE INTO moods(day,mood,n) VALUES(?,?,?)").bind(day(1), "tired", 2).run();

for (const [name, vp, mobile] of [["desktop", { width: 1280, height: 800 }, false], ["mobile", { width: 390, height: 844 }, true]]) {
  console.log("\n=== " + name + " ===");
  const page = await newPage(vp, mobile);
  await page.goto(B + "/", { waitUntil: "networkidle" });
  const head = await page.evaluate(() => ({ manifest: document.querySelector('link[rel=manifest]')?.href, apple: document.querySelector('link[rel=apple-touch-icon]')?.href, og: document.querySelector('meta[property="og:title"]')?.content }));
  ok(name + ": head has manifest + apple icon + og title", head.manifest?.endsWith("/manifest.webmanifest") && head.apple?.endsWith("/apple-touch-icon.png") && !!head.og, JSON.stringify(head));

  // flairs
  const opts = await page.$$eval("#flair-f option", (o) => o.map((x) => x.textContent));
  ok(name + ": feed flair dropdown lists All flairs + 9", opts.length === 10 && /^all/i.test(opts[0]), opts.join());
  ok(name + ": no hashtag chip bar left", (await page.locator("#tagbar").count()) === 0 && (await page.locator("#comp-tags").count()) === 0);
  const pills = await page.$$eval(".card .tag, .feed .tag", (e) => e.map((x) => x.textContent.trim()));
  ok(name + ": post pills show flair without #", pills.length >= 1 && pills.every((t) => !t.includes("#")), pills.join());
  await page.selectOption("#flair-f", { label: "Canteen" }); await page.waitForTimeout(600);
  const shown = await page.$$eval(".feed .body", (e) => e.map((x) => x.textContent));
  ok(name + ": flair filter works", shown.length === 1 && shown[0].includes("samosa"), shown.join("|"));
  await page.selectOption("#flair-f", { index: 0 }); await page.waitForTimeout(500);

  // top range
  ok(name + ": range select hidden until Top", !(await page.locator("#range-f").isVisible()));
  await page.click('[data-sort="top"]'); await page.waitForTimeout(600);
  ok(name + ": range select shown on Top", await page.locator("#range-f").isVisible());
  let n = await page.locator(".feed .body").count();
  ok(name + ": Top this week hides the 30 day old post", n === 2, String(n));
  await page.selectOption("#range-f", "day"); await page.waitForTimeout(600);
  n = await page.locator(".feed .body").count(); ok(name + ": Top today shows 1", n === 1, String(n));
  await page.selectOption("#range-f", "all"); await page.waitForTimeout(600);
  n = await page.locator(".feed .body").count(); ok(name + ": Top all time shows 3", n === 3, String(n));
  await page.click('[data-sort="latest"]'); await page.waitForTimeout(500);
  ok(name + ": range select hidden again on Latest", !(await page.locator("#range-f").isVisible()));

  // composer flair select + weekly prompt
  const confess = mobile ? "#n-confess" : "#b-confess";
  await page.click(confess); await page.waitForSelector("#composer[open]");
  const co = await page.$$eval("#comp-flair option", (o) => o.map((x) => x.value.toLowerCase()));
  ok(name + ": composer flair dropdown has 9 flairs", co.length === 9 && ["funny", "crush", "rant", "advice", "wholesome", "exams", "canteen", "shoutout", "other"].every((v) => co.includes(v)), co.join());
  ok(name + ": composer shows weekly prompt line", await page.locator("#comp-prompt").isVisible() && /got you through/.test(await page.locator("#comp-prompt-t").textContent()));
  await page.click("#comp-use");
  ok(name + ": Use this prompt fills textarea", /got you through/.test(await page.inputValue("#comp-ta")));
  await page.screenshot({ path: `${OUT}f-${name}-composer.png` });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);

  // link preview deep link
  const p2 = await newPage(vp, mobile);
  await p2.goto(B + "/p/" + examId, { waitUntil: "networkidle" });
  await p2.waitForSelector("#single[open]", { timeout: 6000 }).catch(() => {});
  ok(name + ": /p/<id> opens the single post dialog", await p2.locator("#single[open]").count() === 1);
  ok(name + ": single post shows the text", /Exam stress/.test(await p2.locator("#single-b").textContent()));
  const ogt = await p2.evaluate(() => document.querySelector('meta[property="og:title"]')?.content);
  ok(name + ": served og:title for that post", ogt === "Confession #" + examId + " | Inert Gas", ogt);
  await p2.keyboard.press("Escape"); await p2.waitForTimeout(300);
  ok(name + ": closing resets URL to /", new URL(p2.url()).pathname === "/", p2.url());
  const p3 = await newPage(vp, mobile);
  await p3.goto(B + "/p/99999", { waitUntil: "networkidle" }); await p3.waitForTimeout(500);
  ok(name + ": unknown /p/<id> still loads the wall", await p3.locator("#main").isVisible() && await p3.locator("#single[open]").count() === 0);
  ok(name + ": no JS errors on deep links (unknown id may log one 404)", p2.__errs.length === 0 && p3.__errs.every((e) => /404/.test(e)), p2.__errs.concat(p3.__errs).join(" | "));
  await p2.__ctx.close(); await p3.__ctx.close();

  // desktop only widgets (aside)
  if (!mobile) {
    ok(name + ": weekly card visible with theme", await page.locator("#w-prompt").isVisible() && /Exam season/.test(await page.locator("#pc-h").textContent()));
    ok(name + ": week mood widget shows", await page.locator("#w-week").isVisible() && /Mostly stressed/.test(await page.locator("#week-line").textContent()), await page.locator("#week-line").textContent());
    ok(name + ": week mood shows 4 bars", (await page.locator("#week-bars > *").count()) === 4);
    ok(name + ": week mood count text", /8 check-ins/.test(await page.locator("#week-n").textContent()), await page.locator("#week-n").textContent());
    const dl = await Promise.all([page.waitForEvent("download", { timeout: 4000 }).catch(() => null), page.click("#week-save")]);
    ok(name + ": Save as image downloads a png", !!dl[0] && /\.png$/.test(dl[0].suggestedFilename()), dl[0] && dl[0].suggestedFilename());
    await page.screenshot({ path: `${OUT}f-${name}-wall.png` });
  }

  // helplines render as tel links
  await page.evaluate(() => document.querySelector("#b-talk").click());
  await page.waitForSelector("#talk[open]");
  await page.click("#talk-helpbtn"); await page.waitForSelector("#helplines[open]");
  const tel = await page.$$eval("#helplines-list a[href^='tel:']", (a) => a.map((x) => x.getAttribute("href")));
  ok(name + ": helplines are tel: links", tel.length === 2 && tel.includes("tel:1166") && tel.includes("tel:1145"), tel.join());
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  if (!(await page.locator("#talk[open]").count())) { await page.evaluate(() => document.querySelector("#b-talk").click()); await page.waitForSelector("#talk[open]"); }
  ok(name + ": talk dialog says volunteer not counsellor", /volunteer/i.test(await page.locator("#talk").textContent()));

  // talk flow
  await page.fill("#talk-in", "I have been so stressed about exams, I do not know who to tell");
  if (await page.locator("#talk-cap input").count()) { await page.click("#talk-cap input"); await page.waitForFunction(() => /Verified/.test(document.querySelector("#talk-cap").textContent), null, { timeout: 15000 }).catch(() => {}); }
  await page.click("#talk-send");
  await page.waitForSelector("#talk-msgs .cb", { timeout: 8000 }).catch(() => {});
  ok(name + ": talk send shows the conversation", (await page.locator("#talk-msgs .cb").count()) >= 1, await page.locator("#talk-err").textContent().catch(() => ""));
  const code = await page.evaluate(() => Object.keys(localStorage).map((k) => localStorage.getItem(k)).find((v) => /^"[A-Za-z0-9_-]{20,30}"$/.test(v || "")));
  ok(name + ": code kept in this browser only", !!code);
  ok(name + ": own message rendered as text", /so stressed about exams/.test(await page.locator("#talk-msgs").textContent()));
  const th = (await adminGet("/api/admin/threads")).items; const tid = th[0].id;
  await adminPost("/api/admin/thread/reply", { id: tid, text: "Hello, I am the volunteer admin. <b>You are not alone.</b>" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.reload({ waitUntil: "networkidle" }); await page.waitForTimeout(1200);
  ok(name + ": new reply dot appears on load", !(await page.locator("#talk-dot").evaluate((e) => e.hidden)) || !(await page.locator("#n-talk-dot").evaluate((e) => e.hidden)));
  await page.evaluate(() => document.querySelector("#b-talk").click());
  await page.waitForSelector("#talk-msgs .cb.adm", { timeout: 8000 }).catch(() => {});
  const admTxt = await page.locator("#talk-msgs .cb.adm").first().textContent().catch(() => "");
  ok(name + ": admin reply visible", /volunteer admin/.test(admTxt), admTxt);
  ok(name + ": admin reply rendered as text, not HTML", (await page.locator("#talk-msgs .cb.adm b").count()) === 0 && admTxt.includes("<b>"));
  ok(name + ": dot clears after reading", (await page.locator("#talk-dot").evaluate((e) => e.hidden)) && (await page.locator("#n-talk-dot").evaluate((e) => e.hidden)));
  await page.fill("#talk-in", "Thank you, that helps.");
  await page.click("#talk-send"); await page.waitForTimeout(800);
  ok(name + ": visitor follow up appears", /that helps/.test(await page.locator("#talk-msgs").textContent()));
  await page.screenshot({ path: `${OUT}f-${name}-talk.png` });
  await adminPost("/api/admin/thread/status", { id: tid, status: "closed" });
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.evaluate(() => document.querySelector("#b-talk").click()); await page.waitForTimeout(1200);
  ok(name + ": closed thread hides reply box, offers new message", await page.locator("#talk-bar").isHidden() && await page.locator("#talk-newthread").isVisible());
  await page.keyboard.press("Escape");
  ok(name + ": no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok(name + ": no JS errors", page.__errs.length === 0, page.__errs.join(" | "));
  // reset talk state for next viewport
  await db.prepare("DELETE FROM thread_msgs").run(); await db.prepare("DELETE FROM threads").run(); await db.prepare("DELETE FROM limits").run();
  await page.__ctx.close();
}

// visit counter from a real page load
const vp = await newPage({ width: 1280, height: 800 }, false);
await vp.goto(B + "/", { waitUntil: "networkidle" }); await vp.waitForTimeout(800);
const vrows = (await db.prepare("SELECT COUNT(*) c FROM visits WHERE day=?").bind(day(0)).first()).c;
ok("visit counted once from a page load", vrows >= 1, String(vrows));
await vp.reload({ waitUntil: "networkidle" }); await vp.waitForTimeout(500);
const v2 = (await db.prepare("SELECT COUNT(*) c FROM visits WHERE day=?").bind(day(0)).first()).c;
ok("reload same day does not add a row", v2 === vrows, vrows + " vs " + v2);
await vp.__ctx.close();

// admin page: Messages tab + visitors chart
const ap = await newPage({ width: 1280, height: 800 }, false);
await adminPost("/api/admin/thread/status", { id: 0, status: "open" });
await ap.goto(B + "/secret-admin-x", { waitUntil: "networkidle" });
await ap.evaluate(() => sessionStorage.setItem("jbs_admin", "adm-pass-123"));
await ap.reload({ waitUntil: "networkidle" }); await ap.waitForTimeout(800);
ok("admin: Messages tab exists", (await ap.locator("text=Messages").count()) > 0);
ok("admin: visitors chart drawn", (await ap.locator("#vchart").count()) === 1);
ok("admin: no JS errors", ap.__errs.length === 0, ap.__errs.join(" | "));
await ap.screenshot({ path: `${OUT}f-admin.png` });

// admin Messages tab end to end
await db.prepare("DELETE FROM thread_msgs").run(); await db.prepare("DELETE FROM threads").run();
const t0 = Date.now();
await db.prepare("INSERT INTO threads(code_hash,status,urgent,created_at,last_at,last_from,ip) VALUES(?,?,?,?,?,?,?)").bind("h1", "open", 1, t0, t0, "visitor", "5.5.5.5").run();
await db.prepare("INSERT INTO threads(code_hash,status,urgent,created_at,last_at,last_from,ip) VALUES(?,?,?,?,?,?,?)").bind("h2", "open", 0, t0 - 5000, t0 - 5000, "visitor", "5.5.5.6").run();
const tr = (await db.prepare("SELECT id,code_hash FROM threads ORDER BY id").all()).results;
await db.prepare("INSERT INTO thread_msgs(thread_id,from_admin,body,created_at,ip) VALUES(?,?,?,?,?)").bind(tr[0].id, 0, "Some days I just want to die <i>tag</i>", t0, "5.5.5.5").run();
await db.prepare("INSERT INTO thread_msgs(thread_id,from_admin,body,created_at,ip) VALUES(?,?,?,?,?)").bind(tr[1].id, 0, "Question about hostel rules", t0 - 5000, "5.5.5.6").run();
await ap.reload({ waitUntil: "networkidle" }); await ap.waitForTimeout(800);
await ap.locator("nav >> text=Messages").first().click().catch(async () => { await ap.locator("text=Messages").first().click(); });
await ap.waitForSelector("#thr-list .thr", { timeout: 5000 }).catch(() => {});
const cards = await ap.locator("#thr-list .thr").count();
ok("admin msgs: lists 2 open conversations", cards === 2, String(cards));
ok("admin msgs: urgent one is first and flagged", (await ap.locator("#thr-list .thr").first().locator(".av.urgent").count()) === 1 && /hostel/.test(await ap.locator("#thr-list .thr").nth(1).textContent()));
ok("admin msgs: waiting badge shown", (await ap.locator("#thr-list .thr.unread").first().locator(".dot").count()) === 1);
ok("admin msgs: nav badge counts waiting", /2/.test(await ap.locator("nav").first().textContent()));
await ap.locator("#thr-list .thr").first().click(); await ap.waitForSelector("#thr-view:not([hidden]) #chat-ta");
ok("admin msgs: message rendered as text", (await ap.locator("#thr-view .bub i").count()) === 0 && /<i>tag<\/i>/.test(await ap.locator("#thr-view .chat-body").textContent()));
ok("admin msgs: admin sees IP, urgent label", /5\.5\.5\.5/.test(await ap.locator("#thr-view").textContent()) && /urgent/i.test(await ap.locator("#thr-view").textContent()));
await ap.fill("#chat-ta", "I am here. Please call 1166 if you can.");
await ap.locator("#thr-view button.send").click(); await ap.waitForTimeout(900);
const rep = (await db.prepare("SELECT * FROM thread_msgs WHERE thread_id=? AND from_admin=1").bind(tr[0].id).all()).results;
ok("admin msgs: reply saved", rep.length === 1 && /call 1166/.test(rep[0].body));
ap.on("dialog", (d) => d.accept());
await ap.locator("#thr-view >> text=Close chat").click(); await ap.waitForTimeout(900);
const st = await db.prepare("SELECT status FROM threads WHERE id=?").bind(tr[0].id).first();
ok("admin msgs: close works", st.status === "closed");
await ap.locator("#thr-seg >> text=Closed").click(); await ap.waitForTimeout(600);
ok("admin msgs: closed list shows it", (await ap.locator("#thr-list .thr").count()) === 1);
ok("admin msgs: no JS errors", ap.__errs.length === 0, ap.__errs.join(" | "));
await ap.screenshot({ path: `${OUT}f-admin-messages.png` });
await browser.close(); await mf.dispose();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
async function adminGet(p) { return fetch(B + p, { headers: A }).then((r) => r.json()); }
