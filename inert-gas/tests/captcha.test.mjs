// ALTCHA widget in a real browser: tick the box, it solves, a post goes through.
import { createRequire } from "module"; import { execSync } from "child_process"; import fs from "fs";
import { Miniflare } from "miniflare";
const require = createRequire(import.meta.url);
const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");
const script = fs.readFileSync(new URL("../dist/_worker.js", import.meta.url), "utf8");
const mf = new Miniflare({ modules: true, script, compatibilityDate: "2024-09-01", port: 8801, host: "127.0.0.1", d1Databases: { DB: "c" },
  bindings: { ADMIN_PASSWORD: "a", ADMIN_PATH: "adm", KILL_PHRASE: "kk kk kk", REVIVE_PHRASE: "rr rr rr", SALT: "s" },
  outboundService: async () => { throw new Error("no outbound allowed"); } });
await mf.ready; const db = await mf.getD1Database("DB");
let pass = 0, fail = 0; const ok = (n, c, x = "") => { c ? pass++ : fail++; console.log((c ? "PASS " : "FAIL ") + n + (c ? "" : "  " + x)); };
const browser = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1280, height: 800 }], ["phone", { width: 390, height: 780 }]]) {
  const page = await (await browser.newContext({ viewport: vp })).newPage();
  await db.prepare("DELETE FROM posts").run().catch(() => {}); await db.prepare("DELETE FROM limits").run().catch(() => {});
  await page.goto("http://127.0.0.1:8801/", { waitUntil: "networkidle" });
  await page.click(name === "phone" ? "#n-confess" : "#b-confess");
  await page.fill("#comp-ta", "The most chaotic thing I did this semester was " + name);
  await page.click("#comp-cap input");
  await page.waitForFunction(() => /Verified/.test(document.querySelector("#comp-cap").textContent), null, { timeout: 15000 }).catch(() => {});
  ok(name + ": ALTCHA verifies in the browser", /Verified/.test(await page.textContent("#comp-cap")));
  await page.click("#comp-send"); await page.click("#fa-yes", { timeout: 3000 }).catch(() => {}); await page.waitForSelector("#comp-done:not([hidden])", { timeout: 6000 }).catch(() => {});
  ok(name + ": post goes through", (await db.prepare("SELECT COUNT(*) c FROM posts").first()).c === 1);
  const hosts = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => new URL(e.name).host));
  ok(name + ": page loaded nothing from other hosts", hosts.every((h) => h === "127.0.0.1:8801"), hosts.join());
}
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); await mf.dispose(); process.exit(fail ? 1 : 0);
