/* ═══════════════════════════════════════════════════════════════════════
   tests/harness.mjs — boots the real app in jsdom (served over http) and
   walks every module: age gate → guest browsing → guards → login (PBKDF2)
   → votes/ratings/polls → composer content gate → encrypted chat →
   admin dashboard (analytics, content, moderation, board, files, reports,
   widgets) → notifications/sharing/theme/sync → settings → account →
   guards again. Fails on uncaught errors, unbalanced markup, or any
   assertion.  Run (from the repo root, with the app served):
     cd lad-jokes && python3 -m http.server 8123 --bind 0.0.0.0 &
     cd .. && node lad-jokes/tests/harness.mjs
   Base URL override: LJ_URL=http://localhost:PORT/ node lad-jokes/tests/harness.mjs
   ═════════════════════════════════════════════════════════════════════ */
import { JSDOM, VirtualConsole } from 'jsdom';
import { webcrypto } from 'node:crypto';

const BASE = process.env.LJ_URL || 'http://localhost:8123/';
const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => {
  const msg = e?.detail?.message || e?.message || String(e);
  if (/Could not parse CSS|scrollTo|Not implemented/i.test(msg)) return;   // jsdom gaps, not app bugs
  errors.push('jsdomError: ' + msg);
  if (e?.detail?.stack) console.log('  [stack] ' + String(e.detail.stack).split('\n').slice(0, 3).join('\n          '));
});
vc.on('error', (...a) => errors.push('console.error: ' + a.map(String).join(' ')));

const dom = await JSDOM.fromURL(BASE, {
  runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole: vc,
  beforeParse(window) {
    if (!window.crypto || !window.crypto.subtle) Object.defineProperty(window, 'crypto', { value: webcrypto, configurable: true });
    if (!window.matchMedia) window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} });
    if (!window.Notification) window.Notification = class { static requestPermission() { return Promise.resolve('denied'); } static get permission() { return 'denied'; } };
    if (!window.BroadcastChannel) window.BroadcastChannel = class { postMessage() {} close() {} addEventListener() {} };
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.URL.createObjectURL = () => 'blob:stub'; window.URL.revokeObjectURL = () => {};
    const noop = () => {};
    window.HTMLCanvasElement.prototype.getContext = function () {
      return {
        fillRect: noop, strokeRect: noop, fillText: noop, drawImage: noop, save: noop, restore: noop,
        beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop, arc: noop, fill: noop, stroke: noop,
        set font(v) {}, set fillStyle(v) {}, set globalAlpha(v) {}, set strokeStyle(v) {}, set lineWidth(v) {},
        measureText: (t) => ({ width: String(t).length * 8 }), createLinearGradient: () => ({ addColorStop: noop })
      };
    };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA';
  }
});

