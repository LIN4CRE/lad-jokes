/* ═══════════════════════════════════════════════════════════════════════
   views/story.js — single thread: full story, live poll, anonymous outrage
   dial, replies, share, and the author's own engagement read-out.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  function render(params) {
    var s = LJ.store;
    var p = s.get1('posts', params.id);
    if (!p) return '<div class="wrap-narrow"><div class="card empty"><div class="empty__t">Thread not found' + '</div>' +
      '<p>It was either never posted or a moderator killed it. Either way, it is funnier without you.' + '</p>' +
      '<a class="btn btn--primary" href="#/feed">Back to the forum' + '</a></div></div>';

    var T = LJ.postTools;
    var cmts = s.all('comments').filter(function (c) { return c.postId === p.id; }).sort(function (a, b) { return a.at - b.at; });
    var poll = p.pollId ? s.get1('polls', p.pollId) : null;
    var author = s.all('users').filter(function (u) { return u.id === p.authorId || u.handle === p.author; })[0];
    var mine = LJ.accounts.isAuthed() && LJ.accounts.current().id === p.authorId;
    var related = T.list({ cat: p.category, sort: 'hot', showHeld: false }).filter(function (x) { return x.id !== p.id; }).slice(0, 4);
    var ratingCount = Object.keys(p.ratings || {}).length;

    return '<div class="split"><div class="col" style="gap:14px">' +
      '<a class="btn btn--ghost btn--sm" href="#/feed" style="align-self:flex-start">' + U.icon('back') + 'Back to the forum' + '</a>' +
      (p.status === 'queued'
        ? '<div class="banner banner--info" style="margin-bottom:2px">' + U.icon('shield') + '<div><strong>Held for review.</strong> A moderator clears this before it goes anywhere public. It is visible to you and to the team, nobody else.</div></div>'
        : (p.status === 'removed'
          ? '<div class="banner banner--bad" style="margin-bottom:2px">' + U.icon('flag') + '<div><strong>Removed by a moderator.</strong> The thread stays readable here for the record, but it is out of the forum.</div></div>'
          : '')) +
      T.card(Object.assign({}, p, { comments: cmts.length }), { open: true, link: false }) +

      '<div class="grid cols-3">' +
      stat('Score', U.fmt(T.score(p)), 'formula in tooltip', 'Upvotes + 7×replies + 4×ratings + 2×outrage×ratings − 40×reports') +
      stat('Anonymous outrage', (p.outrage || 0).toFixed(1) + '<span class="tiny muted">/10</span>', ratingCount + ' ratings') +
      stat('Reach', U.fmt((p.views || 0) + (p.shares || 0) * 220), 'views + shares') +
      '' + '</div>' +

      (poll ? '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('poll') + ' Attached poll' + '</span>' +
        '<div class="spacer"></div><span class="tiny faint">' + U.fmt(T.totalVotes(poll)) + ' votes' + '</span></div>' +
        '<p style="font-weight:750">' + U.escape(poll.question) + '' + '</p>' +
        (poll.context ? '<p class="tiny muted">' + U.escape(poll.context) + '</p>' : '') +
        T.pollBlock(poll, p.id, false) + '</section>' : '') +

      (mine ? '<section class="banner banner--info">' + U.icon('zap') +
        '<div><b>Your thread.</b> Live engagement: ' + U.fmt(p.votes || 0) + ' upvotes, ' + cmts.length + ' replies, ' +
        ratingCount + ' anonymous ratings. Push alerts fire at 100 / 500 / 1k milestones while you keep them on in <a href="#/settings">Settings</a>.</div></section>' : '') +

      '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('users') + ' The author' + '</span></div>' +
      '<div class="row" style="gap:12px">' + U.avatar(p.author, 'avatar--lg') +
      '<div style="min-width:0"><div class="row row--tight"><b>u/' + U.escape(p.author || 'lad') + '' + '</b>' +
      (author ? '<span class="pill pill--accent">' + U.escape(author.flair) + '</span>' : '') +
      (author && author.admin ? '<span class="pill pill--ok">' + U.icon('shield') + 'moderator</span>' : '') + '' + '</div>' +
      '<div class="tiny muted">' + U.escape(author ? author.bio : 'Anonymous member. We respect that.') + '' + '</div>' +
      (author ? '<div class="tiny faint">joined ' + new Date(author.joined).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) + ' · karma ' + U.fmt(LJ.accounts.karma(author.id).votes) + '</div>' : '') +
      '</div><div class="spacer">' + '</div>' +
      (author && !mine ? '<button class="btn btn--ghost" data-action="dm-user" data-user="' + U.escape(author.handle) + '">' + U.icon('chat') + 'DM</button>' : '') +
      (mine ? '<a class="btn btn--ghost" href="#/account">' + U.icon('chart') + 'My stats</a>' : '') +
      '</div></section>' +

      '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('flame') + ' Outrage leaderboard for this thread' + '</span></div>' +
      ratingTable(p) + '</section>' +
      '' + '</div>' +

      '<aside class="col" style="gap:12px">' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('share') + 'Distribute it' + '</span></div>' +
      '<p class="tiny muted">Share card, permalink and deep links to every major platform. Nothing posts itself — you stay in control of who sees your worst moment.' + '</p>' +
      '<button class="btn btn--primary btn--block" data-action="share-post" data-post="' + p.id + '">' + U.icon('share') + 'Share this story' + '</button>' +
      '<div class="shares" style="margin-top:10px">' + LJ.share.nets.slice(0, 4).map(function (n) {
        return '<button class="share" data-action="share-net" data-post="' + p.id + '" data-net="' + n.id + '"><span class="dot" style="background:' + n.dot + '">' + n.icon + '' + '</span>' + n.label + '' + '</button>';
      }).join('') + '' + '</div></div>' +
      (related.length ? '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('grid') + ' Same room, worse people' + '</span></div>' +
        related.map(function (r) {
          return '<a href="#/story/' + r.id + '" class="row" style="gap:9px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line);color:var(--fg)">' +
            U.avatar(r.author, 'avatar--sm') + '<div style="min-width:0"><div style="font-weight:700;font-size:13px;line-height:1.35">' + U.escape(r.title) + '' + '</div>' +
            '<div class="tiny faint">' + U.fmt(r.votes) + ' upvotes · outrage ' + (r.outrage || 0).toFixed(1) + '' + '</div></div></a>';
        }).join('') + '</div>' : '') +
      '</aside>' + '</div>';
  }

  function stat(label, value, sub, title) {
    return '<div class="card" title="' + U.escape(title || '') + '"><div class="stat"><span class="stat__d">' + label + '' + '</span>' +
      '<span class="stat__n">' + value + '</span><span class="tiny faint">' + U.escape(sub || '') + '' + '</span></div></div>';
  }

  function ratingTable(p) {
    var entries = Object.keys(p.ratings || {}).map(function (k) { return { who: k, v: p.ratings[k] }; }).sort(function (a, b) { return b.v - a.v; });
    if (!entries.length) return '<p class="tiny muted">Nobody has rated it yet. Rate it above — anonymously, with a device token, no handle attached.' + '</p>';
    var buckets = [0, 0, 0, 0, 0];
    entries.forEach(function (e) { buckets[U.clamp(Math.floor(e.v / 2.01), 0, 4)]++; });
    var max = Math.max.apply(null, buckets) || 1;
    return '<div class="row" style="gap:14px;align-items:flex-end;height:96px;margin-bottom:12px">' +
      ['1–2', '3–4', '5–6', '7–8', '9–10'].map(function (lab, i) {
        return '<div style="flex:1;text-align:center"><div style="height:70px;display:flex;align-items:flex-end"><i style="width:100%;height:' + Math.max(4, buckets[i] / max * 70) + 'px;border-radius:5px;background:linear-gradient(180deg,var(--accent),color-mix(in srgb,var(--accent) 25%,transparent));display:block"></i>' + '</div>' +
          '<div class="tiny faint">' + lab + '<br>' + buckets[i] + '' + '</div></div>';
      }).join('') + '' + '</div>' +
      '<p class="tiny faint">' + U.fmt(entries.length) + ' anonymous ratings · mean <b style="color:var(--accent)">' + (p.outrage || 0).toFixed(2) + '</b> · spread ±' + LJ.postTools.spread(p).toFixed(2) + '. Raters are identified only by rotating device tokens.' + '</p>';
  }

  LJ.storyView = {
    register: function () {
      LJ.router.add({ path: '/story/:id', title: 'Thread', render: render });
      LJ.router.action('share-net', function (el) {
        var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
        var n = LJ.share.nets.filter(function (x) { return x.id === el.dataset.net; })[0];
        var url = location.href.split('#')[0] + '#/story/' + p.id;
        var w = window.open(n.url(p.title + ' — Lad Jokes (18+)', url), '_blank', 'noopener,width=680,height=620');
        if (!w) U.toast('Popup blocked', 'Allow popups for this frame, or use the full share sheet.', 'warn');
        else LJ.store.patch('posts', p.id, { shares: (p.shares || 0) + 1 });
      });
      LJ.router.action('dm-user', function (el) {
        var user = LJ.accounts.require('send messages'); if (!user) return;
        var t = LJ.store.all('threads').filter(function (x) { return x.members.indexOf(el.dataset.user) >= 0; })[0];
        LJ.router.go('/chat' + (t ? '/' + t.id : ''));
      });
    }
  };
})();
