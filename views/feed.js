/* ═══════════════════════════════════════════════════════════════════════
   views/feed.js — the forum. Search, filters, engagement sorting, votes,
   anonymous outrage ratings, comments, sharing. Exposes LJ.postTools which
   story.js reuses, so a post never renders two different ways.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  var SORTS = [
    { id: 'hot', label: 'Hot', blurb: 'score ÷ age' },
    { id: 'top', label: 'Top', blurb: 'raw score' },
    { id: 'new', label: 'New', blurb: 'freshest first' },
    { id: 'outrageous', label: 'Outrageous', blurb: 'mean anon rating' },
    { id: 'discussed', label: 'Most argued', blurb: 'comment count' },
    { id: 'controversial', label: 'Controversial', blurb: 'spread of ratings' }
  ];

  /* showHeld:false — a post held for review never joins the public forum.
     Admin surfaces pass showHeld:true explicitly when they need to see the queue. */
  var state = { q: '', cat: 'all', sort: 'hot', onlyPolls: false, mine: false, nsfw: true, showHeld: false };

  /* ══ shared maths ═══════════════════════════════════════════════════ */
  function score(p) {
    var ratings = Object.keys(p.ratings || {}).length;
    var out = p.outrage || LJ.seed.meanRating(p.ratings);
    var s = Math.max(0, (p.votes || 0)) + (p.comments || 0) * 7 + ratings * 4 + Math.max(0, out) * ratings * 2 - (p.flags || []).length * 40;
    return Math.round(s);
  }
  function hotness(p) {
    var hrs = Math.max(0.4, (U.now() - (p.createdAt || U.now())) / 3600000);
    return score(p) / Math.pow(hrs + 3, 1.15);
  }
  function spread(p) {
    var v = Object.keys(p.ratings || {}).map(function (k) { return p.ratings[k]; });
    if (v.length < 2) return 0;
    var mean = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
    var varc = v.reduce(function (a, b) { return a + (b - mean) * (b - mean); }, 0) / v.length;
    return Math.sqrt(varc);
  }
  function sortFn(id) {
    return function (a, b) {
      switch (id) {
        case 'top': return score(b) - score(a);
        case 'new': return (b.createdAt || 0) - (a.createdAt || 0);
        case 'outrageous': return (b.outrage || 0) - (a.outrage || 0) || score(b) - score(a);
        case 'discussed': return (b.comments || 0) - (a.comments || 0);
        case 'controversial': return spread(b) - spread(a);
        default: return hotness(b) - hotness(a);
      }
    };
  }
  function list(filterQuery) {
    var s = LJ.store, q = (filterQuery || state);
    var out = s.all('posts').filter(function (p) {
      if (p.status === 'removed' && !q.includeRemoved) return false;
      var isMine = LJ.accounts.isAuthed() && p.authorId === (LJ.accounts.current() || {}).id;
      var isMod = LJ.accounts.isAdmin();
      if (p.status === 'draft' && !isMine) return false;              // only the author sees drafts
      if (p.status === 'queued' && !isMod && !isMine) return false;    // held for review: staff + author only
      if (q.cat && q.cat !== 'all' && p.category !== q.cat) return false;
      if (q.onlyPolls && !p.pollId) return false;
      if (q.mine && p.authorId !== (LJ.accounts.current() || {}).id) return false;
      if (q.nsfw === false && p.nsfw) return false;
      if (q.q) {
        var hay = (p.title + ' ' + p.body + ' ' + (p.tags || []).join(' ') + ' ' + (p.author || '')).toLowerCase();
        var words = String(q.q).toLowerCase().split(/\s+/).filter(Boolean);
        for (var i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
      }
      return true;
    });
    return out.sort(sortFn(q.sort || 'hot'));
  }

  /* ══ card markup (shared with story view) ══════════════════════════ */
  function outrageBars(v) {
    var n = Math.round(v || 0), out = '';
    for (var i = 1; i <= 10; i++) out += '<i class="' + (i <= n ? 'on' : '') + '"></i>';
    return '<span class="outrage" title="Anonymous outrage score ' + (v || 0).toFixed(1) + ' / 10"><span class="outrage__bars">' + out + '</span><span class="outrage__n">' + (v || 0).toFixed(1) + '' + '</span></span>';
  }

  function pollBlock(poll, postId, inline) {
    if (!poll) return '';
    var total = poll.options.reduce(function (a, o) { return a + (o.votes || 0); }, 0) + (poll.myVote ? 0 : 0);
    var mine = poll.myVote;
    return '<div class="poll" data-poll="' + poll.id + '" data-post="' + postId + '">' +
      (inline ? '' : '<div class="row row--between" style="margin-bottom:2px"><span class="eyebrow">' + U.icon('poll') + ' Community poll' + '</span>' +
        '<span class="tiny muted">' + U.fmt(total) + ' votes · closes ' + U.ago(poll.closesAt).replace(' ago', '') + '</span></div>') +
      poll.options.map(function (o) {
        var pc = total ? Math.round(((o.votes || 0) + (mine === o.id ? 1 : 0)) / (total + (mine ? 0 : 1)) * 100) : 0;
        return '<button class="poll__opt' + (mine === o.id ? ' is-mine' : '') + '" data-action="vote-poll" data-poll="' + poll.id + '" data-opt="' + o.id + '"' +
          ' aria-label="Vote ' + U.escape(o.label) + ', ' + pc + ' percent">' +
          '<span class="bar" style="--w:' + pc + '%">' + '</span>' +
          '<span class="poll__label">' + U.escape(o.label) + '' + '</span>' +
          '<span class="poll__pct">' + pc + '%' + '</span>' +
          '<span class="tag tiny">' + U.fmt((o.votes || 0) + (mine === o.id ? 1 : 0)) + '' + '</span>' +
          '<span class="pill ' + (mine === o.id ? 'pill--accent' : '') + '" style="pointer-events:none">' + (mine === o.id ? 'your vote' : 'vote') + '' + '</span></button>';
      }).join('') +
      '<div class="poll__meta"><span>' + (mine ? U.icon('check') + ' Recorded anonymously — polls never store which option you picked against your handle.' : 'Tap an option to vote. One per device, revocable.') + '' + '</span>' +
      '<button class="btn btn--ghost btn--sm" data-action="share-poll" data-poll="' + poll.id + '">' + U.icon('share') + 'Share poll' + '</button></div>' +
      '' + '</div>';
  }

  function rateBlock(p) {
    var dev = LJ.store.device().id;
    var mine = (p.ratings || {})[dev];
    var dial = '';
    for (var i = 1; i <= 10; i++) dial += '<button data-action="rate" data-post="' + p.id + '" data-v="' + i + '" class="' + (mine >= i ? 'on' : '') + '" aria-label="' + i + ' out of 10">' + i + '' + '</button>';
    return '<div class="rate"><span class="eyebrow">' + U.icon('flame') + (mine ? 'Your rating' : 'Rate the outrage') + '' + '</span>' +
      '<span class="rate__dial">' + dial + '' + '</span>' +
      '<span class="out" style="font:800 12px/1 var(--ff-body)">' + (mine ? 'you said ' + mine + '/10 · ' : '') + U.fmt(Object.keys(p.ratings || {}).length) + ' anonymous ratings' + '</span>' +
      (mine ? '<button class="btn btn--ghost btn--sm" data-action="unrate" data-post="' + p.id + '">' + U.icon('x') + 'Take mine back</button>' : '') +
      '' + '</div>';
  }

  function card(p, opts) {
    opts = opts || {};
    var s = LJ.store;
    var poll = p.pollId ? s.get1('polls', p.pollId) : null;
    var cats = LJ.seed.CATS;
    var cat = cats.filter(function (c) { return c.id === p.category; })[0] || { label: 'General' };
    var me = s.device().id;
    var voted = p.myVote || 0;
    var flagged = (p.flags || []).some(function (f) { return f.by === me; });
    var c = s.all('comments').filter(function (c) { return c.postId === p.id; });
    return '<article class="card card--hover post' + (opts.open ? ' post--open' : '') + (p.featured ? ' card--hot' : '') + '" data-post="' + p.id + '">' +
      '<div class="post__vote">' +
      '<button class="vbtn' + (voted > 0 ? ' is-on' : '') + '" data-action="vote" data-post="' + p.id + '" data-dir="1" aria-label="Upvote">' + U.icon('up') + '' + '</button>' +
      '<span class="post__score">' + U.fmt(p.votes || 0) + '' + '</span>' +
      '<button class="vbtn' + (voted < 0 ? ' is-on' : '') + '" data-action="vote" data-post="' + p.id + '" data-dir="-1" aria-label="Downvote">' + U.icon('down') + '' + '</button>' +
      (p.status === 'removed' ? '<span class="pill pill--bad">removed</span>' : p.status === 'queued' ? '<span class="pill pill--warn">in queue</span>' : '') +
      '' + '</div>' +
      '<div style="min-width:0">' +
      '<div class="row row--tight" style="margin-bottom:7px">' +
      U.avatar(p.author, 'avatar--sm') +
      '<b class="tiny">u/' + U.escape(p.author || 'lad') + '' + '</b>' +
      '<span class="tiny faint">' + U.escape(p.authorName || '') + '' + '</span>' +
      '<span class="pill">' + U.icon(cat.icon || 'chat') + U.escape(cat.label) + '' + '</span>' +
      (p.nsfw ? '<span class="nsfl">18+ NSFW</span>' : '') +
      (p.status === 'queued' ? '<span class="held-tag">held for review</span>' : '') +
      (p.featured ? '<span class="outraged-tag">staff pick</span>' : '') +
      '<span class="tiny faint">· ' + U.ago(p.createdAt) + '' + '</span>' +
      (opts.link === false ? '' : '<div class="spacer"></div><a class="tiny" href="#/story/' + p.id + '">thread ' + U.icon('chev-r') + '</a>') +
      '' + '</div>' +
      '<h3 class="post__title">' + (opts.link === false ? U.escape(p.title) : '<a href="#/story/' + p.id + '">' + U.escape(p.title) + '</a>') + '</h3>' +
      '<p class="post__body">' + U.escape(p.body || '') + '' + '</p>' +
      (poll ? '<div style="margin-top:12px">' + pollBlock(poll, p.id, false) + '</div>' : '') +
      (opts.open ? '' : '<div style="margin-top:12px">' + rateBlock(p) + '</div>') +
      '<div class="post__foot">' +
      outrageBars(p.outrage || 0) +
      (opts.open ? '' : '<button class="btn btn--ghost btn--sm" data-action="open-thread" data-post="' + p.id + '">' + U.icon('comment') + U.fmt(p.comments || 0) + ' replies</button>') +
      '<button class="btn btn--ghost btn--sm" data-action="share-post" data-post="' + p.id + '">' + U.icon('share') + U.fmt(p.shares || 0) + '' + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="flag-post" data-post="' + p.id + '">' + U.icon('flag') + (flagged ? 'Flagged' : 'Report') + '' + '</button>' +
      (LJ.accounts.isAdmin() ? '<button class="btn btn--ghost btn--sm" data-action="admin-post" data-post="' + p.id + '">' + U.icon('shield') + 'Moderate</button>' : '') +
      '<div class="spacer">' + '</div>' +
      (p.tags || []).map(function (t) { return '<span class="tag">' + U.escape(t) + '' + '</span>'; }).join('') +
      '' + '</div>' +
      (opts.open ? renderComments(p, c) : '') +
      '</div></article>';
  }

  function renderComments(p, c) {
    return '<div style="margin-top:16px;border-top:1px solid var(--line);padding-top:12px">' +
      '<div class="row row--between" style="margin-bottom:6px"><span class="eyebrow">' + U.icon('users') + U.fmt(c.length) + ' replies' + '</span>' +
      '<label class="check tiny"><input type="checkbox" data-action="anon-comment" ' + (LJ.store.setting('commentAnon') ? 'checked' : '') + '> Post my reply as anonymous</label>' + '</div>' +
      (c.length ? c.map(function (x) {
        return '<div class="cmt' + (x.anon ? ' cmt--anon' : '') + '">' +
          (x.anon ? U.avatar('anon', 'avatar--sm') : U.avatar(x.author, 'avatar--sm')) +
          '<div><div class="row row--tight"><span class="cmt__who">' + (x.anon ? 'anonymous' : 'u/' + U.escape(x.author)) + '' + '</span>' +
          '<span class="tiny faint">' + U.ago(x.at) + '' + '</span>' +
          (x.votes ? '<span class="pill" style="padding:2px 7px">' + U.icon('up') + U.fmt(x.votes) + '</span>' : '') + '' + '</div>' +
          '<div class="cmt__txt">' + U.escape(x.text) + '' + '</div></div></div>';
      }).join('') : '<p class="tiny muted">No replies yet. Be the disappointment they deserve.</p>') +
      '<form class="row" style="margin-top:12px" data-action="add-comment-form" data-post="' + p.id + '">' +
      '<input class="input" name="text" placeholder="Add your two cents (they are worth less than you think)" maxlength="600" autocomplete="off">' +
      '<button class="btn btn--primary" type="submit">' + U.icon('send') + 'Reply</button></form>' +
      '' + '</div>';
  }

  /* ══ view ═══════════════════════════════════════════════════════════ */
  function renderFeed(params, query) {
    /* deep links (/feed?cat=pub&sort=top) drive state; our own toggle clicks
       mutate state directly, so we never round-trip a partial query string. */
    if (query && Object.keys(query).length) {
      if ('q' in query) state.q = query.q || '';
      if ('cat' in query) state.cat = query.cat || 'all';
      if ('sort' in query) state.sort = query.sort || 'hot';
      if ('polls' in query) state.onlyPolls = query.polls === '1';
      if ('mine' in query) state.mine = query.mine === '1';
      if ('held' in query) state.showHeld = query.held === '1';   // /feed?held=1 to preview the queue
    }
    var s = LJ.store;
    var all = s.all('posts');
    var shown = list();
    var openPoll = s.all('polls').filter(function (p) { return p.closesAt > U.now(); })
      .sort(function (a, b) { return totalVotes(b) - totalVotes(a); })[0];
    var top = shown[0] || null;
    var cats = [{ id: 'all', label: 'Everything', icon: 'grid' }].concat(LJ.seed.CATS);
    var counts = {};
    all.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
    var u = LJ.accounts.current();

    return '<div class="grid" style="gap:16px">' +
      /* hero */
      '<section class="hero">' +
      '<div class="split">' +
      '<div>' +
      '<div class="row row--tight" style="margin-bottom:8px">' +
      '<span class="pill pill--accent pill--live">' + U.icon('zap') + ' Live' + '</span>' +
      '<span class="pill">' + U.fmt(all.filter(function (p) { return p.status !== 'removed'; }).length) + ' stories' + '</span>' +
      '<span class="pill">' + U.fmt(all.reduce(function (a, p) { return a + (p.comments || 0); }, 0)) + ' replies' + '</span>' +
      '<span class="pill">' + U.fmt(all.reduce(function (a, p) { return a + Object.keys(p.ratings || {}).length; }, 0)) + ' anonymous ratings' + '</span>' +
      (u ? '' : '<span class="pill pill--warn">read-only: sign in to post</span>') +
      '' + '</div>' +
      '<h1 class="display h-xl">The LAD<br><em style="color:var(--accent)">JOKES</em> Forum</h1>' +
      '<p class="muted" style="max-width:60ch;margin-top:10px">Adults only, no filters, no apologies. Post the night you keep re-telling badly. Vote on polls nobody commissioned. Rate the worst ones anonymously, then go to bed like a functioning degenerate.' + '</p>' +
      '<div class="row" style="margin-top:14px">' +
      '<a class="btn btn--primary btn--lg" href="#/create">' + U.icon('plus') + 'Share your story' + '</a>' +
      '<a class="btn btn--ghost btn--lg" href="#/polls">' + U.icon('poll') + 'The polling station' + '</a>' +
      '<button class="btn btn--ghost btn--lg" data-action="share-post" data-post="' + (top ? top.id : '') + '"' + (top ? '' : ' disabled') + '>' + U.icon('share') + 'Share the worst one' + '</button>' +
      '' + '</div></div>' +
      (openPoll ? '<div class="card" style="background:color-mix(in srgb, var(--surface) 82%, transparent)">' +
        '<div class="card__head"><span class="card__title">Poll of the hour</span><div class="spacer"></div><span class="tiny faint">' + U.fmt(totalVotes(openPoll)) + ' votes' + '</span></div>' +
        '<p style="font-weight:750;margin:0 0 10px">' + U.escape(openPoll.question) + '' + '</p>' +
        pollBlock(openPoll, openPoll.postId || '', true) +
        '</div>' : '') +
      '</div></section>' +

      /* toolbar */
      '<section class="card" style="padding:12px">' +
      '<div class="row" style="gap:8px">' +
      '<div class="search"><span class="search__ic">' + U.icon('search') + '' + '</span>' +
      '<input class="input" id="q" data-action="search" placeholder="Search stories, tags, lads — “sauna”, “jet ski”, “wrong chat”" value="' + U.escape(state.q) + '" autocomplete="off">' + '</div>' +
      '<select class="select" id="sort" data-action="set-sort" style="max-width:190px" aria-label="Sort by engagement">' +
      SORTS.map(function (o) { return '<option value="' + o.id + '"' + (state.sort === o.id ? ' selected' : '') + '>' + o.label + ' — ' + o.blurb + '</option>'; }).join('') + '</select>' +
      '<button class="btn btn--ghost" data-action="toggle-filter" data-key="onlyPolls">' + U.icon('poll') + (state.onlyPolls ? 'Showing polls' : 'Polls only') + '' + '</button>' +
      '<button class="btn btn--ghost" data-action="toggle-filter" data-key="mine">' + U.icon('user') + (state.mine ? 'My posts' : 'My posts') + '' + '</button>' +
      '<button class="btn btn--ghost" data-action="toggle-filter" data-key="nsfw">' + U.icon(state.nsfw ? 'eye' : 'eyeoff') + (state.nsfw ? 'NSFW on' : 'NSFW hidden') + '' + '</button>' +
      '<span class="spacer">' + '</span>' +
      '<span class="tiny faint">sorted by <b style="color:var(--fg)">' + (SORTS.filter(function (o) { return o.id === state.sort; })[0] || {}).label + '</b> · ' + shown.length + '/' + all.length + ' rooms' + '</span>' +
      '' + '</div>' +
      '<div class="chips" style="margin-top:10px">' + cats.map(function (c) {
        return '<button class="chip' + (state.cat === c.id ? ' is-on' : '') + '" data-action="set-cat" data-cat="' + c.id + '">' + U.icon(c.icon || 'chat') + U.escape(c.label) +
          (c.id === 'all' ? '' : ' ' + (counts[c.id] || 0)) + '' + '</button>';
      }).join('') + '' + '</div>' +
      '</section>' +

      /* list + rail */
      '<div class="split">' +
      '<div class="col" style="gap:12px">' +
      (shown.length ? shown.map(function (p) { return card(p, {}); }).join('')
        : '<div class="card empty"><div class="empty__t">Nothing matches that</div><p>Loosen the filters or start the trouble yourself.' + '</p>' +
        '<a class="btn btn--primary" href="#/create">' + U.icon('plus') + ' Post a story</a></div>') +
      '' + '</div>' +
      '<aside class="col" style="gap:12px">' +
      railTop() + railSync() + railRules() +
      '</aside>' + '</div></div>';
  }

  function railTop() {
    var top = list({ q: '', cat: 'all', sort: 'outrageous' }).slice(0, 5);
    return '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('flame') + ' Most outrageous' + '</span></div>' +
      (top.length ? '<ol class="col" style="gap:9px;list-style:none;padding:0">' + top.map(function (p, i) {
        return '<li class="row" style="gap:8px;align-items:flex-start">' +
          '<b class="mono" style="color:var(--accent)">' + (i + 1) + '' + '</b>' +
          '<a href="#/story/' + p.id + '" style="flex:1;min-width:0;color:var(--fg);font-weight:650;font-size:13px;line-height:1.35">' + U.escape(p.title) + '' + '</a>' +
          '<span class="tiny" style="color:var(--accent);font-weight:800">' + (p.outrage || 0).toFixed(1) + '' + '</span></li>';
      }).join('') + '</ol>' : '<p class="tiny muted">No ratings yet.</p>') + '' + '</div>';
  }
  function railSync() {
    var st = LJ.sync.status();
    return '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('refresh') + ' Realtime & offline' + '</span></div>' +
      '<dl class="dl"><dt>Live channel</dt><dd>' + (st.channel ? '<span style="color:var(--ok)">connected</span>' : 'idle') + '</dd>' +
      '<dt>Network</dt><dd>' + (st.online ? '<span style="color:var(--ok)">online</span>' : '<span style="color:var(--warn)">offline</span>') + '</dd>' +
      '<dt>Shell cached</dt><dd>' + (st.cached ? 'yes (sw)' : 'not in this frame') + '</dd>' +
      '<dt>Queued writes</dt><dd>' + st.pending + '</dd>' +
      '<dt>Last write</dt><dd>' + U.time(st.lastSync) + '</dd>' +
      '<dt>Other tabs</dt><dd>' + st.peers.peers.length + '</dd></dl>' +
      '<div class="row" style="margin-top:10px"><button class="btn btn--ghost btn--sm" data-action="sync-now">' + U.icon('refresh') + 'Flush outbox' + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="sync-peer">' + U.icon('zap') + 'Simulate a device' + '</button></div></div>';
  }
  function railRules() {
    return '<div class="card card--outline"><div class="card__head"><span class="card__title">' + U.icon('shield') + ' House rules' + '</span></div>' +
      '<ul class="tiny muted" style="display:flex;flex-direction:column;gap:6px;padding-left:16px;margin:0">' +
      '<li><b>18+</b> and fictional-by-default. If it reads like a real person, rewrite it.</li>' +
      '<li><b>No names, no addresses, no workplaces, no faces.</b> Confessions, not doxxing.</li>' +
      '<li><b>Nothing about anyone who didn’t agree.</b> That is not a joke, that is a complaint.</li>' +
      '<li><b>Racism, misogyny, homophobia, transphobia:</b> instant removal, then a ban.</li>' +
      '<li><b>Under-18 content is a hard ban</b> and a report to the authorities. Not a bit.</li></ul>' + '</div>';
  }
  function totalVotes(p) { return (p.options || []).reduce(function (a, o) { return a + (o.votes || 0); }, 0); }

  /* ══ interactions ═══════════════════════════════════════════════════ */
  var A = LJ.router.actions;
  A['set-cat'] = function (el) { state.cat = el.dataset.cat; paint(); };
  A['toggle-filter'] = function (el) {
    var key = el.dataset.key; state[key] = !state[key];
    if (key === 'nsfw') LJ.store.setSetting('nsfwVisible', state.nsfw);   // members keep their choice
    paint();
  };
  A['set-sort'] = function (el) { if (el.tagName === 'SELECT') { state.sort = el.value; paint(); } };
  A['search'] = function (el, e) { if (el.tagName === 'INPUT') el.oninput = U.debounce(function () { state.q = el.value; paint(); }, 200); };
  function paint() {
    var host = U.$('#view');
    if (!host) return;
    if (LJ.router.path !== '/feed') { LJ.router.render(); return; }   // story view re-renders itself
    host.innerHTML = renderFeed();
    wire();
    /* keep the URL honest so a reload lands on the same view */
    var q = {};
    if (state.q) q.q = state.q;
    if (state.cat !== 'all') q.cat = state.cat;
    if (state.sort !== 'hot') q.sort = state.sort;
    if (state.onlyPolls) q.polls = 1;
    if (state.mine) q.mine = 1;
    var s = Object.keys(q).length ? '?' + Object.keys(q).map(function (k) { return k + '=' + encodeURIComponent(q[k]); }).join('&') : '';
    /* toggle-driven repaints must not rewrite a deep link: the 18+ switch lives in
       settings (members) or the link itself, and rewriting it would re-enter the route */
    if (state.__noUrl) return;
    try { history.replaceState(null, '', location.pathname + '#/feed' + s); } catch (e) {}
  }

  A['vote'] = function (el) {
    var user = LJ.accounts.require('vote on stories'); if (!user) return;
    var s = LJ.store, p = s.get1('posts', el.dataset.post); if (!p) return;
    var dir = Number(el.dataset.dir);
    var prev = p.myVote || 0;
    var next = prev === dir ? 0 : dir;
    var votes = (p.votes || 0) - prev + next;
    s.patch('posts', p.id, { votes: votes, myVote: next });
    s.put('votes', { id: 'v_' + p.id + '_' + user.id, userId: user.id, postId: p.id, dir: next, at: U.now() });
    if (next > 0 && prev <= 0 && LJ.accounts.isAuthed() && p.authorId === user.id) {
      /* self-love is fine here, we just note it */
    }
    paint();
  };

  A['rate'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    var dev = LJ.store.device().id;
    var ratings = Object.assign({}, p.ratings || {});
    var v = Number(el.dataset.v);
    var before = ratings[dev];
    if (before === v) delete ratings[dev]; else ratings[dev] = v;
    LJ.store.patch('posts', p.id, { ratings: ratings, outrage: LJ.seed.meanRating(ratings) });
    var now = ratings[dev];
    U.toast(now ? 'Rated ' + now + '/10' : 'Rating withdrawn',
      now ? 'Anonymous: your device token only, no handle attached.' : 'No trace of it left.', 'ok', 3000);
    LJ.notify.add({ kind: 'outrage', title: 'Outrage updated on “' + String(p.title).slice(0, 34) + '…”', body: 'Mean ' + LJ.seed.meanRating(ratings).toFixed(1) + '/10 from ' + Object.keys(ratings).length + ' devices.', postId: p.id });
    paint();
  };
  A['unrate'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    var dev = LJ.store.device().id;
    var ratings = Object.assign({}, p.ratings || {});
    delete ratings[dev];
    LJ.store.patch('posts', p.id, { ratings: ratings, outrage: LJ.seed.meanRating(ratings) });
    U.toast('Rating removed', 'Device token forgotten for this story.', 'ok', 2600);
    paint();
  };

  A['flag-post'] = function (el) {
    var user = LJ.accounts.require('report a story'); if (!user) return;
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    var dev = LJ.store.device().id;
    var flags = (p.flags || []).filter(function (f) { return f.by !== dev; });
    var added = flags.length === (p.flags || []).length;
    if (added) flags.push({ why: 'Reported by a member', by: dev, at: U.now(), handle: user.handle });
    LJ.store.patch('posts', p.id, { flags: flags });
    U.toast(added ? 'Sent to moderators' : 'Report withdrawn', added ? 'u/taz will look at it. Nothing changes until a human decides.' : 'Removed from the queue.', added ? 'warn' : 'ok');
    if (added) LJ.notify.add({ kind: 'moderation', title: 'Report queued for review', body: '“' + String(p.title).slice(0, 40) + '…” now sits in the moderation queue.', postId: p.id });
    paint();
  };

  A['open-thread'] = function (el) { LJ.router.go('/story/' + el.dataset.post); };
  A['share-post'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (p) LJ.share.open(p);
  };
  A['share-poll'] = function (el) {
    var poll = LJ.store.get1('polls', el.dataset.poll); if (!poll) return;
    LJ.share.open({ id: poll.postId || ('poll-' + poll.id), title: poll.question, body: poll.context || 'Vote on this.', author: poll.author, category: 'polls', votes: totalVotes(poll), outrage: 0 });
  };
  A['add-comment-form'] = function (el) {
    var f = el;
    if (el.__ljRun) return;                       // click + submit can land in one task: run once
    el.__ljRun = 1; setTimeout(function () { el.__ljRun = 0; }, 0);
    var input = U.$('input[name="text"]', f), text = (input.value || '').trim();
    if (!text) return;
    var user = LJ.accounts.require('reply'); if (!user) return;
    var anon = !!LJ.store.setting('commentAnon');
    var p = LJ.store.get1('posts', f.dataset.post);
    LJ.store.put('comments', {
      id: U.uid('c'), postId: f.dataset.post, author: anon ? 'anon_' + U.hash(user.id).slice(0, 4) : user.handle,
      authorId: anon ? null : user.id, anon: anon, text: text, at: U.now(), votes: 0
    });
    LJ.store.patch('posts', f.dataset.post, { comments: (p && p.comments ? p.comments + 1 : 1) });
    input.value = '';
    U.toast('Posted', anon ? 'Your reply is anonymous on purpose.' : 'Reply live. Someone will disagree shortly.', 'ok', 3000);
    if (p && p.authorId && p.authorId !== user.id) LJ.notify.add({ kind: 'reply', title: 'You have a new reply on “' + String(p.title).slice(0, 30) + '…”', body: text.slice(0, 70), postId: p.id });
    paint();
  };
  A['anon-comment'] = function (el) { LJ.store.setSetting('commentAnon', !!el.checked); };
  A['admin-post'] = function (el) {
    LJ.store.set('lastmod', el.dataset.post);
    LJ.router.go('/admin', { focus: el.dataset.post });
  };

  /* ══ wiring ═════════════════════════════════════════════════════════ */
  function wire() {
    var q = U.$('#q'); if (q) q.oninput = U.debounce(function () { state.q = q.value; paint(); }, 220);
    var srt = U.$('#sort'); if (srt) srt.onchange = function () { state.sort = srt.value; paint(); };
    /* re-attached after every repaint; the handler self-dedupes so a click
       path and a submit path can never both write a reply */
    U.$$('[data-action="add-comment-form"]').forEach(function (f) {
      if (f.dataset.wired === 'pending') return;
      f.dataset.wired = 'pending';
      f.addEventListener('submit', function (e) { e.preventDefault(); A['add-comment-form'](f); });
    });
    var focused = LJ.router.query.focus;
    if (focused) { var el = U.$('[data-post="' + focused + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  LJ.postTools = { card: card, state: state, list: list, score: score, hotness: hotness, spread: spread, pollBlock: pollBlock, rateBlock: rateBlock, outrageBars: outrageBars, totalVotes: totalVotes, SORTS: SORTS, paint: paint };

  LJ.feedView = {
    register: function () {
      LJ.router.add({
        path: '/feed', title: 'The Forum', render: renderFeed, enter: function (host, params, query) {
          host._render = renderFeed;
          /* the 18+ switch is resolved on mount only — never inside renderFeed(), or the
             toggle could not be turned back on. Order: explicit link → member's last
             choice (persisted) → hidden for guests. */
          var before = state.nsfw;
          if (query && 'nsfw' in query) state.nsfw = query.nsfw !== '0' && query.nsfw !== 'false';
          else if (LJ.accounts.isAuthed()) state.nsfw = LJ.store.setting('nsfwVisible') !== false;
          else state.nsfw = false;
          if (state.nsfw !== before) {              // mount already painted the previous choice
            state.__noUrl = 1; paint(); state.__noUrl = 0;   // ...without rewriting the deep link
          }
          wire();
        }
      });
    }
  };
})();
