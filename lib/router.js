/* ═══════════════════════════════════════════════════════════════════════
   lib/router.js — hash router, route table, guards (18+ / auth / admin),
   query-string filters, and the delegated data-action dispatcher that all
   views plug into. Zero dependencies, zero build step.
   Module: LJ.router
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  var routes = [];
  var actions = {};
  var current = null;

  function parse() {
    var raw = (location.hash || '#/feed').replace(/^#/, '') || '/feed';
    var qi = raw.indexOf('?');
    var path = qi >= 0 ? raw.slice(0, qi) : raw;
    var query = {};
    if (qi >= 0) raw.slice(qi + 1).split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      var rawv = String(p[1] || '').replace(/\+/g, ' ');
      query[decodeURIComponent(p[0])] = decodeURIComponent(rawv);
    });
    path = path.replace(/\/+$/, '') || '/';
    return { path: path, query: query, raw: path };
  }

  /* segment matching — no regex escaping traps: ":name" captures, "*" matches the rest */
  function resolve(loc) {
    var segs = loc.path.split('/').filter(Boolean);
    for (var i = 0; i < routes.length; i++) {
      var r = routes[i];
      var rs = r.path.split('/').filter(Boolean);
      if (rs.length !== segs.length) continue;
      var params = {}, ok = true;
      for (var j = 0; j < rs.length; j++) {
        if (rs[j].charAt(0) === ':') { params[rs[j].slice(1)] = decodeURIComponent(segs[j]); continue; }
        if (rs[j] !== segs[j]) { ok = false; break; }
      }
      if (ok) return { route: r, params: params };
    }
    return { route: null, params: {} };
  }

  var R = {
    path: '/feed', query: {}, params: {},
    routes: routes,

    add: function (r) { routes.push(r); return R; },
    action: function (name, fn) { actions[name] = fn; return R; },
    hasAction: function (name) { return !!actions[name]; },

    go: function (path, query) {
      var q = '';
      if (query && Object.keys(query).length) {
        q = '?' + Object.keys(query).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&');
      }
      var target = '#' + path + q;
      if (location.hash === target) { render(); return; }
      location.hash = target;
    },
    replace: function (path, query) {
      var q = (query && Object.keys(query).length) ? '?' + Object.keys(query).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(query[k]); }).join('&') : '';
      location.replace(location.pathname + location.search + '#' + path + q);
    },

    loc: parse,

    guard: function (loc) {
      var agreed = U.store.get('lj:age:v1', null);
      if (!agreed) { R.path = '/splash'; return 'age'; }
      var hit = resolve(loc);
      if (hit.route && hit.route.auth && !LJ.accounts.isAuthed()) return 'auth';
      if (hit.route && hit.route.admin && !LJ.accounts.isAdmin()) return 'admin';
      return null;
    },

    render: render,
    start: function () {
      window.addEventListener('hashchange', render);
      document.addEventListener('click', function (e) {
        var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
        if (!el) return;
        var name = el.getAttribute('data-action');
        var fn = actions[name];
        if (!fn) return;
        /* a plain submit button inside a [data-action] form belongs to the form's
           submit handler — do not run the action twice */
        if (el.tagName === 'A' && el.getAttribute('href')) { /* allow nav links, block others */ if (el.dataset.action !== 'nav') e.preventDefault(); }
        else if (el.tagName !== 'LABEL') e.preventDefault();
        try { fn(el, e); } catch (err) { console.error('[action:' + name + ']', err); U.toast('That broke', String(err.message || err).slice(0, 120), 'bad'); }
      });
      render();
    }
  };

  function render() {
    var loc = parse();
    var hit = resolve(loc);
    var age = U.store.get('lj:age:v1', null);

    /* gate 1 — nobody sees a thing before the age check */
    if (!age || !age.ok) {
      R.path = '/splash'; R.query = {}; R.params = {}; R.route = { title: '18+ only', splash: true };
      var sp = U.$('#splash'), ap = U.$('#app');
      if (sp) sp.hidden = !age || !age.ok ? false : sp.hidden;
      if (ap && age && !age.ok) ap.hidden = true;
      paintChrome();
      document.title = '18+ only · LAD JOKES';
      return;
    }
    if (loc.path === '/splash') { setHash('/feed'); return; }

    /* gate 2 — member-only rooms */
    if (hit.route && hit.route.auth && !LJ.accounts.isAuthed()) {
      U.toast('Members only', 'Sign in to open that room.', 'warn');
      LJ.modalAuth();
      setHash('/feed');
      return;
    }
    /* gate 3 — staff only */
    if (hit.route && hit.route.admin && !LJ.accounts.isAdmin()) {
      U.toast('Moderators only', 'That dashboard needs a staff account. The demo handle taz has one.', 'warn');
      setHash('/feed');
      return;
    }
    /* 404 — never strand the member on a blank hash */
    if (!hit.route) {
      U.toast('No such room', 'Nothing is mapped to ' + loc.path, 'warn');
      setHash('/feed');
      return;
    }
    paint(hit, loc);
  }

  function setHash(path) {
    var target = '#' + path;
    if (location.hash === target) render();
    else location.hash = target;
  }

  function paint(hit, loc) {
    current = hit.route;
    R.path = loc.path; R.query = loc.query; R.params = hit.params; R.route = hit.route;

    var splash = U.$('#splash'), app = U.$('#app');
    if (splash) splash.hidden = true;
    if (app) app.hidden = false;

    var host = U.$('#view');
    if (!host) return;
    host.innerHTML = hit.route.render ? hit.route.render(hit.params, loc.query) : '';
    if (hit.route.enter) { try { hit.route.enter(host, hit.params, loc.query); } catch (e) { console.error('[view:enter]', e); } }
    paintChrome();
    try { window.scrollTo(0, 0); } catch (e) {}
    document.title = (hit.route.title ? hit.route.title + ' · ' : '') + 'LAD JOKES';
    LJ.store.heartbeat((LJ.accounts.current() || {}).handle || 'guest');
    LJ.bus.emit('route:after', { path: loc.path });
  }

  function paintChrome() { if (LJ.shell) { LJ.shell.paintSidebar(); LJ.shell.paintTop(); LJ.shell.paintTabs(); } }

  /* views can ask to re-run render without moving (live-ish updates) */
  LJ.bus.on('view:refresh', function () { if (LJ.router.path && LJ.router.path !== '/splash') render(); });

  R.actions = actions;
  LJ.router = R;
})();
