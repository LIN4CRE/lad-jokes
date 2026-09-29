/* ═══════════════════════════════════════════════════════════════════════
   lib/sync.js — the "realtime across devices" story, honestly modelled:
   · live channel: BroadcastChannel + storage events (multi-tab = the demo
     of multi-device)
   · outbox: writes queue as ops, flushed to a sync worker on reconnect
   · offline: navigator.onLine + service-worker cache state
   · heartbeat: presence for "who is looking at this now"
   Module: LJ.sync
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var lastSync = U.now(), hb = null, live = false;

  var Y = {
    start: function () {
      live = true;
      window.addEventListener('online', function () {
        U.toast('Back online', 'Draining ' + LJ.store.pendingOps() + ' queued change(s) to the sync worker.', 'ok');
        Y.flush(true);
      });
      window.addEventListener('offline', function () {
        U.toast('Offline mode', 'Writes are queueing locally. Nothing is lost — the forum keeps working.', 'warn', 6000);
      });
      document.addEventListener('lj:store:change', function () { lastSync = U.now(); });
      document.addEventListener('lj:remote:sync', function (e) {
        lastSync = U.now();
        U.toast('Synced from another tab', 'Live channel picked up ' + ((e.detail && e.detail.type) || 'a change') + '.', 'info', 3400);
        if (LJ.router && LJ.router.path !== '/login') LJ.bus.emit('view:refresh');
      });
      hb = setInterval(function () {
        LJ.store.heartbeat((LJ.accounts.current() || {}).handle || 'guest');
        lastSync = U.now();
        LJ.bus.emit('sync:beat', Y.status());
      }, 12000);
      LJ.store.heartbeat((LJ.accounts.current() || {}).handle || 'guest');
    },
    stop: function () { live = false; clearInterval(hb); hb = null; },
    running: function () { return live; },

    status: function () {
      var online = navigator.onLine !== false;
      var sw = ('serviceWorker' in navigator) && navigator.serviceWorker.controller != null;
      return {
        online: online,
        cached: !!sw,
        channel: live,
        pending: LJ.store.pendingOps(),
        lastSync: lastSync,
        peers: LJ.store.peers()
      };
    },

    flush: function (silent) {
      var n = LJ.store.flushOps();
      lastSync = U.now();
      if (!silent && !n) U.toast('Nothing to send', 'Outbox is already empty — the local cache is authoritative here.', 'info', 2800);
      return n;
    },

    /* simulated device (handy for a demo of push + realtime) */
    simulatePeer: function () {
      var s = LJ.store, posts = s.all('posts').filter(function (p) { return p.status !== 'removed'; });
      if (!posts.length) return;
      var p = posts[Math.floor(Math.random() * posts.length)];
      var votes = (p.votes || 0) + Math.floor(Math.random() * 60) + 12;
      s.patch('posts', p.id, { votes: votes, views: (p.views || 0) + 400, hot: true });
      s.broadcast({ type: 'peer-engage', id: p.id, votes: votes });
      LJ.notify.add({
        kind: 'milestone', title: 'Another device just fed your story',
        body: '"' + String(p.title).slice(0, 60) + '…" is at ' + U.fmt(votes) + ' upvotes.', postId: p.id
      });
    }
  };

  LJ.sync = Y;
})();
