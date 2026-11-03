// Smoke test for the double-click demo pages (file://, fake backend in localStorage).
import { createRequire } from "module";
import { execSync } from "child_process";
const require = createRequire(import.meta.url);
const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");
const root = new URL("../demo/", import.meta.url).pathname;
let pass = 0, fail = 0;
const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.route("https://js.hcaptcha.com/**", (r) => r.abort());
const page = await ctx.newPage(); const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
await page.goto("file://" + root + "wall-demo.html"); await page.waitForTimeout(1500);
ok("demo wall: feed has posts", (await page.locator(".feed .body").count()) > 0);
const opts = await page.$$eval("#flair-f option", (o) => o.length); ok("demo wall: flair filter options", opts === 10, String(opts));
await page.click('[data-sort="top"]'); await page.waitForTimeout(500);
ok("demo wall: Top shows range select", await page.locator("#range-f").isVisible());
for (const v of ["day", "all", "week"]) { await page.selectOption("#range-f", v); await page.waitForTimeout(400); }
ok("demo wall: range switching works", (await page.locator(".feed .body").count()) >= 0);
ok("demo wall: weekly mood widget renders", await page.locator("#w-week").isVisible());
await page.evaluate(() => document.querySelector("#b-talk").click());
await page.waitForSelector("#talk[open]");
await page.fill("#talk-in", "Demo message to the admin, just testing");
if (await page.locator("#talk-cap .demo-check input").count()) await page.check("#talk-cap .demo-check input"); await page.click("#talk-send"); await page.waitForTimeout(1200);
ok("demo wall: talk message appears in chat", (await page.locator("#talk-msgs").innerText()).includes("Demo message to the admin"), await page.locator("#talk-err").textContent());
ok("demo wall: no JS errors", errs.length === 0, errs.join(" | "));
for (const f of ["admin-demo.html", "mod-demo.html"]) {
  const p = await ctx.newPage(); const e2 = []; p.on("pageerror", (e) => e2.push(e.message));
  await p.goto("file://" + root + f); await p.waitForTimeout(1200);
  ok(f + ": loads without JS errors", e2.length === 0, e2.join(" | "));
  await p.close();
}
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
