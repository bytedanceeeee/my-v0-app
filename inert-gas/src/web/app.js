(() => {
'use strict';
const DEMO = document.documentElement.dataset.mode === 'demo' || /^\/demo\/?$/.test(location.pathname);
const TAGS = ['funny', 'crush', 'rant', 'advice', 'wholesome', 'exams', 'canteen', 'shoutout', 'other'];
const flairName = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : '');
const MOODS = ['stressed', 'tired', 'hopeful', 'chaotic'];
const REACTS = [
  { k: 'like', label: 'Heart', e: '\u2764\uFE0F' },
  { k: 'laugh', label: 'Laughing', e: '\uD83D\uDE02' },
  { k: 'wow', label: 'Surprised', e: '\uD83D\uDE2E' },
  { k: 'sad', label: 'Sad', e: '\uD83D\uDE22' },
  { k: 'up', label: 'Thumbs up', e: '\uD83D\uDC4D' },
];
const PROMPTS = [
  'The most chaotic thing I did this semester was',
  'Something I have never told my friends is',
  'My biggest exam day mistake was',
  'I secretly love it when',
  'The canteen moment I will never forget is',
  'If I could redo first year, I would',
  'A small thing that made my week better was',
  'My unpopular opinion about college life is',
  'I pretend to understand, but honestly',
  'The thing I am weirdly proud of is',
  'My most embarrassing moment on the way to class was',
  'Advice I wish someone had given me earlier is',
];
const RULES = [
  'No real names, nicknames, initials or descriptions that point to a person.',
  'No staff. Do not mention or describe teachers, staff or administrators.',
  'No accusations of crimes, cheating or misconduct against anyone.',
  'No phone numbers, emails, social handles, room numbers or roll numbers.',
  'No links of any kind.',
  'No bullying, mocking or targeting anyone.',
  'No hate based on religion, caste, ethnicity, gender, sexuality or disability.',
  'No sexual content. Keep crushes sweet and general.',
  'Nothing involving minors in any unsafe situation.',
  'No threats, even as a joke.',
  'No self-harm content. If you are struggling, help is in this sheet.',
  'No doxxing or hints about where someone lives or sits.',
  'No impersonating another student, group or club.',
  'No spam, chain posts or repeated posts.',
  'No selling, ads or promotions.',
  'No leaked exam papers, answers or private documents.',
  'No sharing other people\u2019s secrets or private chats.',
  'Be kind in comments. Disagree without insults.',
  'Report instead of retaliating.',
  'Do not try to work out who wrote a confession.',
  'Do not ask people to reveal themselves.',
  'Keep it about campus life, feelings and funny moments.',
  'Write in a way you would be okay with anyone reading.',
  'Posts that break the rules are held for review or removed.',
];
const CARE_RE = /\b(suicid\w*|kill myself|self.?harm|end it all|want to die|cut myself|no reason to live|hurt myself)\b/i;

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  laugh: '<circle cx="12" cy="12" r="10"/><path d="M18 13a6 6 0 0 1-6 5 6 6 0 0 1-6-5h12Z"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  hug: '<path d="M11 14h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 16"/><path d="m7 20 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9"/><path d="m2 15 6 6"/><path d="M19.5 8.5c.7-.7 1.5-1.6 1.5-2.7A2.73 2.73 0 0 0 16 4a2.78 2.78 0 0 0-5 1.8c0 1.2.8 2 1.5 2.8L16 12Z"/>',
  comment: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  dice: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M16 8h.01"/><path d="M8 8h.01"/><path d="M8 16h.01"/><path d="M16 16h.01"/><path d="M12 12h.01"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  spark: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17v4"/><path d="M17 19h4"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  wow: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="15.5" r="2.5"/><path d="M8 9h.01"/><path d="M16 9h.01"/>',
  sad: '<circle cx="12" cy="12" r="10"/><path d="M16 16.5s-1.5-2-4-2-4 2-4 2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  thumb: '<path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
};
const R_ICON = { like: 'heart', laugh: 'laugh', wow: 'wow', sad: 'sad', up: 'thumb' };
const rIcon = (k, size) => h('span', { class: 'em', 'aria-hidden': 'true' }, icon(R_ICON[k] || 'heart', size));
function icon(name, size = 18) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('width', size); s.setAttribute('height', size); s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round'); s.setAttribute('aria-hidden', 'true');
  s.innerHTML = ICONS[name] || '';
  return s;
}
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const k of kids.flat()) {
    if (k == null || k === false) continue;
    e.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
  return e;
}
document.querySelectorAll('[data-icon]').forEach((el) => {
  const big = el.classList.contains('big') || el.classList.contains('fab');
  el.prepend(icon(el.dataset.icon, big ? 24 : 18));
});
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
function makeCid() {
  const a = crypto.getRandomValues(new Uint8Array(24)), c = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from(a, (x) => c[x % 36]).join('');
}
let CID = store.get('xv_cid', '');
if (!/^[a-z0-9]{16,64}$/.test(CID)) { CID = makeCid(); store.set('xv_cid', CID); }
const dayKey = () => new Date().toISOString().slice(0, 10);

function toast(msg) {
  const t = h('div', { class: 'toast', text: msg });
  $('#toasts').append(t);
  setTimeout(() => t.remove(), 3200);
}
function rel(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + ' min ago';
  if (s < 86400) return Math.floor(s / 3600) + ' h ago';
  if (s < 7 * 86400) { const d = Math.floor(s / 86400); return d + (d === 1 ? ' day ago' : ' days ago'); }
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}
const full = (t) => new Date(t).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
function timeEl(t) {
  const b = h('button', { class: 'time', type: 'button', title: full(t), 'data-t': t, text: rel(t) });
  b.addEventListener('click', () => {
    b.dataset.abs = b.dataset.abs ? '' : '1';
    b.textContent = b.dataset.abs ? full(t) : rel(t);
  });
  return h('time', { datetime: new Date(t).toISOString() }, b);
}
function refreshTimes() {
  document.querySelectorAll('.time[data-t]').forEach((b) => { if (!b.dataset.abs) b.textContent = rel(+b.dataset.t); });
}
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Link copied'); }
  catch { prompt('Copy this link', text); }
}
const linkFor = (id) => (DEMO ? location.origin + location.pathname + '#post-' + id : location.origin + '/p/' + id);

/* ---------- API (live or demo) ---------- */
async function api(path, body) {
  if (DEMO) return Demo.handle(path, body);
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : { headers: { accept: 'application/json' } });
  let j = {};
  try { j = await r.json(); } catch {}
  if (!r.ok) throw Object.assign(new Error(j.error || 'Something went wrong. Please try again.'), { status: r.status });
  return j;
}

/* ---------- Captcha (ALTCHA proof of work, served by this site, no third party) ---------- */
async function altSolve(ch, onProgress) {
  const enc = new TextEncoder(), BATCH = 500, want = ch.challenge;
  const w0 = parseInt(want.slice(0, 2), 16), w1 = parseInt(want.slice(2, 4), 16);
  const hex = (a) => { let t = ''; for (let i = 0; i < a.length; i++) t += (a[i] < 16 ? '0' : '') + a[i].toString(16); return t; };
  for (let n = 0; n <= ch.maxnumber; n += BATCH) {
    const end = Math.min(n + BATCH, ch.maxnumber + 1), jobs = [];
    for (let i = n; i < end; i++) jobs.push(crypto.subtle.digest('SHA-256', enc.encode(ch.salt + i)));
    const out = await Promise.all(jobs);
    for (let k = 0; k < out.length; k++) {
      const a = new Uint8Array(out[k]);
      if (a[0] === w0 && a[1] === w1 && hex(a) === want) return n + k;
    }
    onProgress(end / (ch.maxnumber + 1));
  }
  throw new Error('The check found no answer. Tap to try again.');
}
function captcha(box) {
  box.replaceChildren();
  if (DEMO) {
    const cb = h('input', { type: 'checkbox' });
    box.append(h('label', { class: 'demo-check' }, cb, 'I am a human (demo check, the live site uses a private proof-of-work check)'));
    return { get: () => (cb.checked ? 'demo' : ''), reset() { cb.checked = false; } };
  }
  const IDLE = 'I am not a robot';
  let token = '', busy = false;
  const cb = h('input', { type: 'checkbox' }), label = h('span', { text: IDLE });
  box.append(h('label', { class: 'demo-check' }, cb, h('span', { class: 'alt-t' }, label, h('small', { text: 'A private check run by this site. No tracking, no third party.' }))));
  cb.addEventListener('change', async () => {
    if (!cb.checked) { token = ''; label.textContent = IDLE; return; }
    if (busy) return;
    busy = true; cb.disabled = true; token = '';
    label.textContent = 'Checking...';
    try {
      if (!window.crypto || !crypto.subtle) throw new Error('This browser cannot run the check. Open the site over https.');
      const ch = await api('/api/altcha');
      const n = await altSolve(ch, (f) => { label.textContent = 'Checking... ' + Math.round(f * 100) + '%'; });
      token = btoa(JSON.stringify({ algorithm: ch.algorithm, challenge: ch.challenge, number: n, salt: ch.salt, signature: ch.signature }));
      label.textContent = 'Verified. Thank you.';
    } catch (e) { cb.checked = false; label.textContent = e.message || 'The check failed. Tap to try again.'; }
    busy = false; cb.disabled = false;
  });
  return { get: () => token, reset() { token = ''; cb.checked = false; label.textContent = IDLE; } };
}

/* ---------- Theme ---------- */
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set('xv_theme', t);
  $('meta[name="theme-color"]').content = t === 'light' ? '#f1eadc' : '#14110e';
  const b = $('#b-theme');
  b.replaceChildren(icon(t === 'light' ? 'moon' : 'sun'));
  b.setAttribute('aria-label', t === 'light' ? 'Switch to midnight mode' : 'Switch to light mode');
}
setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
$('#b-theme').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light'));

/* ---------- Dialog plumbing ---------- */
const lastFocus = new Map();
/* Dialogs that host the captcha open as non-modal panels. A modal dialog sits in the
   browser top layer. This was needed for the old third-party captcha pop-up; it is harmless now. */
const NM = new Set(['composer', 'suggest', 'talk']);
const NM_BG = ['header.top', '#main', '#aside', '.bnav'];
let nmBd = null;
function nmOpen(d) {
  if (nmBd) nmBd.remove();
  nmBd = document.createElement('div');
  nmBd.className = 'nm-bd';
  nmBd.addEventListener('click', () => d.close());
  document.body.append(nmBd);
  d.classList.add('nm');
  NM_BG.forEach((q) => { const e = document.querySelector(q); if (e) e.inert = true; });
  document.documentElement.style.overflow = 'hidden';
  d.show();
}
function nmClose(d) {
  if (nmBd) { nmBd.remove(); nmBd = null; }
  d.classList.remove('nm');
  NM_BG.forEach((q) => { const e = document.querySelector(q); if (e) e.inert = false; });
  document.documentElement.style.overflow = '';
}
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if ([...document.querySelectorAll('dialog[open]')].some((x) => !x.classList.contains('nm'))) return;
  const d = document.querySelector('dialog.nm[open]');
  if (d) { e.preventDefault(); d.close(); }
});
/* Close one dialog, then run fn after its close handlers have finished (close events are async). */
function closeThen(d, fn) {
  if (!d.open) return fn();
  d.addEventListener('close', () => setTimeout(fn, 0), { once: true });
  d.close();
}
function openD(d) {
  lastFocus.set(d, document.activeElement);
  if (d.open) return;
  if (NM.has(d.id)) nmOpen(d); else d.showModal();
}
document.querySelectorAll('dialog').forEach((d) => {
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) d.close();
    else if (e.target === d) d.close();
  });
  d.addEventListener('close', () => {
    if (d.classList.contains('nm')) nmClose(d);
    const f = lastFocus.get(d);
    if (f && f.focus && document.contains(f)) f.focus();
  });
});

