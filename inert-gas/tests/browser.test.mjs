import { createRequire } from "module";
import { execSync } from "child_process";
import fs from "fs";
const OUT = new URL("./out/", import.meta.url).pathname; fs.mkdirSync(OUT, { recursive: true });
import { Miniflare } from "miniflare";
const require = createRequire(import.meta.url);
const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");
const script = fs.readFileSync(new URL("../dist/_worker.js", import.meta.url), "utf8");
const mf = new Miniflare({
  modules: true, script, compatibilityDate: "2024-09-01", port: 8799, host: "127.0.0.1",
  d1Databases: { DB: "bdb" },
  bindings: { ADMIN_PASSWORD: "adm-pass-123", ADMIN_PATH: "secret-admin-x", KILL_PHRASE: "kill me now please", REVIVE_PHRASE: "revive me now please", SALT: "s" },
  outboundService: async () => new Response(JSON.stringify({ success: true })),
});
await mf.ready;
const db = await mf.getD1Database("DB");
const B = "http://127.0.0.1:8799";
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); };
const browser = await chromium.launch();
async function newPage(vp, name) {
  const ctx = await browser.newContext({ viewport: vp, userAgent: name === "mobile" ? "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1" : undefined, isMobile: name === "mobile", hasTouch: name === "mobile" });
  await ctx.addInitScript(() => { new MutationObserver(() => document.querySelectorAll('.demo-check input:not(:checked):not(:disabled)').forEach((c) => c.click())).observe(document, { childList: true, subtree: true }); });
  const page = await ctx.newPage();
  const errs = [], failed = [], dialogs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  page.on("requestfailed", (r) => failed.push(r.url()));
  page.on("dialog", (d) => { dialogs.push(d.message()); d.dismiss(); });
  page.__errs = errs; page.__failed = failed; page.__dialogs = dialogs; page.__ctx = ctx;
  return page;
}
const publish = async () => db.prepare("UPDATE posts SET publish_at=? WHERE status='live'").bind(Date.now() - 5000).run();

