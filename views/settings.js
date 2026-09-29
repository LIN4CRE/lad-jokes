/* ═══════════════════════════════════════════════════════════════════════
   views/settings.js — appearance, alerts, sync, security, data, offline.
   Everything here writes through the store so another tab reacts live.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  function render() {
    var s = LJ.store, th = LJ.theme.get(), n = LJ.notify.state();
    return '<div class="wrap-narrow col" style="gap:14px">' +
      '<div><span class="eyebrow">' + U.icon('cog') + 'Preferences</span><h1 class="display h-lg">Tune the machine</h1></div>' +

      sec('appearance', 'Look', 'sun', 'Dark is the house style at 2am. The light theme is a real theme, not a filter — every token swaps, and it is applied before first paint.',
        '<div class="row" style="gap:14px;align-items:center">' +
        '<span class="switchrow__t" style="flex:1">Dark mode</span>' +
        '<label class="switch"><input type="checkbox" data-action="set-theme-dark"' + (th.mode === 'dark' ? ' checked' : '') + ' aria-label="Dark mode"><b></b></label>' +
        '<span class="tiny faint">' + (th.mode === 'dark' ? 'on' : 'off') + '</span></div>' +
        '<div class="switchrow"><div style="flex:1"><div class="switchrow__t">Follow the system</div>' +
        '<div class="switchrow__d">Uses prefers-color-scheme and re-applies when it flips</div></div>' +
        '<label class="switch"><input type="checkbox" data-action="set-theme-auto"' + (th.auto ? ' checked' : '') + ' aria-label="Follow system"><b></b></label></div>' +
        '<div style="margin-top:10px"><div class="field__label" style="margin-bottom:8px">Accent</div>' +
        '<div class="row" style="gap:8px">' +
        LJ.theme.ACCENTS.map(function (a) {
          return '<button class="btn btn--ghost" data-action="set-accent" data-accent="' + a.id + '" style="' + (th.accent === a.id ? 'border-color:' + a.dot : '') + '">' +
            '<i style="width:12px;height:12px;border-radius:4px;background:' + a.dot + ';display:inline-block"></i>' + a.label +
            '</button>';
        }).join('') + '</div>' +
        '<p class="tiny faint" style="margin-top:7px">Tokens live on the root element, so the choice survives reloads and reaches every component including the generated share cards.</p></div>') +

      sec('alerts', 'Push &amp; alerts', 'bell', 'Browser notifications when granted; in-app toasts and a persistent inbox always work.',
        '<div class="row" style="gap:10px;align-items:center;margin-bottom:6px">' +
        '<span class="pill ' + (n.permission === 'granted' ? 'pill--ok' : n.permission === 'unsupported' ? 'pill--warn' : 'pill--bad') + '">permission: ' + n.permission + '</span>' +
        '<span class="pill">' + (n.serviceWorker ? 'service worker attached' : 'in-app delivery') + '</span>' +
        '<button class="btn btn--primary btn--sm" data-action="notif-enable">' + U.icon('bell') + (n.permission === 'granted' ? 'Re-test push' : 'Allow push') + '</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="notif-open">' + U.icon('inbox') + 'Inbox (' + LJ.notify.unread() + ')' + '</button></div>' +
        switchRow('notifMilestones', 'Popularity milestones', '100 / 500 / 1k / 2.5k upvotes on your stories') +
        switchRow('notifReplies', 'New replies', 'Someone replies to something you wrote') +
        switchRow('notifMessages', 'New messages', 'DMs and room activity, even while you are elsewhere') +
        switchRow('simEngagement', 'Simulated live engagement', 'Drives the popularity alerts in this demo. Turn off for a quiet room.') +
        '<div class="switchrow"><div style="flex:1"><div class="switchrow__t">Sound</div>' +
        '<div class="switchrow__d">No audio in this prototype — silent toasts by design</div></div>' +
        '<span class="pill">off</span></div>') +

      sec('sync', 'Realtime &amp; offline', 'refresh', 'One data layer, one live channel. Two tabs open on this URL is the multi-device demo.',
        syncBlock() +
        '<div class="row" style="margin-top:10px">' +
        '<button class="btn btn--ghost btn--sm" data-action="sync-now">' + U.icon('cloud') + 'Drain outbox</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="sync-peer">' + U.icon('zap') + 'Simulate another device</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="sync-reload">' + U.icon('refresh') + 'Re-render from disk</button></div>' +
        '<label class="check" style="margin-top:10px"><input type="checkbox" data-action="set-setting" data-key="offline"' +
        (s.setting('offline', true) ? ' checked' : '') + '> Keep working offline (queue writes locally, replay on reconnect)</label>') +

      sec('security', 'Security &amp; encryption', 'lock', 'What a browser prototype can honestly claim, and what production would need.',
        '<dl class="dl">' +
        '<dt>Password storage</dt><dd>never — PBKDF2-SHA256, 150k rounds</dd>' +
        '<dt>Chat encryption</dt><dd>' + LJ.crypto.algorithm + '</dd>' +
        '<dt>SubtleCrypto</dt><dd>' + (LJ.crypto.supported ? '<span style="color:var(--ok)">available</span>' : '<span style="color:var(--warn)">fallback path in use</span>') + '</dd>' +
        '<dt>Key scope</dt><dd>this session, this device</dd>' +
        '<dt>Anonymous ratings</dt><dd>device token, no handle attached</dd></dl>' +
        '<div class="row" style="margin-top:10px">' +
        '<button class="btn btn--ghost btn--sm" data-action="cipher-audit">' + U.icon('db') + 'Audit stored ciphertext</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="lock-chats">' + U.icon('lock') + 'Re-lock chat</button>' +
        (LJ.accounts.isAuthed()
          ? '<button class="btn btn--danger btn--sm" data-action="logout">' + U.icon('logout2') + 'Sign out &amp; destroy key</button>'
          : '<button class="btn btn--primary btn--sm" data-action="modal-auth">' + U.icon('key') + 'Sign in</button>') +
        '</div>') +

      sec('data', 'Your data', 'download', 'Export, import, or burn it down. No server holds anything in this build.',
        '<div class="row">' +
        '<button class="btn btn--ghost btn--sm" data-action="export-all">' + U.icon('download') + 'Export everything (JSON)</button>' +
        '<label class="btn btn--ghost btn--sm" style="cursor:pointer">' + U.icon('upload') + 'Import' +
        '<input type="file" accept="application/json" hidden data-action="import-file"></label>' +
        '<button class="btn btn--danger btn--sm" data-action="wipe-demo">' + U.icon('trash') + 'Reset demo data</button>' +
        '<button class="btn btn--danger btn--sm" data-action="wipe-all">' + U.icon('flame') + 'Delete everything</button></div>' +
        '<p class="tiny faint" style="margin-top:8px">Storage in use: ' + storageEstimate() +
        '. Everything sits in this browser profile — clear it and we genuinely cannot remember you.</p>') +

      sec('app', 'App &amp; install', 'zap', 'Responsive from 320px up, offline shell once the service worker is armed.',
        '<div class="row" style="gap:8px">' +
        '<span class="pill">' + (window.innerWidth < 700 ? 'mobile layout' : window.innerWidth < 980 ? 'compact layout' : 'wide layout') + '</span>' +
        '<span class="pill">' + screen.width + '×' + screen.height + '</span>' +
        '<span class="pill">' + (navigator.onLine !== false ? 'online' : 'offline') + '</span>' +
        '<span class="pill">' + (LJ.notify.state().serviceWorker ? 'sw: ready' : 'sw: not in frame') + '</span></div>' +
        '<div class="row" style="margin-top:10px">' +
        '<button class="btn btn--ghost btn--sm" data-action="install-app">' + U.icon('download') + 'Install as app</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="sw-update">' + U.icon('refresh') + 'Update cache</button></div>' +
        '<p class="tiny faint" style="margin-top:8px">Manifest, service worker and the write queue ship with the prototype. Inside a sandboxed preview frame the SW may be blocked — the app degrades to local persistence and keeps working.</p>') +

      '<p class="tiny faint">Lad Jokes prototype · every member, vote and message is fictional · 18+ · modular client app where <span class="mono">lib/store.js</span> is the only module that knows how data persists.</p>' +
      '</div>';
  }

  function sec(id, title, icon, blurb, body) {
    return '<section class="card" id="sec-' + id + '">' +
      '<div class="card__head"><span class="card__title">' + U.icon(icon) + title + '</span></div>' +
      (blurb ? '<p class="tiny muted" style="margin:-4px 0 10px">' + blurb + '</p>' : '') +
      body + '</section>';
  }
  function switchRow(key, title, desc) {
    return '<div class="switchrow"><div style="flex:1">' +
      '<div class="switchrow__t">' + title + '</div>' +
      (desc ? '<div class="switchrow__d">' + desc + '</div>' : '') +
      '</div><label class="switch"><input type="checkbox" data-action="set-setting" data-key="' + key + '"' +
      (LJ.store.setting(key) ? ' checked' : '') + ' aria-label="' + U.escape(title) + '"><b></b></label></div>';
  }
  function syncBlock() {
    var st = LJ.sync.status();
    return '<div class="grid cols-4" style="gap:10px">' +
      box('Live channel', st.channel ? 'connected' : 'idle', st.channel ? 'var(--ok)' : 'var(--warn)') +
      box('Queued writes', String(st.pending), st.pending ? 'var(--warn)' : 'var(--ok)') +
      box('Last sync', U.time(st.lastSync), 'var(--fg)') +
      box('Peers', st.peers.peers.length + ' tab(s)', 'var(--fg)') + '</div>';
  }
  function box(l, v, c) {
    return '<div class="card" style="padding:10px 12px"><div class="stat">' +
      '<span class="stat__d">' + l + '</span>' +
      '<span style="font-weight:800;font-size:15px;color:' + c + '">' + v + '</span></div></div>';
  }
  function storageEstimate() {
    var bytes = 0;
    LJ.store.ready();
    ['posts', 'comments', 'polls', 'threads', 'files', 'board', 'notes', 'users'].forEach(function (n) {
      try { bytes += JSON.stringify(LJ.store.get(n, [])).length; } catch (e) {}
    });
    return U.bytes(bytes);
  }

  /* ── actions ──────────────────────────────────────────────────────── */
  var A = LJ.router.actions;
  A['set-theme-dark'] = function (el) { LJ.theme.set({ auto: false, mode: el.checked ? 'dark' : 'light' }); repaint(); };
  A['set-theme-auto'] = function (el) { LJ.theme.set({ auto: !!el.checked }); repaint(); };
  A['set-accent'] = function (el) { LJ.theme.setAccent(el.dataset.accent); repaint(); U.toast('Accent set', el.dataset.accent, 'ok', 2000); };
  A['set-setting'] = function (el) {
    var v = el.type === 'checkbox' ? !!el.checked : el.value;
    LJ.store.setSetting(el.dataset.key, v);
    U.toast('Saved', el.dataset.key + ' → ' + v, 'ok', 2200);
  };
  A['notif-enable'] = function () { LJ.notify.ask(); };
  A['notif-open'] = function () { LJ.notifModal(); };
  A['sync-now'] = function () { LJ.sync.flush(); repaint(); };
  A['sync-peer'] = function () { LJ.sync.simulatePeer(); repaint(); };
  A['sync-reload'] = function () { LJ.router.render(); U.toast('Re-rendered', 'Read straight from persisted storage.', 'ok', 2400); };

  A['cipher-audit'] = function () {
    var rows = [];
    LJ.store.all('threads').forEach(function (t) {
      (t.messages || []).slice(-2).forEach(function (m) {
        rows.push('<div style="padding:6px 0;border-top:1px solid var(--line)">' +
          '<div class="tiny faint">' + U.escape(t.title) + ' · ' + (m.env.alg || 'xor-demo') + ' · iv ' +
          (m.env.iv ? m.env.iv.slice(0, 10) + '…' : 'n/a') + ' · ' + String(m.env.c || '').length + ' chars stored</div>' +
          '<div class="code">' + U.escape(String(m.env.c || '').slice(0, 72)) + '…</div></div>');
      });
    });
    U.modal({
      title: 'What the storage layer holds', icon: 'db',
      body: '<p class="muted">No plaintext messages anywhere in local storage. Posts, votes and ratings are readable by design because they are public; private banter is not.</p>' +
        (rows.join('') || '<p class="tiny muted">No messages yet.</p>') +
        '<div class="banner banner--info" style="margin-top:10px">' + U.icon('shield') +
        '<div>Production needs: envelope encryption per conversation, KMS-held master key, rotation, and a written recovery policy. Plus rate limits, audit logs, and a real reporting pipeline.</div></div>',
      foot: '<button class="btn btn--primary" data-action="modal-close">Close the audit</button>'
    });
  };
  A['export-all'] = function () {
    U.download('lad-jokes-export.json', JSON.stringify(LJ.store.exportAll(), null, 2), 'application/json');
    U.toast('Exported', 'Every collection as it stands right now.', 'ok');
  };
  A['import-file'] = function (el) {
    if (el.tagName !== 'INPUT') return;
    el.onchange = function () {
      var f = (el.files || [])[0]; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { LJ.store.importAll(JSON.parse(r.result)); U.toast('Imported', 'Local state replaced from file.', 'ok'); LJ.router.render(); }
        catch (e) { U.toast('Bad file', String(e.message).slice(0, 90), 'bad', 5000); }
      };
      r.readAsText(f);
    };
  };
  A['wipe-demo'] = function () {
    U.confirm('Reset the demo?', 'Stories, polls, chat and files go back to the shipped seed. Your account and this device rating tokens stay.', function () {
      LJ.store.wipe(true); LJ.seed.run(true); LJ.router.render();
      U.toast('Reset done', 'Fresh archive, same you.', 'ok');
    }, 'Reset');
  };
  A['wipe-all'] = function () {
    U.confirm('Delete everything?', 'Every collection, including your account and the age check. No undo, and no server to call.', function () {
      LJ.store.wipe(false);
      U.store.del('lj:age:v1'); U.store.del('lj:theme:v1');
      location.hash = '#/splash'; location.reload();
    }, 'Delete it all', 'danger');
  };
  A['install-app'] = function () {
    U.toast('Install', 'Browser menu → "Add to Home screen" / "Install app". The manifest is wired up.', 'info', 5000);
  };
  A['sw-update'] = function () {
    if ('serviceWorker' in navigator && navigator.serviceWorker.getRegistration) {
      navigator.serviceWorker.getRegistration().then(function (r) {
        if (!r) { U.toast('No registration', 'The preview frame blocks service workers. Serve the files over http:// and the shell caches itself.', 'warn', 5200); return; }
        return r.update().then(function () { U.toast('Cache updated', 'Shell re-cached for offline use.', 'ok'); });
      }).catch(function () { U.toast('Unavailable', 'This context has no service workers.', 'warn'); });
    } else U.toast('Unavailable', 'This context has no service workers.', 'warn');
  };

  function repaint() {
    if (LJ.router.path !== '/settings') return;
    var host = U.$('#view'); if (!host) return;
    host.innerHTML = render();
    wire();
  }
  function wire() { U.$$('[data-action="import-file"]').forEach(function (el) { A['import-file'](el); }); }

  LJ.settingsView = {
    register: function () {
      LJ.router.add({
        path: '/settings', title: 'Settings', render: render, enter: function () { wire(); }
      });
    }
  };
})();