/* ---------- Public settings & widgets ---------- */
let PUB = { banner: '', comments_on: true, delay_min: 2, delay_max: 3, helplines: [], cotd: null, moods: null, week_moods: null, weekly_theme: '', weekly_prompt: '', poll: null, apply: { on: false }, texts: {}, rules: null, prompts: null, privacy: '', report_reasons: null, announce: null };
/* Messages the page shows can be edited by the admin. T(key, default) returns the admin's version when there is one. */
function T(k, d) { const v = PUB.texts && PUB.texts[k]; return typeof v === 'string' && v ? v : d; }
function setTx(el, v) {
  let n = null;
  el.childNodes.forEach((c) => { if (c.nodeType === 3 && c.nodeValue.trim()) n = c; });
  if (n) n.nodeValue = v; else el.append(document.createTextNode(v));
}
function applyTexts() {
  const t = PUB.texts || {};
  document.querySelectorAll('[data-tx]').forEach((el) => { const v = t[el.dataset.tx]; if (typeof v === 'string' && v) setTx(el, v); });
  document.querySelectorAll('[data-ph]').forEach((el) => { const v = t[el.dataset.ph]; if (typeof v === 'string' && v) el.placeholder = v; });
}
function renderRules() {
  const list = Array.isArray(PUB.rules) && PUB.rules.length ? PUB.rules : RULES;
  $('#rules-list').replaceChildren(...list.map((r) => h('li', { text: r })));
}
function renderPrivacy() {
  const text = String(PUB.privacy || '').trim();
  if (!text) return;
  $('#priv-body').replaceChildren(...text.split(/\n{2,}/).map((b) => { b = b.trim(); return b.startsWith('## ') ? h('h3', { text: b.slice(3) }) : h('p', { class: 'note', text: b }); }));
}
const pickPrompt = () => { const l = Array.isArray(PUB.prompts) && PUB.prompts.length ? PUB.prompts : PROMPTS; return l[Math.floor(Math.random() * l.length)]; };
let annShown = false;
function renderAnnounce() {
  const a = PUB.announce, w = $('#w-ann'), chip = $('#ann-chip');
  if (!a) { w.hidden = true; chip.hidden = true; return; }
  const title = a.title || T('ann_default', 'Announcement');
  $('#ann-title').textContent = title; $('#ann-text').textContent = a.body || '';
  $('#ann-date').textContent = a.v && /^\d{10,}$/.test(a.v) ? rel(+a.v) : '';
  $('#ann-chip-t').textContent = title;
  $('#an-h').textContent = title; $('#an-body').textContent = a.body || '';
  w.hidden = false; chip.hidden = false;
  if (!annShown && store.get('xv_ann_seen', '') !== a.v) { annShown = true; openD($('#announce')); }
}
const annSeen = () => { if (PUB.announce) store.set('xv_ann_seen', PUB.announce.v); };
async function loadPublic() {
  try { PUB = Object.assign(PUB, await api('/api/public')); } catch {}
  renderBanner(); renderCotd(); renderMoods(); renderWeek(); renderPoll(); renderHelp(); renderPrompt(); renderRules(); renderPrivacy(); applyTexts(); renderAnnounce(); renderQkFlair(); $('#apply-open').hidden = !(PUB.apply && PUB.apply.on);
}
function renderBanner() {
  const b = $('#banner'), seen = sessionStorage.getItem('xv_banner_x');
  if (PUB.banner && seen !== PUB.banner) { $('#banner-t').textContent = PUB.banner; b.hidden = false; }
  else b.hidden = true;
}
$('#banner-x').addEventListener('click', () => { sessionStorage.setItem('xv_banner_x', PUB.banner); $('#banner').hidden = true; });
function renderCotd() {
  const w = $('#w-cotd'), p = PUB.cotd;
  if (!p) { w.hidden = true; return; }
  w.hidden = false;
  $('#cotd-t').textContent = p.text;
  const total = REACTS.reduce((a, r) => a + (p.reactions[r.k] || 0), 0);
  $('#cotd-m').textContent = plural(total, 'reaction') + ' · ' + flairName(p.tag);
  $('#cotd-open').onclick = () => { location.hash = 'post-' + p.id; };
}
function renderMoods() {
  const box = $('#moods'), mine = store.get('xv_mood', null), voted = mine && mine.day === dayKey() ? mine.mood : '';
  const counts = PUB.moods || Object.fromEntries(MOODS.map((m) => [m, 0]));
  const total = MOODS.reduce((a, m) => a + (counts[m] || 0), 0);
  box.replaceChildren(...MOODS.map((m) => {
    const pct = total ? Math.round(((counts[m] || 0) / total) * 100) : 0;
    const fill = h('i', { class: 'fill', 'aria-hidden': 'true' });
    const b = h('button', { class: 'mood', type: 'button', 'aria-pressed': voted === m ? 'true' : 'false', disabled: !!voted }, fill, h('b', { text: m }), h('span', { text: voted ? pct + '%' : 'Tap to pick' }));
    if (voted) requestAnimationFrame(() => { fill.style.width = pct + '%'; });
    b.addEventListener('click', async () => {
      if (store.get('xv_mood', {}).day === dayKey()) return;
      try {
        const j = await api('/api/mood', { cid: CID, mood: m });
        store.set('xv_mood', { day: dayKey(), mood: j.already ? m : m });
        if (j.moods) PUB.moods = j.moods;
        renderMoods();
      } catch (e) { toast(e.message); }
    });
    return b;
  }));
  $('#mood-n').textContent = plural(total, 'student') + ' checked in today.'; $('#mood-n').hidden = !voted;
}
function renderPrompt() {
  const theme = (PUB.weekly_theme || '').trim(), prompt = (PUB.weekly_prompt || '').trim();
  $('#w-prompt').hidden = !(theme || prompt);
  $('#pc-h').textContent = theme ? 'This week: ' + theme : 'This week';
  $('#pc-p').textContent = prompt;
  $('#pc-p').hidden = !prompt;
  $('#pc-write').hidden = !prompt;
  $('#comp-prompt').hidden = !prompt;
  $('#comp-prompt-t').textContent = prompt;
}
function weekTotals() {
  const t = (PUB.week_moods && PUB.week_moods.totals) || {};
  const totals = Object.fromEntries(MOODS.map((m) => [m, +t[m] || 0]));
  return { totals, total: MOODS.reduce((a, m) => a + totals[m], 0) };
}
function weekLine(totals) {
  const sorted = MOODS.slice().sort((a, b) => totals[b] - totals[a]);
  return totals[sorted[0]] === totals[sorted[1]] ? 'A mixed week on campus' : 'Mostly ' + sorted[0] + ' this week';
}
function renderWeek() {
  const w = $('#w-week'), { totals, total } = weekTotals();
  if (!total) { w.hidden = true; return; }
  w.hidden = false;
  $('#week-line').textContent = weekLine(totals);
  $('#week-n').textContent = plural(total, 'check-in') + ' in 7 days';
  $('#week-bars').replaceChildren(...MOODS.map((m) => {
    const pct = Math.round((totals[m] / total) * 100), fill = h('i', { class: 'fill', 'aria-hidden': 'true' });
    requestAnimationFrame(() => { fill.style.width = pct + '%'; });
    return h('div', { class: 'wbar' }, fill, h('b', { text: m }), h('span', { text: pct + '%' }));
  }));
}
function renderPoll() {
  const box = $('#poll'), p = PUB.poll;
  if (!p) { box.replaceChildren(h('p', { class: 'note', text: 'No poll right now. Suggest one below.' })); return; }
  const mine = store.get('xv_poll_' + p.id, null), voted = mine !== null;
  const total = p.options.reduce((a, _, i) => a + (+p.counts[i] || 0), 0);
  box.replaceChildren(
    h('p', { class: 'poll-q', text: p.question }),
    h('div', { class: 'opts' }, p.options.map((o, i) => {
      const pct = total ? Math.round(((+p.counts[i] || 0) / total) * 100) : 0;
      const fill = h('i', { class: 'fill', 'aria-hidden': 'true' });
      const b = h('button', { class: 'opt', type: 'button', 'aria-pressed': mine === i ? 'true' : 'false', disabled: voted }, fill, h('span', { text: o }), voted ? h('span', { class: 'pct', text: pct + '%' }) : null);
      if (voted) requestAnimationFrame(() => { fill.style.width = pct + '%'; });
      b.addEventListener('click', async () => {
        try {
          const j = await api('/api/poll/vote', { cid: CID, poll: p.id, option: i });
          store.set('xv_poll_' + p.id, i);
          if (j.poll) PUB.poll = j.poll;
          renderPoll();
        } catch (e) { toast(e.message); }
      });
      return b;
    })),
    ...(voted ? [h('p', { class: 'note', style: 'margin-top:10px', text: plural(total, 'vote') })] : []),
  );
}
/* Helplines are stored one per entry as "Name | number | note". A number made only of digits,
   spaces, + and - becomes a tel: link. Entries without " | " stay plain text. */
function helpNodes() {
  const raw = Array.isArray(PUB.helplines) && PUB.helplines.length ? PUB.helplines : ['Support contacts will be added by the admin soon.'];
  return raw.map((x) => {
    const parts = String(x).split(' | '), li = h('li');
    if (parts.length >= 2) {
      const name = parts[0], num = parts[1].trim(), note = parts.slice(2).join(' | ');
      li.append(h('span', { class: 'hl-n', text: name }));
      if (note) li.append(h('span', { class: 'hl-note', text: note }));
      if (/^[\d\s+-]+$/.test(num) && /\d/.test(num)) li.append(h('a', { class: 'tel', href: 'tel:' + num.replace(/[\s-]/g, ''), text: 'Call ' + num }));
      else if (num) li.append(h('span', { class: 'hl-note', text: num }));
    } else li.append(h('span', { text: String(x) }));
    return li;
  });
}
function renderHelp() {
  for (const id of ['#helplines-list', '#care-list']) $(id).replaceChildren(...helpNodes());
}
renderRules();

/* ---------- Feed ---------- */
const S = { sort: 'latest', range: 'week', tag: '', q: '', items: [], next: null, loading: false, done: false, error: false };
const cards = new Map();
const feedEl = $('#feed');
const reacted = store.get('xv_reacts', {});
const saveReacted = () => store.set('xv_reacts', reacted);

function renderFilters() {
  const sel = $('#flair-f');
  sel.replaceChildren(h('option', { value: '', text: 'All' }), ...TAGS.map((t) => h('option', { value: t, text: flairName(t) })));
  sel.value = S.tag;
  $('#range-wrap').hidden = S.sort !== 'top';
  $('#range-f').value = S.range;
}
$('#flair-f').addEventListener('change', (e) => { S.tag = e.target.value; loadFeed(true); });
$('#range-f').addEventListener('change', (e) => { S.range = e.target.value; loadFeed(true); });
function setSort(s) {
  S.sort = s;
  $('#range-wrap').hidden = s !== 'top';
  document.querySelectorAll('#sorts button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.sort === s ? 'true' : 'false'));
  loadFeed(true);
}
document.querySelectorAll('#sorts button').forEach((b) => b.addEventListener('click', () => setSort(b.dataset.sort)));
$('#surprise').addEventListener('click', async () => {
  try {
    const j = await api('/api/feed?sort=random' + (S.tag ? '&tag=' + S.tag : ''));
    const p = j.items[0];
    if (!p) return toast(T('toast_nothing_yet', 'Nothing to surprise you with yet.'));
    openSingle(p);
  } catch (e) { toast(e.message); }
});
let qTimer;
$('#q').addEventListener('input', (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = e.target.value.trim().toLowerCase(); applySearch(); }, 120); });
function applySearch() {
  let shown = 0;
  for (const [id, el] of cards) {
    const p = S.items.find((x) => x.id === id);
    const hit = !S.q || (p && (p.text.toLowerCase().includes(S.q) || p.tag.includes(S.q)));
    el.hidden = !hit;
    if (hit) shown++;
  }
  renderFoot(shown);
}