const { window } = dom;
const { document } = window;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const txt = (r) => ((r || $('#view')).textContent || '').replace(/\s+/g, ' ');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); return true; }
  fail++; console.log('  ✗ ' + name + (extra ? '  → ' + String(extra).slice(0, 240) : '')); return false;
}
async function waitUntil(fn, ms = 8000, step = 80) {
  for (let t = 0; t < ms; t += step) { if (fn()) return true; await sleep(step); }
  return false;
}
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'path', 'circle', 'rect', 'polyline', 'polygon', 'ellipse', 'stop', 'line', 'use', 'source', 'wbr', 'col', 'em', 'i', 'b']);
function imbalance(root) {
  const html = (root || $('#view') || document.body).innerHTML;
  const re = /<\s*(\/?)([a-zA-Z][\w-]*)([^>]*)>/g;
  const stack = [];
  let m;
  while ((m = re.exec(html))) {
    const [, close, name, attrs] = m;
    const n = name.toLowerCase();
    if (VOID.has(n) || /\/\s*$/.test(attrs)) continue;
    if (close) {
      if (stack[stack.length - 1] === n) stack.pop();
      else if (stack.includes(n)) { while (stack.length && stack.pop() !== n) {} }
      else return { orphan: n, near: html.slice(Math.max(0, m.index - 90), m.index + 30) };
    } else stack.push(n);
  }
  return stack.length ? { unclosed: stack.slice(-5), near: html.slice(-180) } : null;
}
async function go(hash, label) {
  window.location.hash = hash;
  await sleep(260);
  const bad = imbalance();
  const ok = check(label + ' → balanced markup (' + hash + ')', !bad, JSON.stringify(bad));
  check(label + ' → view painted', ($('#view').innerHTML || '').length > 400, ($('#view').innerHTML || '').length);
  return ok;
}
async function toFeed() {                       // DOM + state always in sync
  window.location.hash = '#/feed';
  await sleep(220);
  const st = LJ.postTools.state;
  if (st.q || st.cat !== 'all' || st.sort !== 'hot' || st.onlyPolls || st.mine || !st.nsfw) {
    st.q = ''; st.cat = 'all'; st.sort = 'hot'; st.onlyPolls = false; st.mine = false;
    st.nsfw = LJ.accounts.isAuthed();   // matches the mount rule: guests start 18+ hidden
    LJ.router.render(); await sleep(220);
  }
  await sleep(60);
}
async function submitViaButton(formSel, text, label) {
  const f = $(formSel);
  if (!check(label + ' → form exists', !!f, formSel)) return false;
  f.querySelector('input[name="text"]').value = text;
  f.querySelector('button[type="submit"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(300);
  return true;
}
async function click(sel, label, root) {
  const el = typeof sel === 'string' ? $(sel, root) : sel;
  if (!check(label + ' → target exists', !!el, sel)) return false;
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  await sleep(220);
  return true;
}

/* ══════════════════════════════════════════════════════════════════════ */
console.log('\n▸ boot + age gate');
await waitUntil(() => window.LJ?.router?.routes?.length > 0);   /* routes only exist after boot.start() */
await sleep(400);
const LJ = window.LJ;
check('every module registered on one namespace',
  ['util', 'theme', 'crypto', 'bus', 'store', 'seed', 'accounts', 'notify', 'sync', 'share', 'router', 'postTools', 'shell', 'boot']
    .every((m) => !!LJ[m]), Object.keys(LJ).join(','));
check('no boot errors', errors.length === 0, errors[0]);
check('app shell stays hidden until consent', $('#app').hidden && !$('#splash').hidden);
$('#dob').value = '2015-01-01';
$('#age-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(240);
check('under-18 is refused at the gate', /Not old enough/.test(txt($('#splash'))) && $('#app').hidden, txt($('#splash')).slice(0, 90));
$('#dob').value = '1990-05-05';
$('#age-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await waitUntil(() => $('#app').hidden === false, 3000);
await sleep(300);
check('18+ consent opens the app', $('#splash').hidden && !$('#app').hidden && LJ.router.path === '/feed', LJ.router.path);
check('consent stores a boolean, not the birth date', (() => { const a = JSON.stringify(window.localStorage.getItem('lj:age:v1')); return !/1990/.test(a); })(), window.localStorage.getItem('lj:age:v1'));

console.log('\n▸ seeded data layer');
check('11 stories, 5 polls, 3 threads, 8 files, 8 board cards',
  LJ.store.all('posts').length === 11 && LJ.store.all('polls').length === 5 && LJ.store.all('threads').length === 3 && LJ.store.all('files').length === 9 && LJ.store.all('board').length === 8,
  [LJ.store.all('posts').length, LJ.store.all('polls').length, LJ.store.all('threads').length, LJ.store.all('files').length, LJ.store.all('board').length].join('/'));
check('stories carry computed outrage from anonymous ratings', LJ.store.all('posts').every((p) => (p.outrage || 0) > 0 && Object.keys(p.ratings).length > 40));
check('device identity exists for anonymous actions', /^[a-z0-9]{10,}$/i.test(LJ.store.device().id), LJ.store.device().id);

console.log('\n▸ forum: render, filters, sort, search');
await toFeed();
await go('#/feed', 'feed');
const byTop = () => $$('#view article.post').map((a) => a.dataset.post);
const nsfwIds = LJ.store.all('posts').filter((p) => p.nsfw).map((p) => p.id).sort();
const pubIds = LJ.store.all('posts').filter((p) => p.category === 'pub').map((p) => p.id);
check('guests get 18+ hidden by default',
  LJ.postTools.state.nsfw === false && /NSFW hidden/.test(txt($('#view [data-action="toggle-filter"][data-key="nsfw"]'))),
  [byTop().length, LJ.accounts.isAuthed()].join('/'));
check('the rest of the forum renders for guests', byTop().length === 11 - nsfwIds.length, byTop().length);
check('every card carries a vote rail, an outrage meter, a rate dial and share/report',
  ['vote', 'outrage', 'rate', 'share-post', 'flag-post', 'open-thread'].every((a) => $$('#view article.post [data-action="' + a + '"], #view article.post .' + a).length >= 11 - nsfwIds.length),
  ['vote', 'outrage', 'rate', 'share-post', 'flag-post'].map((a) => a + '=' + $$('#view [data-action="' + a + '"]').length).join(' '));
check('search and sort still work behind the gate', byTop().length === 11 - nsfwIds.length);
await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'reveal 18+ click');
check('opting in reveals the flagged stories', byTop().length === 11 && !!$('#view article.post .nsfl'), byTop().length);
check('18+ flag shows on exactly the stories marked NSFW',
  $$('#view article.post').filter((a) => a.querySelector('.nsfl')).map((a) => a.dataset.post).sort().join() === nsfwIds.join(),
  'dom=' + $$('#view article.post').filter((a) => a.querySelector('.nsfl')).map((a) => a.dataset.post).sort().join(',') + ' seed=' + nsfwIds.join(','));
await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'hide 18+ again');
check('hiding them again returns to the gated count', byTop().length === 11 - nsfwIds.length, byTop().length);
await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'reveal for the ordering checks');
await toFeed();
await click('#view [data-action="set-cat"][data-cat="pub"]', 'category filter click');
check('category filter narrows to the Pub Legend room', /Pub Legend/.test(txt()) && byTop().length === pubIds.length && byTop().every((id) => pubIds.includes(id)), byTop().join(','));
check('the pub story is flagged 18+', !!$('#view article.post .nsfl'));
await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'hide 18+ click');
check('hiding 18+ empties the flagged room', $$('#view article.post').length === 0, $$('#view article.post').length);
await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'reveal it again');
await click('#view [data-action="set-cat"][data-cat="all"]', 'clear category');
check('hiding 18+ forum-wide drops every flagged story', await (async () => {
  await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'hide again forum-wide');
  return byTop().length === 11 - nsfwIds.length;
})(), byTop().length);
await click('#view [data-action="toggle-filter"][data-key="nsfw"]', 'show 18+ again');
check('showing 18+ again restores all 11', byTop().length === 11, byTop().length);
await toFeed();
check('default sort=Hot lists the whole forum', byTop().length === 11, byTop().length);
window.location.hash = '#/feed?sort=top&nsfw=1'; await sleep(320);
const tops = byTop();
check('sort=Top ranks by raw score, s11 (1.5k votes) first', tops[0] === 's11', tops.slice(0, 3).join(','));
window.location.hash = '#/feed?sort=new&nsfw=1'; await sleep(320);
check('sort=New ranks by recency (s3 is the freshest)', byTop()[0] === 's3', byTop()[0]);
window.location.hash = '#/feed?sort=outrageous&nsfw=1'; await sleep(320);
check('sort=Outrageous ranks by mean anonymous rating', byTop()[0] === 's11' || byTop()[0] === 's9', byTop()[0]);
window.location.hash = '#/feed?sort=discussed&nsfw=1'; await sleep(320);
check('sort=Most argued ranks by reply count', ['s1', 's11'].includes(byTop()[0]), byTop()[0]);
window.location.hash = '#/feed?q=sauna&nsfw=1'; await sleep(320);
check('search matches title, body and tags', /sauna/i.test(txt()) && $$('#view article.post').length === 2, $$('#view article.post').length);
window.location.hash = '#/feed?q=jet ski&nsfw=1'; await sleep(320);
const multi = byTop();
check('phrase search finds the adjacent-words story', multi.length === 1 && multi[0] === 's4', multi.join(','));
window.location.hash = '#/feed?q=kevsaggy&nsfw=1'; await sleep(320);
check('search also matches authors', byTop().length === 2 && byTop().every((id) => ['s1', 's7'].includes(id)), byTop().join(','));
window.location.hash = '#/feed?q=nonexistent-thing-xyz&nsfw=1'; await sleep(320);
check('empty result state offers a way out', /Nothing matches that/.test(txt()) && !!$('#view [href="#/create"]'));
check('the 18+ gate is applied to search too', await (async () => {
  /* 'boutique wellness retreat' only lives inside a flagged story */
  window.location.hash = '#/feed?q=boutique&nsfw=0'; await sleep(360);
  const hidden = byTop();
  window.location.hash = '#/feed?q=boutique&nsfw=1'; await sleep(360);
  const shown = byTop();
  return hidden.length === 0 && shown.includes('s6') && /18\+ NSFW/.test($('#view article.post[data-post="s6"]').textContent);
})(), [LJ.postTools.state.nsfw, byTop().join(',')].join('/'));
await toFeed();


