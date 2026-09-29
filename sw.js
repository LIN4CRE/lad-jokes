/* ═══════════════════════════════════════════════════════════════════════
   sw.js — offline shell + cache-first app assets + notification actions.
   Registered by lib/notify.js when the context allows service workers.
   In a sandboxed preview iframe the browser may block registration; the app
   degrades to localStorage persistence and keeps working.
   ═══════════════════════════════════════════════════════════════════════ */
const CACHE = 'lad-jokes-v1';
const ASSETS = [
  './', './index.html', './app.js', './app.webmanifest', './icon.svg',
  './styles/app.css',
  './lib/utils.js', './lib/theme.js', './lib/crypto.js', './lib/store.js',
  './lib/accounts.js', './lib/notify.js', './lib/sync.js', './lib/share.js', './lib/router.js',
  './data/seed.js',
  './views/splash.js', './views/feed.js', './views/story.js', './views/polls.js',
  './views/create.js', './views/chat.js', './views/admin.js', './views/account.js', './views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;           // never intercept third parties
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => {
      if (hit) {
        // background revalidate so the shell stays fresh without a flash
        fetch(req).then((res) => res.ok && caches.open(CACHE).then((c) => c.put(req, res.clone()))).catch(() => {});
        return hit;
      }
      return fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));           // app-shell fallback when offline
    })
  );
});

/* ── push + notifications ─────────────────────────────────────────────── */
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch (_) { data = { title: 'Lad Jokes', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Lad Jokes', {
      body: data.body || '',
      tag: data.tag || 'lj',
      icon: './icon.svg',
      badge: './icon.svg',
      data: { url: data.url || './#/feed' },
      actions: [
        { title: 'Open thread', action: 'open' },
        { title: 'Rate it 🔥10', action: 'rate10' },
        { title: 'Dismiss', action: 'close' }
      ]
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  if (e.action === 'close') return;
  const target = (e.notification.data && e.notification.data.url) || './#/feed';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) { c.postMessage({ type: 'lj:notification-click', action: e.action, url: target }); return c.focus(); }
      }
      return self.clients.openWindow(target);
    })
  );
});

/* let the app trigger a notification while open (demo path) */
self.addEventListener('message', (e) => {
  const d = e.data || {};
  if (d.type === 'lj:notify') {
    e.waitUntil(self.registration.showNotification(d.title || 'Lad Jokes', { body: d.body || '', tag: d.tag || 'lj' }));
  }
  if (d.type === 'lj:skip-waiting') self.skipWaiting();
});