function card(p, opts = {}) {
  const heat = REACTS.reduce((a, r) => a + ((p.reactions || {})[r.k] || 0), 0);
  const look = (heat >= 20 ? ' hot' : '') + (Date.now() - p.publish_at < 20 * 60000 ? ' fresh' : '');
  const el = h('article', { class: 'card' + look, tabindex: '-1', id: opts.single ? null : 'post-' + p.id, 'aria-label': 'Confession number ' + p.id });
  const mine = new Set((reacted[p.id] || []).filter((k) => REACTS.some((r) => r.k === k)));
  const counts = Object.assign({ like: 0, laugh: 0, wow: 0, sad: 0, up: 0 }, p.reactions);
  const clamp = !opts.single && p.text.length > 700;
  const body = h('p', { class: 'body' + (p.text.length > 420 ? ' long' : p.text.length < 110 ? ' short' : '') + (clamp ? ' clamp' : ''), text: p.text });
  let moreBtn2 = null;
  if (clamp) {
    moreBtn2 = h('button', { class: 'more', type: 'button', 'aria-expanded': 'false', text: T('card_read_more', 'Read more') });
    moreBtn2.addEventListener('click', () => {
      const open = body.classList.toggle('clamp') === false;
      moreBtn2.setAttribute('aria-expanded', open ? 'true' : 'false');
      moreBtn2.textContent = open ? T('card_read_less', 'Show less') : T('card_read_more', 'Read more');
    });
  }
  const meta = h('div', { class: 'meta' }, h('span', { class: 'tag', 'data-tag': p.tag, text: p.tag }), h('span', { class: 'num', text: '#' + p.id }), timeEl(p.publish_at));

  /* One reaction per person per confession: picking a new one replaces the old one,
     picking the same one again removes it. */
  const rBtn = {}, rNum = {};
  const paint = (k) => {
    const r = REACTS.find((x) => x.k === k);
    rBtn[k].setAttribute('aria-pressed', mine.has(k) ? 'true' : 'false');
    rNum[k].textContent = counts[k] || '';
    rBtn[k].setAttribute('aria-label', r.label + ', ' + plural(counts[k] || 0, 'reaction') + (mine.has(k) ? ', selected' : ''));
  };
  const flip = (k, state) => {
    if (state) mine.add(k); else mine.delete(k);
    counts[k] = Math.max(0, (counts[k] || 0) + (state ? 1 : -1));
    p.reactions[k] = counts[k];
    paint(k);
    reacted[p.id] = [...mine];
    if (!reacted[p.id].length) delete reacted[p.id];
    saveReacted();
  };
  let rQueue = Promise.resolve();
  const reactBtns = REACTS.map((r) => {
    rNum[r.k] = h('span', { class: 'num', text: counts[r.k] || '' });
    const b = rBtn[r.k] = h('button', { class: 'react', type: 'button', 'data-r': r.k, 'aria-pressed': mine.has(r.k) ? 'true' : 'false' }, rIcon(r.k, 19), rNum[r.k]);
    paint(r.k);
    b.addEventListener('click', () => {
      const on = !mine.has(r.k), drop = on ? [...mine] : [];
      drop.forEach((k) => flip(k, false));
      flip(r.k, on);
      rQueue = rQueue.then(async () => {
        try {
          for (const k of drop) await api('/api/reaction', { cid: CID, id: p.id, type: k, on: false });
          await api('/api/reaction', { cid: CID, id: p.id, type: r.k, on });
        } catch (e) { flip(r.k, !on); drop.forEach((k) => flip(k, true)); toast(e.message); }
      });
    });
    return b;
  });

  const cCount = h('span', { class: 'num', text: p.comments || '' });
  const cBtn = h('button', { class: 'act', type: 'button', 'aria-expanded': 'false', 'aria-label': 'Comments' }, icon('comment'), cCount);
  let cBox = null;
  cBtn.addEventListener('click', () => {
    const open = cBtn.getAttribute('aria-expanded') === 'true';
    cBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
    if (open) { cBox.hidden = true; return; }
    if (!cBox) { cBox = commentsBox(p, cCount); el.append(cBox); }
    cBox.hidden = false;
    const ta = cBox.querySelector('textarea'); if (ta) ta.focus();
  });

  const shareBtn = h('button', { class: 'act', type: 'button', 'aria-label': 'Share as image' }, icon('image'));
  shareBtn.addEventListener('click', () => openShare(p));

  const pop = h('div', { class: 'menu-pop', role: 'menu', hidden: true });
  const moreBtn = h('button', { class: 'act', type: 'button', 'aria-label': 'More options', 'aria-haspopup': 'menu', 'aria-expanded': 'false' }, icon('more'));
  const closeMenu = () => { pop.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); document.removeEventListener('click', outside, true); };
  const outside = (e) => { if (!menu.contains(e.target)) closeMenu(); };
  moreBtn.addEventListener('click', () => {
    if (!pop.hidden) return closeMenu();
    pop.hidden = false; moreBtn.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', outside, true);
    pop.querySelector('button').focus();
  });
  pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeMenu(); moreBtn.focus(); } });
  const mi = (ic, txt, fn, cls) => { const b = h('button', { type: 'button', role: 'menuitem', class: cls }, icon(ic), txt); b.addEventListener('click', () => { closeMenu(); fn(); }); return b; };
  pop.append(
    mi('link', 'Copy link', async () => { if (await shareGate(p)) copy(linkFor(p.id)); }),
    mi('flag', 'Report', () => openReport({ id: p.id, comment: false, onDone: () => {
      el.replaceChildren(meta, h('p', { class: 'reported', text: T('reported_post', 'Reported, thank you. This confession is hidden while an admin reviews it.') }));
    } }), 'danger'),
  );
  const menu = h('div', { class: 'menu' }, moreBtn, pop);

  el.append(meta, body, moreBtn2, h('div', { class: 'actions' }, reactBtns, h('span', { class: 'spacer' }), cBtn, shareBtn, menu));
  if (opts.openComments) setTimeout(() => cBtn.click(), 0);
  return el;
}

const creacted = store.get('xv_creacts', {});
function cReactBar(c) {
  const counts = Object.assign({}, c.reactions || {}), btns = {};
  let cur = REACTS.some((r) => r.k === creacted[c.id]) ? creacted[c.id] : '', q = Promise.resolve();
  const wrap = h('div', { class: 'c-react', role: 'group', 'aria-label': 'React to this comment' });
  const paint = () => REACTS.forEach((r) => {
    btns[r.k].setAttribute('aria-pressed', cur === r.k ? 'true' : 'false');
    btns[r.k].querySelector('.num').textContent = counts[r.k] || '';
  });
  REACTS.forEach((r) => {
    const b = btns[r.k] = h('button', { class: 'react', type: 'button', 'data-r': r.k, 'aria-label': r.label, 'aria-pressed': 'false' }, rIcon(r.k, 15), h('span', { class: 'num' }));
    b.addEventListener('click', () => {
      const prev = cur, on = prev !== r.k;
      if (prev) counts[prev] = Math.max(0, (counts[prev] || 0) - 1);
      if (on) counts[r.k] = (counts[r.k] || 0) + 1;
      cur = on ? r.k : '';
      if (cur) creacted[c.id] = cur; else delete creacted[c.id];
      store.set('xv_creacts', creacted); paint();
      q = q.then(async () => {
        try { await api('/api/comment/reaction', { cid: CID, id: c.id, type: r.k, on }); }
        catch (e) { toast(e.message); }
      });
    });
    wrap.append(b);
  });
  paint();
  return wrap;
}
function commentsBox(p, countEl) {
  const box = h('div', { class: 'comments' });
  const list = h('ul', { class: 'c-list', 'aria-label': 'Comments' });
  const status = h('p', { class: 'c-empty', text: 'Loading comments...' });
  box.append(status, list);
  const load = async () => {
    try {
      const rows = await api('/api/comments?post=' + p.id);
      status.hidden = rows.length > 0;
      status.textContent = T('cm_none', 'No comments yet. Be kind and go first.');
      countEl.textContent = rows.length || '';
      list.replaceChildren(...rows.map((c) => {
        const li = h('li', { class: 'c-item' });
        const flag = h('button', { class: 'act', type: 'button', 'aria-label': 'Report comment' }, icon('flag', 15));
        flag.addEventListener('click', () => openReport({ id: c.id, comment: true, onDone: () => { li.replaceChildren(h('p', { class: 'note', text: 'Reported, thank you. Hidden for review.' })); } }));
        li.append(h('div', { style: 'flex:1;min-width:0' }, h('p', { text: c.text }), h('small', { text: rel(c.publish_at) }), cReactBar(c)), flag);
        return li;
      }));
    } catch (e) { status.textContent = e.message; }
  };
  load();
  if (!PUB.comments_on) { box.append(h('p', { class: 'note', text: 'Comments are paused right now.' })); return box; }
  const ta = h('textarea', { class: 'field', maxlength: '300', placeholder: T('cm_ph', 'Add a kind comment'), 'aria-label': 'Your comment', rows: '2' });
  const cnt = h('span', { class: 'count', text: '0 / 300' });
  const cap = h('div', { class: 'captcha' });
  const err = h('p', { class: 'err', role: 'alert', hidden: true });
  const send = h('button', { class: 'btn primary small', type: 'button' }, icon('send', 16), 'Comment');
  let capCtl = null;
  ta.addEventListener('focus', () => { if (!capCtl) capCtl = captcha(cap); }, { once: true });
  ta.addEventListener('input', () => { const n = ta.value.trim().length; cnt.textContent = n + ' / 300'; cnt.classList.toggle('bad', n > 300); });
  send.addEventListener('click', async () => {
    if (!capCtl) capCtl = captcha(cap);
    err.hidden = true;
    const text = ta.value.trim();
    if (text.length < 2) { err.textContent = 'Write at least 2 characters.'; err.hidden = false; return; }
    const tok = capCtl.get();
    if (!tok) { err.textContent = T('err_captcha', 'Please complete the captcha first.'); err.hidden = false; return; }
    send.disabled = true;
    try {
      const j = await api('/api/comment', { cid: CID, post: p.id, text, captcha: tok });
      ta.value = ''; cnt.textContent = '0 / 300';
      form.replaceChildren(h('p', { class: 'ok-msg', text: 'Thanks. Your comment will appear in about ' + delayText(j) + '.' }));
    } catch (e) { err.textContent = e.message; err.hidden = false; }
    send.disabled = false;
    capCtl.reset();
  });
  const form = h('div', { class: 'c-form' }, ta, cap, err, h('div', { class: 'c-foot' }, h('span', { class: 'note', text: T('cm_note', 'Comments are reviewed like confessions.') }), h('span', { class: 'row' }, cnt, send)));
  box.append(form);
  return box;
}
function delayText(j) {
  const lo = (j && j.delay_min) || PUB.delay_min, hi = (j && j.delay_max) || PUB.delay_max;
  if (DEMO) return '15 seconds (demo speed)';
  return lo === hi ? plural(lo, 'minute') : lo + ' to ' + hi + ' minutes';
}

