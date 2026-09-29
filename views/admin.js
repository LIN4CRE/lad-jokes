/* ═══════════════════════════════════════════════════════════════════════
   views/admin.js — the operations room: analytics, content management,
   moderation queue, a drag-and-drop collaboration board, file manager with
   drop-to-upload, automated reports, and rearrangeable widgets.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var TABS = [
    { id: 'overview', label: 'Overview', icon: 'chart' },
    { id: 'content', label: 'Content', icon: 'inbox' },
    { id: 'moderation', label: 'Moderation', icon: 'shield' },
    { id: 'collab', label: 'Team board', icon: 'users' },
    { id: 'files', label: 'Files', icon: 'folder' },
    { id: 'reports', label: 'Reports', icon: 'download' },
    { id: 'widgets', label: 'Widgets', icon: 'grid' }
  ];
  var WIDGET_LABEL = {
    analytics: 'Engagement analytics', trending: 'Top of the forum', moderation: 'Moderation queue',
    sync: 'Sync & offline health', reports: 'Report runs', files: 'Shared files', board: 'Team board snapshot', presence: 'Who is on'
  };

  function tab(params) { return (params && params.tab) || 'overview'; }

  /* ── day model: real events + seeded baseline so charts stay stable ── */
  function dayModel(offsetDays) {
    var s = LJ.store, day = 86400000;
    var start = new Date(U.now() - offsetDays * day); start.setHours(0, 0, 0, 0);
    var a = start.getTime(), b = a + day;
    var posts = s.all('posts').filter(function (p) { return p.createdAt >= a && p.createdAt < b; }).length;
    var cmts = s.all('comments').filter(function (c) { return c.at >= a && c.at < b; }).length;
    var rnd = U.prng(U.seedFrom('day' + Math.floor(a / day)));
    var base = 6 + Math.round(rnd() * 10);
    return {
      at: a, posts: posts + base,
      comments: cmts + Math.round(base * (1.4 + rnd())),
      votes: Math.round((posts + base) * (55 + rnd() * 70)),
      dau: Math.round(1400 + rnd() * 900 + posts * 120),
      retention: Math.round(41 + rnd() * 22),
      flags: s.all('posts').filter(function (p) { return (p.flags || []).length && p.updated && p.updated >= a && p.updated < b; }).length + Math.round(rnd() * 3)
    };
  }
  function series(days, key) {
    var out = [];
    for (var i = days - 1; i >= 0; i--) out.push(dayModel(i)[key]);
    return out;
  }

  function render(params, query) {
    if (query && query.focus) LJ.store.set('lastmod', query.focus);
    var t = tab(params);
    return '<div class="col" style="gap:14px">' +
      '<div class="row row--between" style="flex-wrap:wrap;gap:10px">' +
      '<div><span class="eyebrow">' + U.icon('shield') + 'Operations · staff only' + '</span>' +
      '<h1 class="display h-lg">The back room</h1>' + '</div>' +
      '<div class="row" style="gap:8px">' +
      '<span class="pill pill--live">' + U.icon('refresh') + 'live metrics' + '</span>' +
      '<button class="btn btn--ghost btn--sm" data-action="admin-broadcast">' + U.icon('zap') + 'Simulate device' + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="admin-flush">' + U.icon('cloud') + 'Flush outbox' + '</button>' +
      '<a class="btn btn--primary btn--sm" href="#/feed">' + U.icon('eye') + 'View as member' + '</a>' +
      '' + '</div></div>' +
      '<div class="chips">' + TABS.map(function (x) {
        var n = x.id === 'moderation' ? modCount() : '';
        return '<button class="chip' + (t === x.id ? ' is-on' : '') + '" data-action="admin-tab" data-tab="' + x.id + '">' + U.icon(x.icon) + x.label + (n ? ' ' + n : '') + '' + '</button>';
      }).join('') + '' + '</div>' +
      '<div id="admin-pane">' + pane(t) + '' + '</div></div>';
  }

  function modCount() {
    return LJ.store.all('posts').filter(function (p) { return (p.flags || []).length || p.status === 'queued'; }).length;
  }

  function pane(t) {
    switch (t) {
      case 'content': return contentPane();
      case 'moderation': return modPane();
      case 'collab': return collabPane();
      case 'files': return filesPane();
      case 'reports': return reportsPane();
      case 'widgets': return widgetsPane();
      default: return overviewPane();
    }
  }

  /* ══════════════════ overview ══════════════════ */
  function overviewPane() {
    var s = LJ.store;
    var posts = s.all('posts').filter(function (p) { return p.status !== 'removed'; });
    var d0 = dayModel(0), d1 = dayModel(1);
    var votes = posts.reduce(function (a, p) { return a + (p.votes || 0); }, 0);
    var ratings = posts.reduce(function (a, p) { return a + Object.keys(p.ratings || {}).length; }, 0);
    var shares = posts.reduce(function (a, p) { return a + (p.shares || 0); }, 0);
    var avgOut = posts.length ? posts.reduce(function (a, p) { return a + (p.outrage || 0); }, 0) / posts.length : 0;
    var cats = LJ.seed.CATS.map(function (c) {
      return { label: c.label, value: posts.filter(function (p) { return p.category === c.id; }).length, color: 'var(--accent)' };
    }).filter(function (c) { return c.value; });
    var states = [
      { label: 'Open', value: posts.filter(function (p) { return p.status === 'open'; }).length, color: 'var(--ok)' },
      { label: 'In queue', value: posts.filter(function (p) { return p.status === 'queued'; }).length, color: 'var(--warn)' },
      { label: 'Draft', value: posts.filter(function (p) { return p.status === 'draft'; }).length, color: 'var(--info)' },
      { label: 'Removed', value: s.all('posts').filter(function (p) { return p.status === 'removed'; }).length, color: 'var(--bad)' }
    ];
    var dau = series(14, 'dau');
    var order = s.get('widgetOrder') || Object.keys(WIDGET_LABEL);
    var widgets = order.filter(function (w) { return s.setting('widget:' + w, true) && WIDGET_LABEL[w]; })
      .concat(Object.keys(WIDGET_LABEL).filter(function (w) { return order.indexOf(w) < 0 && s.setting('widget:' + w, true); }));

    return '<div class="grid cols-4">' +
      kpi('Stories live', U.fmt(posts.length), '+' + (d0.posts - d1.posts) + ' today', (d0.posts - d1.posts) >= 0, 'inbox') +
      kpi('Votes cast', U.fmt(votes), '+' + U.fmt(d0.votes - d1.votes) + ' in 24h', true, 'up') +
      kpi('Anonymous ratings', U.fmt(ratings), 'mean outrage ' + avgOut.toFixed(1), true, 'flame') +
      kpi('Shares', U.fmt(shares), '+' + (d0.comments - d1.comments) + ' replies today', (d0.comments - d1.comments) >= 0, 'share') +
      '' + '</div>' +
      '<div class="widgets">' + widgets.map(function (w) { return widget(w); }).join('') + '' + '</div>' +
      '<div class="grid cols-2">' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('chart') + 'Daily active users — 14 days' + '</span>' +
      '<div class="spacer"></div><span class="tiny faint">seeded demo series + real local events' + '</span></div>' +
      '<div class="bars">' + dau.map(function (v) { return '<div data-v="' + U.fmt(v) + ' DAU" style="height:' + Math.max(8, v / Math.max.apply(null, dau) * 100) + '%">' + '</div>'; }).join('') + '' + '</div>' +
      U.spark(dau, { label: 'DAU trend' }) + '' + '</div>' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('grid') + 'Category mix' + '</span></div>' +
      U.donut(cats.length ? cats : [{ label: 'None yet', value: 1, color: 'var(--surface-3)' }], String(posts.length), 'stories') +
      '<hr class="divider"><div class="card__head"><span class="card__title">' + U.icon('shield') + 'Lifecycle' + '</span></div>' +
      U.donut(states, String(modCount()), 'flagged') + '' + '</div>' +
      '' + '</div>';
  }
  function kpi(label, value, delta, up, icon) {
    return '<div class="card card--hover"><div class="row row--between"><span class="eyebrow">' + U.icon(icon) + label + '' + '</span></div>' +
      '<div class="stat"><span class="stat__n">' + value + '' + '</span>' +
      '<span class="' + (up ? 'stat__up' : 'stat__down') + '">' + (up ? '▲' : '▼') + ' ' + U.escape(delta) + '' + '</span></div></div>';
  }

  function widget(name) {
    var s = LJ.store;
    var inner = '';
    if (name === 'analytics') {
      var v = series(7, 'votes'), c = series(7, 'comments'), r = series(7, 'retention');
      inner = '<div class="row" style="gap:16px"><div style="flex:1"><div class="tiny faint">votes/24h' + '</div>' + U.spark(v, { label: 'votes' }) + '' + '</div>' +
        '<div style="flex:1"><div class="tiny faint">replies/24h' + '</div>' + U.spark(c, { label: 'comments' }) + '' + '</div>' +
        '<div style="flex:1"><div class="tiny faint">D7 retention' + '</div>' + U.spark(r, { label: 'retention' }) + '' + '</div></div>' +
        '<div class="row row--tight"><span class="pill pill--ok">retention +4.2pt w/w</span><span class="pill">push on: ' + LJ.notify.state().permission + '' + '</span></div>';
    } else if (name === 'trending') {
      inner = LJ.postTools.list({ sort: 'hot' }).slice(0, 5).map(function (p, i) {
        return '<a href="#/story/' + p.id + '" class="row" style="gap:8px;padding:5px 0;color:var(--fg);font-size:12.5px"><b class="mono" style="color:var(--accent)">' + (i + 1) + '' + '</b>' +
          '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.escape(p.title) + '' + '</span>' +
          '<span class="tiny faint">' + U.fmt(LJ.postTools.score(p)) + '' + '</span></a>';
      }).join('') || '<p class="tiny muted">Empty forum. Remarkable.' + '</p>';
    } else if (name === 'moderation') {
      var q = modQueue();
      inner = (q.length ? q.slice(0, 4).map(function (p) {
        return '<div class="row" style="gap:8px;padding:5px 0;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.escape(p.title) + '' + '</span>' +
          '<button class="btn btn--ok btn--sm" data-action="mod-approve" data-post="' + p.id + '">keep' + '</button>' +
          '<button class="btn btn--danger btn--sm" data-action="mod-remove" data-post="' + p.id + '">pull' + '</button></div>';
      }).join('') : '<p class="tiny muted">Queue is empty. Go and cause some trouble.</p>') +
        '<button class="btn btn--ghost btn--sm" data-action="admin-tab" data-tab="moderation">Open moderation →' + '</button>';
    } else if (name === 'sync') {
      var st = LJ.sync.status();
      inner = '<dl class="dl"><dt>Live channel</dt><dd>' + (st.channel ? 'on' : 'off') + '</dd><dt>Network</dt><dd>' + (st.online ? 'online' : '<b style="color:var(--warn)">offline</b>') + '</dd>' +
        '<dt>Queued writes</dt><dd>' + st.pending + '</dd><dt>Peers</dt><dd>' + st.peers.peers.length + ' tab(s)</dd>' +
        '<dt>Last sync</dt><dd>' + U.time(st.lastSync) + '</dd></dl>' +
        '<div class="row"><button class="btn btn--ghost btn--sm" data-action="admin-flush">' + U.icon('cloud') + 'Drain outbox' + '</button>' +
        '<button class="btn btn--ghost btn--sm" data-action="admin-sim-offline">' + U.icon('wifi-off') + 'Simulate offline' + '</button></div>';
    } else if (name === 'reports') {
      inner = s.all('reports').map(function (r) {
        return '<div class="row" style="gap:8px;padding:5px 0;border-top:1px solid var(--line)"><span style="flex:1;min-width:0;font-size:12.5px">' + U.escape(r.name) + '' + '</span>' +
          '<span class="pill ' + (r.on ? 'pill--ok' : '') + '">' + r.cadence + '' + '</span></div>';
      }).join('') + '<button class="btn btn--ghost btn--sm" data-action="admin-tab" data-tab="reports">Manage reports →' + '</button>';
    } else if (name === 'files') {
      var f = s.all('files');
      inner = '<div class="tiny faint">' + f.length + ' items · ' + U.bytes(f.reduce(function (a, x) { return a + x.size; }, 0)) + ' in shared storage' + '</div>' +
        f.slice(0, 4).map(function (x) { return '<div class="row" style="gap:7px;padding:4px 0;font-size:12.5px">' + U.icon('clip') + '<span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + U.escape(x.name) + '</span><span class="tiny faint">' + U.bytes(x.size) + '' + '</span></div>'; }).join('') +
        '<button class="btn btn--ghost btn--sm" data-action="admin-tab" data-tab="files">Open file manager →' + '</button>';
    } else if (name === 'board') {
      var b = s.all('board');
      inner = ['triage', 'doing', 'review', 'shipped'].map(function (c) {
        var n = b.filter(function (x) { return x.col === c; }).length;
        return '<div class="row" style="gap:7px;padding:4px 0"><span style="flex:1" class="tiny">' + c + '</span><div class="meter" style="flex:2"><i style="width:' + (b.length ? n / b.length * 100 : 0) + '%"></i></div><b class="tiny">' + n + '' + '</b></div>';
      }).join('') + '<button class="btn btn--ghost btn--sm" data-action="admin-tab" data-tab="collab">Open board →' + '</button>';
    } else if (name === 'presence') {
      var st2 = LJ.sync.status();
      inner = '<div class="presence">' + U.icon('users') + ' this browser has ' + (st2.peers.tabs || 1) + ' live tab(s)' + '</div>' +
        (st2.peers.peers.length ? st2.peers.peers.map(function (p) {
          return '<div class="row" style="gap:7px;font-size:12.5px;padding:4px 0">' + U.avatar(p.label, 'avatar--sm') + '<span style="flex:1">' + U.escape(p.label) + '</span><span class="tiny faint">' + U.escape(p.route || '') + ' · ' + U.ago(p.at) + '' + '</span></div>';
        }).join('') : '<p class="tiny muted">Open a second tab on this URL to watch the sync channel light up — that is the multi-device demo.</p>');
    }
    return '<section class="widget' + (name === 'analytics' ? ' widget--wide' : '') + '" data-widget="' + name + '" draggable="true">' +
      '<div class="widget__h"><span class="grip">' + U.icon('drag') + '' + '</span>' +
      '<span class="card__title" style="flex:1">' + U.escape(WIDGET_LABEL[name]) + '' + '</span>' +
      '<button class="btn btn--ghost btn--icon" data-action="widget-hide" data-widget="' + name + '" title="Hide widget">' + U.icon('x') + '' + '</button></div>' +
      inner + '</section>';
  }

  /* ══════════════════ content management ══════════════════ */
  function contentPane() {
    var all = LJ.store.all('posts');
    var focus = LJ.store.get('lastmod');
    return '<div class="card card--pad0"><div class="card__head" style="padding:14px 16px 0">' +
      '<span class="card__title">' + U.icon('inbox') + 'Content management</span><div class="spacer">' + '</div>' +
      '<div class="search" style="max-width:280px"><span class="search__ic">' + U.icon('search') + '' + '</span>' +
      '<input class="input" id="cq" placeholder="Filter by title, author, tag">' + '</div>' +
      '<select class="select" id="cstate" style="max-width:150px"><option value="">all states</option><option>open</option><option>queued</option><option>draft</option><option>removed</option></select>' +
      '<button class="btn btn--ghost btn--sm" data-action="export-csv">' + U.icon('download') + 'Export CSV' + '</button></div>' +
      '<div style="overflow:auto"><table class="table" style="min-width:820px"><thead><tr>' +
      ['Story', 'Author', 'Room', 'State', 'Score', 'Outrage', 'Flags', 'Updated', ''].map(function (h) { return '<th>' + h + '</th>'; }).join('') +
      '</tr></thead><tbody id="cbody">' + rows(all) + '</tbody></table>' + '</div></div>';
  }
  function rows(all) {
    var q = (U.$('#cq') || {}).value || '', st = (U.$('#cstate') || {}).value || '';
    var focus = LJ.store.get('lastmod');
    return all.slice().sort(function (a, b) { return LJ.postTools.score(b) - LJ.postTools.score(a); })
      .filter(function (p) {
        if (st && p.status !== st) return false;
        if (q && (p.title + ' ' + (p.author || '') + ' ' + (p.tags || []).join(' ')).toLowerCase().indexOf(q.toLowerCase()) < 0) return false;
        return true;
      }).map(function (p) {
        var cat = (LJ.seed.CATS.filter(function (c) { return c.id === p.category; })[0] || {}).label || p.category;
        return '<tr' + (focus === p.id ? ' style="background:color-mix(in srgb,var(--accent) 10%,transparent)"' : '') + '>' +
          '<td><a href="#/story/' + p.id + '" style="color:var(--fg);font-weight:650">' + U.escape(p.title) + '' + '</a>' +
          (p.pollId ? ' <span class="pill" style="padding:2px 6px">poll</span>' : '') + (p.nsfw ? ' <span class="nsfl">18+</span>' : '') + '</td>' +
          '<td class="tiny">u/' + U.escape(p.author || '') + '</td><td class="tiny">' + U.escape(cat || '') + '</td>' +
          '<td><span class="pill ' + (p.status === 'open' ? 'pill--ok' : p.status === 'removed' ? 'pill--bad' : p.status === 'queued' ? 'pill--warn' : '') + '">' + p.status + '</span></td>' +
          '<td class="n">' + U.fmt(LJ.postTools.score(p)) + '</td>' +
          '<td class="n">' + (p.outrage || 0).toFixed(1) + '</td>' +
          '<td class="n">' + ((p.flags || []).length || '—') + '</td>' +
          '<td class="tiny faint">' + U.ago(p.updated || p.createdAt) + '</td>' +
          '<td class="row row--tight" style="justify-content:flex-end">' +
          '<button class="btn btn--ghost btn--sm" data-action="admin-feature" data-post="' + p.id + '">' + (p.featured ? 'unpin' : 'pin') + '' + '</button>' +
          (p.status === 'removed'
            ? '<button class="btn btn--ok btn--sm" data-action="mod-restore" data-post="' + p.id + '">restore</button>'
            : '<button class="btn btn--danger btn--sm" data-action="mod-remove" data-post="' + p.id + '">remove</button>') +
          '<button class="btn btn--ghost btn--sm" data-action="admin-edit" data-post="' + p.id + '">' + U.icon('edit') + '' + '</button>' +
          '' + '</td></tr>';
      }).join('') || '<tr><td colspan="9"><div class="empty"><div class="empty__t">No rows</div><p>Nothing matches that filter.' + '</p></div></td></tr>';
  }

  /* ══════════════════ moderation ══════════════════ */
  function modQueue() {
    return LJ.store.all('posts').filter(function (p) { return p.status !== 'removed' && ((p.flags || []).length || p.status === 'queued'); })
      .sort(function (a, b) { return ((b.flags || []).length) - ((a.flags || []).length); });
  }
  function modPane() {
    var q = modQueue(), s = LJ.store;
    var log = s.all('notes').filter(function (n) { return n.kind === 'moderation'; });
    return '<div class="grid cols-2">' +
      '<div class="col" style="gap:12px">' + (q.length ? q.map(function (p) {
        var flags = p.flags || [];
        return '<div class="card' + (p.status === 'queued' ? ' card--hot' : '') + '">' +
          '<div class="row row--between" style="margin-bottom:6px">' +
          '<div class="row row--tight">' + U.avatar(p.author, 'avatar--sm') + '<b class="tiny">u/' + U.escape(p.author || '') + '' + '</b>' +
          '<span class="tiny faint">' + U.ago(p.createdAt) + '' + '</span></div>' +
          '<span class="pill ' + (p.status === 'queued' ? 'pill--warn">held for review' : 'pill--bad') + '">' + (p.status === 'queued' ? 'held for review' : flags.length + ' report' + (flags.length > 1 ? 's' : '')) + '' + '</span></div>' +
          '<div class="post__title" style="font-size:17px">' + U.escape(p.title) + '' + '</div>' +
          '<p class="post__body" style="margin-top:6px">' + U.escape(String(p.body || '').slice(0, 300)) + (String(p.body || '').length > 300 ? '…' : '') + '' + '</p>' +
          (flags.length ? '<div class="tiny faint" style="margin-top:8px">reported: ' + flags.map(function (f) { return U.escape(f.why || 'member') + ' (' + U.ago(f.at) + ')'; }).join(' · ') + '</div>' : '') +
          '<div class="row" style="margin-top:11px">' +
          '<button class="btn btn--ok btn--sm" data-action="mod-approve" data-post="' + p.id + '">' + U.icon('check') + 'Keep & publish' + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="mod-edit" data-post="' + p.id + '">' + U.icon('edit') + 'Edit' + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="mod-flag-user" data-post="' + p.id + '">' + U.icon('user') + 'Warn author' + '</button>' +
          '<button class="btn btn--danger btn--sm" data-action="mod-remove" data-post="' + p.id + '">' + U.icon('trash') + 'Remove' + '</button>' +
          '<div class="spacer"></div><a class="btn btn--ghost btn--sm" href="#/story/' + p.id + '">' + U.icon('eye') + 'Thread' + '</a>' +
          '' + '</div></div>';
      }).join('') : '<div class="card empty"><div class="empty__t">Queue clear</div><p>No reports, no held posts. Suspiciously well-behaved forum.</p></div>') + '' + '</div>' +
      '<div class="col" style="gap:12px">' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('flag') + 'Auto-filter rules' + '</span></div>' +
      [['Contact details → hold for human review', true], ['Slurs & threats → refuse on submit', true], ['3+ reports in 24h → auto-hold', true], ['Mean outrage under 3.0 with 40+ ratings → demote from Hot', false], ['Author warned twice → 72h posting cooldown', true]].map(function (r) {
        return '<div class="switchrow"><div style="flex:1"><div class="switchrow__t">' + r[0] + '' + '</div></div>' +
          '<span class="pill ' + (r[1] ? 'pill--ok">on' : '">off') + '' + '</span></div>';
      }).join('') + '<p class="tiny faint" style="margin:8px 0 0">Rules shown here mirror the client-side gate in the composer. Production moves them server-side with an audit trail.' + '</p></div>' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('clock') + 'Action log' + '</span></div>' +
      (log.length ? log.slice(0, 8).map(function (n) {
        return '<div class="row" style="gap:8px;padding:6px 0;border-top:1px solid var(--line);font-size:12.5px">' + U.icon('check') +
          '<span style="flex:1">' + U.escape(n.body || n.title) + '</span><span class="tiny faint">' + U.ago(n.at) + '' + '</span></div>';
      }).join('') : '<p class="tiny muted">Nothing logged yet today.</p>') + '' + '</div></div></div>';
  }

  /* ══════════════════ team board (drag & drop) ══════════════════ */
  var COLS = [{ id: 'triage', label: 'Triage' }, { id: 'doing', label: 'Doing' }, { id: 'review', label: 'In review' }, { id: 'shipped', label: 'Shipped' }];
  function collabPane() {
    var s = LJ.store, board = s.all('board');
    var peers = LJ.sync.status().peers.peers;
    return '<div class="card" style="padding:14px">' +
      '<div class="row row--between" style="margin-bottom:12px">' +
      '<div class="row" style="gap:10px"><span class="card__title">' + U.icon('users') + 'Team board' + '</span>' +
      '<span class="pill pill--live">' + U.icon('zap') + 'live · drag any card' + '</span>' +
      '<div class="avatars">' + ['taz', 'kevsaggy', 'donutman99'].map(function (h) { return U.avatar(h, 'avatar--sm'); }).join('') + '' + '</div>' +
      (peers.length ? '<span class="tiny faint">' + peers.length + ' other tab(s) seeing this now</span>' : '') + '' + '</div>' +
      '<div class="row"><button class="btn btn--ghost btn--sm" data-action="board-add">' + U.icon('plus') + 'Card' + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="board-note">' + U.icon('comment') + 'Post to room' + '</button></div></div>' +
      '<div class="kanban">' + COLS.map(function (c) {
        var items = board.filter(function (x) { return x.col === c.id; });
        return '<div class="kcol" data-col="' + c.id + '" data-action="drop-col">' +
          '<div class="kcol__h">' + U.icon(c.id === 'shipped' ? 'check' : c.id === 'doing' ? 'zap' : 'inbox') + c.label +
          '<span class="spacer"></span><span class="pill" style="padding:2px 7px">' + items.length + '' + '</span></div>' +
          items.map(function (x) {
            return '<div class="kcard" draggable="true" data-card="' + x.id + '">' + U.escape(x.title) +
              '<div class="kcard__meta">' + U.avatar(x.who, 'avatar--sm') + '<span>' + U.escape(x.who) + '' + '</span>' +
              '<span class="pill" style="padding:2px 6px">' + U.escape(x.tag) + '' + '</span>' +
              '<span class="spacer">' + '</span>' +
              '<span class="' + (x.due < U.now() ? 'stat__down' : 'tiny faint') + '">' + (x.due < U.now() ? 'late ' + U.ago(x.due).replace(' ago', '') : U.ago(x.due)) + '' + '</span></div></div>';
          }).join('') + '' + '</div>';
      }).join('') + '' + '</div></div>' +
      '<div class="grid cols-2">' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('chat') + 'Room notes' + '</span></div>' +
      (LJ.store.all('threads').filter(function (t) { return t.kind === 'team'; }).map(function (t) {
        return '<div class="row" style="gap:9px;padding:7px 0;border-top:1px solid var(--line)"><span style="flex:1"><b>' + U.escape(t.title) + '</b> <span class="tiny faint">' + (t.messages || []).length + ' encrypted messages' + '</span></span>' +
          '<a class="btn btn--ghost btn--sm" href="#/chat/' + t.id + '">Open' + '</a></div>';
      }).join('') || '<p class="tiny muted">No team rooms yet.</p>') + '' + '</div>' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('bell') + 'Change feed' + '</span></div>' +
      '<p class="tiny muted">Every board move writes to the ops outbox and broadcasts on the live channel, so a second tab or device sees it within the next beat.' + '</p>' +
      '<div class="row"><span class="pill">' + LJ.store.pendingOps() + ' queued</span><span class="pill">' + LJ.store.all('board').length + ' cards' + '</span>' +
      '<button class="btn btn--ghost btn--sm" data-action="admin-flush">' + U.icon('cloud') + 'Drain now' + '</button></div></div></div>';
  }

  /* ══════════════════ files (drag & drop upload) ══════════════════ */
  function filesPane() {
    var s = LJ.store, files = s.all('files');
    var folder = s.get('lastmod-folder') || 'all';
    var folders = ['all', 'assets', 'reports', 'shared', 'archive'];
    var shown = folder === 'all' ? files : files.filter(function (f) { return f.folder === folder; });
    return '<div class="files">' +
      '<div class="col" style="gap:6px">' +
      '<div class="eyebrow">' + U.icon('folder') + 'Drop a file anywhere in this pane' + '</div>' +
      folders.map(function (f) {
        var n = f === 'all' ? files.length : files.filter(function (x) { return x.folder === f; }).length;
        return '<button class="folder' + (folder === f ? ' is-on' : '') + '" data-action="open-folder" data-folder="' + f + '" data-drop="1">' +
          U.icon('folder') + '<span style="flex:1;text-align:left">' + f + '</span><span class="tiny faint">' + n + '' + '</span></button>';
      }).join('') +
      '<div class="card card--outline" style="margin-top:6px"><div class="tiny faint">' + U.bytes(files.reduce(function (a, x) { return a + x.size; }, 0)) + ' used · encrypted at rest · ' + files.length + ' objects' + '</div></div>' +
      '' + '</div>' +
      '<div class="col" style="gap:10px">' +
      '<div class="dropzone" id="dz" data-drop="1"><b>Drag files here</b> or ' +
      '<label class="btn btn--ghost btn--sm" style="display:inline-flex;margin-left:6px">' + U.icon('upload') + 'browse<input type="file" multiple hidden id="filepick" data-action="file-pick"></label>' +
      '<div class="tiny faint" style="margin-top:6px">Metadata only is recorded in this prototype — no bytes leave the browser.' + '</div></div>' +
      '<div class="card card--pad0"><div class="card__head" style="padding:12px 14px 0"><span class="card__title">' + U.icon('clip') + shown.length + ' items in ' + folder + '' + '</span>' +
      '<div class="spacer"></div><select class="select" id="fsort" style="max-width:170px"><option value="new">newest</option><option value="big">largest</option><option value="name">name</option></select>' + '</div>' +
      '<div style="padding:8px 10px 12px">' + shown.map(function (f) {
        return '<div class="fl" draggable="true" data-file="' + f.id + '">' + U.icon(f.kind === 'image' ? 'image' : f.kind === 'audio' || f.kind === 'video' ? 'zap' : 'clip') +
          '<span class="fl__name">' + U.escape(f.name) + '' + '</span>' +
          '<span class="tiny faint fl__hide">' + U.ago(f.updated) + '' + '</span>' +
          '<span class="tiny faint fl__hide">' + U.bytes(f.size) + ' · ' + U.escape(f.owner) + '' + '</span>' +
          '<span class="row row--tight fl__act" style="justify-content:flex-end">' +
          '<button class="btn btn--ghost btn--sm" data-action="file-share" data-file="' + f.id + '">' + U.icon('share') + '' + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="file-move" data-file="' + f.id + '">' + U.icon('folder') + '' + '</button>' +
          '<button class="btn btn--ghost btn--sm" data-action="file-del" data-file="' + f.id + '">' + U.icon('trash') + '' + '</button></span></div>';
      }).join('') + '' + '</div></div></div></div>';
  }

  /* ══════════════════ reports ══════════════════ */
  function reportsPane() {
    var s = LJ.store, rs = s.all('reports');
    return '<div class="grid cols-2">' +
      '<div class="card card--pad0"><div class="card__head" style="padding:14px 16px 0">' +
      '<span class="card__title">' + U.icon('download') + 'Automated reports</span><div class="spacer">' + '</div>' +
      '<button class="btn btn--ghost btn--sm" data-action="report-new">' + U.icon('plus') + 'Schedule' + '</button></div>' +
      '<div style="padding:10px 12px 14px">' + rs.map(function (r) {
        return '<div class="switchrow"><div style="flex:1"><div class="switchrow__t">' + U.escape(r.name) + '' + '</div>' +
          '<div class="tiny faint">' + r.cadence + ' at ' + r.at + ' → ' + U.escape(r.to) + ' · last run ' + U.ago(r.lastRun) + '' + '</div></div>' +
          '<button class="btn btn--ghost btn--sm" data-action="report-run" data-report="' + r.id + '">' + U.icon('zap') + 'Run now' + '</button>' +
          '<label class="switch"><input type="checkbox" data-action="report-toggle" data-report="' + r.id + '"' + (r.on ? ' checked' : '') + '><b>' + '</b></label></div>';
      }).join('') + '' + '</div></div>' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('chart') + 'Live digest preview' + '</span></div>' +
      '<p class="tiny muted">Generated from the same store the app runs on — nothing is pre-baked into the report.' + '</p>' +
      digestTable() +
      '<div class="row" style="margin-top:12px">' +
      '<button class="btn btn--primary" data-action="export-csv">' + U.icon('download') + 'Export engagement CSV' + '</button>' +
      '<button class="btn btn--ghost" data-action="export-json">' + U.icon('db') + 'Snapshot JSON' + '</button>' +
      '<button class="btn btn--ghost" data-action="report-email">' + U.icon('send') + 'Send to #content-ops' + '</button></div></div></div>';
  }
  function digestTable() {
    var top = LJ.postTools.list({ sort: 'top' }).slice(0, 8);
    return '<table class="table"><thead><tr><th>Story</th><th>Score</th><th>Outrage</th><th>Replies</th></tr></thead><tbody>' +
      top.map(function (p) {
        return '<tr><td style="max-width:260px">' + U.escape(p.title) + '</td><td class="n">' + U.fmt(LJ.postTools.score(p)) + '</td>' +
          '<td class="n">' + (p.outrage || 0).toFixed(1) + '</td><td class="n">' + (p.comments || 0) + '' + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  /* ══════════════════ widget editor ══════════════════ */
  function widgetsPane() {
    var s = LJ.store, order = s.get('widgetOrder') || Object.keys(WIDGET_LABEL);
    return '<div class="grid cols-2">' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('grid') + 'Dashboard widgets' + '</span>' +
      '<div class="spacer"></div><span class="tiny faint">drag to reorder · switches to gate' + '</span></div>' +
      '<p class="tiny muted">This is the modular bit: every widget is a separate renderer that reads only from the store, so you can delete half of them and the dashboard still builds.' + '</p>' +
      '<div class="col" style="gap:6px" id="wlist">' + order.map(function (w) {
        return '<div class="fl" draggable="true" data-widget="' + w + '">' + U.icon('drag') +
          '<span class="fl__name">' + U.escape(WIDGET_LABEL[w] || w) + '' + '</span>' +
          '<span class="tiny faint fl__hide">renderer:' + w + '' + '</span>' +
          '<span class="fl__act row" style="justify-content:flex-end"><label class="switch"><input type="checkbox" data-action="widget-toggle" data-widget="' + w + '"' + (s.setting('widget:' + w, true) ? ' checked' : '') + '><b>' + '</b></label></span></div>';
      }).join('') + '' + '</div></div>' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('eye') + 'Preview' + '</span></div>' +
      '<div class="widgets">' + order.filter(function (w) { return s.setting('widget:' + w, true); }).map(function (w) { return widget(w); }).join('') + '' + '</div></div></div>';
  }

  /* ══════════════════ actions ══════════════════ */
  var A = LJ.router.actions;
  A['admin-tab'] = function (el) { LJ.router.go('/admin/' + el.dataset.tab, el.dataset.focus ? { focus: el.dataset.focus } : null); };
  A['admin-broadcast'] = function () { LJ.sync.simulatePeer(); };
  A['admin-flush'] = function () { LJ.sync.flush(); };
  A['admin-sim-offline'] = function () {
    window.dispatchEvent(new Event('offline'));
    U.toast('Offline simulated', 'Writes now queue in the outbox. Reload the page: still here.', 'warn', 5000);
  };
  A['admin-feature'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    LJ.store.patch('posts', p.id, { featured: !p.featured });
    U.toast(p.featured ? 'Unpinned' : 'Pinned as staff pick', p.title.slice(0, 60), 'ok', 3000);
    repaint();
  };
  A['admin-edit'] = function (el) { A['mod-edit'](el); };
  A['mod-edit'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    var m = U.modal({
      title: 'Edit & publish', icon: 'edit',
      body: '<form id="me" class="col">' +
        '<label class="field"><span class="field__label">Title</span><input class="input" name="title" value="' + U.escape(p.title) + '"></label>' +
        '<label class="field"><span class="field__label">Body</span><textarea class="textarea" name="body">' + U.escape(p.body || '') + '</textarea></label>' +
        '<label class="field"><span class="field__label">State</span><select class="select" name="status">' +
        ['open', 'queued', 'draft', 'removed'].map(function (x) { return '<option' + (x === p.status ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label>' +
        '<div class="tiny faint">Editing counts as a staff action: it is logged and the author is notified.' + '</div>' +
        '<button class="btn btn--primary btn--block" type="submit">Save</button></form>'
    });
    U.$('#me', m.root).addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      LJ.store.patch('posts', p.id, { title: String(fd.get('title')), body: String(fd.get('body')), status: fd.get('status'), editedBy: (LJ.accounts.current() || {}).handle, editedAt: U.now() });
      m.close();
      LJ.notify.add({ kind: 'moderation', title: 'Moderator edited your story', body: '"' + String(p.title).slice(0, 40) + '…" state → ' + fd.get('status'), postId: p.id });
      U.toast('Saved', 'Author notified, edit logged.', 'ok');
      repaint();
    });
  };
  A['mod-approve'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    LJ.store.patch('posts', p.id, { status: 'open', flags: [] });
    LJ.notify.add({ kind: 'moderation', title: 'Your story stayed up', body: '"' + String(p.title).slice(0, 40) + '…" reports dismissed after review.', postId: p.id });
    U.toast('Kept', 'Reports cleared. Everyone else keeps laughing.', 'ok');
    repaint();
  };
  A['mod-remove'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    U.confirm('Remove “' + String(p.title).slice(0, 34) + '…”?', 'It disappears from the forum immediately and the author is told why. Restorable.', function () {
      LJ.store.patch('posts', p.id, { status: 'removed', removedAt: U.now(), removedBy: (LJ.accounts.current() || {}).handle });
      LJ.notify.add({ kind: 'moderation', title: 'Your story was removed', body: 'Reason: outside the house rules. Appeal in your account page.', postId: p.id });
      U.toast('Removed', 'Logged in the action trail.', 'warn');
      repaint();
    }, 'Remove it', 'danger');
  };
  A['mod-restore'] = function (el) {
    LJ.store.patch('posts', el.dataset.post, { status: 'open', removedAt: null });
    U.toast('Restored', 'Back on the wall.', 'ok'); repaint();
  };
  A['mod-flag-user'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post); if (!p) return;
    U.toast('Warning issued', 'u/' + p.author + ' has been warned and the action is logged. Repeat behaviour triggers a 72h cooldown.', 'warn', 5000);
    LJ.notify.add({ kind: 'moderation', title: 'A moderator warned you', body: 'Keep it fictional, keep it kind to strangers.', postId: p.id });
  };
  A['export-csv'] = function () {
    var rows = [['id', 'title', 'author', 'category', 'status', 'votes', 'comments', 'shares', 'ratings', 'outrage', 'flags', 'created']];
    LJ.store.all('posts').forEach(function (p) {
      rows.push([p.id, '"' + String(p.title).replace(/"/g, '""') + '"', p.author, p.category, p.status, p.votes || 0, p.comments || 0, p.shares || 0,
        Object.keys(p.ratings || {}).length, (p.outrage || 0).toFixed(2), (p.flags || []).length, new Date(p.createdAt).toISOString()]);
    });
    var ok = U.download('lad-jokes-engagement-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map(function (r) { return r.join(','); }).join('\n'), 'text/csv');
    if (ok) U.toast('CSV ready', rows.length - 1 + ' rows exported', 'ok', 3400);
  };
  A['export-json'] = function () {
    U.download('lad-jokes-snapshot.json', JSON.stringify(LJ.store.exportAll(), null, 2), 'application/json');
    U.toast('Snapshot downloaded', 'Every collection, as the app holds it.', 'ok', 3600);
  };
  A['report-run'] = function (el) {
    var r = LJ.store.get1('reports', el.dataset.report); if (!r) return;
    LJ.store.patch('reports', r.id, { lastRun: U.now() });
    A['export-csv']();
    U.toast('Report generated', r.name + ' · delivered to ' + r.to, 'ok', 4200);
    LJ.notify.add({ kind: 'system', title: 'Report delivered', body: r.name });
    repaint();
  };
  A['report-toggle'] = function (el) {
    LJ.store.patch('reports', el.dataset.report, { on: !!el.checked });
    U.toast('Scheduling ' + (el.checked ? 'on' : 'off'), el.checked ? 'Runs automatically and files the output.' : 'Manual runs only now.', 'ok', 2600);
  };
  A['report-email'] = function () { U.toast('Digest sent', 'Simulated delivery to #content-ops with the live CSV attached.', 'ok', 3800); };
  A['report-new'] = function () {
    var m = U.modal({
      title: 'Schedule a report', icon: 'download',
      body: '<form id="nr" class="col">' +
        '<label class="field"><span class="field__label">Name</span><input class="input" name="name" placeholder="Monthly outrage review" required></label>' +
        '<div class="row"><label class="field" style="flex:1"><span class="field__label">Cadence</span><select class="select" name="cadence"><option>daily</option><option selected>weekly</option><option>monthly</option></select></label>' +
        '<label class="field" style="flex:1"><span class="field__label">Time</span><input class="input" name="at" type="time" value="09:00"></label>' + '</div>' +
        '<label class="field"><span class="field__label">Deliver to</span><input class="input" name="to" placeholder="#content-ops" value="#content-ops"></label>' +
        '<button class="btn btn--primary btn--block" type="submit">Schedule</button></form>'
    });
    U.$('#nr', m.root).addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      LJ.store.put('reports', { id: U.uid('r'), name: fd.get('name'), cadence: fd.get('cadence'), at: fd.get('at'), to: fd.get('to'), format: 'csv', on: true, lastRun: 0 });
      m.close(); U.toast('Scheduled', 'It will run on the beat and file the output.', 'ok'); repaint();
    });
  };

  A['open-folder'] = function (el) { LJ.store.set('lastmod-folder', el.dataset.folder); repaint(); };
  A['file-del'] = function (el) { LJ.store.remove('files', el.dataset.file); U.toast('Deleted', 'Metadata removed; the object store keeps an audit copy.', 'ok', 2800); repaint(); };
  A['file-share'] = function (el) {
    var f = LJ.store.get1('files', el.dataset.file); if (!f) return;
    U.copy(location.href.split('#')[0] + '#/admin/files?open=' + f.id).then(function () {
      U.toast('Link copied', 'Shareable with signed-in staff only.', 'ok', 3200);
    });
  };
  A['file-move'] = function (el) {
    var f = LJ.store.get1('files', el.dataset.file); if (!f) return;
    var m = U.modal({
      title: 'Move file', icon: 'folder',
      body: '<p class="muted">Where should <b>' + U.escape(f.name) + '</b> live?</p><div class="row">' +
        ['assets', 'reports', 'shared', 'archive'].map(function (x) {
          return '<button class="btn btn--ghost" data-action="file-move-to" data-file="' + f.id + '" data-to="' + x + '">' + x + '' + '</button>';
        }).join('') + '</div>'
    });
    return m;
  };
  A['file-move-to'] = function (el) {
    LJ.store.patch('files', el.dataset.file, { folder: el.dataset.to, updated: U.now() });
    U.closeModal(); U.toast('Moved', 'Now in ' + el.dataset.to + '.', 'ok', 2400); repaint();
  };
  A['file-pick'] = function (el) {
    if (el.tagName !== 'INPUT') return;
    el.onchange = function () { addFiles(Array.prototype.slice.call(el.files || [])); };
  };
  function addFiles(files) {
    if (!files.length) return;
    var folder = LJ.store.get('lastmod-folder') || 'all';
    folder = folder === 'all' ? 'assets' : folder;
    files.forEach(function (f) {
      LJ.store.put('files', {
        id: U.uid('f'), name: f.name, folder: folder,
        kind: /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : /^audio\//.test(f.type) ? 'audio' : 'doc',
        size: f.size, updated: U.now(), owner: (LJ.accounts.current() || {}).handle || 'you'
      });
    });
    U.toast(files.length + ' file' + (files.length > 1 ? 's' : '') + ' added', 'Metadata recorded in ' + folder + '. Prototype keeps bytes on-device.', 'ok', 4000);
    repaint();
  }

  A['widget-hide'] = function (el) { LJ.store.setSetting('widget:' + el.dataset.widget, false); U.toast('Widget hidden', 'Bring it back from the Widgets tab.', 'ok', 2600); repaint(); };
  A['widget-toggle'] = function (el) { LJ.store.setSetting('widget:' + el.dataset.widget, !!el.checked); repaint(); };
  A['board-add'] = function () {
    var m = U.modal({
      title: 'New board card', icon: 'plus',
      body: '<form id="nb" class="col"><label class="field"><span class="field__label">Task</span><input class="input" name="title" placeholder="Ship the offline vote queue" required></label>' +
        '<div class="row"><label class="field" style="flex:1"><span class="field__label">Owner</span><input class="input" name="who" value="taz"></label>' +
        '<label class="field" style="flex:1"><span class="field__label">Column</span><select class="select" name="col"><option>triage</option><option>doing</option><option>review</option><option>shipped</option></select></label>' + '</div>' +
        '<label class="field" style="flex:1"><span class="field__label">Tag</span><input class="input" name="tag" value="product"></label>' +
        '<label class="field"><span class="field__label">Due</span><input class="input" name="due" type="date" value="' + new Date(U.now() + 3 * 86400000).toISOString().slice(0, 10) + '"></label>' +
        '<button class="btn btn--primary btn--block" type="submit">Add card</button></form>'
    });
    U.$('#nb', m.root).addEventListener('submit', function (e) {
      e.preventDefault(); var fd = new FormData(e.target);
      LJ.store.put('board', { id: U.uid('b'), col: fd.get('col'), title: fd.get('title'), who: fd.get('who'), tag: fd.get('tag'), due: new Date(fd.get('due')).getTime(), votes: 0 });
      LJ.store.broadcast({ type: 'board', coll: 'board' });
      m.close(); U.toast('Card added', 'Everyone on the board sees it on the next beat.', 'ok', 3000); repaint();
    });
  };
  A['board-note'] = function () {
    var t = LJ.store.all('threads').filter(function (x) { return x.kind === 'team'; })[0];
    if (!t) return U.toast('No team room', 'Create one in Chat first.', 'warn');
    LJ.router.go('/chat/' + t.id);
  };

  /* ── drag & drop wiring (re-attached after every repaint) ─────────── */
  function wireDnD() {
    var drag = null;
    U.$$('.kcard').forEach(function (c) {
      c.addEventListener('dragstart', function (e) { drag = { t: 'card', id: c.dataset.card }; c.classList.add('is-drag'); try { e.dataTransfer.setData('text/plain', c.dataset.card); } catch (err) {} });
      c.addEventListener('dragend', function () { c.classList.remove('is-drag'); U.$$('.kcol').forEach(function (k) { k.classList.remove('is-over'); }); });
    });
    U.$$('.kcol').forEach(function (col) {
      col.addEventListener('dragover', function (e) { e.preventDefault(); col.classList.add('is-over'); });
      col.addEventListener('dragleave', function () { col.classList.remove('is-over'); });
      col.addEventListener('drop', function (e) {
        e.preventDefault(); col.classList.remove('is-over');
        if (!drag || drag.t !== 'card') return;
        var cur = LJ.store.get1('board', drag.id);
        if (cur && cur.col !== col.dataset.col) {
          LJ.store.patch('board', drag.id, { col: col.dataset.col });
          LJ.store.broadcast({ type: 'board-move', coll: 'board', id: drag.id, col: col.dataset.col });
          U.toast('Moved to ' + col.dataset.col, cur.title.slice(0, 50), 'ok', 2200);
          repaint();
        }
      });
    });
    /* files: OS drop + card-to-folder */
    var host = U.$('#admin-pane');
    var dz = U.$('#dz');
    [dz].concat(U.$$('.folder')).forEach(function (zone) {
      if (!zone) return;
      zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-over'); });
      zone.addEventListener('dragleave', function () { zone.classList.remove('is-over'); });
      zone.addEventListener('drop', function (e) {
        e.preventDefault(); zone.classList.remove('is-over');
        var folder = zone.dataset.folder || LJ.store.get('lastmod-folder') || 'assets';
        if (drag && drag.t === 'file') {
          LJ.store.patch('files', drag.id, { folder: folder === 'all' ? 'assets' : folder, updated: U.now() });
          U.toast('Moved file', 'Now in ' + folder + '.', 'ok', 2400); repaint(); return;
        }
        var fs = e.dataTransfer && e.dataTransfer.files;
        if (fs && fs.length) addFiles(Array.prototype.slice.call(fs));
      });
    });
    U.$$('.fl[draggable]').forEach(function (r) {
      r.addEventListener('dragstart', function (e) { drag = { t: 'file', id: r.dataset.file }; r.classList.add('is-drag'); });
      r.addEventListener('dragend', function () { r.classList.remove('is-drag'); });
    });
    /* widget reorder */
    var wlist = U.$('#wlist'), wdrag = null;
    if (wlist) U.$$('.fl[draggable]', wlist).forEach(function (r) {
      r.addEventListener('dragstart', function () { wdrag = r.dataset.widget; r.classList.add('is-drag'); });
      r.addEventListener('dragend', function () { r.classList.remove('is-drag'); });
      r.addEventListener('dragover', function (e) { e.preventDefault(); r.classList.add('is-over'); });
      r.addEventListener('dragleave', function () { r.classList.remove('is-over'); });
      r.addEventListener('drop', function (e) {
        e.preventDefault(); r.classList.remove('is-over');
        var order = (LJ.store.get('widgetOrder') || []).slice();
        if (!wdrag) return;
        order = order.filter(function (x) { return x !== wdrag; });
        var i = order.indexOf(r.dataset.widget);
        order.splice(i < 0 ? order.length : i, 0, wdrag);
        LJ.store.set('widgetOrder', order);
        U.toast('Order saved', 'Dashboard rebuilt from the new order.', 'ok', 2400);
        repaint();
      });
    });
    U.$$('.widget[draggable]').forEach(function (w) {
      w.addEventListener('dragstart', function (e) { wdrag = w.dataset.widget; w.classList.add('is-drag'); });
      w.addEventListener('dragend', function () { w.classList.remove('is-drag'); U.$$('.widget').forEach(function (x) { x.classList.remove('is-over'); }); });
      w.addEventListener('dragover', function (e) { e.preventDefault(); w.classList.add('is-over'); });
      w.addEventListener('dragleave', function () { w.classList.remove('is-over'); });
      w.addEventListener('drop', function (e) {
        e.preventDefault(); w.classList.remove('is-over');
        if (!wdrag || wdrag === w.dataset.widget) return;
        var order = (LJ.store.get('widgetOrder') || Object.keys(WIDGET_LABEL)).slice();
        order = order.filter(function (x) { return x !== wdrag; });
        var i = order.indexOf(w.dataset.widget);
        order.splice(i < 0 ? order.length : i, 0, wdrag);
        LJ.store.set('widgetOrder', order);
        repaint();
      });
    });
    var fsort = U.$('#fsort'); if (fsort) fsort.onchange = function () {
      var k = fsort.value, files = LJ.store.all('files');
      files.sort(function (a, b) { return k === 'big' ? b.size - a.size : k === 'name' ? a.name.localeCompare(b.name) : b.updated - a.updated; });
      LJ.store.set('files', files); repaint();
    };
    var cq = U.$('#cq'); if (cq) cq.oninput = U.debounce(function () { var b = U.$('#cbody'); if (b) b.innerHTML = rows(LJ.store.all('posts')); }, 200);
    var cs = U.$('#cstate'); if (cs) cs.onchange = function () { var b = U.$('#cbody'); if (b) b.innerHTML = rows(LJ.store.all('posts')); };
  }

  function repaint() {
    if (LJ.router.path.indexOf('/admin') !== 0) return;
    var host = U.$('#admin-pane'); if (!host) return;
    host.innerHTML = pane(tab({ tab: (LJ.router.path.split('/')[2] || 'overview') }));
    wireDnD();
  }

  LJ.adminView = {
    register: function () {
      var r = { path: '/admin', title: 'Back room', admin: true, render: render, enter: function () { wireDnD(); } };
      LJ.router.add(r);
      LJ.router.add({ path: '/admin/:tab', title: 'Back room', admin: true, render: render, enter: function () { wireDnD(); } });
      if (!('draggable' in document.createElement('div'))) U.toast('Heads up', 'This browser frame blocks HTML5 drag-and-drop; every drag action also has a button.', 'warn', 5000);
    }
  };
})();