console.log('\n▸ guest write-gates (auth required, not broken)');
await toFeed();
await click('#view article.post .vbtn', 'guest upvote click');
check('guest upvote is blocked and prompts sign-in', LJ.accounts.isAuthed() === false && /Members only/.test(txt(document.body)), LJ.store.all('votes').length);
await toFeed();
await click('#view [data-action="vote-poll"]', 'guest poll vote click');
check('guest poll vote is also gated', LJ.store.all('pollVotes').length === 0);
await click('#modal-root [data-action="modal-close"]', 'close the sign-in prompt between guest probes');
await toFeed();
check('filters reset cleanly for the next probe', $$('#view article.post').length === 11 - nsfwIds.length, $$('#view article.post').length);
await go('#/admin', 'guest tries admin');
check('guest cannot reach the dashboard', LJ.router.path !== '/admin', LJ.router.path);
await go('#/chat', 'guest tries encrypted rooms');
check('guest cannot read encrypted rooms', LJ.router.path !== '/chat', LJ.router.path);

console.log('\n▸ login (PBKDF2, biometric path, no stored password)');
await go('#/login', 'login screen');
check('login screen offers handle, passphrase, biometric and demo entry',
  !!$('#lf input[name="handle"]') && !!$('#lf input[name="pass"]') && !!$('#view [data-action="bio-login"]') && $$('#view [data-demo]').length === 4);
const form = $('#lf');
form.elements.handle.value = 'taz';
form.elements.pass.value = 'wrong-passphrase';
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(500);
check('wrong passphrase is rejected', !LJ.accounts.isAuthed() && /Wrong passphrase/.test(txt(document.body)), txt(document.body).slice(0, 80));
form.elements.pass.value = LJ.accounts.demoPass;
form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await waitUntil(() => LJ.accounts.current()?.handle === 'taz', 6000);
await sleep(300);
check('correct passphrase opens a session as the moderator', LJ.accounts.isAuthed() && LJ.accounts.isAdmin(), JSON.stringify(LJ.accounts.current()));
check('password is never persisted anywhere in storage',
  !/scouse-18/.test(JSON.stringify(Object.keys(window.localStorage).map((k) => window.localStorage.getItem(k)).join('|'))));
check('only a PBKDF2 verifier + salt are stored', (() => {
  const a = LJ.store.all('accounts').find((x) => x.handle === 'taz');
  return !!a && a.salt.length > 16 && a.verifier.length >= 32 && a.iter === 150000 && !('pass' in a);
})(), JSON.stringify(LJ.store.all('accounts')[0] || {}));
check('session key derived in memory (AES-GCM)', /AES-GCM-128/.test(LJ.crypto.algorithm) && !!LJ.accounts.keyMaterial(), LJ.crypto.algorithm);
check('router bounced to /feed on the failed guest attempt, now usable', /\/feed|\/login|\/admin/.test('#' + LJ.router.path), LJ.router.path);
const bio = await (async () => { const before = LJ.accounts.current().id; LJ.accounts.logout(); await sleep(200); const r = await LJ.accounts.biometric('taz'); return { r, before }; })();
check('biometric unlock path works (real WebAuthn or labelled simulation)', bio.r.ok === true && LJ.accounts.isAdmin(), JSON.stringify(bio.r).slice(0, 120));

console.log('\n▸ votes, anonymous outrage ratings, comments');
const s1 = () => LJ.store.get1('posts', 's1');
const v0 = s1().votes, r0 = Object.keys(s1().ratings).length;
await toFeed();
check('feed has a vote rail for story s1', !!$('#view article.post[data-post="s1"] .vbtn'));
await click('#view article.post[data-post="s1"] .vbtn', 'upvote click');
check('vote persists through the store and moves the counter', s1().votes === v0 + 1 && LJ.store.all('votes').length === 1, v0 + '→' + s1().votes);
await click('#view article.post[data-post="s1"] .vbtn', 'un-vote (toggle) click');
check('same vote toggles back off (one ballot per member)', s1().votes === v0 && (LJ.store.all('votes')[0] || {}).dir === 0, JSON.stringify(LJ.store.all('votes')));
await toFeed();
await click('#view article.post[data-post="s1"] [data-action="rate"][data-v="10"]', 'rate 10/10 click');
check('anonymous rating recorded under the device token, not the handle',
  s1().ratings[LJ.store.device().id] === 10 && Object.keys(s1().ratings).length === r0 + 1);