function skeletons(n) { return Array.from({ length: n }, () => h('div', { class: 'skel', 'aria-hidden': 'true' })); }
function renderFoot(shownCount) {
  const f = $('#feed-foot');
  f.replaceChildren();
  if (S.error) {
    const b = h('button', { class: 'btn', type: 'button', text: 'Try again' });
    b.addEventListener('click', () => loadFeed(!S.items.length));
    f.append(h('div', { class: 'state' }, h('h2', { text: 'The wall did not load' }), h('p', { text: 'Check your connection and try again.' }), b));
    return;
  }
  if (S.loading) return;
  if (!S.items.length) {
    const b = h('button', { class: 'btn primary', type: 'button' }, icon('pen'), 'Write the first one');
    b.addEventListener('click', openComposer);
    const rangeOnly = S.sort === 'top' && S.range !== 'all' && !S.tag;
    f.append(h('div', { class: 'state' }, h('h2', { text: S.tag ? 'Nothing with the ' + flairName(S.tag) + ' flair yet' : rangeOnly ? 'Nothing in this range yet' : T('feed_quiet', 'The wall is quiet') }), h('p', { text: rangeOnly ? 'Try a longer range, or write the first one.' : 'No confessions here yet. Yours could be the first.' }), b));
    return;
  }
  const shown = shownCount == null ? [...cards.values()].filter((c) => !c.hidden).length : shownCount;
  if (S.q && !shown) { f.append(h('div', { class: 'state' }, h('h2', { text: 'No matches' }), h('p', { text: 'Search only covers confessions loaded so far. Scroll for more or try another word.' }))); return; }
  if (S.sort === 'random') {
    const b = h('button', { class: 'btn', type: 'button' }, icon('shuffle'), 'Shuffle again');
    b.addEventListener('click', () => loadFeed(true));
    f.append(h('div', { class: 'end' }, b));
    return;
  }
  if (S.done) f.append(h('p', { class: 'end', text: T('feed_end', 'You have reached the beginning of the wall.') }));
}
let feedToken = 0;
async function loadFeed(reset) {
  if (reset) {
    feedToken++;
    S.items = []; S.next = null; S.done = false; S.error = false; S.loading = false;
    cards.clear();
    feedEl.replaceChildren(...skeletons(3));
    $('#pill').hidden = true; newCount = 0;
  }
  if (S.loading || S.done) return;
  S.loading = true; S.error = false;
  const token = feedToken;
  const qs = new URLSearchParams({ sort: S.sort });
  if (S.tag) qs.set('tag', S.tag);
  if (S.sort === 'top') qs.set('range', S.range);
  if (S.next) for (const [k, v] of Object.entries(S.next)) qs.set(k, v);
  if (!reset) feedEl.append(...skeletons(1));
  renderFoot();
  try {
    const j = await api('/api/feed?' + qs);
    if (token !== feedToken) return;
    feedEl.querySelectorAll('.skel').forEach((s) => s.remove());
    const fresh = j.items.filter((p) => !cards.has(p.id));
    S.items.push(...fresh);
    for (const p of fresh) { const c = card(p); cards.set(p.id, c); feedEl.append(c); }
    S.next = j.next; S.done = !j.next;
  } catch (e) {
    if (token !== feedToken) return;
    feedEl.querySelectorAll('.skel').forEach((s) => s.remove());
    S.error = true;
  }
  S.loading = false;
  applySearch();
}
new IntersectionObserver((es) => {
  if (es.some((e) => e.isIntersecting) && !S.loading && !S.done && !S.error && S.items.length && S.sort !== 'random') loadFeed(false);
}, { rootMargin: '600px 0px' }).observe($('#sentinel'));

/* new confessions pill */
let newCount = 0;
async function checkNew() {
  if (document.hidden || S.sort !== 'latest' || !S.items.length) return;
  try {
    const j = await api('/api/feed?sort=latest' + (S.tag ? '&tag=' + S.tag : ''));
    const top = S.items[0];
    newCount = j.items.filter((p) => !cards.has(p.id) && (p.publish_at > top.publish_at || (p.publish_at === top.publish_at && p.id > top.id))).length;
    const pill = $('#pill');
    if (newCount) {
      pill.replaceChildren(icon('up', 16), (newCount >= 20 ? '20+' : newCount) + (newCount === 1 ? ' new confession' : ' new confessions'));
      pill.hidden = false;
    }
  } catch {}
}
$('#pill').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); loadFeed(true); });
setInterval(() => { refreshTimes(); checkNew(); }, DEMO ? 15000 : 60000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshTimes(); checkNew(); } });

/* ---------- Composer ---------- */
const DRAFT = 'xv_draft';
const comp = $('#composer'), ta = $('#comp-ta');
let compTag = 'other', compCap = null, doneTimer = null;
function syncFlair() {
  const s = $('#comp-flair');
  if (!s.options.length) s.replaceChildren(...TAGS.map((t) => h('option', { value: t, text: flairName(t) })));
  s.value = compTag;
}
$('#comp-flair').addEventListener('change', (e) => { compTag = e.target.value; saveDraft(); });
/* If the flair was left on Other, ask once whether that is really right. */
function askOther() {
  return new Promise((res) => {
    const d = $('#flairask');
    let answer = false;
    $('#fa-yes').onclick = () => { answer = true; d.close(); };
    $('#fa-change').onclick = () => { answer = false; d.close(); };
    d.addEventListener('close', () => res(answer), { once: true });
    d.showModal();
  });
}
const confirmFlair = (tag) => (tag === 'other' ? askOther() : Promise.resolve(true));
function saveDraft() { if (ta.value) store.set(DRAFT, { text: ta.value, tag: compTag }); else store.del(DRAFT); }
function updateCount() {
  const n = ta.value.trim().length, c = $('#comp-count');
  c.textContent = n + ' / 1000';
  c.classList.toggle('bad', n > 1000);
  const care = $('#care');
  if (CARE_RE.test(ta.value) && !care.dataset.x) care.hidden = false;
}
ta.addEventListener('input', () => { updateCount(); saveDraft(); });
$('#care-x').addEventListener('click', () => { $('#care').hidden = true; $('#care').dataset.x = '1'; });
$('#dice').addEventListener('click', () => {
  const p = pickPrompt();
  if (!ta.value.trim()) { ta.value = p + ' '; updateCount(); saveDraft(); }
  else ta.placeholder = p + '...';
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
});
function usePrompt() {
  const p = (PUB.weekly_prompt || '').trim();
  if (!p) return;
  if (ta.value.trim()) { toast('Your draft is still here. Clear it to start from the prompt.'); return; }
  ta.value = p + ' '; updateCount(); saveDraft(); ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
}
$('#comp-use').addEventListener('click', usePrompt);
$('#pc-write').addEventListener('click', () => { openComposer(); usePrompt(); });
function openComposer() {
  clearInterval(doneTimer);
  $('#comp-form').hidden = false; $('#comp-done').hidden = true; $('#comp-err').hidden = true;
  const d = store.get(DRAFT, null);
  if (d && !ta.value) { ta.value = d.text || ''; compTag = TAGS.includes(d.tag) ? d.tag : 'other'; }
  syncFlair(); updateCount();
  openD(comp);
  if (!compCap) compCap = captcha($('#comp-cap'));
  setTimeout(() => ta.focus(), 30);
}
$('#comp-send').addEventListener('click', async () => {
  const err = $('#comp-err');
  err.hidden = true;
  const raw = ta.value;
  if (!raw.trim()) { err.textContent = T('err_write_first', 'Write something first.'); err.hidden = false; return; }
  const tok = compCap ? compCap.get() : '';
  if (!tok) { err.textContent = T('err_captcha', 'Please complete the captcha first.'); err.hidden = false; return; }
  if (!(await confirmFlair(compTag))) { $('#comp-flair').focus(); return; }
  const btn = $('#comp-send');
  btn.disabled = true;
  store.del(DRAFT);
  try {
    const j = await api('/api/submit', { text: raw, tag: compTag, cid: CID, captcha: tok });
    ta.value = ''; compTag = 'other'; syncFlair(); $('#care').hidden = true; delete $('#care').dataset.x;
    showDone(j);
  } catch (e) { err.textContent = e.message; err.hidden = false; }
  btn.disabled = false;
  compCap.reset();
});
function showDone(j) {
  $('#comp-form').hidden = true; $('#comp-done').hidden = false;
  $('#done-t').textContent = 'Your confession will appear on the wall in about ' + delayText(j) + '. If it breaks a rule it will be held for review instead.';
  const lo = DEMO ? 0.25 : (j.delay_min || PUB.delay_min), hi = DEMO ? 0.25 : (j.delay_max || PUB.delay_max);
  let left = Math.round(((lo + hi) / 2) * 60);
  const tick = () => {
    const t = $('#done-timer');
    if (left <= 0) { t.textContent = 'Any moment now'; clearInterval(doneTimer); return; }
    t.textContent = 'About ' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
    left--;
  };
  clearInterval(doneTimer); tick(); doneTimer = setInterval(tick, 1000);
}
comp.addEventListener('close', () => clearInterval(doneTimer));
['#b-confess', '#n-confess'].forEach((s) => $(s).addEventListener('click', openComposer));

/* ---------- Big confession box on the wall ---------- */
let qkTag = 'other', qkCap = null;
const qka = $('#qk-ta');
function renderQkFlair() {
  const s = $('#qk-flair');
  if (!s.options.length) s.replaceChildren(...TAGS.map((t) => h('option', { value: t, text: flairName(t) })));
  s.value = qkTag;
}
$('#qk-flair').addEventListener('change', (e) => { qkTag = e.target.value; });
function qkEnsureCap() { if (!qkCap) { $('#qk-cap').hidden = false; qkCap = captcha($('#qk-cap')); } }
qka.addEventListener('focus', qkEnsureCap);
qka.addEventListener('input', () => { const n = qka.value.trim().length, c = $('#qk-count'); c.textContent = n + ' / 1000'; c.classList.toggle('bad', n > 1000); });
$('#qk-rules').addEventListener('click', () => openD($('#rules')));
$('#qk-send').addEventListener('click', async () => {
  const err = $('#qk-err'), ok = $('#qk-ok'), btn = $('#qk-send'), raw = qka.value;
  err.hidden = true; ok.hidden = true;
  if (!raw.trim()) { err.textContent = T('err_write_first', 'Write something first.'); err.hidden = false; qka.focus(); return; }
  qkEnsureCap();
  const tok = qkCap.get();
  if (!tok) { err.textContent = T('err_captcha', 'Please complete the captcha first.'); err.hidden = false; return; }
  if (!(await confirmFlair(qkTag))) { $('#qk-flair').focus(); return; }
  btn.disabled = true;
  try {
    const j = await api('/api/submit', { text: raw, tag: qkTag, cid: CID, captcha: tok });
    qka.value = ''; qkTag = 'other'; renderQkFlair(); $('#qk-count').textContent = '0 / 1000';
    ok.textContent = T('qk_sent', 'Sent. Thank you for sharing. It will appear on the wall in about') + ' ' + delayText(j) + '.';
    ok.hidden = false;
  } catch (e) { err.textContent = e.message; err.hidden = false; }
  btn.disabled = false;
  qkCap.reset();
});