for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["mobile", { width: 390, height: 844 }]]) {
  console.log("\n=== " + name + " ===");
  for (const t of ["posts","comments","reactions","reaction_counts","reports","limits"]) await db.prepare("DELETE FROM "+t).run().catch(()=>{});
  const page = await newPage(vp, name);
  await page.goto(B + "/", { waitUntil: "networkidle" });
  ok(name + ": title contains St. Xavier", /Xavier/.test(await page.title()), await page.title());
  ok(name + ": feed visible, no hero (Wall first)", await page.locator("#main").isVisible());
  const confess = name === "mobile" ? "#n-confess" : "#b-confess";
  ok(name + ": Confess button visible", await page.locator(confess).isVisible());
  ok(name + ": no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  ok(name + ": no fake/demo ribbon on live", !(await page.locator("#demo-note").isVisible()));
  await page.screenshot({ path: `${OUT}${name}-wall.png` });

  // submit via UI
  await page.click(confess);
  await page.waitForSelector("#composer[open]");
  const msg = name + " confession: I secretly love the library at 7am";
  await page.fill("#comp-ta", msg);
  await page.locator("#comp-tags button, #comp-tags [role=radio], #comp-tags label").first().click().catch(() => {});
  await page.click("#comp-send"); await page.click("#fa-yes", { timeout: 1500 }).catch(() => {});
  await page.waitForSelector("#comp-done:not([hidden])", { timeout: 8000 }).catch(() => {});
  ok(name + ": composer success screen", await page.locator("#comp-done").isVisible(), await page.locator("#comp-err").textContent().catch(() => ""));
  await page.screenshot({ path: `${OUT}${name}-sent.png` });
  const row = await db.prepare("SELECT * FROM posts WHERE text LIKE ? ORDER BY id DESC LIMIT 1").bind("%" + name + " confession%").first();
  ok(name + ": row stored live w/ IP logged", row && row.status === "live" && row.ip, JSON.stringify(row));
  await page.click("#comp-done [data-close]").catch(() => {});

  // XSS + second post
  await db.prepare("INSERT INTO posts(text,status,reason,publish_at,ip,created_at,tag) VALUES(?,?,?,?,?,?,?)").bind("<img src=x onerror=alert('xss')><script>alert('xss2')</script> hello", "live", "", Date.now() - 9000, "1.1.1.1", Date.now(), "funny").run();
  await publish();
  await page.reload({ waitUntil: "networkidle" });
  const cards = page.locator("article.card");
  ok(name + ": feed shows posts", (await cards.count()) >= 2, String(await cards.count()));
  ok(name + ": XSS rendered as literal text", (await page.locator("article.card img").count()) === 0 && (await page.locator("article.card", { hasText: "<img src=x" }).count()) === 1);
  ok(name + ": no alert dialog fired", page.__dialogs.length === 0, page.__dialogs.join());

  // reactions regression: like on card 1, laugh on card 2 must not cross
  const c1 = cards.nth(0), c2 = cards.nth(1);
  await c1.locator('.react[data-r=like]').click();
  await c2.locator('.react[data-r=laugh]').click();
  await page.waitForTimeout(500);
  const idOf = async (c) => +(await c.getAttribute("id")).replace("post-", "");
  const id1 = await idOf(c1), id2 = await idOf(c2);
  const rc = (await db.prepare("SELECT post_id,type,n FROM reaction_counts").all()).results;
  ok(name + ": reactions bound to correct post+type", rc.some(x => x.post_id === id1 && x.type === "like" && x.n === 1) && rc.some(x => x.post_id === id2 && x.type === "laugh" && x.n === 1) && rc.length === 2, JSON.stringify(rc));
  await page.reload({ waitUntil: "networkidle" });
  ok(name + ": reaction stays selected after reload", (await page.locator(`#post-${id1} .react[data-r=like][aria-pressed=true]`).count()) === 1);
  await page.locator(`#post-${id1} .react[data-r=like]`).click(); await page.waitForTimeout(400);
  const rc2 = (await db.prepare("SELECT n FROM reaction_counts WHERE post_id=? AND type='like'").bind(id1).first());
  ok(name + ": un-react decrements", rc2.n === 0, JSON.stringify(rc2));

  // comment
  await page.locator(`#post-${id1} button[aria-label=Comments]`).click();
  await page.waitForSelector(`#post-${id1} .comments textarea`);
  await page.fill(`#post-${id1} .comments textarea`, "Totally relatable, hang in there");
  await page.locator(`#post-${id1} .comments button`).filter({ hasText: /post|send|comment/i }).first().click();
  await page.waitForTimeout(800);
  const cm = await db.prepare("SELECT status,ip FROM comments ORDER BY id DESC LIMIT 1").first();
  ok(name + ": comment submitted via UI", cm && cm.status === "live" && cm.ip, JSON.stringify(cm));

  // report
  await page.locator(`#post-${id2} button[aria-label="More options"]`).click();
  await page.locator(`#post-${id2} [role=menuitem].danger`).click();
  await page.waitForSelector("#report[open]");
  await page.selectOption("#rep-sel", { index: 1 }); await page.fill("#rep-d", "This names a student in the second paragraph."); await page.click("#rep-send");
  await page.waitForTimeout(800);
  const rp = await db.prepare("SELECT status,reason FROM posts WHERE id=?").bind(id2).first();
  ok(name + ": report via UI archives post", rp.status === "archived", JSON.stringify(rp));

  // theme toggle, rules dialog
  const before = await page.evaluate(() => document.documentElement.dataset.theme || "");
  await page.click("#b-theme"); const after = await page.evaluate(() => document.documentElement.dataset.theme || "");
  ok(name + ": theme toggle changes theme", before !== after, before + "->" + after);
  await page.screenshot({ path: `${OUT}${name}-dark.png` });
  ok(name + ": privacy policy discloses IP logging", /IP addresses are logged/.test(await page.evaluate(() => fetch("/api/public").then((r) => r.text()))));
  const bad = page.__failed.filter(u => true);
  ok(name + ": no failed requests", bad.length === 0, bad.join());
  ok(name + ": no JS console/page errors", page.__errs.length === 0, page.__errs.join(" | "));
  await page.__ctx.close();
}

// over-long input handling
console.log("\n=== edge UI ===");
{
  const page = await newPage({ width: 1280, height: 800 }, "desktop");
  await page.goto(B + "/", { waitUntil: "networkidle" });
  await page.click("#b-confess"); await page.fill("#comp-ta", "a ".repeat(700));
  await page.click("#comp-send"); await page.click("#fa-yes", { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(500);
  ok("over 1000 chars blocked with message", (await page.locator("#comp-err").isVisible()) && (await db.prepare("SELECT COUNT(*) c FROM posts WHERE text LIKE 'a a a a%'").first()).c === 0, await page.locator("#comp-err").textContent());
  await page.fill("#comp-ta", "I want to end it all, honestly.");
  await page.waitForTimeout(400);
  ok("care/helpline panel appears for self-harm wording", await page.locator("#care").isVisible());
  await page.__ctx.close();
}

// admin UI
console.log("\n=== admin UI ===");
{
  const page = await newPage({ width: 1280, height: 800 }, "desktop");
  await db.prepare("INSERT INTO posts(text,status,reason,publish_at,ip,created_at,tag) VALUES(?,?,?,?,?,?,?)").bind("held for review text here", "archived", "link", Date.now(), "4.3.2.1", Date.now(), "rant").run();
  await page.goto(B + "/secret-admin-x", { waitUntil: "networkidle" });
  const pw = page.locator('input[type=password]').first();
  ok("admin login form", await pw.isVisible());
  await pw.fill("wrong"); await pw.press("Enter"); await page.waitForTimeout(600);
  ok("admin wrong pw stays locked", await pw.isVisible());
  await pw.fill("adm-pass-123"); await pw.press("Enter"); await page.waitForTimeout(1200);
  ok("admin dashboard opens", !(await pw.isVisible()) , "");
  await page.locator("nav button, nav a, button").filter({ hasText: /^Review/ }).first().click(); await page.waitForTimeout(1000);
  const txt = await page.locator("body").innerText();
  ok("admin shows held post + IP", /held for review text here/.test(txt) && /4\.3\.2\.1/.test(txt), txt.slice(0, 400));
  await page.screenshot({ path: OUT + "admin.png" });
  ok("admin: no JS errors (ignoring the intentional wrong-password 401)", page.__errs.filter(e => !/401/.test(e)).length === 0, page.__errs.join(" | "));
  await page.__ctx.close();
}

// mod UI
console.log("\n=== moderator UI ===");
{
  const r = await mf.dispatchFetch(B + "/api/admin/mod", { method: "POST", headers: { authorization: "Bearer adm-pass-123", "content-type": "application/json" }, body: JSON.stringify({ username: "modx" }) });
  const { password } = await r.json();
  const page = await newPage({ width: 390, height: 844 }, "mobile");
  await page.goto(B + "/review", { waitUntil: "networkidle" });
  const inputs = page.locator("input");
  ok("mod login form", (await inputs.count()) >= 2);
  await inputs.nth(0).fill("modx"); await inputs.nth(1).fill(password); await inputs.nth(1).press("Enter"); await page.waitForTimeout(1200);
  const t = await page.locator("body").innerText();
  ok("mod queue loads, shows held post, no IP", /held for review text here/.test(t) && !/4\.3\.2\.1/.test(t), t.slice(0, 300));
  await page.screenshot({ path: OUT + "mod.png" });
  ok("mod: no JS errors", page.__errs.length === 0, page.__errs.join(" | "));
  await page.__ctx.close();
}

// kill phrase via UI
console.log("\n=== kill switch via UI ===");
{
  const page = await newPage({ width: 1280, height: 800 }, "desktop");
  await page.goto(B + "/", { waitUntil: "networkidle" });
  await page.click("#b-confess"); await page.fill("#comp-ta", "kill me now please"); await page.click("#comp-send"); await page.click("#fa-yes", { timeout: 1500 }).catch(() => {}); await page.waitForTimeout(1000);
  const resp = await page.goto(B + "/");
  ok("after kill phrase the site returns 404", resp.status() === 404, String(resp.status()));
  await page.__ctx.close();
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); await mf.dispose();
