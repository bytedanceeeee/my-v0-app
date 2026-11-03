// Redesign guard. Run:  node tools/contract-check.mjs
// The look of the Wall may change completely. The "contract" below may not, or the site breaks.
// Checks src/web/* against what app.js and the Worker need. Exit code 1 on any failure.
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = f => fs.readFileSync(path.join(root, f), 'utf8');
const head = r('src/web/head.html'), css = r('src/web/style.css'), body = r('src/web/body.html'), js = r('src/web/app.js');
const reg = new Set(JSON.parse(r('src/text_registry.line.js').trim().replace(/^const TEXT_REGISTRY = /, '').replace(/;$/, '')).map(x => x.k));
let bad = 0; const fail = m => { bad++; console.log('FAIL ' + m); }; const pass = m => console.log('PASS ' + m);

// 1. head.html markers the build and the Worker rely on
for (const [needle, why] of [['<!--og-->', 'build.js injects link-preview tags here'], ['data-mode="live"', 'build.js flips this to "demo" for demo pages'], ['xv_theme', 'saved theme bootstrap'], ['data-theme=', 'theme attribute'], ['rel="manifest"', 'PWA manifest'], ['apple-touch-icon', 'home-screen icon']])
  head.includes(needle) ? pass('head has ' + needle) : fail('head.html lost ' + needle + ' (' + why + ')');

// 2. every element id app.js looks up must exist in body.html or be created by app.js
const bodyIds = new Set([...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const jsMadeIds = new Set([...js.matchAll(/\bid=\\?["']([A-Za-z0-9_-]+)/g)].map(m => m[1]));
for (const m of js.matchAll(/\.id\s*=\s*['"]([A-Za-z0-9_-]+)['"]/g)) jsMadeIds.add(m[1]);
const wanted = new Set();
for (const m of js.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) wanted.add(m[1]);
for (const m of js.matchAll(/\$\$?\(\s*['"`]([^'"`]+)['"`]/g)) for (const t of m[1].matchAll(/#([A-Za-z][A-Za-z0-9_-]*)/g)) wanted.add(t[1]);
const missing = [...wanted].filter(i => !bodyIds.has(i) && !jsMadeIds.has(i));
missing.length ? fail('ids used by app.js but missing from body.html: ' + missing.join(', ')) : pass(wanted.size + ' element ids that app.js looks up all exist');

// 3. no dynamic-template ids such as id="x-${n}" are checkable, but fixed ids in body.html must not be duplicated
const all = [...body.matchAll(/\bid="([^"$]+)"/g)].map(m => m[1]); const dup = all.filter((x, i) => all.indexOf(x) !== i);
dup.length ? fail('duplicate ids in body.html: ' + [...new Set(dup)].join(', ')) : pass(all.length + ' ids in body.html, none duplicated');

// 4. editable-text keys (Admin > Content) must exist in the registry, and every body.html key must survive
const used = new Set([...body.matchAll(/data-(?:tx|ph)="([^"]+)"/g)].map(m => m[1]));
for (const m of js.matchAll(/\bT\('([^']+)'/g)) used.add(m[1]);
const noReg = [...used].filter(k => !reg.has(k));
noReg.length ? fail('text keys not in text_registry.line.js: ' + noReg.join(', ')) : pass(used.size + ' editable-text keys all registered');
const baseline = fs.existsSync(path.join(root, 'tools/contract-baseline.json')) ? JSON.parse(r('tools/contract-baseline.json')) : null;
if (baseline) {
  const lostIds = baseline.bodyIds.filter(i => !bodyIds.has(i) && !jsMadeIds.has(i));
  lostIds.length ? fail('ids that existed before the redesign are gone: ' + lostIds.join(', ')) : pass('all ' + baseline.bodyIds.length + ' original body ids still present');
  const lostTx = baseline.textKeys.filter(k => !used.has(k));
  lostTx.length ? fail('editable text (data-tx / data-ph / T()) removed: ' + lostTx.join(', ')) : pass('all ' + baseline.textKeys.length + ' editable text keys still used');
  const lostData = baseline.dataAttrs.filter(a => !(body + js).includes(a));
  lostData.length ? fail('data-* hooks gone: ' + lostData.join(', ')) : pass('all ' + baseline.dataAttrs.length + ' data-* hooks still present');
}

// 5. strict CSP: nothing may load from another site (the Worker sends default-src 'self')
const ext = [];
for (const [n, s] of [['head.html', head], ['body.html', body], ['style.css', css], ['app.js', js]]) {
  for (const m of s.matchAll(/(?:src|href)\s*=\s*"(https?:)?\/\/[^"]+"/g)) if (!/^href="https?:\/\/[^"]*"$/.test(m[0]) || /rel="(stylesheet|preload)"/.test(s.slice(m.index - 60, m.index + 120))) ext.push(n + ': ' + m[0]);
  for (const m of s.matchAll(/@import[^;]+;|url\(\s*["']?https?:\/\/[^)]+\)/g)) ext.push(n + ': ' + m[0]);
}
for (const m of body.matchAll(/<(link|script|img|iframe|video|audio|source)\b[^>]*\b(src|href)="https?:\/\/[^"]*"/g)) if (m[1] !== 'a') ext.push('body.html: ' + m[0].slice(0, 90));
ext.length ? fail('external resources (blocked by CSP, and a privacy leak): ' + ext.join(' | ')) : pass('no external fonts, styles, scripts or images');
if (/<script[^>]+src=/i.test(head + body)) fail('external <script src> found'); else pass('no <script src>');

// 6. fonts: only url(@font/...) from assets/fonts, within budget
let fb = 0; for (const m of css.matchAll(/url\(\s*["']?@font\/([^"')\s]+)/g)) { const f = path.join(root, 'assets/fonts', m[1]); if (!fs.existsSync(f)) fail('missing font file ' + m[1]); else fb += fs.statSync(f).size; }
fb > 260 * 1024 ? fail('fonts ' + Math.round(fb / 1024) + ' KB over the 260 KB budget') : pass('fonts embedded: ' + Math.round(fb / 1024) + ' KB of 260 KB');
if (!/font-display\s*:\s*(swap|block|optional)/.test(css) && fb) fail('@font-face without font-display');

// 7. accessibility and behaviour guards in CSS
/prefers-reduced-motion/.test(css) ? pass('prefers-reduced-motion respected') : fail('no prefers-reduced-motion block');
/\[data-theme=light\]|\[data-theme="light"\]/.test(css) ? pass('light theme defined') : fail('light theme missing');
/:focus-visible/.test(css) ? pass('focus-visible styles present') : fail('no :focus-visible styles');
/\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/.test(css) ? pass('[hidden] rule kept') : fail('[hidden]{display:none!important} rule was removed');
/\.sr-only/.test(css) ? pass('.sr-only kept') : fail('.sr-only removed');
/viewport-fit=cover/.test(head) ? pass('viewport-fit=cover kept') : fail('viewport-fit=cover removed');
console.log(bad ? '\n' + bad + ' check(s) FAILED' : '\nAll contract checks passed'); process.exit(bad ? 1 : 0);
