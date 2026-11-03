// Builds dist/_worker.js: the single file the owner uploads to Cloudflare Pages.
// Icons are embedded as base64. src/text_registry.line.js holds the editable public-text list
// (one line: const TEXT_REGISTRY = [...]). The build warns if index.html has a data-tx / data-ph /
// T('key') key that is missing from that registry.
// Usage: node build.js
const fs = require('fs'), path = require('path'), cp = require('child_process');
const r = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const esc = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
// The public Wall lives in src/web/ (head.html, style.css, body.html, app.js) and is glued together here.
// Fonts: write url(@font/NAME.woff2) in style.css. The build embeds ONLY the files the CSS names, as data: URIs
// (nothing loads from another site). Files live in assets/fonts/. Budget: 260 KB of fonts.
const FONT_BUDGET = 260 * 1024;
let fontBytes = 0; const fontsUsed = [];
const css = r('src/web/style.css').replace(/url\(\s*["']?@font\/([A-Za-z0-9._-]+)["']?\s*\)/g, (m, name) => {
  const f = path.join(__dirname, 'assets', 'fonts', name);
  if (!fs.existsSync(f)) throw new Error('style.css uses @font/' + name + ' but assets/fonts/' + name + ' does not exist');
  const buf = fs.readFileSync(f); fontBytes += buf.length; fontsUsed.push(name + ' ' + Math.round(buf.length / 1024) + ' KB');
  return 'url(data:font/woff2;base64,' + buf.toString('base64') + ') format("woff2")';
});
if (fontBytes > FONT_BUDGET) throw new Error('Embedded fonts are ' + Math.round(fontBytes / 1024) + ' KB, over the ' + Math.round(FONT_BUDGET / 1024) + ' KB budget. Use fewer fonts.');
const indexHtml = r('src/web/head.html') + '<style>\n' + css + '</style>\n</head>\n<body>' + r('src/web/body.html') + '<script>\n' + r('src/web/app.js') + '</script>\n</body>\n</html>\n';
const pages = { index: indexHtml, admin: r('src/admin.html'), mod: r('src/mod.html') };
const icon = n => fs.readFileSync(path.join(__dirname, 'assets', 'icon-' + n + '.png')).toString('base64');
if (!pages.index.includes('<!--og-->')) throw new Error('src/web/head.html is missing the <!--og--> marker in <head>');
const regLine = r('src/text_registry.line.js').replace(/\n$/, '');
const reg = new Set(JSON.parse(regLine.replace(/^const TEXT_REGISTRY = /, '').replace(/;$/, '')).map(x => x.k));
const used = new Set();
for (const m of pages.index.matchAll(/data-(?:tx|ph)="([^"]+)"/g)) used.add(m[1]);
for (const m of pages.index.matchAll(/\bT\('([^']+)'/g)) used.add(m[1]);
const missing = [...used].filter(k => !reg.has(k));
console.log('Editable texts: ' + reg.size + (missing.length ? '  WARNING missing from registry: ' + missing.join(', ') : ''));
const out = 'const ICON_180_B64 = "' + icon(180) + '";\n' +
            'const ICON_192_B64 = "' + icon(192) + '";\n' +
            'const ICON_512_B64 = "' + icon(512) + '";\n' +
            'const INDEX_HTML = `' + esc(pages.index) + '`;\n' +
            'const ADMIN_HTML = `' + esc(pages.admin) + '`;\n' +
            'const MOD_HTML = `' + esc(pages.mod) + '`;\n\n' +
            regLine + '\n' + r('src/worker.src.js') + '\n' + r('src/review.src.js');
fs.mkdirSync(path.join(__dirname, 'dist'), { recursive: true });
const file = path.join(__dirname, 'dist', '_worker.js');
fs.writeFileSync(file, out);
const check = file.replace(/\.js$/, '.check.mjs');
fs.writeFileSync(check, out);
try { cp.execFileSync(process.execPath, ['--check', check], { stdio: 'inherit' }); } finally { fs.unlinkSync(check); }
const pub = path.join(__dirname, 'demo');
fs.mkdirSync(pub, { recursive: true });
const demo = s => s.replace('data-mode="live"', 'data-mode="demo"');
fs.writeFileSync(path.join(pub, 'wall-demo.html'), demo(pages.index));
fs.writeFileSync(path.join(pub, 'admin-demo.html'), demo(pages.admin));
fs.writeFileSync(path.join(pub, 'mod-demo.html'), demo(pages.mod));
if (fontsUsed.length) console.log('Embedded fonts: ' + fontsUsed.join(', '));
console.log('Built dist/_worker.js (' + Math.round(out.length / 1024) + ' KB)');
