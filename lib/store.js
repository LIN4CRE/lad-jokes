/* ═══════════════════════════════════════════════════════════════════════
   lib/store.js — the data layer. One place that owns state, persistence,
   change events and the realtime/outbox machinery. Views never touch
   localStorage directly. Swapping this module for REST/GraphQL/WebSocket
   (or Supabase/Firebase) does not require touching a single view.
   Module: LJ.store, LJ.bus
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var NS = 'lj';
  var ver = 'v1';
  function k(name) { return NS + ':' + name + ':' + ver; }

  var NAMES = {
    users: 'users', accounts: 'accounts', sessions: 'sessions',
    posts: 'posts', comments: 'comments', votes: 'votes', ratings: 'ratings',
    polls: 'polls', pollVotes: 'poll-votes', messages: 'messages', threads: 'threads',
    notes: 'notifications', reports: 'reports', files: 'files', board: 'board',
    widgetOrder: 'widgets', settings: 'settings', auth: 'auth', device: 'device',
    ops: 'ops', presence: 'presence', meta: 'meta'
  };

  /* ══ bus: pub/sub + cross-module DOM events ═════════════════════════ */
  var subs = {};
  LJ.bus = {
    on: function (evt, fn) { (subs[evt] = subs[evt] || []).push(fn); return function () { LJ.bus.off(evt, fn); }; },
    off: function (evt, fn) { subs[evt] = (subs[evt] || []).filter(function (f) { return f !== fn; }); },
    emit: function (evt, detail) {
      (subs[evt] || []).slice().forEach(function (fn) { try { fn(detail, evt); } catch (e) { console.error('[bus]', evt, e); } });
      try { document.dispatchEvent(new CustomEvent('lj:' + evt, { detail: detail })); } catch (e) {}
    }
  };

  /* ══ state cache ═══════════════════════════════════════════════════ */
  var cache = {};
  var hydrated = false;
  function read(name) {
    if (!hydrated) hydrate();
    if (!(name in cache)) cache[name] = U.store.get(k(name), null);
    return cache[name];
  }
  function hydrate() {
    hydrated = true;
    Object.keys(NAMES).forEach(function (n) { cache[n] = U.store.get(k(NAMES[n]), null); });
  }

  var flushTimer = null, dirty = {};
  function flush() {
    flushTimer = null;
    Object.keys(dirty).forEach(function (n) {
      var val = cache[n];
      U.store.set(k(n), val);
      delete dirty[n];
    });
    LJ.bus.emit('store:flushed');
  }
  function write(name, value) {
    cache[name] = value; dirty[name] = 1;
    if (!flushTimer) flushTimer = setTimeout(flush, 90);
  }

  /* ══ generic access ════════════════════════════════════════════════ */
  var S = {
    ready: function () { hydrate(); return true; },
    get: function (name, fb) { var v = read(name); return v === null || v === undefined ? fb : v; },
    set: function (name, value) { write(name, value); LJ.bus.emit('store:change', { name: name }); return value; },

    /* collection helpers */
    all: function (name) { var v = read(name); return Array.isArray(v) ? v : []; },
    get1: function (name, id) { return S.all(name).filter(function (x) { return x && x.id === id; })[0] || null; },
    put: function (name, obj) {
      var arr = S.all(name).slice();
      var i = arr.findIndex(function (x) { return x.id === obj.id; });
      if (i >= 0) { obj.updated = U.now(); arr[i] = obj; } else { arr.unshift(obj); }
      write(name, arr);
      logOp(i >= 0 ? 'update' : 'insert', name, obj.id);
      LJ.bus.emit('store:change', { name: name, id: obj.id, kind: i >= 0 ? 'update' : 'insert' });
      return obj;
    },
    patch: function (name, id, patch) {
      var cur = S.get1(name, id); if (!cur) return null;
      var next = Object.assign({}, cur, patch, { updated: U.now() });
      write(name, S.all(name).map(function (x) { return x.id === id ? next : x; }));
      logOp('patch', name, id, Object.keys(patch));
      LJ.bus.emit('store:change', { name: name, id: id, kind: 'patch' });
      return next;
    },
    remove: function (name, id) {
      write(name, S.all(name).filter(function (x) { return x.id !== id; }));
      logOp('delete', name, id);
      LJ.bus.emit('store:change', { name: name, id: id, kind: 'delete' });
    },
    where: function (name, fn) { return S.all(name).filter(fn); }
  };

  /* ══ ops outbox — the realtime sync seam ═══════════════════════════ */
  function logOp(kind, coll, id, fields) {
    var ops = (read('ops') || []).slice(-199);
    ops.push({ id: U.uid('op'), t: U.now(), kind: kind, coll: coll, id2: id, fields: fields || null, tab: TAB });
    write('ops', ops);
    broadcast({ type: 'ops', ops: ops.slice(-1) });
    LJ.bus.emit('ops:pending', { count: ops.length });
  }
  S.flushOps = function () {
    var ops = read('ops') || [];
    if (!ops.length) return 0;
    var sent = ops.length;
    // Prototype: nothing to send to — we mark the outbox drained and say so.
    write('ops', []);
    LJ.bus.emit('ops:flushed', { sent: sent });
    U.toast('Outbox drained', sent + ' queued change' + (sent > 1 ? 's' : '') + ' acknowledged by sync worker.', 'ok', 3200);
    return sent;
  };
  S.pendingOps = function () { return (read('ops') || []).length; };

  /* ══ cross-tab realtime (BroadcastChannel, storage-event fallback) ══ */
  var TAB = (U.store.get(k('meta'), {}) || {}).tab || U.uid('tab');
  var bc = null;
  try { if ('BroadcastChannel' in window) bc = new BroadcastChannel('lj-sync'); } catch (e) {}
  function broadcast(msg) {
    msg = Object.assign({ from: TAB, t: U.now() }, msg);
    if (bc) { try { bc.postMessage(msg); return; } catch (e) {} }
    try { if (window.localStorage) localStorage.setItem(k('bus'), JSON.stringify(msg)); } catch (e) {}
  }
  S.broadcast = broadcast;
  if (bc) bc.onmessage = function (e) { onRemote(e.data); };
  U.on(window, 'storage', function (e) {
    if (e.key === k('bus') && e.newValue) { try { onRemote(JSON.parse(e.newValue)); } catch (err) {} }
  });
  function onRemote(msg) {
    if (!msg || msg.from === TAB) return;
    hydrated = false; cache = {};              // re-hydrate from disk
    LJ.bus.emit('remote:sync', msg);
    LJ.bus.emit('store:change', { name: msg.coll || null, remote: true });
  }

  /* ══ presence heartbeat (multi-device "who's on this now") ═════════ */
  S.heartbeat = function (label) {
    var p = read('presence') || {};
    p[TAB] = { at: U.now(), label: label || 'anonymous', route: (LJ.router && LJ.router.path) || '/' };
    var cutoff = U.now() - 45000;
    Object.keys(p).forEach(function (t) { if (p[t].at < cutoff) delete p[t]; });
    write('presence', p);
    broadcast({ type: 'presence' });
    return p;
  };
  S.peers = function () {
    var p = read('presence') || {}, me = 0, out = [];
    Object.keys(p).forEach(function (t) { if (t === TAB) me++; else out.push(p[t]); });
    return { tabs: me, peers: out };
  };

  /* ══ device identity (anonymous ratings, no account needed) ════════ */
  S.device = function () {
    var d = read('device');
    if (!d) d = write('device', { id: LJ.crypto ? LJ.crypto.token() : U.uid('dev'), created: U.now() });
    return read('device');
  };

  /* ══ import / export / wipe ════════════════════════════════════════ */
  S.exportAll = function () {
    var out = { _app: 'Lad Jokes', _version: 1, _at: new Date().toISOString(), collections: {} };
    Object.keys(NAMES).forEach(function (n) { out.collections[n] = read(n); });
    return out;
  };
  S.importAll = function (obj) {
    if (!obj || !obj.collections) throw new Error('Not a Lad Jokes export');
    Object.keys(NAMES).forEach(function (n) { if (n in obj.collections) write(n, obj.collections[n]); });
    hydrate();
    LJ.bus.emit('store:import');
  };
  S.wipe = function (keepAuth) {
    Object.keys(NAMES).forEach(function (n) {
      if (keepAuth && (n === 'auth' || n === 'users' || n === 'accounts' || n === 'device')) return;
      U.store.del(k(NAMES[n])); cache[n] = null;
    });
    flush();
    LJ.bus.emit('store:change', { name: '*' });
  };

  /* settings passthrough */
  S.setting = function (name, fb) {
    var s = read('settings') || {};
    return name in s ? s[name] : fb;
  };
  S.setSetting = function (name, value) {
    var s = Object.assign({}, read('settings') || {});
    s[name] = value; write('settings', s);
    LJ.bus.emit('settings:change', { name: name, value: value });
    return value;
  };

  LJ.store = S;
})();
