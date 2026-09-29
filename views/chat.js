/* ═══════════════════════════════════════════════════════════════════════
   views/chat.js — encrypted rooms and DMs. Ciphertext is what gets stored;
   plaintext lives only in an in-memory cache while the session key exists.
   Includes a "read the raw ciphertext" inspector so the claim is checkable.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  function threads() { return LJ.store.all('threads'); }
  function unread(t) { return LJ.store.setting('unread:' + t.id, 0); }

  function render(params) {
    var list = threads();
    var active = params.id ? LJ.store.get1('threads', params.id) : list[0];
    var user = LJ.accounts.current();
    return '<div class="col" style="gap:14px">' +
      '<div class="row row--between">' +
      '<div><span class="eyebrow">' + U.icon('lock') + ' Encrypted rooms' + '</span>' +
      '<h1 class="display h-lg">Banter, sealed</h1>' + '</div>' +
      '<div class="row">' +
      '<span class="pill pill--ok">' + U.icon('key') + LJ.crypto.algorithm.split(' · ')[0] + '' + '</span>' +
      (user ? '' : '<span class="pill pill--warn">sign in to read</span>') +
      '<button class="btn btn--ghost" data-action="new-thread">' + U.icon('plus') + 'New room' + '</button>' +
      '' + '</div></div>' +
      '<div class="banner">' + U.icon('shield') + '<div>Messages are stored encrypted at rest with a session key derived from your passphrase and a device salt. ' +
      'The key is destroyed on sign-out, so a stolen database dump is ciphertext. <b>Prototype-grade</b>: production needs per-user keypairs, server-side delivery, and recovery you can actually use.' + '</div></div>' +
      '<div class="chat" data-pane="' + (params.id ? 'thread' : 'list') + '">' +
      '<div class="chat__list">' + list.map(function (t) {
        var last = (t.messages || [])[t.messages.length - 1];
        var n = unread(t);
        return '<button class="chat__who' + (active && active.id === t.id ? ' is-on' : '') + '" data-action="open-thread" data-thread="' + t.id + '">' +
          U.avatar(t.title, '') + '<div style="flex:1;min-width:0;text-align:left">' +
          '<div class="row row--tight"><b style="font-size:13.5px">' + U.escape(t.title) + '' + '</b>' +
          (t.kind === 'team' ? '<span class="pill" style="padding:2px 6px">team</span>' : t.kind === 'room' ? '<span class="pill" style="padding:2px 6px">room</span>' : '') +
          '</div><div class="tiny faint" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
          (last ? U.ago(last.at) + ' · sealed payload' : 'nothing yet') + '' + '</div></div>' +
          (n ? '<span class="nav__badge">' + n + '</span>' : '') + '' + '</button>';
      }).join('') + '' + '</div>' +
      (active ? pane(active) : '<div class="chat__body"><div class="empty"><div class="empty__t">Pick a room</div><p>Four are open, none are polite.</p></div></div>') +
      '' + '</div></div>';
  }

  function pane(t) {
    var user = LJ.accounts.current();
    var msgs = (t.messages || []).map(function (m) { return msg(t, m, user); });
    return '<div class="chat__body">' +
      '<div class="row row--between" style="padding:12px 14px;border-bottom:1px solid var(--line)">' +
      '<div class="row" style="gap:10px"><button class="btn btn--ghost btn--icon" data-action="back-list" title="Rooms">' + U.icon('back') + '' + '</button>' +
      '<div><b>' + U.escape(t.title) + '</b><div class="tiny faint">' + t.members.length + ' members · ' + U.presenceDot(true) + ' ' + Math.max(1, Math.round(t.members.length * 0.6)) + ' online' + '</div></div></div>' +
      '<div class="row"><button class="btn btn--ghost btn--sm" data-action="cipher-peek" data-thread="' + t.id + '">' + U.icon('db') + 'Raw ciphertext' + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="share-room" data-thread="' + t.id + '">' + U.icon('share') + 'Invite' + '</button></div></div>' +
      '<div class="chat__scroll" id="scroll">' + msgs.join('') + '' + '</div>' +
      '<div class="typing" id="typing">' + '</div>' +
      (user ? '<form class="chat__form" data-action="send-form" data-thread="' + t.id + '">' +
        '<input class="input" name="text" placeholder="Say something you will regret in the morning" maxlength="900" autocomplete="off">' +
        '<button class="btn btn--primary" type="submit" title="Encrypt and send">' + U.icon('send') + '</button></form>'
        : '<div class="chat__form"><p class="tiny muted" style="margin:0">Sign in to encrypt a message to this room.</p><div class="spacer"></div><button class="btn btn--primary btn--sm" data-action="modal-auth">' + U.icon('lock') + 'Sign in</button></div>') +
      '' + '</div>';
  }

  function msg(t, m, user) {
    var me = user && (m.from === user.handle);
    var text = LJ.accounts.decryptNow(m, t.id);
    var label = m.from === 'anon' ? 'anonymous' : (m.from || 'unknown');
    return '<div class="msg' + (me ? ' msg--me' : '') + '">' +
      '<div class="msg__meta">' + U.avatar(label, 'avatar--sm') + '<b>' + U.escape(label) + '</b><span>' + U.time(m.at) + '' + '</span>' +
      '<span class="msg__lock">' + U.icon('lock') + (m.env && m.env.alg === 'AES-GCM-128' ? 'AES-GCM' : 'sealed') + '' + '</span></div>' +
      (text ? U.escape(text) : '<span class="muted">🔒 Locked — ' + (user ? 'decrypting…' : 'sign in to decrypt this payload') + '</span>') +
      '<div class="row row--tight" style="margin-top:8px">' +
      ['🔥', '😂', '💀'].map(function (e) {
        var n = (m.reactions || {})[e] || 0;
        return '<button class="pill" data-action="react" data-thread="' + t.id + '" data-msg="' + m.id + '" data-e="' + e + '" style="padding:3px 8px;cursor:pointer">' + e + ' ' + n + '' + '</button>';
      }).join('') + '' + '</div></div>';
  }

  /* ── actions ──────────────────────────────────────────────────────── */
  var A = LJ.router.actions;
  A['open-thread'] = function (el) { LJ.router.go('/chat/' + el.dataset.thread); };
  A['back-list'] = function () { LJ.router.go('/chat'); };
  A['modal-auth'] = function () { LJ.modalAuth(); };
  A['send-form'] = function (el) {
    if (el.__ljRun) return;              // click+submit both land in one task; run once
    el.__ljRun = 1; setTimeout(function () { el.__ljRun = 0; }, 0);

    var text = (U.$('input[name="text"]', el).value || '').trim();
    if (!text) return;
    var user = LJ.accounts.require('send messages'); if (!user) return;
    var t = LJ.store.get1('threads', el.dataset.thread); if (!t) return;
    LJ.accounts.encryptMessage(t.id, text).then(function (env) {
      var m = { id: U.uid('m'), from: user.handle, at: U.now(), env: env, alg: env.alg, reactions: {} };
      LJ.crypto.cachePut(m.id, text);
      LJ.store.patch('threads', t.id, { messages: (t.messages || []).concat([m]) });
      LJ.store.broadcast({ type: 'chat', coll: 'threads', id: t.id });
      U.$('input[name="text"]', el).value = '';
      repaint(t.id);
      setTimeout(function () { autoReply(t.id, user); }, 1200 + Math.random() * 1600);
    });
  };
  A['react'] = function (el) {
    var t = LJ.store.get1('threads', el.dataset.thread); if (!t) return;
    LJ.store.patch('threads', t.id, {
      messages: (t.messages || []).map(function (m) {
        if (m.id !== el.dataset.msg) return m;
        var r = Object.assign({}, m.reactions || {});
        r[el.dataset.e] = (r[el.dataset.e] || 0) + 1;
        return Object.assign({}, m, { reactions: r });
      })
    });
    repaint(t.id);
  };
  A['cipher-peek'] = function (el) {
    var t = LJ.store.get1('threads', el.dataset.thread); if (!t) return;
    var rows = (t.messages || []).slice(-4).map(function (m) {
      return '<div style="margin-bottom:10px"><div class="tiny faint">' + U.escape(m.from) + ' · ' + U.time(m.at) + ' · ' + (m.env.alg || 'xor-demo') + ' · iv ' + (m.env.iv ? m.env.iv.slice(0, 12) + '…' : '—') + '' + '</div>' +
        '<div class="code">' + U.escape(String(m.env.c || '').slice(0, 220)) + (m.env.c && m.env.c.length > 220 ? '…' : '') + '' + '</div></div>';
    }).join('');
    U.modal({
      title: 'What is actually on disk', icon: 'db',
      body: '<p class="muted">This is the stored record for the last few messages in <b>' + U.escape(t.title) + '</b>. No plaintext, no names attached to keys — only the encrypted envelope and its IV.' + '</p>' + rows +
        '<div class="banner banner--info">' + U.icon('zap') + '<div>Clearing the in-memory cache and signing out makes these bytes permanently unreadable for this prototype. Try it: <b>Sign out</b>, reload, and the history stays locked.</div></div>'
    });
  };
  A['share-room'] = function (el) {
    var t = LJ.store.get1('threads', el.dataset.thread); if (!t) return;
    U.copy(location.href.split('#')[0] + '#/chat/' + t.id);
    U.toast('Invite link copied', 'Anyone with the link still needs a member account to read it.', 'ok', 4000);
  };
  A['new-thread'] = function () {
    var user = LJ.accounts.require('create a room'); if (!user) return;
    var m = U.modal({
      title: 'New encrypted room', icon: 'lock',
      body: '<form id="nt" class="col">' +
        '<label class="field"><span class="field__label">Room name</span><input class="input" name="title" maxlength="40" placeholder="Mums, Wives and Consequences" required></label>' +
        '<label class="field"><span class="field__label">Members (comma separated)</span><input class="input" name="members" value="kevsaggy, gazza_t, donutman99"></label>' +
        '<label class="check"><input type="checkbox" name="team"> Team-only room (shows in the admin board too)</label>' +
        '<button class="btn btn--primary btn--block" type="submit">Open it</button></form>'
    });
    U.$('#nt', m.root).addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(e.target);
      var t = {
        id: U.uid('t'), kind: fd.get('team') === 'on' ? 'team' : 'room', title: String(fd.get('title')).trim(),
        blurb: 'New room. Nothing stored in plaintext.', members: [user.handle].concat(String(fd.get('members') || '').split(',').map(function (x) { return x.trim().replace(/^@?u\//, ''); }).filter(Boolean)),
        createdAt: U.now(), messages: []
      };
      LJ.store.put('threads', t);
      m.close();
      U.toast('Room open', 'Encrypted from the first byte.', 'ok');
      LJ.router.go('/chat/' + t.id);
    });
  };

  var REPLIES = [
    'noted. putting that in the group chat and ruining your week.',
    'the way you type says you have not slept since 2019.',
    'i am screenshotting this like it is evidence in a trial.',
    'bold of you to assume i would not read that out loud.',
    'ok but has anyone considered that the sauna story was always about all of us.'
  ];
  function autoReply(threadId, user) {
    var t = LJ.store.get1('threads', threadId); if (!t) return;
    var pool = t.members.filter(function (h) { return h !== user.handle; });
    if (!pool.length) return;
    var who = pool[Math.floor(Math.random() * pool.length)];
    var text = REPLIES[Math.floor(Math.random() * REPLIES.length)];
    LJ.accounts.encryptMessage(t.id, text).then(function (env) {
      var m = { id: U.uid('m'), from: who, at: U.now(), env: env, alg: env.alg, reactions: {} };
      LJ.crypto.cachePut(m.id, text);
      var t2 = LJ.store.get1('threads', threadId);
      LJ.store.patch('threads', threadId, { messages: (t2.messages || []).concat([m]) });
      if (LJ.router.path.indexOf('/chat') !== 0) LJ.store.setSetting('unread:' + threadId, unread(t2) + 1);
      LJ.notify.newDmAlert(who, text, threadId);
      if (LJ.router.path.indexOf('/chat') === 0) repaint(threadId);
    });
  }

  function repaint(threadId) {
    if (LJ.router.path.indexOf('/chat') !== 0) return;
    var host = U.$('#view'); if (!host) return;
    host.innerHTML = render({ id: threadId });
    var s = U.$('#scroll'); if (s) s.scrollTop = s.scrollHeight;
  }

  LJ.chatView = {
    register: function () {
      LJ.router.add({ path: '/chat', title: 'Rooms', auth: true, render: render, enter: function () { after(); } });
      LJ.router.add({ path: '/chat/:id', title: 'Room', auth: true, render: render, enter: function () { after(); } });
    }
  };
  function after() {
    var s = U.$('#scroll'); if (s) s.scrollTop = s.scrollHeight;
    var f = U.$('[data-action="send-form"]');
    if (f) f.addEventListener('submit', function (e) { e.preventDefault(); A['send-form'](f, e); });
    if (LJ.router.params.id) {
      var t = LJ.store.get1('threads', LJ.router.params.id);
      if (t) { LJ.store.setSetting('unread:' + t.id, 0); LJ.notify.markRead(); }
    }
    /* typing indicator theatre */
    var ty = U.$('#typing');
    if (ty && Math.random() < 0.6) {
      ty.innerHTML = '<i></i><i></i><i></i> someone is typing something worse';
      setTimeout(function () { if (ty.parentNode) ty.innerHTML = ''; }, 3400);
    }
  }
})();