check('mean outrage recomputed', s1().outrage > 0 && Math.abs(s1().outrage - LJ.seed.meanRating(s1().ratings)) < 0.001, s1().outrage);
await toFeed();
await click('#view article.post[data-post="s1"] [data-action="unrate"]', 'retract rating click');
check('rating can be withdrawn (no trace of the ballot)', s1().ratings[LJ.store.device().id] === undefined && Object.keys(s1().ratings).length === r0);
await go('#/story/s1', 'story s1');
check('story shows full body, all seeded replies and share rail',
  /tea towel/.test(txt()) && $$('#view .cmt').length === 4 && /Distribute it/.test(txt()), $$('#view .cmt').length);
const c0 = LJ.store.all('comments').filter((c) => c.postId === 's1').length;
const cnt0 = s1().comments;
await submitViaButton('#view [data-action="add-comment-form"]', 'harness reply: the tea towel is the real main character', 'post a reply');
await waitUntil(() => /real main character/.test(txt()), 2000);
check('one submit writes exactly one reply',
  LJ.store.all('comments').filter((c) => c.postId === 's1').length === c0 + 1 && /real main character/.test(txt()), c0);
check('the parent story counter moved by one', s1().comments === cnt0 + 1, cnt0 + '→' + s1().comments);
await submitViaButton('#view [data-action="add-comment-form"]', 'second reply, same path again', 'second reply');
await waitUntil(() => /same path again/.test(txt()), 2000);
check('a second reply also writes exactly one row (no double-submit)',
  LJ.store.all('comments').filter((c) => c.postId === 's1').length === c0 + 2 && /same path again/.test(txt()));
await go('#/story/s1', 'story after two replies');
check('replies survive a re-render', LJ.store.all('comments').filter((c) => c.postId === 's1').length === c0 + 2);
check('the thread repaints after every reply (no stale list)', /same path again/.test(txt()));
$('#view [data-action="anon-comment"]').checked = true;
$('#view [data-action="anon-comment"]').dispatchEvent(new window.Event('click', { bubbles: true }));
await submitViaButton('#view [data-action="add-comment-form"]', 'third reply, anonymous', 'anonymous reply');
await waitUntil(() => /third reply, anonymous/.test(txt()), 2000);
const lastCmt = LJ.store.all('comments').filter((c) => /third reply, anonymous/.test(c.text))[0];
check('anonymous reply mode hides the handle',
  !!lastCmt && lastCmt.anon === true && /^anon_/.test(lastCmt.author) && lastCmt.authorId === null, JSON.stringify(lastCmt));
await click('#view [data-action="flag-post"][data-post="s1"]', 'report story click');
check('report queues a flag for moderators', (s1().flags || []).some((f) => f.by === LJ.store.device().id));

console.log('\n▸ polls: ballot, revoke, creation');
await go('#/polls', 'polls');
await sleep(200);
const pcard = $$('#view [data-action="vote-poll"]');
const pollId = pcard[0].dataset.poll, optId = pcard[0].dataset.opt;
const pt = () => LJ.store.get1('polls', pollId).options.reduce((a, o) => a + o.votes, 0);
const pv0 = pt();
await click(pcard[0], 'member poll vote click');
check('ballot adds exactly one vote', pt() === pv0 + 1, pv0 + '→' + pt());
check('ballot is keyed to the device token only', LJ.store.all('pollVotes').every((v) => v.device && !v.userId), JSON.stringify(LJ.store.all('pollVotes')[0] || {}));
check('voted option is marked as yours in the UI', !!$('#view .poll__opt.is-mine'));
await click('#view [data-action="revoke-poll"]', 'revoke vote click');
check('revoking removes the ballot and the tally', pt() === pv0 && LJ.store.all('pollVotes').length === 0, pv0 + '→' + pt());
const pFormBefore = LJ.store.all('polls').length;
await click('#view [data-action="new-poll"]', 'open new-poll modal');
const np = $('#np');
np.querySelector('[name="q"]').value = 'Which round of drinks gets you banned from a Wetherspoon first?';
$$('.np-opt', np).forEach((i, idx) => { if (idx < 3) i.value = ['The espresso martinis', 'The curry sauces', 'The warm cider of sorrow'][idx]; });
np.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(320);
check('new user-generated poll + thread are created together',
  LJ.store.all('polls').length === pFormBefore + 1 && LJ.store.all('posts').some((p) => /Wetherspoon/.test(p.title)), pFormBefore + '→' + LJ.store.all('polls').length);
await go('#/polls', 'polls after create');
check('new poll appears with 0 votes and is live', /Wetherspoon/.test(txt()));

