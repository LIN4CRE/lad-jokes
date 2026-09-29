/* ═══════════════════════════════════════════════════════════════════════
   app.js — composition root. Owns the chrome (sidebar, topbar, tabbar),
   registers every view with the router, boots the services, and exposes the
   one place where the module graph is wired together.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  var NAV_MAIN = [
    { path: '/feed', label: 'Forum', icon: 'home' },
    { path: '/polls', label: 'Polls', icon: 'poll' },
    { path: '/chat', label: 'Rooms', icon: 'chat', auth: true },
    { path: '/account', label: 'Account', icon: 'user' }
  ];
  var TABS = [
    { path: '/feed', label: 'Forum', icon: 'home' },
    { path: '/polls', label: 'Polls', icon: 'poll' },
    { path: '/create', label: 'Post', icon: 'plus', auth: true },
    { path: '/chat', label: 'Rooms', icon: 'chat', auth: true },
    { path: '/account', label: 'You', icon: 'user' }
  ];

  /* ══════════ chrome ══════════ */
  var shell = {
    render: function () { LJ.shell.paintSidebar(); LJ.shell.paintTop(); LJ.shell.paintTabs(); },
    syncActive: function () {
      var p = LJ.router.path;
      U.$$('#sidebar [data-nav], #tabbar [data-nav]').forEach(function (a) {
        a.classList.toggle('is-active', p === a.dataset.nav || (a.dataset.nav !== '/' && p.indexOf(a.dataset.nav) === 0));
      });
    },

    paintSidebar: function () {
      var host = U.$('#sidebar'); if (!host) return;
      var s = LJ.store, u = LJ.accounts.current();
      var counts = {};
      s.all('posts').forEach(function (p) { if (p.status !== 'removed') counts[p.category] = (counts[p.category] || 0) + 1; });
      var unread = LJ.notify.unread();
      var mods = s.all('posts').filter(function (p) { return (p.flags || []).length || p.status === 'queued'; }).length;

      host.innerHTML =
        '<a class="brand" href="#/feed" data-nav="/feed">' +
        '<span class="brand__mark">' + U.icon('flame', { fill: true }) + '' + '</span>' +
        '<span class="brand__word hide-sm">Lad<em>Jokes</em>' + '</span></a>' +
        '<a class="btn btn--primary btn--block" href="#/create" data-nav="/create">' + U.icon('plus') + '<span class="hide-sm">Tell the story' + '</span></a>' +
        '<nav class="nav">' + NAV_MAIN.map(function (n) {
          return '<a class="nav__a" href="#' + n.path + '" data-nav="' + n.path + '">' + U.icon(n.icon) +
            '<span class="lbl">' + n.label + '' + '</span>' +
            (n.path === '/account' && unread ? '<span class="nav__badge">' + unread + '</span>' : '') + '' + '</a>';
        }).join('') +
        (LJ.accounts.isAdmin() ? '<a class="nav__a" href="#/admin" data-nav="/admin">' + U.icon('shield') +
          '<span class="lbl">Back room' + '</span>' + (mods ? '<span class="nav__badge">' + mods + '</span>' : '') + '</a>' : '') +
        '<a class="nav__a" href="#/settings" data-nav="/settings">' + U.icon('cog') + '<span class="lbl">Settings' + '</span></a>' +
        '</nav>' +
        '<div class="nav nav__sec"><div class="eyebrow hide-sm" style="padding:0 12px 2px">Rooms' + '</div>' +
        LJ.seed.CATS.slice(0, 6).map(function (c) {
          return '<a class="nav__a" href="#/feed?cat=' + c.id + '" title="' + U.escape(c.blurb) + '">' + U.icon(c.icon) +
            '<span class="lbl">' + U.escape(c.label) + '' + '</span>' + (counts[c.id] ? '<span class="nav__count">' + counts[c.id] + '</span>' : '') + '' + '</a>';
        }).join('') + '' + '</div>' +
        '<div class="side__foot">' +
        (u ? '<div class="me">' + U.avatar(u.handle) + '<div class="hide-sm" style="min-width:0"><div class="me__name">u/' + U.escape(u.handle) + '' + '</div>' +
          '<div class="me__meta">' + U.escape(u.flair || 'member') + '</div></div></div>'
          : '<a class="btn btn--ghost btn--block" href="#/login">' + U.icon('lock') + '<span class="hide-sm">Sign in</span></a>') +
        '<div class="row" style="gap:6px">' +
        '<button class="btn btn--ghost btn--icon" data-action="theme-toggle" title="Toggle dark / light" aria-label="Toggle dark mode">' + U.icon(LJ.theme.isDark() ? 'sun' : 'moon') + '' + '</button>' +
        '<button class="btn btn--ghost btn--icon" data-action="notif-open" title="Alerts" aria-label="Alerts">' + U.icon('bell') + '' + '</button>' +
        '<button class="btn btn--ghost btn--icon" data-action="sync-now" title="Sync now" aria-label="Sync now">' + U.icon(LJ.sync.status().online ? 'refresh' : 'wifi-off') + '' + '</button>' +
        '' + '</div></div>';
      this.syncActive();
    },

    paintTop: function () {
      var host = U.$('#topbar'); if (!host) return;
      var s = LJ.store, u = LJ.accounts.current();
      var st = LJ.sync.status();
      var unread = LJ.notify.unread();
      var routeTitle = (LJ.router.route || {}).title || '';
      host.innerHTML =
        '<div class="top__title"><span class="eyebrow">' + U.escape(routeTitle) + '' + '</span>' +
        '<b style="font-size:13px;font-weight:700">' + U.fmt(s.all('posts').filter(function (p) { return p.status !== 'removed'; }).length) +
        ' stories · ' + U.fmt(s.all('posts').reduce(function (a, p) { return a + (p.comments || 0); }, 0)) + ' replies · ' +
        '<span style="color:var(--ok)">live' + '</span></b></div>' +
        '<div class="spacer">' + '</div>' +
        '<div class="search" style="max-width:340px;flex:1 1 200px"><span class="search__ic">' + U.icon('search') + '' + '</span>' +
        '<input class="input" id="top-q" placeholder="Search the archive   /" autocomplete="off" value="' + U.escape(LJ.postTools.state.q || '') + '">' + '</div>' +
        '<button class="btn btn--ghost btn--icon" data-action="filter-sheet" title="Filters" aria-label="Filters">' + U.icon('filter') + '' + '</button>' +
        '<button class="btn btn--ghost btn--icon" data-action="theme-toggle" title="Dark / light" aria-label="Toggle dark mode">' + U.icon(LJ.theme.isDark() ? 'sun' : 'moon') + '' + '</button>' +
        '<button class="btn btn--ghost btn--icon" data-action="notif-open" title="Alerts" aria-label="' + unread + ' unread alerts" style="position:relative">' + U.icon('bell') +
        (unread ? '<span style="position:absolute;top:-4px;right:-4px;min-width:17px;height:17px;border-radius:9px;background:var(--accent);color:var(--accent-ink);font:800 10px/17px var(--ff-body);text-align:center">' + unread + '</span>' : '') + '' + '</button>' +
        (st.online ? '' : '<span class="pill pill--warn">' + U.icon('wifi-off') + 'offline</span>') +
        (u ? '<a class="avatar" href="#/account" style="text-decoration:none">' + U.avatar(u.handle).replace('class="avatar "', '') + '</a>'
          : '<a class="btn btn--primary btn--sm" href="#/login">' + U.icon('key') + 'Sign in</a>');
      var q = U.$('#top-q');
      if (q) q.oninput = U.debounce(function () {
        LJ.postTools.state.q = q.value;
        if (LJ.router.path === '/feed') LJ.postTools.paint(); else LJ.router.go('/feed', { q: q.value });
      }, 220);
    },

    paintTabs: function () {
      var host = U.$('#tabbar'); if (!host) return;
      var unread = LJ.notify.unread();
      host.innerHTML = TABS.map(function (n) {
        return '<a class="tabbar__a" href="#' + n.path + '" data-nav="' + n.path + '">' + U.icon(n.icon) +
          '<span>' + n.label + (n.path === '/account' && unread ? ' (' + unread + ')' : '') + '' + '</span></a>';
      }).join('');
      this.syncActive();
    }
  };
  LJ.shell = shell;

  /* ══════════ alert inbox ══════════ */
  LJ.notifModal = function () {
    var items = LJ.notify.all();
    U.modal({
      title: 'Alerts', icon: 'bell',
      body: (items.length ? items.map(function (n) {
        return '<div class="row" style="gap:9px;padding:9px 0;border-top:1px solid var(--line);' + (n.read ? 'opacity:.55' : '') + '">' +
          U.icon(n.kind === 'message' ? 'chat' : n.kind === 'milestone' ? 'up' : n.kind === 'outrage' ? 'flame' : n.kind === 'moderation' ? 'shield' : 'zap') +
          '<div style="flex:1;min-width:0"><div style="font-weight:750;font-size:13.5px">' + U.escape(n.title) + '' + '</div>' +
          '<div class="tiny muted">' + U.escape(n.body || '') + '' + '</div></div>' +
          '<div class="row row--tight"><span class="tiny faint">' + U.ago(n.at) + '' + '</span>' +
          (n.postId ? '<a class="btn btn--ghost btn--sm" href="#/story/' + n.postId + '" data-action="modal-close">open</a>' : '') +
          (n.threadId ? '<a class="btn btn--ghost btn--sm" href="#/chat/' + n.threadId + '" data-action="modal-close">room</a>' : '') + '' + '</div></div>';
      }).join('') : '<p class="muted">Nothing yet. Post something regrettable and come back in ten minutes.</p>'),
      foot: '<span class="tiny muted">' + LJ.notify.unread() + ' unread · permission: ' + LJ.notify.state().permission + '' + '</span>' +
        '<div class="spacer"></div><button class="btn btn--ghost btn--sm" data-action="notif-clear">Clear all' + '</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="notif-readall">Mark read' + '</button>' +
        '<button class="btn btn--primary btn--sm" data-action="notif-enable">' + U.icon('bell') + 'Enable push</button>'
    });
    LJ.notify.markRead();
    setTimeout(function () { shell.paintTop(); shell.paintSidebar(); }, 60);
  };

  /* ══════════ filter sheet (mobile-friendly search + sort) ══════════ */
  LJ.filterSheet = function () {
    var st = LJ.postTools.state;
    var body = '<div class="field" style="margin-bottom:12px"><span class="field__label">Sort posts by engagement' + '</span>' +
      '<div class="chips">' + LJ.postTools.SORTS.map(function (o) {
        return '<button class="chip' + (st.sort === o.id ? ' is-on' : '') + '" data-action="sheet-sort" data-sort="' + o.id + '">' + o.label + '' + '</button>';
      }).join('') + '' + '</div></div>' +
      '<div class="field" style="margin-bottom:12px"><span class="field__label">Room</span><div class="chips">' +
      [{ id: 'all', label: 'Everything' }].concat(LJ.seed.CATS).map(function (c) {
        return '<button class="chip' + (st.cat === c.id ? ' is-on' : '') + '" data-action="sheet-cat" data-cat="' + c.id + '">' + U.escape(c.label) + '' + '</button>';
      }).join('') + '' + '</div></div>' +
      '<label class="check" style="margin-bottom:8px"><input type="checkbox" data-action="sheet-flag" data-key="onlyPolls"' + (st.onlyPolls ? ' checked' : '') + '> Polls only</label>' +
      '<label class="check" style="margin-bottom:8px"><input type="checkbox" data-action="sheet-flag" data-key="mine"' + (st.mine ? ' checked' : '') + '> My posts only</label>' +
      '<label class="check"><input type="checkbox" data-action="sheet-flag" data-key="nsfw"' + (st.nsfw ? ' checked' : '') + '> Show 18+ / NSFW stories' + '</label>';
    U.modal({ title: 'Filter & sort', icon: 'filter', body: body, foot: '<span class="tiny muted">' + LJ.postTools.list().length + ' rooms match right now</span>' });
  };

  /* ══════════ global actions ══════════ */
  var A = LJ.router.actions;
  A['age-decline'] = function () { LJ.splash.declined(); };
  A['theme-toggle'] = function () { LJ.theme.toggle(); shell.paintSidebar(); shell.paintTop(); };
  A['modal-close'] = function () { U.closeModal(); };
  A['notif-open'] = function () { LJ.notifModal(); };
  A['notif-enable'] = function () { LJ.notify.ask(); };
  A['notif-clear'] = function () { LJ.notify.clear(); U.closeModal(); shell.paintTop(); };
  A['notif-readall'] = function () { LJ.notify.markRead(); U.closeModal(); shell.paintTop(); };
  A['filter-sheet'] = function () { LJ.filterSheet(); };
  A['sync-now'] = function () { LJ.sync.flush(); };
  A['sync-peer'] = function () { LJ.sync.simulatePeer(); };
  A['sheet-sort'] = function (el) { LJ.postTools.state.sort = el.dataset.sort; U.closeModal(); LJ.router.render(); };
  A['sheet-cat'] = function (el) { LJ.postTools.state.cat = el.dataset.cat; U.closeModal(); LJ.router.render(); };
  A['sheet-flag'] = function (el) { LJ.postTools.state[el.dataset.key] = !!el.checked; U.closeModal(); LJ.router.render(); };
  A['share-current'] = function () {
    var list = LJ.postTools.list().slice(0, 1);
    if (list[0]) LJ.share.open(list[0]);
  };

  /* ══════════ boot ══════════ */
  LJ.boot = {
    unGate: function () {
      U.store.set('lj:age:v1', { ok: true, at: U.now() });
      /* if boot has not finished wiring the router yet, this call is enough —
         render() runs the moment router.start() fires */
      LJ.router.render();
      if (LJ.router.path === '/splash') LJ.router.go('/feed');
      U.toast('Welcome in', 'Adults only, no mercy. Start with the polling station.', 'ok', 4200);
    },
    start: function () {
      LJ.store.ready();
      LJ.accounts.init().then(function () {
        [LJ.splash, LJ.feedView, LJ.storyView, LJ.pollsView, LJ.createView, LJ.chatView, LJ.adminView, LJ.accountView, LJ.settingsView]
          .forEach(function (v) { v && v.register && v.register(); });

        LJ.notify.registerSW();
        LJ.notify.startTicker();
        LJ.sync.start();
        LJ.router.start();

        /* keep chrome honest */
        ['store:change', 'auth:login', 'auth:logout', 'route:after', 'notify:read', 'notify:new', 'theme:change', 'sync:beat'].forEach(function (evt) {
          LJ.bus.on(evt, function () { shell.render(); });
        });
        /* first paint of chrome before router sets active state */
        shell.render();

        /* keyboard: / search, t theme, g f feed */
        document.addEventListener('keydown', function (e) {
          var typing = /INPUT|TEXTAREA|SELECT/.test((e.target && e.target.tagName) || '');
          if (e.key === '/' && !typing) { e.preventDefault(); var q = U.$('#top-q') || U.$('#q'); if (q) q.focus(); }
          if ((e.key === 't' || e.key === 'T') && !typing && !e.metaKey && !e.ctrlKey) { LJ.theme.toggle(); shell.render(); }
          if (e.key === 'Escape' && typing) e.target.blur();
        });
        window.addEventListener('online', function () { shell.render(); });
        window.addEventListener('offline', function () { shell.render(); });

        /* the demo nudge, once, after a beat */
        setTimeout(function () {
          if (!LJ.accounts.isAuthed()) U.toast('Tip', 'Sign in with the demo account <b>kevsaggy</b> (or <b>taz</b> for moderators) to post, vote, rate and read the encrypted rooms.', 'info', 9000);
        }, 2600);
      });
    }
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', LJ.boot.start);
  else LJ.boot.start();
})();
