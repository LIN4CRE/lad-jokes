/* ═══════════════════════════════════════════════════════════════════════
   tools/make-package.mjs — build the shippable file set.

   The prototype has no bundler and no compile step, which is a feature, so
   "building" here means: copy exactly the files the app loads, plus the
   manifest/assets it references, into dist/ and tar them up for a release
   attachment or an internal server drop. Run: npm run package
   ═══════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

/* the file set is derived from index.html + sw.js, never hand-maintained */
const refs = new Set([...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1])
  .filter((r) => !r.startsWith('data:') && !r.startsWith('#') && !r.startsWith('http')));
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const block = sw.slice(sw.indexOf('const ASSETS'), sw.indexOf('];', sw.indexOf('const ASSETS')));
for (const a of [...block.matchAll(/'([^']+)'/g)].map((m) => m[1])) {
  if (a !== './') refs.add(a.replace(/^\.\//, ''));
}
/* the repo keeps banner.png (1.4MB, for the social preview) — the runtime bundle only
   needs the JPEG the README embeds and the PWA icons */
for (const extra of ['app.webmanifest', 'icon.svg', 'README.md', 'LICENSE',
                     'assets/banner.jpg',
                     'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png']) {
  refs.add(extra);
}

const files = [...refs].filter((f) => fs.existsSync(path.join(ROOT, f))).sort();
const missing = [...refs].filter((f) => !fs.existsSync(path.join(ROOT, f)));

fs.rmSync(OUT, { recursive: true, force: true });
for (const f of files) {
  fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
  fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}
fs.writeFileSync(path.join(OUT, 'BUILD.txt'), [
  'Lad Jokes — prototype build',
  'generated: ' + new Date().toISOString(),
  'files:     ' + files.length,
  'serve:     any static host; must be http(s) or localhost for WebCrypto + service worker',
  '', ...files, '',
].join('\n'));

const version = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const tgz = path.join(ROOT, `lad-jokes-v${version}.tar.gz`);
fs.rmSync(tgz, { force: true });
spawnSync('tar', ['-czf', path.basename(tgz), '-C', OUT, '.'], { cwd: ROOT, stdio: 'inherit' });

const bytes = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
console.log('dist/  ' + files.length + ' files · ' + (bytes / 1024).toFixed(0) + 'KB');
console.log(tgz.replace(ROOT + '/', '') + '  ' + (fs.statSync(tgz).size / 1024).toFixed(0) + 'KB');
if (missing.length) { console.error('\nreferenced but missing: ' + missing.join(', ')); process.exit(1); }