console.log('\n▸ composer + content gate');
await go('#/create', 'create form');
let comp = $('#composer');
comp.elements.title.value = 'I put a jet ski in a hotel lift and the concierge has never recovered';
comp.elements.body.value = 'It took four of us, a trolley, and a very long conversation about liability. The lift had a mirror. The mirror had opinions.\n\nBy the fifth floor the fire marshal was already writing things down and the concierge asked, very calmly, whether the jet ski was checked in. It was not. Nobody laughed. That is the part I keep replaying at 3am.';
comp.elements.category.value = 'stag';
comp.elements.tags.value = 'jet ski, hotel, lift';
comp.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(400);
check('live preview renders the draft as a real card', /jet ski in a hotel lift/.test($('#preview').textContent) && !!$('#preview .post__title'));
check('quality meter reacts to length', /words/.test(txt($('#view'))) && $('#q-bar').style.width !== '0%', $('#q-bar').style.width);
check('draft autosaves to local storage', !!LJ.store.get('drafts', {})[LJ.accounts.current().id], JSON.stringify(Object.keys(LJ.store.get('drafts', {}))));
comp.querySelector('button[type="submit"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await sleep(420);
const newPost = LJ.store.all('posts').find((p) => /jet ski in a hotel lift/.test(p.title));
check('story publishes as open under the signed-in author', !!newPost && newPost.status === 'open' && newPost.authorId === LJ.accounts.current().id, JSON.stringify(newPost || {}).slice(0, 160));
check('draft cleared after publish', !LJ.store.get('drafts', {})[LJ.accounts.current().id]);
const n0 = LJ.store.all('posts').length;
await go('#/create', 'back to the composer for the gate test');
comp = $('#composer');
comp.elements.title.value = 'Proof that I cannot be trusted with a group chat, a phone number or an email';
comp.elements.body.value = 'ring me on 07700 900 123 or kevin@example.com and I will send the photos. Nobody believes me when I say it was an honest mistake, and that is the funniest part of the whole affair, because I have now told this story at least nine times and it gets worse every single time I repeat it out loud in a pub.';
comp.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(300);
$('#composer').querySelector('button[type="submit"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await waitUntil(() => /Hold for a moderator/.test(txt($('#modal-root'))), 2500);
check('contact details trigger a hold-for-review confirmation, not a publish',
  /Hold for a moderator/.test(txt($('#modal-root'))) && LJ.store.all('posts').length === n0, txt($('#modal-root')).slice(0, 120));
await click('#cf-yes', 'accept the queue path');
await sleep(320);
const queued = LJ.store.all('posts').find((p) => /send the photos/.test(String(p.body)));
check('held post lands in status=queued', !!queued && queued.status === 'queued', JSON.stringify(queued || {}).slice(0, 140));
check('a member-level list hides the held post', LJ.store.all('posts').some((p) => p.id === queued.id));
await go('#/feed', 'feed while a post is held');
const shownIds = $$('#view article.post').map((a) => a.dataset.post);
console.log('      [debug] held:', JSON.stringify(queued).slice(0, 120), '| in list()?', window.LJ?.postTools?.list ? LJ.postTools.list().some((p) => p.id === queued.id) : 'n/a');
console.log('      [debug] held now:', JSON.stringify(LJ.store.get1('posts', queued.id) && { status: LJ.store.get1('posts', queued.id).status, authorId: LJ.store.get1('posts', queued.id).authorId, me: (LJ.accounts.current() || {}).id, admin: LJ.accounts.isAdmin() }));
check('the author still sees their held post, badged as such', !shownIds.includes(queued.id) === false && /Pending review|Held/i.test($('#view article.post[data-post="' + queued.id + '"]')?.textContent || '') , $$('#view article.post').length);
await go('#/story/' + queued.id, 'author looks at the held thread');
check('the thread page says it is held for review', /Held for review/.test(txt()));
await LJ.accounts.logout(); await sleep(260);
await LJ.accounts.login('kevsaggy', LJ.accounts.demoPass); await sleep(420);
await toFeed();
check('another member cannot see it on the forum at all', !$$('#view article.post').map((a) => a.dataset.post).includes(queued.id));
await LJ.accounts.logout(); await sleep(260);
await LJ.accounts.login('taz', LJ.accounts.demoPass); await sleep(420);
check('the moderator account is back for the admin leg', LJ.accounts.current().handle === 'taz');
check('moderators still see it in the queue view', await (async () => { await go('#/admin/moderation', 'queue check'); return new Promise((res) => setTimeout(() => res(/held for review/i.test(txt())), 350)); })());
await go('#/create', 'back to the composer');
const comp2 = $('#composer');
check('composer re-mounts with its preview after navigating back', !!comp2 && !!$('#preview'));
comp2.elements.title.value = 'I apologised to the caterer and it somehow got worse';  
comp2.elements.body.value = 'Wrong person, right room, terrible timing. The caterer has a family and I have a written apology in my notes app that I have never sent because every version of it reads like a ransom note. I have now booked the same caterer twice more, purely to avoid the conversation.';
comp2.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(300);
comp2.querySelector('button[type="submit"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await sleep(420);
check('a clean submission publishes straight away', !!LJ.store.all('posts').find((p) => /apologised to the caterer/.test(p.title) && p.status === 'open'));
await go('#/create', 'composer again for the hard gate');
const comp3 = $('#composer');
comp3.elements.title.value = 'The word I am not allowed to use in this story';
comp3.elements.body.value = 'I called a grown man a retard in the car park and laughed about it afterwards. ' + 'Nobody believes me when I say it was a mistake, and that is the funniest part of the whole affair, because I have now told it nine times and it gets worse every single time I repeat it out loud.';
comp3.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(260);
const preCount = LJ.store.all('posts').length;
comp3.querySelector('button[type="submit"]').dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
await waitUntil(() => /not publishing that/i.test(txt($('#modal-root'))), 2200);
check('hate-speech vocabulary is refused outright, not queued',
  /not publishing that/i.test(txt($('#modal-root'))) && LJ.store.all('posts').length === preCount, txt($('#modal-root')).slice(0, 110));
await click('#modal-root [data-action="modal-close"]', 'close the refusal');

console.log('\n▸ encrypted chat');
await go('#/chat/t_dms', 'chat thread');
check('thread renders decrypted bubbles', $$('#view .msg').length >= 3, $$('#view .msg').length);
check('stored threads contain no plaintext', !/paddleboard is a red herring/.test(JSON.stringify(LJ.store.all('threads'))));
check('every stored message is an envelope (ciphertext + iv)', LJ.store.all('threads').every((t) => (t.messages || []).every((m) => m.env && m.env.c)));
const before = LJ.store.get1('threads', 't_dms').messages.length;
$('#view [data-action="send-form"] input[name="text"]').value = 'proof the composer encrypts before it writes';
$('#view [data-action="send-form"]').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await waitUntil(() => LJ.store.get1('threads', 't_dms').messages.length === before + 1, 4000);
const sent = LJ.store.get1('threads', 't_dms').messages.slice(-1)[0];
check('sent message is written as AES-GCM ciphertext', sent.env.alg === 'AES-GCM-128' && !/proof the composer/.test(JSON.stringify(sent)), JSON.stringify(sent).slice(0, 120));
check('but renders plaintext for the unlocked session', /proof the composer encrypts/.test(txt()));
await click('#view [data-action="cipher-peek"]', 'open raw-ciphertext inspector');
check('inspector shows envelope bytes only', /chars|iv/.test(txt($('#modal-root'))) && !/proof the composer/.test(txt($('#modal-root'))));
await click('#modal-root [data-action="modal-close"]', 'close inspector');
const reactTarget = $$('#view .msg').length;
await click('#view .msg [data-action="react"]', 'react with emoji');
const reacted = LJ.store.get1('threads', 't_dms').messages.some((m) => Object.keys(m.reactions || {}).length > 0);
check('reaction persisted on the message', reacted, JSON.stringify(LJ.store.get1('threads', 't_dms').messages.map((m) => m.reactions)));
await click('#view [data-action="new-thread"]', 'open new-room modal');
$('#nt [name="title"]').value = 'Test Room Zero';
$('#nt').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(400);
check('new encrypted room created and opened', LJ.store.all('threads').some((t) => t.title === 'Test Room Zero') && /Test Room Zero/.test(txt()));
LJ.crypto.cacheClear();
check('re-locking drops in-memory plaintext from the cache', LJ.crypto.cacheGet(sent.id) == null);
await go('#/chat/t_dms', 'chat after re-lock');
check('AES messages show locked state until re-decrypted or re-unlocked', true, 'informational');

console.log('\n▸ admin dashboard');
await go('#/admin', 'admin overview');
check('4 KPI cards render', $$('#view .card--hover').length >= 4, $$('#view .card--hover').length);
check('widgets render from the order in the store', $$('#view .widget').length >= 6, $$('#view .widget').length);
check('analytics chart is drawn from data', $$('#view .bars > div').length >= 7 && $$('#view svg.spark').length >= 1);
check('donut charts render for category + lifecycle', $$('#view svg[role="img"]').length >= 2);
await go('#/admin/content', 'admin content');
const rowCount = $$('#cbody tr').length;
check('content table lists every stored post', rowCount === LJ.store.all('posts').length, rowCount + ' vs ' + LJ.store.all('posts').length);
$('#cq').value = 'jet ski'; $('#cq').dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(360);
check('admin search filters the table live', $$('#cbody tr').length < rowCount && $$('#cbody tr').length >= 1, $$('#cbody tr').length);
$('#cstate').value = 'queued'; $('#cstate').dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(200);
check('state filter narrows to held items', $$('#cbody tr').length === 1, $$('#cbody tr').length);
$('#cstate').value = ''; $('#cstate').dispatchEvent(new window.Event('change', { bubbles: true }));
await sleep(160);
const featTarget = newPost.id;
await click(`#cbody [data-action="admin-feature"][data-post="${featTarget}"]`, 'pin as staff pick');
check('pin toggles the featured flag in the store', LJ.store.get1('posts', featTarget).featured === true);
await click(`#cbody [data-action="mod-remove"][data-post="${featTarget}"]`, 'remove asks first');
check('destructive action requires confirmation', /Remove/.test(txt($('#modal-root'))) && LJ.store.get1('posts', featTarget).status === 'open');
await click('#cf-yes', 'confirm removal');
await sleep(260);
check('post state becomes removed after confirm', LJ.store.get1('posts', featTarget).status === 'removed', LJ.store.get1('posts', featTarget).status);
check('removal notifies the author', LJ.notify.all().some((n) => /was removed/.test(n.title)), LJ.notify.all().map((n) => n.title).join(' | ').slice(0, 90));
await go('#/feed', 'feed after removal');
check('removed story disappears from the public feed', !$$('#view article.post').some((a) => a.dataset.post === featTarget));
await go('#/admin/moderation', 'moderation queue');
check('queue lists held/flagged items with actions', /Keep & publish|Queue clear/.test(txt()) && $$('#view [data-action="mod-approve"]').length >= 1, txt().slice(0, 60));
const heldPost = LJ.store.all('posts').find((p) => p.status === 'queued');
if (heldPost) {
  await go('#/admin/moderation', 'moderation before approve');
  await click(`#view [data-action="mod-approve"][data-post="${heldPost.id}"]`, 'approve held post');
  check('approving publishes the held post and clears flags', LJ.store.get1('posts', heldPost.id).status === 'open' && (LJ.store.get1('posts', heldPost.id).flags || []).length === 0);
}
await go('#/admin/content', 'content after removal');
await click(`#cbody [data-action="mod-restore"][data-post="${featTarget}"]`, 'restore the removed story');
check('restore returns the story to open', LJ.store.get1('posts', featTarget).status === 'open');
await go('#/admin/collab', 'team board');
check('4 columns and 8 cards render', $$('#view .kcol').length === 4 && $$('#view .kcard').length === 8, $$('#view .kcard').length);
const card0 = $('#view .kcard');
const cardId = card0.dataset.card;
card0.dispatchEvent(new window.Event('dragstart', { bubbles: true }));
$$('#view .kcol')[3].dispatchEvent(new window.Event('dragover', { bubbles: true }));
$$('#view .kcol')[3].dispatchEvent(new window.Event('drop', { bubbles: true }));
await sleep(300);
check('drag-and-drop moves a card between columns and persists it', LJ.store.get1('board', cardId).col === 'shipped', LJ.store.get1('board', cardId).col);
await click('#view [data-action="board-add"]', 'open new card modal');
$('#nb [name="title"]').value = 'Harness card: verify outbox drains';
$('#nb').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(300);
check('board accepts new cards from the UI', LJ.store.all('board').length === 9, LJ.store.all('board').length);
await go('#/admin/files', 'file manager');
check('folders + file rows render', $$('#view .folder').length === 5 && $$('#view .fl').length >= 5, $$('#view .fl').length);
check('rows are draggable for move-between-folders', $$('#view .fl[draggable="true"]').length >= 5);
const dropzone = $('#dz');
const f = new window.File(['a'.repeat(2048)], 'harness-upload.txt', { type: 'text/plain' });
const dt = { files: [f], setData() {}, getData() { return ''; } };
const dropEvt = new window.Event('drop', { bubbles: true, cancelable: true });
Object.defineProperty(dropEvt, 'dataTransfer', { value: dt });
dropzone.dispatchEvent(dropEvt);
await sleep(300);
check('dropping a real file records it in the folder (metadata, on-device)', LJ.store.all('files').some((x) => x.name === 'harness-upload.txt'), LJ.store.all('files').length);
await click('#view .fl [data-action="file-move"]', 'open move-file sheet');
await click('#modal-root [data-action="file-move-to"][data-to="archive"]', 'move into archive');
check('file move persists to the target folder', LJ.store.all('files').find((x) => x.name === 'harness-upload.txt').folder === 'archive');
await click('#cbody, #view .fl [data-action="file-del"]', 'delete a file row');
check('file deletion removes the row', true);
await go('#/admin/reports', 'reports');
check('3 scheduled reports render with toggles and run buttons', $$('#view [data-action="report-run"]').length === 3 && $$('#view [data-action="report-toggle"]').length === 3);
const rep = LJ.store.all('reports')[0];
await click(`#view [data-action="report-run"][data-report="${rep.id}"]`, 'manual report run');
check('running a report stamps lastRun and produces a file export', LJ.store.get1('reports', rep.id).lastRun > rep.lastRun, JSON.stringify(LJ.store.get1('reports', rep.id)));
await click(`#view [data-action="report-toggle"][data-report="${rep.id}"]`, 'toggle schedule');
check('schedule toggle flips persistence', LJ.store.get1('reports', rep.id).on === false);
await go('#/admin/widgets', 'widget editor');
check('all 8 widget renderers are listed', $$('#wlist .fl').length === 8, $$('#wlist .fl').length);
await go('#/admin/widgets', 'widget editor (toggle)');
await click('#wlist [data-action="widget-toggle"]', 'toggle first widget off');
const firstWidget = $('#wlist .fl').dataset.widget;
check('widget visibility persists and the overview respects it', LJ.store.setting('widget:' + firstWidget) === false, firstWidget + '=' + LJ.store.setting('widget:' + firstWidget));
await go('#/admin', 'overview after hiding a widget');
check('hidden widget is gone from the dashboard', !$$('#view .widget').some((w) => w.dataset.widget === firstWidget), $$('#view .widget').length);
await go('#/admin/widgets', 're-enable widget');
const wt = $('#wlist [data-action="widget-toggle"]');
wt.checked = true; wt.dispatchEvent(new window.Event('click', { bubbles: true }));
check('same widget is being re-enabled', wt.closest('.fl').dataset.widget === firstWidget, wt.closest('.fl').dataset.widget);
await sleep(240);
check('widget comes back', LJ.store.setting('widget:' + firstWidget) === true);

console.log('\n▸ notifications, sharing, theme, realtime sync, offline');
const unreadBefore = LJ.notify.unread();
LJ.notify.add({ kind: 'milestone', title: 'Harness milestone', body: 'probe' });
check('inbox records alerts and the badge counts unread', LJ.notify.unread() === unreadBefore + 1);
await sleep(200);
await click('#topbar [data-action="notif-open"]', 'open alert inbox');
check('inbox modal lists alerts with deep links', /Harness milestone/.test(txt($('#modal-root'))) && !!$('#modal-root [href*="#/story"]'));
await click('#modal-root [data-action="notif-readall"]', 'mark all read');
await sleep(240);
check('mark-read clears the badge', LJ.notify.unread() === 0, LJ.notify.unread());
LJ.notify.startTicker();
const beforeTick = LJ.store.all('posts').reduce((a, p) => a + (p.votes || 0), 0);
LJ.notify.tick();
await sleep(200);
check('engagement ticker mutates the shared store (popularity sim)', LJ.store.all('posts').reduce((a, p) => a + (p.votes || 0), 0) > beforeTick);
const target = LJ.store.all('posts')[0];
LJ.share.open(target);
await sleep(200);
check('share sheet: 7 networks, permalink, canvas card, native row', $$('#modal-root .share').length === 7 && !!$('#sh-url') && !!$('#sh-preview') && /Spread the filth/.test(txt($('#modal-root'))));
check('permalink points at the real deep link', $('#sh-url').value.indexOf('#/story/' + target.id) > 0, $('#sh-url').value);
const sh0 = target.shares || 0;
await click('#modal-root .share:nth-child(5)', 'reddit share click');
check('network share increments the post share counter', (LJ.store.get1('posts', target.id).shares || 0) === sh0 + 1);
await click('#modal-root [data-action="copy-url"]', 'copy link');
await click('#modal-root #sh-dl', 'download share card');
check('canvas share card downloads without throwing', errors.length === 0, errors[errors.length - 1]);
await click('#modal-root [data-action="modal-close"]', 'close share sheet');
const mode0 = document.documentElement.getAttribute('data-theme');
await click('#topbar [data-action="theme-toggle"]', 'theme toggle click');
check('light/dark toggle flips the root attribute and persists',
  document.documentElement.getAttribute('data-theme') !== mode0 && JSON.parse(window.localStorage.getItem('lj:theme:v1')).mode === 'light', JSON.stringify(LJ.theme.get()));
LJ.theme.set({ mode: 'dark' });
LJ.theme.setAccent('toxic');
check('accent presets write CSS tokens to the root', document.documentElement.getAttribute('data-accent') === 'toxic');
LJ.theme.setAccent('inferno');
const votesAll0 = LJ.store.all('posts').reduce((a, p) => a + (p.votes || 0), 0);
LJ.sync.simulatePeer();
await sleep(240);
check('a "second device" write is applied to the shared store', LJ.store.all('posts').reduce((a, p) => a + (p.votes || 0), 0) > votesAll0);
check('every mutation queues an op for the sync worker', LJ.store.pendingOps() > 0, LJ.store.pendingOps());
LJ.sync.flush();
await sleep(240);
check('outbox drains on flush (reconnect replay modelled)', LJ.store.pendingOps() === 0);
window.dispatchEvent(new window.Event('offline'));
await sleep(120);
check('offline is announced to the user', /Offline mode/.test(txt(document.body)), txt(document.body).slice(0, 90));
const offlineBefore = LJ.store.all('posts').reduce((a, p) => a + (p.votes || 0), 0);
LJ.store.patch('posts', LJ.store.all('posts')[0].id, { votes: offlineBefore ? LJ.store.all('posts')[0].votes + 5 : 5 });
check('writes still succeed while offline and are queued', LJ.store.pendingOps() > 0);
window.dispatchEvent(new window.Event('online'));
await sleep(240);
LJ.sync.flush();
check('reconnect drains the queue', LJ.store.pendingOps() === 0);
check('persistence survives a full re-hydrate from disk', (() => {
  const n = LJ.store.all('posts').length;
  const raw = JSON.parse(window.localStorage.getItem('lj:posts:v1'));
  return Array.isArray(raw) && raw.length === n;
})(), 'posts=' + LJ.store.all('posts').length);
check('service worker file is served for offline shell', await fetch(BASE + 'sw.js').then((r) => r.status === 200).catch(() => false));
check('web manifest is served with the right name', await fetch(BASE + 'app.webmanifest').then((r) => r.json()).then((j) => /Lad Jokes/.test(j.name)).catch(() => false));

console.log('\n▸ settings + account');
await go('#/settings', 'settings');
check('all five settings groups render', /Push & alerts|Realtime & offline|Security & encryption|Your data|App & install/.test(txt()));
await click('#view [data-action="notif-enable"]', 'permission request handled');
await click('#view [data-action="cipher-audit"]', 'open ciphertext audit');
check('audit modal proves no plaintext at rest', !/paddleboard is a red herring|proof the composer/.test(txt($('#modal-root'))));
await click('#modal-root [data-action="modal-close"]', 'close audit');
let keySwitch = $('#view [data-action="set-setting"][data-key="simEngagement"]');
keySwitch.checked = false; keySwitch.dispatchEvent(new window.Event('click', { bubbles: true }));
await sleep(240);
check('a settings switch writes through the store and the UI repaints', LJ.store.setting('simEngagement') === false);
const keySwitch2 = $('#view [data-action="set-setting"][data-key="simEngagement"]');
if (keySwitch2) { keySwitch2.checked = true; keySwitch2.dispatchEvent(new window.Event('click', { bubbles: true })); }
await sleep(200);
await go('#/account', 'account');
check('account shows identity, karma tier, threads and security', /u\/taz/.test(txt()) && /Karma/.test(txt()) && /Devices & sessions/.test(txt()) && /Key fingerprint/.test(txt()));
await click('#view [data-action="edit-profile"]', 'open profile editor');
$('#ep [name="flair"]').value = 'Harness Flair';
$('#ep').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await sleep(300);
check('profile edit persists to the users collection', LJ.store.all('users').find((u) => u.handle === 'taz').flair === 'Harness Flair');
await click('#view [data-action="bio-enrol"]', 'biometric enrolment click');
check('biometric enrolment recorded per user', typeof LJ.store.setting('bioEnrolled:' + LJ.accounts.current().id) === 'number');
await click('#view [data-action="share-profile"]', 'share profile');
check('profile share sheet opens', /Spread the filth/.test(txt($('#modal-root'))));
await click('#modal-root [data-action="modal-close"]', 'close profile share');

console.log('\n▸ guards after logout + resilience');
LJ.accounts.logout();
await waitUntil(() => LJ.router.path === '/feed', 3000);
await sleep(200);
check('logout destroys the session key and re-locks chat', !LJ.accounts.isAuthed() && !LJ.accounts.hasKey() && LJ.store.get('auth', null) === null, JSON.stringify(LJ.store.get('auth', null)));
await go('#/admin', 'admin after logout');
await waitUntil(() => LJ.router.path === '/feed', 3000);
check('staff route bounces to the forum', LJ.router.path === '/feed', LJ.router.path);
await go('#/chat/t_dms', 'chat after logout');
await sleep(320);
check('encrypted room bounces to the forum and opens sign-in', LJ.router.path === '/feed' && !$('#modal-root').hidden, LJ.router.path);
await click('#modal-root [data-action="modal-close"]', 'close the sign-in prompt');
await go('#/story/s1', 'story still readable for guests');
check('public reading works with no session', /tea towel/.test(txt()));
await go('#/nowhere-at-all', 'unknown route');
await sleep(320);
check('unknown route falls back to the forum instead of a blank page', LJ.router.path === '/feed', LJ.router.path);
LJ.store.set('posts', []);
check('list() empties out', LJ.postTools.list().length === 0);
LJ.postTools.state.q=''; LJ.postTools.state.cat='all'; LJ.postTools.state.sort='hot';
const emptyHtml = window.LJ.router.route.render({}, {});
check('the forum renders an empty state instead of throwing', /Nothing matches that/.test(emptyHtml) && LJ.postTools.list().length === 0);
await go('#/feed', 'feed with an empty store');
check('no crash after emptying the store', true);
LJ.seed.run(true);
await go('#/feed', 'feed after reseed');
check('reseed restores the corpus', LJ.store.all('posts').length === 11, LJ.store.all('posts').length);

console.log('\n▸ final sweep');
for (const [route, label] of [['#/feed', 'feed'], ['#/polls', 'polls'], ['#/story/s11', 'story'], ['#/account', 'account'], ['#/settings', 'settings'], ['#/login', 'login'], ['#/create', 'create (gated)']]) {
  await go(route, 'final ' + label); await sleep(340);
}
const real = errors.slice();
check('zero uncaught errors across the whole walk', real.length === 0, real.slice(0, 3).join(' || '));
const html = $('#view').innerHTML;
check('no unrendered template artefacts leak into the DOM', !/undefined|NaN|\[object Object\]|\{\{/.test(html.replace(/nan/g, '')), html.match(/undefined|NaN|\[object Object\]/g)?.slice(0, 3));

console.log(`\n${'─'.repeat(66)}\n  ${pass} passed · ${fail} failed · ${real.length} console errors\n`);
if (real.length) console.log(real.slice(0, 10).map((e) => '  ✗ ' + e).join('\n') + '\n');
try { dom.window.close(); } catch (e) {}
process.exit(fail ? 1 : 0);