/* ---------- Report ---------- */
let repTarget = null, repReason = '';
const REP_REASONS = ['Names or identifying details', 'Mentions staff', 'Bullying or hate', 'Sexual content', 'Worried about someone\u2019s safety', 'Spam or selling', 'Something else'];
function renderRepReasons() {
  const list = Array.isArray(PUB.report_reasons) && PUB.report_reasons.length ? PUB.report_reasons : REP_REASONS;
  const sel = $('#rep-sel');
  sel.replaceChildren(h('option', { value: '', text: T('rep_choose', 'Choose a problem...') }), ...list.map((t) => h('option', { value: t, text: t })));
  sel.value = repReason;
}
$('#rep-sel').addEventListener('change', (e) => { repReason = e.target.value; });
function openReport(t) {
  repTarget = t; repReason = '';
  $('#rep-d').value = ''; $('#rep-count').textContent = '0 / 300'; $('#rep-err').hidden = true;
  renderRepReasons(); openD($('#report'));
}
$('#rep-d').addEventListener('input', (e) => { $('#rep-count').textContent = e.target.value.trim().length + ' / 300'; });
$('#rep-send').addEventListener('click', async () => {
  if (!repTarget) return;
  const t = repTarget, err = $('#rep-err'), details = $('#rep-d').value.trim();
  err.hidden = true;
  if (!repReason) { err.textContent = T('err_rep_choose', 'Choose what the problem is.'); err.hidden = false; return; }
  if (details.length < 10) { err.textContent = T('err_rep_describe', 'Describe the problem in at least 10 characters.'); err.hidden = false; return; }
  const btn = $('#rep-send'); btn.disabled = true;
  try {
    await api(t.comment ? '/api/comment/report' : '/api/report', { cid: CID, id: t.id, reason: repReason, details });
    $('#report').close();
    toast(T('toast_reported', 'Reported, thank you'));
    t.onDone && t.onDone();
  } catch (e) { err.textContent = e.message; err.hidden = false; }
  btn.disabled = false;
});

/* ---------- Share image ---------- */
const SHARE_STYLES = {
  paper: { label: 'Paper', bg: '#f4efe3', fg: '#1d1a15', sub: '#6b5f4c', accent: '#a5640b', font: 'Georgia, "Times New Roman", serif' },
  neon: { label: 'Neon', bg: '#0b0b16', fg: '#f6f4ff', sub: '#b7b2d6', accent: '#ff5fd2', font: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  minimal: { label: 'Minimal', bg: '#ffffff', fg: '#111316', sub: '#5b616b', accent: '#111316', font: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
};
let shareP = null, shareStyle = 'paper', shareUrl = '';
function drawShare() {
  const st = SHARE_STYLES[shareStyle], W = 1080, H = 1350, pad = 110;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = st.bg; c.fillRect(0, 0, W, H);
  if (shareStyle === 'neon') {
    c.strokeStyle = st.accent; c.lineWidth = 6; c.shadowColor = st.accent; c.shadowBlur = 40;
    c.strokeRect(50, 50, W - 100, H - 100); c.shadowBlur = 0;
  } else if (shareStyle === 'paper') {
    c.fillStyle = st.accent; c.fillRect(pad, 150, 90, 8);
  } else {
    c.strokeStyle = '#e4e6ea'; c.lineWidth = 2; c.strokeRect(40, 40, W - 80, H - 80);
  }
  c.fillStyle = st.sub; c.font = '600 32px ' + st.font; c.textBaseline = 'top';
  c.fillText(flairName(shareP.tag) + '   ·   confession #' + shareP.id, pad, 190);
  let size = 56;
  const text = shareP.text;
  const wrap = (sz) => {
    c.font = (shareStyle === 'paper' ? '' : '500 ') + sz + 'px ' + st.font;
    const lines = [];
    for (const para of text.split(/\n/)) {
      let line = '';
      for (const w of para.split(/\s+/)) {
        const tryL = line ? line + ' ' + w : w;
        if (c.measureText(tryL).width > W - pad * 2 && line) { lines.push(line); line = w; }
        else line = tryL;
      }
      lines.push(line);
    }
    return lines;
  };
  let lines = wrap(size);
  while (lines.length * size * 1.45 > H - 560 && size > 26) { size -= 3; lines = wrap(size); }
  const maxLines = Math.floor((H - 560) / (size * 1.45));
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '...'; }
  c.fillStyle = st.fg;
  lines.forEach((l, i) => c.fillText(l, pad, 270 + i * size * 1.45));
  c.fillStyle = st.accent; c.font = '700 34px ' + st.font;
  c.fillText('Inert Gas', pad, H - 210);
  c.fillStyle = st.sub; c.font = '500 30px ' + st.font;
  c.fillText("Confessions \u00b7 St. Xavier's College (SXC)", pad, H - 160);
  cv.toBlob((b) => {
    if (shareUrl) URL.revokeObjectURL(shareUrl);
    shareUrl = URL.createObjectURL(b);
    $('#share-img').src = shareUrl;
  }, 'image/png');
}
function renderShareStyles() {
  $('#share-styles').replaceChildren(...Object.entries(SHARE_STYLES).map(([k, v]) => {
    const b = h('button', { class: 'chip', type: 'button', role: 'radio', 'aria-checked': k === shareStyle ? 'true' : 'false', 'aria-pressed': k === shareStyle ? 'true' : 'false', text: v.label });
    b.addEventListener('click', () => { shareStyle = k; renderShareStyles(); drawShare(); });
    return b;
  }));
}
async function shareGate(p) {
  if (DEMO) return true;
  try { await api('/api/share', { cid: CID, id: p.id }); return true; }
  catch (e) { toast(e.message); return false; }
}
async function openShare(p) { if (!(await shareGate(p))) return; shareP = p; renderShareStyles(); drawShare(); openD($('#share')); }
$('#share-dl').addEventListener('click', () => {
  if (!shareUrl) return;
  const a = h('a', { href: shareUrl, download: 'confession-' + shareP.id + '-' + shareStyle + '.png' });
  document.body.append(a); a.click(); a.remove();
});
$('#share-link').addEventListener('click', () => shareP && copy(linkFor(shareP.id)));

/* ---------- Weekly mood image ---------- */
function drawWeekImage() {
  const { totals, total } = weekTotals();
  if (!total) return;
  const st = SHARE_STYLES.paper, W = 1080, H = 1350, pad = 110;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d');
  c.fillStyle = st.bg; c.fillRect(0, 0, W, H);
  c.fillStyle = st.accent; c.fillRect(pad, 150, 90, 8);
  c.textBaseline = 'top';
  c.fillStyle = st.sub; c.font = '600 32px ' + st.font;
  c.fillText('Campus mood  ·  last 7 days', pad, 190);
  c.fillStyle = st.fg; c.font = '600 72px ' + st.font;
  const words = weekLine(totals).split(' '); let line = '', y = 270;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > W - pad * 2 && line) { c.fillText(line, pad, y); y += 90; line = w; } else line = t;
  }
  c.fillText(line, pad, y);
  MOODS.forEach((m, i) => {
    const by = 600 + i * 150, pct = Math.round((totals[m] / total) * 100);
    c.fillStyle = st.fg; c.font = '600 44px ' + st.font; c.fillText(flairName(m), pad, by);
    c.textAlign = 'right'; c.fillStyle = st.sub; c.fillText(pct + '%', W - pad, by); c.textAlign = 'left';
    c.fillStyle = '#e6dcc6'; c.fillRect(pad, by + 64, W - pad * 2, 30);
    c.fillStyle = st.accent; c.fillRect(pad, by + 64, Math.max(6, ((W - pad * 2) * pct) / 100), 30);
  });
  c.fillStyle = st.sub; c.font = '500 30px ' + st.font;
  c.fillText(plural(total, 'check-in') + ' this week', pad, H - 280);
  c.fillStyle = st.accent; c.font = '700 34px ' + st.font;
  c.fillText('Inert Gas', pad, H - 210);
  c.fillStyle = st.sub; c.font = '500 30px ' + st.font;
  c.fillText("Confessions \u00b7 St. Xavier's College (SXC)", pad, H - 160);
  cv.toBlob((b) => {
    const url = URL.createObjectURL(b);
    const a = h('a', { href: url, download: 'campus-mood-week-' + dayKey() + '.png' });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}
$('#week-save').addEventListener('click', drawWeekImage);

/* ---------- Single post (permalink) ---------- */
function openSingle(p) {
  $('#single-b').replaceChildren(card(p, { single: true, openComments: false }));
  openD($('#single'));
}
async function routeHash() {
  const m = /^#post-(\d+)$/.exec(location.hash) || (!DEMO && /^\/p\/(\d+)\/?$/.exec(location.pathname));
  if (!m) return;
  const id = +m[1];
  try { const j = await api('/api/post?id=' + id); openSingle(j.post); }
  catch { toast('That confession is not available.'); }
}
$('#single').addEventListener('close', () => {
  if (!DEMO && /^\/p\/\d+\/?$/.test(location.pathname)) history.replaceState(null, '', '/');
  else if (/^#post-/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
});
window.addEventListener('hashchange', routeHash);

/* ---------- Poll suggestion ---------- */
let sugCap = null;
$('#poll-suggest').addEventListener('click', () => {
  $('#sug-err').hidden = true;
  openD($('#suggest'));
  if (!sugCap) sugCap = captcha($('#sug-cap'));
});
$('#sug-ta').addEventListener('input', (e) => { $('#sug-count').textContent = e.target.value.trim().length + ' / 200'; });
$('#sug-send').addEventListener('click', async () => {
  const err = $('#sug-err'), text = $('#sug-ta').value.trim();
  err.hidden = true;
  if (text.length < 5) { err.textContent = 'Write at least 5 characters.'; err.hidden = false; return; }
  const tok = sugCap.get();
  if (!tok) { err.textContent = T('err_captcha', 'Please complete the captcha first.'); err.hidden = false; return; }
  try {
    await api('/api/poll/request', { cid: CID, text, captcha: tok });
    $('#sug-ta').value = ''; $('#sug-count').textContent = '0 / 200';
    $('#suggest').close(); toast('Thanks, your idea was sent for review');
  } catch (e) { err.textContent = e.message; err.hidden = false; }
  sugCap.reset();
});


/* ---------- Moderator application (optional, switched on by the admin) ---------- */
let apCap = null, apImage = '', apBuilt = false;
function buildApplyForm() {
  const a = PUB.apply || {};
  $('#apply-code-wrap').hidden = !a.code_required;
  $('#ap-dom').textContent = a.domains && a.domains.length ? '(must end in ' + a.domains.map((d) => '@' + d).join(' or ') + ')' : '';
  if (apBuilt) return;
  apBuilt = true;
  $('#ap-qs').replaceChildren(...(a.questions || []).map((q) => h('label', { class: 'fl' }, q.q, h('textarea', { class: 'field', 'data-q': q.id, maxlength: '1000', rows: '3' }), h('span', { class: 'note', text: 'At least ' + q.min + ' characters.' }))));
  $('#ap-consents').replaceChildren(...(a.consents || []).map((c) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', 'data-c': c.id }), h('span', { text: c.t }))));
}
$('#apply-open').addEventListener('click', () => {
  $('#ap-err').hidden = true;
  buildApplyForm();
  openD($('#apply'));
  if (!apCap) apCap = captcha($('#ap-cap'));
});
/* Shrink the ID photo on this device so it uploads fast and fits in the database. */
function shrinkImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      let max = 1400, q = 0.85, out = '';
      for (let i = 0; i < 6; i++) {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length < 880000) break;
        max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.08);
      }
      URL.revokeObjectURL(url);
      out.length < 1180000 ? res(out) : rej(new Error('That photo is too large. Try another.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be read as a photo.')); };
    img.src = url;
  });
}
$('#ap-file').addEventListener('change', async (e) => {
  const f = e.target.files[0], err = $('#ap-err');
  apImage = ''; $('#ap-prev').hidden = true; err.hidden = true;
  if (!f) return;
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { err.textContent = 'Use a JPG, PNG or WebP photo.'; err.hidden = false; e.target.value = ''; return; }
  try { apImage = await shrinkImage(f); $('#ap-prev').src = apImage; $('#ap-prev').hidden = false; }
  catch (x) { err.textContent = x.message; err.hidden = false; e.target.value = ''; }
});
$('#ap-send').addEventListener('click', async () => {
  const err = $('#ap-err'), btn = $('#ap-send'), v = (id) => $(id).value.trim();
  err.hidden = true;
  const fail = (m) => { err.textContent = m; err.hidden = false; };
  const answers = {}; document.querySelectorAll('#ap-qs [data-q]').forEach((t) => { answers[t.dataset.q] = t.value.trim(); });
  const consent = {}; document.querySelectorAll('#ap-consents [data-c]').forEach((c) => { consent[c.dataset.c] = c.checked; });
  if (!v('#ap-name') || !v('#ap-roll') || !v('#ap-program') || !v('#ap-year') || !v('#ap-email') || !v('#ap-phone')) return fail('Please fill in every detail about you.');
  if (!apImage) return fail('Please upload a photo of your college ID.');
  for (const q of (PUB.apply.questions || [])) if ((answers[q.id] || '').length < q.min) return fail('Please answer every question properly.');
  if (!Object.values(consent).length || !Object.values(consent).every(Boolean)) return fail('Please tick all the confirmations.');
  const tok = apCap ? apCap.get() : '';
  if (!tok) return fail('Please complete the captcha first.');
  btn.disabled = true;
  try {
    await api('/api/apply', { cid: CID, captcha: tok, code: v('#ap-code'), name: v('#ap-name'), roll: v('#ap-roll'), program: v('#ap-program'), year: v('#ap-year'), email: v('#ap-email'), phone: v('#ap-phone'), answers, consent, id_image: apImage });
    ['#ap-code', '#ap-name', '#ap-roll', '#ap-program', '#ap-year', '#ap-email', '#ap-phone', '#ap-file'].forEach((i) => { $(i).value = ''; });
    document.querySelectorAll('#ap-qs textarea').forEach((t) => { t.value = ''; });
    document.querySelectorAll('#ap-consents input').forEach((c) => { c.checked = false; });
    apImage = ''; $('#ap-prev').hidden = true;
    $('#apply').close(); toast('Application sent. The admin will contact you.');
  } catch (e) { fail(e.message); }
  btn.disabled = false;
  if (apCap) apCap.reset();
});

