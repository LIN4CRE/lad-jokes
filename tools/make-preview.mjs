/* tools/make-preview.mjs
   Boots the real app in jsdom, walks a few routes, and snapshots the DOM the
   app actually produced into a single self-contained HTML file (stylesheets and
   scripts inlined) so it can be opened anywhere, no server needed.
   This is a frozen DOM snapshot, not a pixel screenshot.
   usage: node tools/make-preview.mjs [baseUrl]                                    */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8123/';
const OUT = path.join(ROOT, 'preview.html');
const noise = (m) => /scrollTo|Not implemented|Could not parse CSS|css/i.test(m);
const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', (e) => { const m = String(e.detail?.stack || e.message || e); if (!noise(m)) errors.push(m.slice(0, 300)); });
vc.on('error', (...a) => { const m = a.map(String).join(' '); if (!noise(m)) errors.push(m.slice(0, 300)); });

const dom = await JSDOM.fromURL(BASE, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(w) {
    if (!w.crypto?.subtle) Object.defineProperty(w, 'crypto', { value: webcrypto, configurable: true });
    if (!w.matchMedia) w.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    if (!w.Notification) w.Notification = class { static requestPermission() { return Promise.resolve('denied'); } static get permission() { return 'denied'; } };
    w.HTMLCanvasElement.prototype.getContext = () => null;
    w.HTMLCanvasElement.prototype.toDataURL = () => '';
    w.HTMLElement.prototype.scrollIntoView = function () {};
  },
});
const { window } = dom;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s) => window.document.querySelector(s);
const txt = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();

for (let i = 0; i < 200; i++) if (window.LJ?.router?.routes?.length) break; else await sleep(100);

$('#dob').value = '1990-05-05';
$('#age-form').dispatchEvent(new window.Event('submit', { bubbles: true }));
await sleep(900);
await window.LJ.accounts.loginDemo('taz');
await sleep(900);

const shots = [];
async function grab(label, hash, extra) {
  window.location.hash = hash;
  await sleep(700);
  if (extra) { await extra(); await sleep(500); }
  const modal = !$('#modal-root').hidden ? `<div class="modal-root">${$('#modal-root').innerHTML}</div>` : '';
  const body = `<div class="shell">${$('#sidebar').outerHTML.replace(' id="sidebar"', '').replace('<aside ', '<aside ')}
    <div class="workspace"><header class="top">${$('#topbar').innerHTML}</header>
    <main class="view">${$('#view').innerHTML}</main></div></div>${modal}`;
  shots.push({ label, hash, body });
  console.log('  snap', label.padEnd(22), String($('#view')?.innerHTML.length).padStart(7), 'bytes ·', txt($('#view')).slice(0, 60) + '…');
}

await grab('forum', '#/feed');
await grab('story thread', '#/story/s1');
await grab('polls', '#/polls');
await grab('share sheet', '#/feed', async () => {
  window.LJ.share.open(window.LJ.store.get1('posts', 's4'));
  await sleep(900);                                 // let the canvas card finish drawing
});
await grab('encrypted chat', '#/chat/t_dms');
await grab('admin overview', '#/admin/overview');
await grab('moderation queue', '#/admin/moderation');
await grab('account', '#/account');
await grab('settings', '#/settings');
await grab('login', '#/login');

/* light-theme pair for the forum, to prove the toggle */
window.LJ.theme.set('light');
await sleep(400);
await grab('forum (light)', '#/feed');
const htmlLight = dom.window.document.documentElement.getAttribute('data-theme');

let css = fs.readFileSync(path.join(ROOT, 'styles/app.css'), 'utf8');
css = css.replace(/@import[^;]+;/g, '');           // no network fetches in a standalone file
const doc = `<!doctype html>
<html lang="en" data-theme="dark" data-accent="inferno">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Lad Jokes — rendered DOM snapshots</title>
<style>${css}</style>
<style>
  /* preview chrome only, so the snapshots can be browsed in one file */
  body { padding: 0 0 60px; }
  .pv-bar { position: sticky; top: 0; z-index: 50; display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 16px;
            background: var(--surface); border-bottom: 1px solid var(--line); font: 700 12px/1 var(--ff-body); }
  .pv-bar button { font: inherit; padding: 7px 11px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface-2); color: var(--muted); cursor: pointer; }
  .pv-bar button[aria-pressed="true"] { background: var(--accent); color: var(--accent-ink); border-color: transparent; }
  .pv-shot { display: none; }
  .pv-shot.on { display: block; }
  .pv-shot .shell { min-height: auto; }
  .pv-shot .side { position: static; height: auto; }
  .pv-note { max-width: 1180px; margin: 18px auto 0; padding: 0 20px; color: var(--faint); font-size: 12px; }
</style>
</head>
<body>
<div class="pv-bar" role="toolbar" aria-label="Snapshot picker">${shots.map((s, i) => `<button data-i="${i}" aria-pressed="${i === 0}">${s.label}</button>`).join('')}</div>
${shots.map((s, i) => `<section class="pv-shot${i === 0 ? ' on' : ''}" data-i="${i}">${s.body}</section>`).join('\n')}
<p class="pv-note">Frozen DOM captured from the running app (jsdom), restyled with the app's own stylesheet — the navigation, filters and buttons are inert here. Light/dark pair included to show the theme toggle (${htmlLight === 'light' ? 'light theme captured' : 'theme capture fell back'}). Errors during capture: ${errors.length || 'none'}.</p>
<script>
document.querySelector('.pv-bar').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  document.querySelectorAll('.pv-bar button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  document.querySelectorAll('.pv-shot').forEach((x) => x.classList.toggle('on', x.dataset.i === b.dataset.i));
  window.scrollTo(0, 0);
});
</script>
</body>
</html>`;
fs.writeFileSync(OUT, doc);
console.log('\nwrote', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1024).toFixed(0) + 'KB', '·', shots.length, 'snapshots');
if (errors.length) console.log('errors:', errors.slice(0, 4));
window.close();
process.exit(0);
