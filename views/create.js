/* ═══════════════════════════════════════════════════════════════════════
   views/create.js — the confessional. Compose a story, optionally attach a
   poll, live preview, autosaving draft, and the pre-publish content gate
   (contact details → queue; slurs → refusal).
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  var BANNED = [/\b(fag(got)?|nigger|coon|kike|tranny|retard(ed)?)\b/i, /\bdying\b.*\byou\b/i, /\bi.?ll.?k.?ll.? ?you\b/i];
  var CONTACT = [/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, /[\w.+-]+@[\w-]+\.[\w.-]{2,}/i, /\bhttps?:\/\/\S+/i, /\b(apt|flat)\s?\d+\b/i, /\b\d{1,4}\s[A-Z][a-z]+\s?(street|rd|road|ave|lane|ln)\b/i];

  function scan(text) {
    var hard = BANNED.some(function (r) { return r.test(text); });
    var soft = CONTACT.filter(function (r) { return r.test(text); }).length;
    return { hard: hard, soft: soft };
  }
  function quality(text) {
    var w = String(text).trim().split(/\s+/).filter(Boolean).length;
    var paras = String(text).split(/\n{2,}/).filter(function (p) { return p.trim().length > 20; }).length;
    var score = U.clamp(Math.round(20 + w * 0.35 + paras * 12), 0, 100);
    return { words: w, paras: paras, score: score, verdict: score > 78 ? 'Broadcast quality. Ridiculous.' : score > 55 ? 'Solid. The lads will laugh.' : score > 30 ? 'Thin. Add the detail you left out.' : 'This is a tweet, not a story.' };
  }

  function render(params, query) {
    var user = LJ.accounts.current();
    if (!user) { setTimeout(function () { LJ.modalAuth(); }, 120); }
    var d = LJ.store.get('drafts', {})[user ? user.id : 'guest'] || {};
    var attachPoll = query && query.poll ? LJ.store.get1('polls', query.poll) : null;

    return '<div class="wrap-narrow"><div class="col" style="gap:14px">' +
      '<div class="row row--between">' +
      '<div><span class="eyebrow">' + U.icon('edit') + 'The confessional' + '</span>' +
      '<h1 class="display h-lg">Tell it properly<br>this time</h1>' + '</div>' +
      '<a class="btn btn--ghost" href="#/feed">' + U.icon('x') + 'Cancel' + '</a></div>' +

      '<form id="composer" class="grid cols-2" style="align-items:start">' +
      '<div class="col" style="gap:12px">' +
      '<label class="field"><span class="field__label">Headline — the bit people read first' + '</span>' +
      '<input class="input" name="title" maxlength="120" placeholder="e.g. I invented a band to win a pub quiz crate" value="' + U.escape(d.title || '') + '" required></label>' +

      '<div class="row" style="gap:10px">' +
      '<label class="field" style="flex:1"><span class="field__label">Room</span><select class="select" name="category">' +
      LJ.seed.CATS.map(function (c) { return '<option value="' + c.id + '"' + (d.category === c.id ? ' selected' : '') + '>' + c.label + ' — ' + c.blurb + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field" style="flex:1"><span class="field__label">Tags (comma separated)' + '</span>' +
      '<input class="input" name="tags" maxlength="80" placeholder="sauna, jet ski, consequences" value="' + U.escape(d.tags || '') + '"></label>' +
      '' + '</div>' +

      '<label class="field"><span class="field__label">The story' + '</span>' +
      '<textarea class="textarea" name="body" maxlength="5000" placeholder="Set the scene, commit to the mistake, then land it. Nobody remembers a story that ends with &quot;anyway&quot;."' +
      ' style="min-height:260px">' + U.escape(d.body || '') + '</textarea></label>' +
      '<div class="row" style="gap:10px;align-items:center">' +
      '<div class="meter" style="flex:1"><i id="q-bar" style="width:0%"></i>' + '</div>' +
      '<span class="tiny faint" id="q-txt">0 words' + '</span></div>' +

      '<div class="row" style="gap:16px">' +
      '<label class="check"><input type="checkbox" name="nsfw"' + (d.nsfw ? ' checked' : '') + '> Flag as 18+ / NSFW</label>' +
      '<label class="check"><input type="checkbox" name="attach"' + (attachPoll ? ' checked disabled' : '') + '> Attach my poll' + (attachPoll ? ' ("' + U.escape(attachPoll.question.slice(0, 40)) + '…")' : '') + '</label>' +
      '<label class="check"><input type="checkbox" name="draft"> Save as draft only</label>' +
      '' + '</div>' +

      '<div class="row row--between" style="margin-top:4px">' +
      '<span class="tiny faint" id="save-note">draft autosaves every few keystrokes' + '</span>' +
      '<div class="row"><button class="btn btn--ghost" type="button" data-action="clear-draft">' + U.icon('trash') + 'Clear' + '</button>' +
      '<button class="btn btn--primary btn--lg" type="submit">' + U.icon('zap') + 'Publish to the forum' + '</button></div>' +
      '' + '</div>' +
      '' + '</div>' +

      '<div class="col" style="gap:12px">' +
      '<div class="card"><div class="card__head"><span class="card__title">' + U.icon('eye') + 'Live preview' + '</span></div>' +
      '<div id="preview">' + '</div></div>' +
      '<div class="card card--outline"><div class="card__head"><span class="card__title">' + U.icon('shield') + 'What gets rejected' + '</span></div>' +
      '<ul class="tiny muted" style="padding-left:16px;margin:0;display:flex;flex-direction:column;gap:6px">' +
      '<li>Anything with a phone number, email, link, address or workplace — that gets held for a moderator instead of published.</li>' +
      '<li>Slurs and threats: refused on the spot, no debate, no second chance.</li>' +
      '<li>Real people you have not named permission from. If you can point at them in a photo, rewrite it.</li>' +
      '<li>Anything about someone under 18. Ever. In any tone.</li></ul>' +
      '<p class="tiny faint" style="margin:10px 0 0">Filters are client-side in this prototype. Production: server-side classifier, human review queue, audit log.' + '</p></div>' +
      '</div></form>' + '</div></div>';
  }

  function preview() {
    var f = U.$('#composer'); if (!f) return;
    var fd = new FormData(f);
    var body = String(fd.get('body') || '');
    var q = quality(body);
    var bar = U.$('#q-bar'), txt = U.$('#q-txt');
    if (bar) bar.style.width = q.score + '%';
    if (txt) txt.textContent = q.words + ' words · ' + q.paras + ' paras · ' + q.verdict;
    var host = U.$('#preview');
    var user = LJ.accounts.current() || { handle: 'guest' };
    if (host) {
      host.innerHTML = LJ.postTools.card({
        id: 'preview', title: String(fd.get('title') || 'Your headline lands here'), body: body || 'Nothing yet. The blank page always wins first.',
        category: fd.get('category'), tags: String(fd.get('tags') || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        author: user.handle, authorName: user.name, createdAt: U.now(), votes: 0, comments: 0, shares: 0,
        ratings: {}, nsfw: fd.get('nsfw') === 'on', status: 'open'
      }, { link: false });
      U.$$('[data-action]', host).forEach(function (b) { b.setAttribute('data-action', 'noop-preview'); });
    }
  }
  LJ.router.action('noop-preview', function () { U.toast('That is a preview', 'It only goes live when you hit publish.', 'info', 2200); });

  function saveDraft() {
    var f = U.$('#composer'); if (!f) return;
    var fd = new FormData(f);
    var user = LJ.accounts.current() || { id: 'guest' };
    var drafts = LJ.store.get('drafts', {});
    drafts[user.id] = { title: fd.get('title'), body: fd.get('body'), category: fd.get('category'), tags: fd.get('tags'), nsfw: fd.get('nsfw') === 'on', at: U.now() };
    LJ.store.set('drafts', drafts);
    var note = U.$('#save-note');
    if (note) note.innerHTML = '<span style="color:var(--ok)">saved locally ' + new Date().toLocaleTimeString('en-GB') + '</span> · survives a reload, offline included';
  }

  var A = LJ.router.actions;
  A['clear-draft'] = function () {
    var user = LJ.accounts.current() || { id: 'guest' };
    var drafts = LJ.store.get('drafts', {});
    delete drafts[user.id];
    LJ.store.set('drafts', drafts);
    var f = U.$('#composer'); if (f) f.reset();
    preview();
    U.toast('Cleared', 'Draft gone. Maybe that is the funniest part.', 'ok', 2600);
  };

  function mount(host) {
    var f = U.$('#composer', host); if (!f) return;
    f.addEventListener('input', U.debounce(function () { preview(); saveDraft(); }, 260));
    preview();
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var user = LJ.accounts.require('post'); if (!user) return;
      var fd = new FormData(f);
      var title = String(fd.get('title') || '').trim();
      var body = String(fd.get('body') || '').trim();
      if (title.length < 12) return U.toast('Headline too short', 'Give us at least a sentence worth arguing with.', 'bad');
      if (body.split(/\s+/).length < 25) return U.toast('Not enough story', 'Twenty-five words minimum. This is a forum, not a fortune cookie.', 'bad');

      var risk = scan(title + '\n' + body);
      var doPublish = function (status) {
        var pollId = fd.get('attach') === 'on' && LJ.router.query.poll ? LJ.router.query.poll : null;
        var p = {
          id: U.uid('s'), type: pollId ? 'poll' : 'story', title: title, body: body,
          category: fd.get('category'), tags: String(fd.get('tags') || '').split(',').map(function (t) { return t.trim().replace(/^#/, ''); }).filter(Boolean).slice(0, 5),
          authorId: user.id, author: user.handle, authorName: user.name,
          createdAt: U.now(), votes: 1, views: 1, comments: 0, shares: 0, ratings: {}, myVote: 1,
          flags: [], status: status, nsfw: fd.get('nsfw') === 'on', pollId: pollId, outrage: 0, featured: false
        };
        LJ.store.put('posts', p);
        if (pollId) LJ.store.patch('polls', pollId, { postId: p.id });
        if (!fd.get('draft')) { var dd = LJ.store.get('drafts', {}); delete dd[user.id]; LJ.store.set('drafts', dd); }
        U.toast(status === 'queued' ? 'Held for review' : 'Published',
          status === 'queued' ? 'A moderator clears it. It is not public yet, and it is not a punishment — that was a phone number.' : 'Live. Blame the browser.',
          status === 'queued' ? 'warn' : 'ok', 5200);
        LJ.notify.add({ kind: 'system', title: status === 'queued' ? 'Submission queued' : 'Your story went live', body: title.slice(0, 60), postId: p.id });
        LJ.store.broadcast({ type: 'post:new', coll: 'posts', id: p.id });
        LJ.router.go('/story/' + p.id);
      };

      if (risk.hard) {
        U.modal({
          title: 'We are not publishing that', icon: 'flag',
          body: '<p class="muted">This reads as a slur or a threat, not a joke. The room is rude; it is not a place for that. Cut it and the rest of the story usually lands harder anyway.' + '</p>' +
            '<div class="banner banner--bad">' + U.icon('shield') + '<div>Refused client-side in this prototype. In production this is a server-side classifier plus a human review queue and an audit log.</div></div>',
          foot: '<button class="btn btn--primary" data-action="modal-close">Take it back and rewrite</button>'
        });
        return;
      }
      if (risk.soft) {
        U.confirm('Hold for a moderator?', 'It looks like you pasted contact details or an address (' + risk.soft + ' match' + (risk.soft > 1 ? 'es' : '') + '). We can queue it for review instead of publishing it to the whole site.',
          function () { doPublish('queued'); }, 'Queue it', 'danger');
        return;
      }
      doPublish(fd.get('draft') ? 'draft' : 'open');
    });
  }

  LJ.createView = {
    register: function () {
      LJ.router.add({ path: '/create', title: 'Post a story', auth: true, render: render, enter: mount });
    }
  };
})();