/* ---------- Talk to the admin: a live chat ---------- */
/* The private code lives only in this browser. The server keeps a hash of it, never the code.
   While the window is open the browser asks for news every 2 seconds, and your own message shows at once. */
const TK = 'xv_talk', TKSEEN = 'xv_talk_seen';
let talkCap = null, talkTimer = null, talkMsgs = [], talkStatus = 'open', talkBusy = false;
const tkCode = () => store.get(TK, '');
const tkForget = () => { store.del(TK); store.del(TKSEEN); };
const talkDot = (on) => { $('#talk-dot').hidden = !on; $('#n-talk-dot').hidden = !on; };
const hhmm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayLabel = (t) => { const d = new Date(t); return d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }); };
const talkLastId = () => talkMsgs.reduce((a, m) => Math.max(a, m.id || 0), 0);
function renderChat(stick) {
  const box = $('#talk-msgs'), near = box.scrollHeight - box.scrollTop - box.clientHeight < 90;
  const kids = []; let day = '';
  if (!talkMsgs.length) kids.push(h('p', { class: 'chat-empty', text: T('talk_empty', 'Say hello. Only the admin can read what you write here.') }));
  for (const m of talkMsgs) {
    const dl = dayLabel(m.created_at);
    if (dl !== day) { day = dl; kids.push(h('div', { class: 'chat-day', text: dl })); }
    kids.push(h('div', { class: 'cb ' + (m.from_admin ? 'adm' : 'me') + (m.pending ? ' pending' : '') }, h('span', { text: m.body }), h('small', { text: hhmm(m.created_at) + (m.from_admin ? '' : m.pending ? ' ...' : ' \u2713') })));
  }
  box.replaceChildren(...kids);
  if (stick || near) box.scrollTop = box.scrollHeight;
}
function talkLayout() {
  const open = talkStatus === 'open', has = !!tkCode();
  $('#talk-bar').hidden = !open; $('#talk-closed').hidden = open; $('#talk-keep').hidden = !open;
  $('#talk-cap').hidden = has || !open;
  $('#talk-status').textContent = !open ? T('talk_closed', 'The admin closed this conversation. You can start a new message.') : has ? T('talk_status', 'Messages show up here the moment the admin writes back.') : T('talk_status_new', 'Write your first message. No name and no account needed.');
}
function talkApply(j) {
  talkMsgs = j.messages.map((m) => ({ ...m })); talkStatus = j.status;
  store.set(TKSEEN, talkMsgs.filter((m) => m.from_admin).length);
  talkDot(false);
  $('#talk-care').hidden = !j.urgent;
  talkLayout(); renderChat(true);
}
async function talkTick() {
  if (!$('#talk').open || document.hidden || !tkCode() || talkBusy) return;
  talkBusy = true;
  try {
    const j = await api('/api/talk/thread', { code: tkCode(), after: talkLastId() });
    let changed = false;
    for (const m of j.messages) if (!talkMsgs.some((x) => x.id === m.id)) { talkMsgs.push({ ...m }); changed = true; }
    if (j.status !== talkStatus) { talkStatus = j.status; changed = true; }
    if (j.urgent) $('#talk-care').hidden = false;
    if (changed) { store.set(TKSEEN, talkMsgs.filter((m) => m.from_admin).length); talkLayout(); renderChat(false); }
  } catch (e) { if (e.status === 404) { tkForget(); clearInterval(talkTimer); talkNew(); } }
  talkBusy = false;
}
function talkPoll() { clearInterval(talkTimer); talkTimer = setInterval(talkTick, 2000); }
function talkNew() {
  talkMsgs = []; talkStatus = 'open';
  if (!talkCap) talkCap = captcha($('#talk-cap'));
  $('#talk-box').hidden = false; $('#talk-load').hidden = true;
  talkLayout(); renderChat(true);
  setTimeout(() => $('#talk-in').focus(), 40);
}
async function openTalk() {
  $('#talk-err').hidden = true;
  const code = tkCode();
  talkMsgs = []; talkStatus = 'open';
  openD($('#talk'));
  if (!code) { talkNew(); return; }
  $('#talk-box').hidden = true; $('#talk-load').hidden = false; $('#talk-load').style.padding = '16px';
  $('#talk-load').textContent = T('talk_loading', 'Loading your conversation...');
  try {
    const j = await api('/api/talk/thread', { code });
    $('#talk-load').hidden = true; $('#talk-box').hidden = false;
    talkApply(j); talkPoll();
    setTimeout(() => $('#talk-in').focus(), 40);
  } catch (e) {
    if (e.status === 404) { tkForget(); talkNew(); }
    else $('#talk-load').textContent = e.message + ' Close this window and try again.';
  }
}
$('#talk').addEventListener('close', () => clearInterval(talkTimer));
const tin = $('#talk-in');
const tgrow = () => { tin.style.height = 'auto'; tin.style.height = Math.min(120, tin.scrollHeight) + 'px'; };
tin.addEventListener('input', () => { tgrow(); if (CARE_RE.test(tin.value)) $('#talk-care').hidden = false; });
tin.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && matchMedia('(hover:hover)').matches) { e.preventDefault(); talkSendMsg(); }
});
$('#talk-send').addEventListener('click', talkSendMsg);
async function talkSendMsg() {
  const err = $('#talk-err'), text = tin.value.trim(), code = tkCode();
  err.hidden = true;
  if (!text) return;
  let tok = '';
  if (!code) {
    tok = talkCap ? talkCap.get() : '';
    if (!tok) { err.textContent = T('err_captcha', 'Please complete the captcha first.'); err.hidden = false; return; }
  }
  const tmp = { id: 0, from_admin: false, body: text, created_at: Date.now(), pending: true };
  talkMsgs.push(tmp); tin.value = ''; tgrow(); renderChat(true); tin.focus();
  const settle = (msg) => {
    const dupe = msg && talkMsgs.some((x) => x !== tmp && x.id === msg.id);
    if (dupe) talkMsgs.splice(talkMsgs.indexOf(tmp), 1);
    else { tmp.pending = false; if (msg) { tmp.id = msg.id; tmp.created_at = msg.created_at; } }
    renderChat(true);
  };
  try {
    if (!code) {
      const j = await api('/api/talk/start', { cid: CID, text, captcha: tok });
      store.set(TK, j.code); store.set(TKSEEN, 0);
      talkStatus = 'open'; $('#talk-care').hidden = !j.urgent; talkLayout(); settle(j.message); talkPoll();
    } else {
      const j = await api('/api/talk/send', { code, text });
      if (j.urgent) $('#talk-care').hidden = false;
      settle(j.message);
    }
  } catch (e) {
    talkMsgs.splice(talkMsgs.indexOf(tmp), 1); tin.value = text; tgrow(); renderChat(true);
    err.textContent = e.message; err.hidden = false;
    if (e.closed) { talkStatus = 'closed'; talkLayout(); }
    if (e.status === 404) { tkForget(); talkNew(); }
  }
  if (!code && talkCap) talkCap.reset();
}
$('#talk-newthread').addEventListener('click', () => { tkForget(); clearInterval(talkTimer); talkNew(); });
async function checkTalk() {
  if (!tkCode()) return;
  try {
    const j = await api('/api/talk/thread', { code: tkCode(), peek: true });
    talkDot(j.messages.filter((m) => m.from_admin).length > store.get(TKSEEN, 0));
  } catch (e) { if (e.status === 404) tkForget(); }
}
['#b-talk', '#n-talk'].forEach((q) => $(q).addEventListener('click', openTalk));
document.querySelectorAll('[data-privacy]').forEach((b) => b.addEventListener('click', () => openD($('#privacy'))));
$('#aside-privacy').addEventListener('click', () => openD($('#privacy')));
$('#care-talk').addEventListener('click', () => closeThen(comp, openTalk));
$('#rules-talk').addEventListener('click', () => closeThen($('#rules'), openTalk));
$('#rules-help').addEventListener('click', () => closeThen($('#rules'), () => openD($('#helplines'))));
$('#hl-talk').addEventListener('click', () => closeThen($('#helplines'), openTalk));
['#b-helplines', '#aside-helplines', '#talk-helpbtn'].forEach((q) => $(q).addEventListener('click', () => openD($('#helplines'))));
$('#ann-open').addEventListener('click', () => openD($('#announce')));
$('#ann-chip').addEventListener('click', () => openD($('#announce')));
$('#an-ok').addEventListener('click', () => $('#announce').close());
$('#announce').addEventListener('close', annSeen);
setInterval(() => { if (!$('#talk').open && !document.hidden) checkTalk(); }, 15000);

