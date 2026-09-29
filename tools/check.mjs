/* ═══════════════════════════════════════════════════════════════════════
   tools/check.mjs — static repo self-check. Fast, no browser, no network.
   Catches the boring ways a zero-build app rots: a script tag pointing at a
   file that no longer exists, a service worker precaching a typo, an
   unbalanced stylesheet, invalid JSON, a syntax error in a file nobody
   imports. `npm test` covers behaviour; this covers wiring.

   Run: node tools/check.mjs      (exit 1 on any problem)
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = (rel) => fs.existsSync(path.join(ROOT, rel));

let pass = 0;
const fail = [];
const ok = (cond, label, detail) => {
  if (cond) { pass++; } else { fail.push(label + (detail ? '  → ' + detail : '')); }
};
const list = (dir, filter) => fs.readdirSync(path.join(ROOT, dir))
  .filter((f) => !filter || filter(f)).map((f) => path.join(dir, f));

/* ── 1. index.html references ─────────────────────────────────────────── */
const html = read('index.html');
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  .filter((r) => !r.startsWith('data:') && !r.startsWith('#') && !r.startsWith('http'));
for (const r of refs) ok(exists(r), 'index.html references a missing file', r);
ok(refs.some((r) => r === 'app.js'), 'index.html must load app.js last');

/* every JS file in the tree must be loaded by the page (nothing orphaned) */
const jsFiles = ['app.js', 'lib', 'views', 'data']
  .flatMap((p) => fs.statSync(path.join(ROOT, p)).isFile() ? [p] : list(p, (f) => f.endsWith('.js')));
const loaded = new Set([...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]));
for (const f of jsFiles) ok(loaded.has(f), 'JS file is not loaded by index.html', f);
for (const f of loaded) ok(exists(f), 'index.html loads a missing script', f);

/* load order: utils must come before everything, app.js last */
const order = [...html.matchAll(/src="([^"]+\.js)"/g)].map((m) => m[1]);
ok(order[0].endsWith('lib/utils.js'), 'lib/utils.js must be the first script', order[0]);
ok(order[order.length - 1] === 'app.js', 'app.js must be the last script', order[order.length - 1]);

/* ── 2. every script parses ───────────────────────────────────────────── */
/* real parser, real module semantics: `node --check` on each file. Costs ~40ms
   per file and never disagrees with the engine the app actually runs on. */
const JS = [...jsFiles, 'sw.js', 'tests/harness.mjs', 'tools/make-preview.mjs',
            'tools/check.mjs', 'tools/make-package.mjs'].filter(exists);
for (const f of JS) {
  const r = spawnSync(process.execPath, ['--check', path.join(ROOT, f)], { encoding: 'utf8' });
  ok(r.status === 0, 'syntax error in ' + f, (r.stderr || '').split('\n').slice(1, 3).join(' ').trim());
}
ok(JS.length >= jsFiles.length + 4, 'some app files were skipped by the parser', JS.length + '/' + jsFiles.length);

/* ── 3. JSON files ────────────────────────────────────────────────────── */
for (const f of ['app.webmanifest', 'package.json']) {
  try { JSON.parse(read(f)); ok(true, f); } catch (e) { ok(false, 'invalid JSON: ' + f, e.message); }
}
const manifest = JSON.parse(read('app.webmanifest'));
for (const icon of manifest.icons || []) ok(exists(icon.src), 'manifest icon missing', icon.src);
for (const sc of manifest.shortcuts || []) {
  const file = sc.url.split('#')[0].replace(/^\.\//, '');          // "./#/create" → "./"
  ok(file === '' || exists(file), 'manifest shortcut target missing', sc.url);
}

/* ── 4. service worker precache matches the shell ─────────────────────── */
const sw = read('sw.js');
const assetsBlock = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
const precached = [...assetsBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((a) => a !== './');
for (const a of precached) ok(exists(a.replace('./', '')), 'service worker precaches a missing file', a);
for (const f of [...jsFiles, 'styles/app.css', 'index.html', 'app.webmanifest', 'icon.svg']) {
  ok(precached.includes('./' + f), 'shell file is not precached by sw.js', f);
}

/* ── 5. stylesheet sanity ─────────────────────────────────────────────── */
const css = read('styles/app.css');
const open = (css.match(/{/g) || []).length, close = (css.match(/}/g) || []).length;
ok(open === close, 'unbalanced braces in app.css', open + ' open / ' + close + ' close');
const declared = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const usedVars = new Set([...css.matchAll(/var\(\s*(--[a-z0-9]+(?:-[a-z0-9]+)*)/g)].map((m) => m[1]));
const undeclared = [...usedVars].filter((v) => !declared.has(v) && v !== '--w');   // --w is set inline
ok(undeclared.length === 0, 'CSS custom properties used but never declared', undeclared.join(', '));
ok(!/@import\s+url\(https?:/.test(css), 'stylesheet must not fetch remote CSS');
ok(css.includes('@media (prefers-reduced-motion'), 'no reduced-motion block');
ok(/\[data-theme="light"\]/.test(css), 'no light theme ruleset');

/* classes the JS emits must exist in CSS (typo catcher; generous on purpose) */
const cssClasses = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]));
const emitted = new Set();
for (const f of [...jsFiles, 'index.html']) {
  for (const m of read(f).matchAll(/class=\\?["']([^"'<>{]+)\\?["']/g)) {
    for (const c of m[1].split(/\s+/)) if (c && !/[${(]/.test(c)) emitted.add(c);
  }
}
const unstyled = [...emitted].filter((c) => !cssClasses.has(c));
ok(unstyled.length === 0, 'classes emitted with no CSS rule', unstyled.join(', '));

/* ── 6. packaging + repo assets ───────────────────────────────────────── */
for (const f of ['README.md', 'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md', 'CHANGELOG.md',
                 '.gitignore', '.gitattributes', '.editorconfig',
                 'assets/banner.png', 'assets/banner.jpg', 'assets/social-preview.png',
                 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
                 '.github/workflows/ci.yml', '.github/workflows/pages.yml',
                 '.github/ISSUE_TEMPLATE/bug-report.yml', '.github/pull_request_template.md']) {
  ok(exists(f), 'expected repo file is missing', f);
}
const pkg = JSON.parse(read('package.json'));
for (const [name, cmd] of Object.entries(pkg.scripts || {})) {
  const file = (cmd.match(/node (\S+\.mjs)/) || [])[1];
  if (file) ok(exists(file), 'npm script "' + name + '" points at a missing file', file);
}
ok(!!pkg.devDependencies?.jsdom, 'package.json must declare the jsdom dev dependency');
ok(!Object.keys(pkg.dependencies || {}).length, 'the app must ship with zero runtime dependencies');

/* ── 7. no secrets, no stray local state ──────────────────────────────── */
const tracked = [...jsFiles, 'index.html', 'styles/app.css', 'sw.js', 'README.md', 'package.json'];
const secret = /(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}|ghp_[A-Za-z0-9]{20,}|BEGIN (RSA|OPENSSH) PRIVATE KEY/;
for (const f of tracked) ok(!secret.test(read(f)), 'possible credential committed in ' + f, '');

/* ── report ───────────────────────────────────────────────────────────── */
const width = 62;
console.log('─'.repeat(width));
console.log('  lad-jokes static check');
console.log('  ' + pass + ' checks passed · ' + fail.length + ' failed');
if (fail.length) {
  console.log('\n  ✗ ' + fail.join('\n  ✗ '));
  console.log('─'.repeat(width));
  process.exit(1);
}
console.log('─'.repeat(width));
process.exit(0);
