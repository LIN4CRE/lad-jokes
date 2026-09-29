/* ═══════════════════════════════════════════════════════════════════════
   views/polls.js — the polling station: user-generated polls, anonymous
   one-per-device voting, revocable, live bars, closing countdown.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var state = { filter: 'open', q: '' };

  function total(p) { return (p.options || []).reduce(function (a, o) { return a + (o.votes || 0); }, 0); }
  function ended(p) { return p.closesAt <= U.now(); }

  function render() {
    var s = LJ.store;
    var all = s.all('polls');
    var votes = s.all('pollVotes');
    var dev = s.device().id;
    var list = all.filter(function (p) {
      if (state.filter === 'open' && ended(p)) return false;
      if (state.filter === 'ended' && !ended(p)) return false;
      if (state.filter === 'mine' && p.author !== ((LJ.accounts.current() || {}).handle)) return false;
      if (state.q) {
        var hay = (p.question + ' ' + (p.context || '') + ' ' + (p.options || []).map(function (o) { return o.label; }).join(' ')).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) < 0) return false;
      }
      return true;
    }).sort(function (a, b) {
      if (state.filter === 'ended') return b.createdAt - a.createdAt;
      return (ended(a) ? 1 : 0) - (ended(b) ? 1 : 0) || total(b) - total(a);
    });

    var votedIds = votes.filter(function (v) { return v.device === dev; }).map(function (v) { return v.pollId; });
    var totalVotes = all.reduce(function (a, p) { return a + total(p); }, 0);

    return '<div class="split"><div class="col" style="gap:14px">' +
      '<section class="hero"><h1 class="display h-lg">The Polling<br>Station</h1>' +
      '<p class="muted" style="max-width:62ch">Rig nothing. Vote once per device, change your mind, take it back. Polls here are user-generated, anonymously counted, and occasionally the reason a group chat dies.' + '</p>' +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn btn--primary btn--lg" data-action="new-poll">' + U.icon('plus') + 'Start a poll' + '</button>' +
      '<a class="btn btn--ghost btn--lg" href="#/feed">' + U.icon('chat') + 'Back to the forum' + '</a>' +
      '<span class="spacer">' + '</span>' +
      '<span class="pill">' + all.length + ' polls</span><span class="pill">' + U.fmt(totalVotes) + ' votes cast' + '</span>' +
      '<span class="pill pill--ok">' + votedIds.length + ' voted by you' + '</span>' +
      '</div></section>' +

      '<div class="card" style="padding:12px"><div class="row" style="gap:8px">' +
      '<div class="chips" style="flex:1">' +
      ['open', 'ended', 'mine'].map(function (f) {
        return '<button class="chip' + (state.filter === f ? ' is-on' : '') + '" data-action="poll-filter" data-f="' + f + '">' + (f === 'mine' ? 'My polls' : f === 'open' ? 'Live now' : 'Closed') + '' + '</button>';
      }).join('') + '' + '</div>' +
      '<div class="search" style="max-width:340px"><span class="search__ic">' + U.icon('search') + '' + '</span>' +
      '<input class="input" id="pq" placeholder="Search the polls" value="' + U.escape(state.q) + '">' + '</div>' +
      '' + '</div></div>' +

      (list.length ? list.map(function (p) {
        var t = total(p);
        var closed = ended(p);
        var mine = p.myVote;
        return '<section class="card' + (closed ? '' : ' card--hover') + '">' +
          '<div class="card__head">' + U.avatar(p.author, 'avatar--sm') +
          '<b class="tiny">u/' + U.escape(p.author || 'lad') + '' + '</b>' +
          '<span class="tiny faint">' + U.ago(p.createdAt) + '' + '</span>' +
          '<div class="spacer">' + '</div>' +
          (closed ? '<span class="pill">closed</span>' : '<span class="pill pill--accent pill--live">' + U.icon('zap') + 'live</span>') +
          '<span class="pill">' + U.fmt(t) + ' votes' + '</span>' +
          (p.anonymous === false ? '<span class="pill pill--warn">named votes</span>' : '<span class="pill pill--ok">anonymous</span>') +
          '' + '</div>' +
          '<h3 class="post__title">' + U.escape(p.question) + '</h3>' +
          (p.context ? '<p class="tiny muted">' + U.escape(p.context) + '</p>' : '') +
          '<div style="margin-top:12px">' + LJ.postTools.pollBlock(p, p.postId || '', true) + '' + '</div>' +
          '<div class="post__foot">' +
          (closed ? '<span class="tiny muted">Winner: <b style="color:var(--fg)">' + U.escape(winner(p)) + '</b></span>'
            : '<span class="tiny muted">Closes ' + U.ago(p.closesAt).replace(' ago', ' from now') + '</span>') +
          '<button class="btn btn--ghost btn--sm" data-action="revoke-poll" data-poll="' + p.id + '">' + U.icon('x') + 'Clear my vote' + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="share-poll" data-poll="' + p.id + '">' + U.icon('share') + 'Share' + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="discuss-poll" data-poll="' + p.id + '">' + U.icon('comment') + 'Discuss' + '</button>' +
          '</div></section>';
      }).join('') : '<div class="card empty"><div class="empty__t">No polls match</div><p>Start one. That is how they all begin.' + '</p>' +
        '<button class="btn btn--primary" data-action="new-poll">' + U.icon('plus') + 'New poll</button></div>') +
      '' + '</div>' +
      '<aside class="col" style="gap:12px">' + rail() + '</aside>' + '</div>';
  }

  function winner(p) {
    var w = (p.options || []).slice().sort(function (a, b) { return (b.votes || 0) - (a.votes || 0); })[0];
    return w ? w.label : 'nobody';
  }
  function rail() {
    var s = LJ.store, all = s.all('polls');
    var ranked = all.slice().sort(function (a, b) { return total(b) - total(a); }).slice(0, 6);
    return '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('chart') + 'Turnout' + '</span></div>' +
      '<div class="bars">' + ranked.map(function (p) {
        var t = total(p), max = total(ranked[0]) || 1;
        return '<div data-v="' + U.fmt(t) + ' votes" style="height:' + Math.max(6, t / max * 100) + '%">' + '</div>';
      }).join('') + '' + '</div>' +
      ranked.map(function (p, i) { return '<div class="tiny faint">' + (i + 1) + '. ' + U.escape(p.question.slice(0, 42)) + '… <b style="color:var(--fg)">' + U.fmt(total(p)) + '' + '</b></div>'; }).join('') +
      '' + '</div>' +
      '<div class="card card--outline"><div class="card__head"><span class="card__title">' + U.icon('lock') + 'How voting works' + '</span></div>' +
      '<ul class="tiny muted" style="padding-left:16px;margin:0;display:flex;flex-direction:column;gap:6px">' +
      '<li>One vote per device token. Your handle is not attached to the tally.</li>' +
      '<li>Changing your vote rewrites the same record — no second entry.</li>' +
      '<li>Results are live to everyone through the sync channel; your ballot is not.</li>' +
      '<li>Clearing a vote deletes the record locally and queues the removal.</li></ul>' + '</div>';
  }

  /* ── actions ──────────────────────────────────────────────────────── */
  var A = LJ.router.actions;
  A['poll-filter'] = function (el) { state.filter = el.dataset.f; repaint(); };
  function repaint() {
    if (LJ.router.path !== '/polls') return;
    var host = U.$('#view'); host.innerHTML = render(); wire();
  }
  function wire() {
    var q = U.$('#pq'); if (q) q.oninput = U.debounce(function () { state.q = q.value; repaint(); }, 220);
  }

  A['vote-poll'] = function (el) {
    var user = LJ.accounts.require('vote in polls'); if (!user) return;
    var s = LJ.store, p = s.get1('polls', el.dataset.poll); if (!p) return;
    if (ended(p)) return U.toast('Closed', 'That poll shut. Start a fresh one and settle it properly.', 'warn');
    var dev = s.device().id;
    var opt = el.dataset.opt;
    var options = (p.options || []).map(function (o) {
      var v = o.votes || 0;
      if (p.myVote === o.id) v = Math.max(0, v - 1);
      if (p.myVote !== opt && o.id === opt) v += 1;
      return Object.assign({}, o, { votes: v });
    });
    var next = p.myVote === opt ? null : opt;
    s.patch('polls', p.id, { options: options, myVote: next });
    var votes = s.all('pollVotes').filter(function (v) { return !(v.device === dev && v.pollId === p.id); });
    if (next) votes.unshift({ id: 'pv_' + p.id + '_' + dev, pollId: p.id, optionId: next, device: dev, at: U.now() });
    s.set('pollVotes', votes);
    U.toast(next ? 'Vote counted' : 'Vote cleared', next ? 'Anonymous. Nobody can tie this ballot to you.' : 'Removed from the tally.', 'ok', 2800);
    repaint();
  };
  A['revoke-poll'] = function (el) {
    var s = LJ.store, p = s.get1('polls', el.dataset.poll);
    if (!p || !p.myVote) return U.toast('Nothing to revoke', 'You have not voted here yet.', 'info');
    var opt = p.myVote;
    var options = (p.options || []).map(function (o) {
      return o.id === opt ? Object.assign({}, o, { votes: Math.max(0, (o.votes || 0) - 1) }) : o;
    });
    s.patch('polls', p.id, { options: options, myVote: null });
    s.set('pollVotes', s.all('pollVotes').filter(function (v) { return !(v.pollId === p.id && v.device === s.device().id); }));
    U.toast('Ballot voided', 'Your vote is gone from the tally and from the log.', 'ok', 2600);
    repaint();
  };
  A['discuss-poll'] = function (el) {
    var p = LJ.store.get1('polls', el.dataset.poll); if (!p) return;
    if (p.postId && LJ.store.get1('posts', p.postId)) return LJ.router.go('/story/' + p.postId);
    U.modal({
      title: 'Discuss this poll', icon: 'comment',
      body: '<p class="muted">No thread attached yet. Ship it to the forum so people can argue in public.' + '</p>' +
        '<p class="post__title" style="font-size:18px">' + U.escape(p.question) + '</p>',
      foot: '<button class="btn btn--ghost" data-action="modal-close">Later' + '</button>' +
        '<a class="btn btn--primary" href="#/create?poll=' + p.id + '">Post it with a thread</a>'
    });
  };

  A['new-poll'] = function () {
    var user = LJ.accounts.require('start a poll'); if (!user) return;
    var body = '<form id="np" class="col">' +
      '<label class="field"><span class="field__label">Question</span><input class="input" name="q" maxlength="140" placeholder="What should we all disagree about?" required></label>' +
      '<label class="field"><span class="field__label">Context (optional)</span><input class="input" name="ctx" maxlength="180" placeholder="Why this matters at 11pm"></label>' +
      '<div class="field"><span class="field__label">Options (2–8)' + '</span>' +
      Array.apply(null, Array(4)).map(function (_, i) {
        return '<input class="input np-opt" name="opt' + i + '" maxlength="90" placeholder="Option ' + (i + 1) + '"' + (i < 2 ? ' required' : '') + '>';
      }).join('') +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="np-add">' + U.icon('plus') + 'Add option' + '</button></div>' +
      '<div class="row" style="gap:14px">' +
      '<label class="field" style="flex:1"><span class="field__label">Closes in' + '</span>' +
      '<select class="select" name="days"><option value="1">1 day</option><option value="3" selected>3 days</option><option value="7">7 days</option><option value="14">14 days</option></select></label>' +
      '<label class="check" style="align-self:flex-end;padding-bottom:9px"><input type="checkbox" name="anon" checked> Anonymous tally</label>' +
      '' + '</div>' +
      '<button class="btn btn--primary btn--block btn--lg" type="submit">' + U.icon('poll') + 'Open the poll' + '</button>' +
      '<p class="tiny faint">Opens immediately in the feed under your handle. You can delete it any time before a moderator screenshots it.' + '</p>' +
      '</form>';
    var m = U.modal({ title: 'New poll', icon: 'plus', body: body });
    U.$('#np', m.root).addEventListener('submit', function (e) {
      e.preventDefault();
      var f = new FormData(e.target);
      var opts = U.$$('.np-opt', e.target).map(function (i) { return i.value.trim(); }).filter(Boolean);
      if (opts.length < 2) return U.toast('Need 2 options minimum', 'A one-option poll is a statement.', 'bad');
      var p = {
        id: U.uid('poll'), question: String(f.get('q')).trim(), context: String(f.get('ctx') || '').trim(),
        author: user.handle, authorId: user.id, createdAt: U.now(),
        closesAt: U.now() + Number(f.get('days')) * 86400000, anonymous: f.get('anon') === 'on',
        options: opts.map(function (l, i) { return { id: 'o' + (i + 1), label: l, votes: 0 }; }), myVote: null
      };
      LJ.store.put('polls', p);
      var post = {
        id: U.uid('s'), type: 'poll', title: 'POLL: ' + p.question, body: p.context || 'Voting is open. Settle it here.',
        category: 'banter', tags: ['poll'], authorId: user.id, author: user.handle, authorName: user.name,
        createdAt: U.now(), votes: 1, views: 12, comments: 0, nsfw: false, ratings: {}, myVote: 0, flags: [], status: 'open',
        pollId: p.id, outrage: 0
      };
      LJ.store.put('posts', post);
      LJ.store.patch('polls', p.id, { postId: post.id });
      m.close();
      U.toast('Poll is live', 'Thread posted too, so people can argue where everyone can see.', 'ok');
      LJ.notify.add({ kind: 'system', title: 'Your poll is open', body: p.question.slice(0, 60) });
      repaint();
    });
  };
  A['np-add'] = function () {
    var host = U.$('#np .field:nth-child(3)');
    var inputs = U.$$('.np-opt');
    if (inputs.length >= 8) return U.toast('Eight is plenty', 'Beyond that it is a survey, not a poll.', 'warn');
    var el = document.createElement('input');
    el.className = 'input np-opt'; el.name = 'opt' + inputs.length; el.maxLength = 90;
    el.placeholder = 'Option ' + (inputs.length + 1);
    inputs[inputs.length - 1].insertAdjacentElement('afterend', el);
    el.focus();
  };

  LJ.pollsView = {
    register: function () {
      LJ.router.add({ path: '/polls', title: 'Polls', render: render, enter: function () { wire(); } });
    }
  };
})();