/* ---------- Rules, help, nav ---------- */
const openRules = () => openD($('#rules'));
['#b-rules', '#n-rules', '#aside-rules'].forEach((s) => $(s).addEventListener('click', openRules));
$('#b-help').addEventListener('click', () => openD($('#help')));
function setView(v) {
  document.body.classList.toggle('view-today', v === 'today');
  $('#n-wall').toggleAttribute('aria-current', v !== 'today'); if (v !== 'today') $('#n-wall').setAttribute('aria-current', 'page');
  $('#n-today').toggleAttribute('aria-current', v === 'today'); if (v === 'today') $('#n-today').setAttribute('aria-current', 'page');
  window.scrollTo({ top: 0 });
}
$('#n-wall').addEventListener('click', () => setView('wall'));
$('#n-today').addEventListener('click', () => setView('today'));
$('#home').addEventListener('click', (e) => { e.preventDefault(); setView('wall'); window.scrollTo({ top: 0, behavior: 'smooth' }); });

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (document.querySelector('dialog[open]')) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) return;
  if (e.key === 'c') { e.preventDefault(); openComposer(); }
  else if (e.key === '/') { e.preventDefault(); setView('wall'); $('#q').focus(); }
  else if (e.key === '?') { e.preventDefault(); openD($('#help')); }
  else if (e.key === 'j' || e.key === 'k') {
    const list = [...cards.values()].filter((c) => !c.hidden);
    if (!list.length) return;
    const cur = list.indexOf(document.activeElement.closest && document.activeElement.closest('.card'));
    const n = cur < 0 ? 0 : Math.max(0, Math.min(list.length - 1, cur + (e.key === 'j' ? 1 : -1)));
    list[n].focus({ preventScroll: true });
    list[n].scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
});

