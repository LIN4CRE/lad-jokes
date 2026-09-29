/* ═══════════════════════════════════════════════════════════════════════
   lib/notify.js — push notification layer: browser Notification API when
   granted + service worker present, in-app toasts always, persisted inbox,
   badge count, and the popularity/milestone ticker that drives "your post
   is blowing up" alerts.
   Module: LJ.notify
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var swReg = null, swReady = false, timer = null;

  function S() { return LJ.store; }

  function push(title, body, tag) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    try {
      if (swReady && swReg && swReg.showNotification) {
        swReg.showNotification(title, { body: body, tag: tag || 'lj', icon: favIcon(), badge: favIcon(), data: { url: '#' + (LJ.router.path || '/feed') } });
      } else {
        new Notification(title, { body: body, tag: tag || 'lj' });
      }
      return true;
    } catch (e) { return false; }
  }
  function favIcon() { return (document.querySelector('link[rel="icon"]') || {}).href || location.href; }

  var N = {
    state: function () {
      return {
        permission: ('Notification' in window) ? Notification.permission : 'unsupported',
        serviceWorker: swReady,
        supported: 'Notification' in window
      };
    },
    registerSW: function () {
      if (!('serviceWorker' in navigator) || !location.protocol.match(/^https?:/)) return Promise.resolve(false);
      return navigator.serviceWorker.register('sw.js').then(function (r) {
        swReg = r; swReady = true;
        U.toast('Offline mode armed', 'Service worker cached the shell — reload with the network off and it still opens.', 'ok', 5000);
        LJ.bus.emit('sw:ready');
        return true;
      }).catch(function (e) {
        console.info('[sw] unavailable in this context:', e && e.message);
        return false;
      });
    },
    ask: function () {
      if (!('Notification' in window)) { U.toast('Not supported', 'This browser has no Notification API. In-app alerts are still on.', 'warn'); return Promise.resolve('denied'); }
      return Notification.requestPermission().then(function (p) {
        if (p === 'granted') {
          U.toast('Push armed', 'We will ping you when your story starts climbing or a DM lands.', 'ok');
          N.pushTest();
        } else U.toast('Permission ' + p, 'No browser pushes — in-app toasts and the inbox still work.', p === 'denied' ? 'bad' : 'warn');
        LJ.bus.emit('notify:perm', p);
        return p;
      }).catch(function () { return 'denied'; });
    },
    pushTest: function () {
      push('Lad Jokes', 'This is what a popularity alert looks like. Your move, algorithm.', 'lj-test');
    },

    /* ── inbox ─────────────────────────────────────────────────────── */
    add: function (item) {
      var n = Object.assign({ id: U.uid('n'), at: U.now(), read: false }, item);
      S().set('notes', [n].concat(S().all('notes')).slice(0, 80));
      if (n.title) {
        var off = N.chrome();
        U.toast(n.title, n.body, n.kind === 'message' ? 'info' : 'ok', 6000);
        if (!off) push(n.title, n.body, n.kind + n.postId);
      }
      LJ.bus.emit('notify:new', n);
      return n;
    },
    chrome: function () { return U.now() - (LJ.activity.last || 0) < 12000; },
    all: function () { return S().all('notes'); },
    unread: function () { return S().all('notes').filter(function (n) { return !n.read; }).length; },
    markRead: function (id) {
      S().set('notes', S().all('notes').map(function (n) { return (!id || n.id === id) ? Object.assign({}, n, { read: true }) : n; }));
      LJ.bus.emit('notify:read', { id: id });
    },
    clear: function () { S().set('notes', []); LJ.bus.emit('notify:read', { all: true }); },

    /* ── the popularity ticker ─────────────────────────────────────── */
    startTicker: function () {
      if (timer) return;
      timer = setInterval(N.tick, 9000);
      LJ.bus.emit('ticker:start');
    },
    stopTicker: function () { clearInterval(timer); timer = null; },
    running: function () { return !!timer; },

    tick: function () {
      var s = S();
      if (!s.setting('simEngagement', true)) return;
      if (document.hidden) return;                 // no fake churn while hidden
      var posts = s.all('posts').filter(function (p) { return p.status !== 'removed'; });
      if (!posts.length) return;
      var pool = posts.slice().sort(function (a, b) { return (b.views || 0) - (a.views || 0); }).slice(0, 6);
      var target = pool[Math.floor(Math.random() * pool.length)];
      var bump = Math.floor(Math.random() * 9) + 1;
      var nextVotes = (target.votes || 0) + bump;
      var nextViews = (target.views || 0) + bump * Math.floor(Math.random() * 9 + 4);
      var milestones = [100, 500, 1000, 1500, 2000, 2500, 3000, 5000];
      var crossed = milestones.filter(function (m) { return target.votes < m && nextVotes >= m; });
      s.patch('posts', target.id, { votes: nextVotes, views: nextViews, hot: true });
      s.broadcast({ type: 'engagement', id: target.id, votes: nextVotes });

      if (crossed.length && s.setting('notifMilestones', true)) {
        var mine = LJ.accounts.isAuthed() && target.authorId === LJ.accounts.current().id;
        N.add({
          kind: 'milestone',
          title: (mine ? 'Your story passed ' : 'Passing story: ') + U.fmt(crossed[0]) + ' upvotes',
          body: '"' + short(target.title) + '" just grew by ' + bump + ' in a tick.',
          postId: target.id
        });
      }
      /* an occasional reply to a story you wrote */
      if (Math.random() < 0.16 && LJ.accounts.isAuthed()) {
        var minePosts = posts.filter(function (p) { return p.authorId === LJ.accounts.current().id; });
        var p0 = minePosts[0] || posts[0];
        var who = ['gazza_t', 'donutman99', 'bazza', 'taz', 'anon_' + U.hash(Date.now()).slice(0, 4)][Math.floor(Math.random() * 5)];
        var lines = [
          'This is the funniest thing I have read between two pints.',
          'Banned from the group chat for exactly this.',
          'Adding "no milk" to the list of reasons I trust nobody.',
          'I laughed so hard the dog left the room.',
          'Genuine question: how is this legal?'
        ];
        s.put('comments', {
          id: U.uid('c'), postId: p0.id, author: who, anon: who.indexOf('anon_') === 0,
          text: lines[Math.floor(Math.random() * lines.length)], at: U.now(), votes: Math.floor(Math.random() * 12)
        });
        s.patch('posts', p0.id, { comments: (p0.comments || 0) + 1 });
        if (S().setting('notifReplies', true)) {
          N.add({ kind: 'reply', title: who + ' replied to your story', body: lines[0], postId: p0.id });
        }
      }
    },

    newDmAlert: function (from, text, threadId) {
      if (!S().setting('notifMessages', true)) return;
      N.add({ kind: 'message', title: 'New DM from ' + from, body: short(text), threadId: threadId });
    }
  };

  function short(t) { t = String(t || ''); return t.length > 76 ? t.slice(0, 76) + '…' : t; }

  LJ.notify = N;
})();