/* ---------- Demo backend (only used at /demo) ---------- */
const Demo = (() => {
  const KEY = 'xavier_demo_store_v3';
  const RULES = [[/([+]?\d[\s-]?){8,}/, 'doxxing'], [/https?:\/\/|www\./i, 'link'], [/@\w{2,}/, 'handle'], [/\b(prof|professor|sir|madam|mam|hod|principal|dean|lecturer|teacher)\b/i, 'staff'], [/\b(suicid\w*|kill myself|self.?harm|want to die)\b/i, 'self-harm'], [/\b(fuck\w*|bitch\w*|bastard)\b/i, 'abuse']];
  const SEED = [
    ['funny', 'Walked into the wrong classroom, sat through 20 minutes of a lecture on organic chemistry, and I am a BBA student. Nobody said anything. I took notes.'],
    ['crush', 'To the person who always shares their umbrella at the Maitighar gate when it pours: you probably do not know it, but you made my monsoon.'],
    ['rant', 'Why does the wifi only work when I am standing in exactly one corner of the library, holding my laptop above my head like a trophy?'],
    ['advice', 'First years: start your assignments the day they are given. I know, I know. But trust me, future you at 2 am will be grateful.'],
    ['other', 'I have eaten the same canteen momo order every single day for two years. The didi starts making it the second I walk in. This is my greatest achievement.'],
    ['funny', 'My group project partner and I have been working together for three months and we still have not figured out each other\u2019s actual first names. It is too late to ask.'],
    ['crush', 'There is someone in my section who laughs at every single joke in class, even the bad ones. It is the best sound on campus.'],
    ['rant', 'Internal exams, assignments, presentations and a fest all in the same week should be illegal.'],
    ['advice', 'If you are feeling lost in your course, you are not alone. Half of us are figuring it out as we go. Talk to your seniors, they have been there.'],
    ['other', 'Sometimes I sit on the steps after class just to watch the sunset over the buildings before taking the bus home. Small peace.'],
    ['funny', 'Said "you too" when the canteen uncle said "enjoy your meal." He was not eating. I think about it daily.'],
    ['rant', 'Printing one page should not require a three step quest and a queue that reaches the gate.'],
    ['crush', 'You lent me a pen during the exam and never asked for it back. I still have it. It is my lucky pen now.'],
    ['advice', 'Drink water, sleep before midnight at least twice a week, and call home. That is the whole secret.'],
    ['other', 'I joined a club just for the free snacks and accidentally became the vice president. Send help.'],
    ['funny', 'Spent the whole presentation with my slides on the wrong file. Explained the cafeteria menu PDF with full confidence. Got a B.'],
    ['other', 'Thank you to whoever leaves sticky notes with nice messages on the library desks. You are doing something real.'],
    ['rant', 'The lift is basically a myth at this point. A legend told to first years.'],
    ['advice', 'Your GPA is not your worth. Keep trying, but be kind to yourself.'],
    ['funny', 'Ran to catch the bus, tripped, did a full recovery roll, and the bus driver clapped. Best and worst morning of my life.'],
    ['crush', 'If you are the one who hums old Nepali songs in the corridor before the first period: please never stop.'],
    ['other', 'Third year and I just discovered there is a rooftop. Who has been keeping this secret?'],
    ['wholesome', 'A stranger held the lift for me while I was carrying three bags. Tiny kindness, huge difference to my morning.'],
    ['exams', 'Four exams, two assignments, one fest. Please send snacks and good vibes.'],
    ['canteen', 'The new samosa guy has a secret chutney and I will defend it with my life.'],
    ['shoutout', 'Shoutout to the guard at the main gate who greets every single person by name. You make Mondays survivable.'],
    ['rant', 'Group chats that are silent for a week and then send 300 messages at 1 am the night before submission.'],
    ['advice', 'Make friends outside your department. Some of my favourite people here study things I do not understand at all.'],
  ];
  function seed() {
    const now = Date.now();
    const posts = SEED.map(([tag, text], i) => {
      const id = 100 + i;
      const age = (SEED.length - i) * 37 * 60000 + Math.floor(Math.random() * 600000);
      const r = () => Math.floor(Math.random() * 14);
      return { id, tag, text, status: 'live', reason: null, created_at: now - age - 150000, publish_at: now - age, reactions: { like: r(), laugh: tag === 'funny' ? r() + 8 : r() / 2 | 0, relate: r(), hug: tag === 'advice' || tag === 'crush' ? r() + 3 : r() / 3 | 0 }, comments: [] };
    });
    const held = (id, tag, text, reason, mins) => ({ id, tag, text, status: 'archived', reason, created_at: now - mins * 60000, publish_at: now - mins * 60000, reactions: { like: 0, laugh: 0, relate: 0, hug: 0 }, comments: [] });
    posts.push(
      held(90, 'rant', 'The professor in room 204 gives surprise tests every week and nobody can keep up.', 'staff', 32),
      held(91, 'crush', 'Text me if you are the one in the blue hoodie, my number is 98XXXXXXXX12345.', 'doxxing', 75),
      held(92, 'funny', 'The canteen samosa today was so good I want to write a review at www.samosa-reviews.example.', 'link', 140),
      held(93, 'other', 'Honestly some days it all feels like too much and I do not know who to talk to.', 'self-harm', 210),
    );
    posts[posts.length - 2].comments.push({ id: 1, text: 'The rooftop is everyone\u2019s favourite secret. Welcome to the club.', publish_at: now - 20 * 60000, status: 'live' });
    posts[posts.length - 5].comments.push({ id: 2, text: 'This is the kind of thing that keeps me going. Thank you.', publish_at: now - 90 * 60000, status: 'live' }, { id: 3, text: 'I am going to start doing this too.', publish_at: now - 60 * 60000, status: 'live' });
    posts[4].comments.push({ id: 4, text: 'Legend behaviour honestly.', publish_at: now - 5 * 3600000, status: 'live' });
    posts[7].comments.push({ id: 5, text: 'Whoever planned this week clearly hates us, find them @schedule_admin', publish_at: now - 45 * 60000, created_at: now - 45 * 60000, status: 'archived', reason: 'handle' });
    return {
      nextId: 100 + SEED.length, nextC: 10, posts,
      settings: { mod_apply_on: '1', banner: 'Welcome to the new wall. Be kind, keep it fun, and read the rules before you post.', comments_on: '1', cotd_id: '', delay_min: '2', delay_max: '3', post_cooldown_min: '30', comment_cooldown_min: '2', report_threshold: '1', helplines: JSON.stringify(['1166 National Suicide Prevention Helpline (११६६ आत्महत्या रोकथामको लागि राष्ट्रिय हेल्पलाईन) | 1166 | Free, confidential, open 24/7', 'Khabar Garaun 1145 Helpline | 1145 | Free and confidential, 24/7, by phone and SMS']), mod_path: 'review', weekly_theme: 'Exam season', weekly_prompt: 'The thing that got me through this week was' },
      requests: [
        { id: 1, text: 'Which canteen item deserves a statue?', status: 'pending', reason: 'review', created_at: now - 3 * 3600000 },
        { id: 2, text: 'Morning classes or afternoon classes?', status: 'pending', reason: 'review', created_at: now - 50 * 60000 },
      ],
      nextR: 3,
      mods: [{ id: 1, username: 'sam_review', created_at: now - 6 * 86400000 }],
      threads: [
        { id: 1, code: 'demo-seed-1', status: 'open', urgent: 1, created_at: now - 50 * 60000, last_at: now - 50 * 60000, last_from: 'visitor', ip: '203.0.113.17', msgs: [{ id: 1, from_admin: false, body: 'I have been feeling really low since results came out and I do not know who to tell.', created_at: now - 50 * 60000 }] },
        { id: 2, code: 'demo-seed-2', status: 'open', urgent: 0, created_at: now - 26 * 3600000, last_at: now - 20 * 3600000, last_from: 'admin', ip: '203.0.113.88', msgs: [{ id: 1, from_admin: false, body: 'Can you pin a post asking about a lost jacket near the library?', created_at: now - 26 * 3600000 }, { id: 2, from_admin: true, body: 'Sure, we can add a banner for it today.', created_at: now - 20 * 3600000 }] },
      ], nextT: 3,
      moods: { day: dayKey(), counts: { stressed: 23, tired: 31, hopeful: 18, chaotic: 12 } },
      poll: { id: 1, question: 'Best spot to study before an exam?', options: ['Library', 'Canteen', 'The steps outside', 'At home, obviously'], counts: { 0: 34, 1: 12, 2: 19, 3: 27 } },
    };
  }
  let db = store.get(KEY, null);
  if (!db || !db.posts) { db = seed(); store.set(KEY, db); }
  const save = () => store.set(KEY, db);
  const ruleFor = (t) => (RULES.find(([r]) => r.test(t)) || [])[1] || null;
  const S = () => db.settings || {};
  const helplines = () => { try { return JSON.parse(S().helplines || '[]'); } catch { return []; } };
  const live = (p) => p.status === 'live' && p.publish_at <= Date.now();
  const pub = (p) => ({ id: p.id, text: p.edited_text || p.text, tag: p.tag, publish_at: p.publish_at, reactions: Object.assign({}, p.reactions), comments: p.comments.filter(live).length, score: Object.values(p.reactions).reduce((a, b) => a + b, 0) });
  const wait = (v) => new Promise((r) => setTimeout(() => r(v), 180 + Math.random() * 220));
  const fail = (m, status) => wait().then(() => { throw Object.assign(new Error(m), { status }); });
  db.threads = db.threads || []; db.nextT = db.nextT || 1;
  if (!db.weekPrev) { db.weekPrev = Array.from({ length: 6 }, () => ({ stressed: 4 + Math.floor(Math.random() * 20), tired: 5 + Math.floor(Math.random() * 22), hopeful: 3 + Math.floor(Math.random() * 14), chaotic: 2 + Math.floor(Math.random() * 12) })); save(); }
  if (db.moods.day !== dayKey()) { db.moods = { day: dayKey(), counts: { stressed: 0, tired: 0, hopeful: 0, chaotic: 0 } }; save(); }
  const demoApply = () => S().mod_apply_on === '1' ? { on: true, code_required: !!S().mod_apply_code, domains: String(S().mod_apply_domains || '').split(/[\s,;]+/).filter(Boolean), questions: [['why', 'Why do you want to moderate this wall, and what do you hope to improve?', 40], ['friend', 'A close friend\'s confession is held for review and clearly breaks a rule. What do you do?', 40], ['selfharm', 'A held confession says the writer wants to hurt themselves. What do you do, and what do you not do?', 40], ['disagree', 'You strongly disagree with a held confession, but it breaks no rule. What do you do?', 30], ['identify', 'You think you can tell who wrote a confession. What do you do with that knowledge?', 30], ['pressure', 'A senior, a friend or a staff member asks you to remove or keep a post. How do you respond?', 30], ['experience', 'Any earlier experience with moderating, a club or a community? Write "none" if there is none.', 4], ['time', 'How many hours a week can you really give, and at what times of day?', 5]].map(([id, q, min]) => ({ id, q, min })), consents: [['identity', 'I understand the admin will see my real name, details and college ID, and that this is not anonymous.'], ['truth', 'Everything I entered is true and the ID photo is my own current college ID.'], ['trust', 'I will never share what I see as a moderator, and I understand my access can be removed at any time.']].map(([id, t]) => ({ id, t })) } : { on: false };
  function cotd() {
    const now = Date.now();
    const pick = db.posts.find((p) => p.id === +S().cotd_id && live(p));
    if (pick) return pub(pick);
    const c = db.posts.filter((p) => live(p) && p.publish_at > now - 86400000).map(pub).sort((a, b) => b.score - a.score)[0];
    return c && c.score > 0 ? c : null;
  }
  function handle(path, body) {
    const u = new URL(path, location.origin), q = u.searchParams, p = u.pathname;
    if (p === '/api/public') {
      const days = [], totals = { stressed: 0, tired: 0, hopeful: 0, chaotic: 0 };
      for (let i = 6; i >= 0; i--) {
        const counts = i === 0 ? db.moods.counts : db.weekPrev[6 - i];
        days.push(Object.assign({ day: new Date(Date.now() - i * 86400000).toISOString().slice(0, 10) }, counts));
        for (const m of MOODS) totals[m] += counts[m] || 0;
      }
      return wait({ banner: S().banner || '', comments_on: S().comments_on !== '0', delay_min: +S().delay_min || 2, delay_max: +S().delay_max || 3, helplines: helplines(), cotd: cotd(), moods: db.moods.counts, week_moods: { days, totals }, weekly_theme: S().weekly_theme || '', weekly_prompt: S().weekly_prompt || '', poll: db.poll || null, apply: demoApply() });
    }
    if (p === '/api/visit') return wait({ ok: true });
    if (p === '/api/apply') {
      if (S().mod_apply_on !== '1') return fail('Applications are closed right now.', 403);
      if (body.captcha !== 'demo') return fail('Solve the captcha and try again.');
      if (!String(body.name || '').trim() || !body.id_image) return fail('Fill in every detail and upload your ID photo.');
      db.apps = db.apps || [];
      db.apps.push({ id: db.apps.length + 1, status: 'pending', name: body.name, roll: body.roll, program: body.program, year: body.year, email: body.email, phone: body.phone, answers: Object.entries(body.answers || {}).map(([id, a]) => ({ id, q: id, a })), ip: '203.0.113.' + Math.floor(Math.random() * 250), created_at: Date.now(), has_id: 1, id_image: body.id_image });
      save(); return wait({ ok: true });
    }
    if (p === '/api/talk/start') {
      const text = String(body.text || '').trim();
      if (text.length < 5 || text.length > 1000) return fail('Write between 5 and 1000 characters.');
      if (body.captcha !== 'demo') return fail('Solve the captcha and try again.');
      const code = 'demo' + Math.random().toString(36).slice(2) + Date.now().toString(36), now = Date.now();
      db.threads.push({ id: db.nextT++, code, status: 'open', urgent: CARE_RE.test(text) ? 1 : 0, created_at: now, last_at: now, last_from: 'visitor', ip: '203.0.113.' + Math.floor(Math.random() * 250), msgs: [{ id: 1, from_admin: false, body: text, created_at: now }] });
      save(); return wait({ ok: true, code, urgent: CARE_RE.test(text), helplines: helplines() });
    }
    if (p === '/api/talk/thread' || p === '/api/talk/send') {
      const t = db.threads.find((x) => x.code === body.code);
      if (!t) return fail('Not found.', 404);
      if (p === '/api/talk/thread') return wait({ status: t.status, urgent: !!t.urgent, messages: t.msgs.map((m) => ({ id: m.id, from_admin: !!m.from_admin, body: m.body, created_at: m.created_at })) });
      const text = String(body.text || '').trim();
      if (t.status !== 'open') return fail('This conversation is closed. You can start a new message.', 403);
      if (text.length < 2 || text.length > 1000) return fail('Write between 2 and 1000 characters.');
      t.msgs.push({ id: t.msgs.length + 1, from_admin: false, body: text, created_at: Date.now() });
      t.last_at = Date.now(); t.last_from = 'visitor'; if (CARE_RE.test(text)) t.urgent = 1;
      save(); return wait({ ok: true, urgent: CARE_RE.test(text) });
    }
    if (p === '/api/feed') {
      const sort = q.get('sort') || 'latest', tag = q.get('tag');
      let list = db.posts.filter(live).filter((x) => !tag || x.tag === tag).map(pub);
      const now = Date.now();
      if (sort === 'top') { const rg = q.get('range'), win = rg === 'day' ? 86400000 : rg === 'all' ? 0 : 7 * 86400000; if (win) list = list.filter((x) => x.publish_at > now - win); }
      if (sort === 'latest') list.sort((a, b) => b.publish_at - a.publish_at || b.id - a.id);
      if (sort === 'top') list.sort((a, b) => b.score - a.score || b.publish_at - a.publish_at);
      if (sort === 'trending') list.sort((a, b) => b.score / (1 + (now - b.publish_at) / 3600000) - a.score / (1 + (now - a.publish_at) / 3600000));
      if (sort === 'random') { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } return wait({ items: list.slice(0, 20), next: null }); }
      const SIZE = 10;
      let start = 0;
      if (sort === 'latest' && q.get('before')) { const bt = +q.get('before'), bi = +q.get('before_id'); start = list.findIndex((x) => x.publish_at < bt || (x.publish_at === bt && x.id < bi)); if (start < 0) start = list.length; }
      else start = +q.get('offset') || 0;
      const items = list.slice(start, start + SIZE), last = items[items.length - 1];
      const more = start + SIZE < list.length && last;
      return wait({ items, next: more ? (sort === 'latest' ? { before: last.publish_at, before_id: last.id } : { offset: start + SIZE }) : null });
    }
    if (p === '/api/post') { const x = db.posts.find((y) => y.id === +q.get('id') && live(y)); return x ? wait({ post: pub(x) }) : fail('Not found.'); }
    if (p === '/api/submit') {
      const text = String(body.text || '').trim();
      if (text.length < 5 || text.length > 1000) return fail('Write between 5 and 1000 characters.');
      if (body.captcha !== 'demo') return fail('Solve the captcha and try again.');
      const id = db.nextId++;
      const reason = ruleFor(text);
      db.posts.push({ id, text, tag: TAGS.includes(body.tag) ? body.tag : 'other', status: reason ? 'archived' : 'live', reason, created_at: Date.now(), publish_at: Date.now() + 15000, reactions: { like: 0, laugh: 0, relate: 0, hug: 0 }, comments: [] });
      save(); return wait({ ok: true, delay_min: 2, delay_max: 3 });
    }
    if (p === '/api/reaction') {
      const x = db.posts.find((y) => y.id === +body.id);
      if (x) { x.reactions[body.type] = Math.max(0, (x.reactions[body.type] || 0) + (body.on ? 1 : -1)); save(); }
      return wait({ ok: true, on: !!body.on });
    }
    if (p === '/api/report') { const x = db.posts.find((y) => y.id === +body.id); if (x) { x.status = 'archived'; x.reason = 'reported'; x.reports = (x.reports || 0) + 1; x.report_notes = [body.reason, body.details].filter(Boolean).join(': '); save(); } return wait({ ok: true }); }
    if (p === '/api/comment/report') { for (const x of db.posts) for (const c of x.comments) if (c.id === +body.id) { c.status = 'archived'; c.reason = 'reported'; c.reports = (c.reports || 0) + 1; c.report_notes = [body.reason, body.details].filter(Boolean).join(': '); } save(); return wait({ ok: true }); }
    if (p === '/api/comments') { const x = db.posts.find((y) => y.id === +q.get('post')); return wait(x ? x.comments.filter(live).sort((a, b) => a.publish_at - b.publish_at).map((c) => ({ id: c.id, text: c.text, publish_at: c.publish_at })) : []); }
    if (p === '/api/comment') {
      const text = String(body.text || '').trim(), x = db.posts.find((y) => y.id === +body.post);
      if (text.length < 2 || text.length > 300) return fail('Write between 2 and 300 characters.');
      if (body.captcha !== 'demo') return fail('Solve the captcha and try again.');
      if (!x) return fail('That confession is unavailable.');
      if (S().comments_on === '0') return fail('Comments are turned off right now.');
      const reason = ruleFor(text);
      x.comments.push({ id: db.nextC++, text, created_at: Date.now(), publish_at: Date.now() + 15000, status: reason ? 'archived' : 'live', reason });
      save(); return wait({ ok: true, delay_min: 2, delay_max: 3 });
    }
    if (p === '/api/mood') { if (MOODS.includes(body.mood)) { db.moods.counts[body.mood]++; save(); } return wait({ ok: true, moods: db.moods.counts }); }
    if (p === '/api/poll/vote') { if (!db.poll) return fail('There is no poll right now.'); db.poll.counts[body.option] = (db.poll.counts[body.option] || 0) + 1; save(); return wait({ ok: true, poll: db.poll }); }
    if (p === '/api/poll/request') {
      const text = String(body.text || '').trim();
      if (text.length < 5 || text.length > 200) return fail('Write between 5 and 200 characters.');
      if (body.captcha !== 'demo') return fail('Solve the captcha and try again.');
      db.requests = db.requests || [];
      db.requests.push({ id: db.nextR = (db.nextR || 1) + 1, text, status: 'pending', reason: ruleFor(text) || 'review', created_at: Date.now() });
      save(); return wait({ ok: true });
    }
    return fail('Not found.');
  }
  function reset() { db = seed(); save(); ['xv_reacts', 'xv_mood', 'xv_poll_1'].forEach(store.del); }
  return { handle, reset };
})();
if (DEMO) {
  $('#demo-note').hidden = false;
  $('#demo-reset').addEventListener('click', () => { Demo.reset(); for (const k in reacted) delete reacted[k]; loadPublic(); loadFeed(true); toast('Demo data reset'); });
}

/* ---------- Boot ---------- */
renderFilters();
renderQkFlair();
renderRepReasons();
loadPublic();
loadFeed(true);
routeHash();
checkTalk();
/* Private visitor counter: at most one anonymous ping per UTC day per browser. */
if (!DEMO) {
  const vd = dayKey();
  if (store.get('xv_visit', '') !== vd) api('/api/visit', { cid: CID }).then(() => store.set('xv_visit', vd)).catch(() => {});
}
})();
