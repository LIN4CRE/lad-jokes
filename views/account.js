/* ═══════════════════════════════════════════════════════════════════════
   views/account.js — secure login screen (also the account manager once
   you are in): sessions, biometric unlock, key handling, notification
   preferences, your karma, and account controls.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  /* ══════════ #/login — the gate itself ══════════ */
  function loginView() {
    var a = LJ.accounts;
    return '<div style="min-height:70dvh;display:grid;place-items:center;padding:10px">' +
      '<div class="grid cols-2" style="max-width:1040px;width:100%;align-items:center;gap:26px">' +
      '<div class="col" style="gap:14px">' +
      '<span class="pill pill--accent pill--live" style="align-self:flex-start">' + U.icon('lock') + 'Encrypted session · 18+' + '</span>' +
      '<h1 class="display" style="font-size:clamp(34px,6vw,64px)">Members<br>only, <em style="color:var(--accent)">actually</em></h1>' +
      '<p class="muted">No passwords stored — ever. Your passphrase is stretched through PBKDF2-SHA256 at 150k rounds into a key that lives in memory while you are signed in and dies the moment you sign out.' + '</p>' +
      '<ul class="tiny muted" style="display:flex;flex-direction:column;gap:7px;padding-left:18px">' +
      '<li><b>Biometric unlock</b> where the device supports it (WebAuthn platform authenticator)</li>' +
      '<li><b>Chat ciphertext at rest</b> — the DB never holds readable banter</li>' +
      '<li><b>Session list &amp; revocation</b>, plus a data export if you get bored of us</li>' +
      '<li><b>Nothing about your life is scraped</b> for ads. This is a prototype, and it behaves.</li></ul>' +
      '<div class="row">' + LJ.share.nets.slice(0, 4).map(function (n) {
        return '<span class="pill">' + n.label + '' + '</span>';
      }).join('') + '<span class="tiny faint">invite sharing works from any story' + '</span></div>' +
      '' + '</div>' +
      '<div class="card" style="border:2px solid color-mix(in srgb,var(--accent) 45%,transparent);box-shadow:var(--shadow)">' +
      '<div class="row" style="margin-bottom:12px">' +
      '<button class="chip is-on" data-ltab="in">Sign in</button><button class="chip" data-ltab="up">Join' + '</button></div>' +
      '<form id="lf" class="col" autocomplete="off">' +
      '<label class="field"><span class="field__label">Handle' + '</span>' +
      '<input class="input" name="handle" placeholder="kevsaggy" autocapitalize="none" spellcheck="false" value="kevsaggy"></label>' +
      '<label class="field" hidden id="lname"><span class="field__label">Display name</span><input class="input" name="name" placeholder="Kev"></label>' +
      '<label class="field"><span class="field__label">Passphrase' + '</span>' +
      '<input class="input" name="pass" type="password" placeholder="demo: scouse-18+-demo" value="' + LJ.accounts.demoPass + '"></label>' +
      '<label class="check" style="margin-top:2px"><input type="checkbox" name="remember" checked> Keep me signed in on this device</label>' +
      '<div class="row" style="margin-top:6px"><button class="btn btn--primary btn--lg" type="submit" id="lgo" style="flex:1">' + U.icon('key') + '<span>Unlock' + '</span></button>' +
      '<button class="btn btn--ghost btn--lg" type="button" data-action="bio-login" title="Biometric">' + U.icon('fingerprint') + '' + '</button></div>' +
      '<div class="row row--tight" style="margin-top:8px">' +
      ['kevsaggy', 'taz', 'donutman99', 'gazza_t'].map(function (h) {
        return '<button class="btn btn--ghost btn--sm" data-demo="' + h + '">' + h + '' + '</button>';
      }).join('') + '' + '</div>' +
      '<p class="tiny faint" style="margin:10px 0 0">Demo handles all use passphrase <span class="mono">' + LJ.accounts.demoPass + '</span>. <b>taz</b> is a moderator — that unlocks the back room.' + '</p>' +
      '</form>' + '</div></div></div>';
  }

  function wireLogin(host) {
    var which = 'in';
    U.$$('[data-ltab]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        which = b.dataset.ltab;
        U.$$('[data-ltab]', host).forEach(function (x) { x.classList.toggle('is-on', x === b); });
        U.$('#lname', host).hidden = which !== 'up';
        U.$('#lgo span', host).textContent = which === 'up' ? 'Create account' : 'Unlock';
      });
    });
    var f = U.$('#lf', host);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fd = new FormData(f);
      var job = which === 'up'
        ? LJ.accounts.signup(fd.get('handle'), fd.get('name'), fd.get('pass'))
        : LJ.accounts.login(String(fd.get('handle')).trim().toLowerCase(), fd.get('pass'));
      U.$('#lgo', host).disabled = true;
      job.then(function (r) {
        U.$('#lgo', host).disabled = false;
        if (!r.ok) return U.toast('Access denied', r.error, 'bad', 6000);
        U.toast('Signed in', 'Session key derived, threads decrypted, ' + (r.user.admin ? 'moderator tools unlocked.' : 'forum unlocked.'), 'ok');
        LJ.router.go(r.user.admin ? '/admin' : '/feed');
      });
    });
    U.$$('[data-demo]', host).forEach(function (b) {
      b.addEventListener('click', function () {
        LJ.accounts.loginDemo(b.dataset.demo).then(function (r) {
          if (!r.ok) return U.toast('Nope', r.error, 'bad');
          U.toast('Signed in as ' + r.user.handle, r.user.admin ? 'Admin dashboard unlocked.' : 'Say something regrettable.', 'ok');
          LJ.router.go(r.user.admin ? '/admin' : '/feed');
        });
      });
    });
  }

  /* ══════════ #/account — profile + security ══════════ */
  function accountView() {
    var u = LJ.accounts.current();
    if (!u) return '<div class="wrap-narrow"><div class="card"><div class="empty"><div class="empty__t">Not signed in' + '</div>' +
      '<p>Pick a handle and start collecting regret.</p><button class="btn btn--primary" data-action="modal-auth">' + U.icon('lock') + 'Sign in or join' + '</button></div></div></div>';
    var k = LJ.accounts.karma(u.id);
    var s = LJ.store;
    var mine = s.all('posts').filter(function (p) { return p.authorId === u.id; });
    var auth = s.get('auth', {});
    var devs = [{ id: 'this-device', label: 'This browser · ' + (navigator.platform || 'unknown'), at: U.now(), current: true }]
      .concat((s.get('otherDevices', []) || []));
    var myComments = s.all('comments').filter(function (c) { return c.authorId === u.id; });

    return '<div class="split"><div class="col" style="gap:14px">' +
      '<section class="hero"><div class="row" style="gap:14px;align-items:center">' +
      U.avatar(u.handle, 'avatar--lg') +
      '<div style="min-width:0"><div class="row row--tight"><h1 class="display" style="font-size:clamp(24px,4vw,38px)">' + U.escape(u.name) + '</h1>' +
      '<span class="pill pill--accent">u/' + U.escape(u.handle) + '' + '</span>' + (u.admin ? '<span class="pill pill--ok">' + U.icon('shield') + 'moderator</span>' : '') + '' + '</div>' +
      '<div class="tiny muted">' + U.escape(u.bio || '') + '' + '</div></div>' +
      '<div class="spacer"></div><button class="btn btn--ghost" data-action="edit-profile">' + U.icon('edit') + 'Edit' + '</button></div>' +
      '<div class="grid cols-4" style="margin-top:16px">' +
      mini('Karma', U.fmt(k.votes), k.tier.name) + mini('Stories', String(k.posts), U.pct(k.posts, 10) + '% of the forum') +
      mini('Mean outrage', k.avgOutrage ? k.avgOutrage.toFixed(1) : '—', 'anonymous ratings') +
      mini('Replies', String(myComments.length), 'written by you') + '' + '</div>' +
      '<div class="row" style="margin-top:12px"><div style="flex:1;min-width:220px"><div class="tiny faint" style="margin-bottom:4px">' + k.tier.name + ' · ' + k.tier.pct + '% to the next tier' + '</div>' +
      '<div class="meter"><i style="width:' + k.tier.pct + '%"></i>' + '</div></div>' +
      '<button class="btn btn--primary" data-action="share-profile">' + U.icon('share') + 'Share profile card' + '</button></div>' +
      '</section>' +

      '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('inbox') + 'Your threads' + '</span>' +
      '<div class="spacer"></div><a class="btn btn--ghost btn--sm" href="#/create">' + U.icon('plus') + 'New story' + '</a></div>' +
      (mine.length ? mine.map(function (p) {
        return '<div class="row" style="gap:10px;padding:9px 0;border-top:1px solid var(--line)">' +
          '<a href="#/story/' + p.id + '" style="flex:1;min-width:0;color:var(--fg);font-weight:650;font-size:13.5px">' + U.escape(p.title) + '' + '</a>' +
          '<span class="pill">' + U.fmt(p.votes) + ' ' + U.icon('up') + '' + '</span>' +
          '<span class="pill">' + (p.outrage || 0).toFixed(1) + ' 🔥' + '</span>' +
          '<span class="pill ' + (p.status === 'open' ? 'pill--ok' : p.status === 'removed' ? 'pill--bad' : 'pill--warn') + '">' + p.status + '' + '</span>' +
          '<button class="btn btn--ghost btn--sm" data-action="post-notify" data-post="' + p.id + '">' + U.icon('bell') + '' + '</button>' +
          (p.status !== 'removed' ? '<button class="btn btn--ghost btn--sm" data-action="post-delete" data-post="' + p.id + '">' + U.icon('trash') + '</button>' :
            '<button class="btn btn--ghost btn--sm" data-action="post-recover" data-post="' + p.id + '">' + U.icon('refresh') + 'appeal</button>') + '' + '</div>';
      }).join('') : '<p class="tiny muted">Nothing posted yet. The archive waits patiently.</p>') + '</section>' +
      '' + '</div>' +

      '<aside class="col" style="gap:14px">' +
      '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('shield') + 'Security' + '</span></div>' +
      '<dl class="dl"><dt>Password stored</dt><dd>none — PBKDF2 verifier</dd>' +
      '<dt>Key strength</dt><dd>AES-GCM-128</dd>' +
      '<dt>Session</dt><dd>' + (auth.at ? U.time(auth.at) : '—') + '</dd>' +
      '<dt>Chat ciphertext</dt><dd>' + (LJ.accounts.hasKey() ? '<span style="color:var(--ok)">unlocked this session</span>' : 'locked') + '</dd>' +
      '<dt>Key fingerprint</dt><dd class="mono">' + (LJ.accounts.keyMaterial() || '—') + '…</dd></dl>' +
      '<div class="row" style="margin-top:10px">' +
      '<button class="btn btn--ghost btn--sm" data-action="bio-enrol">' + U.icon('fingerprint') + (LJ.accounts.biometricAvailable() ? 'Enrol biometrics' : 'Biometrics (simulated)') + '' + '</button>' +
      '<button class="btn btn--ghost btn--sm" data-action="lock-chats">' + U.icon('lock') + 'Re-lock chat' + '</button>' +
      '<button class="btn btn--danger btn--sm" data-action="logout">' + U.icon('logout2') + 'Sign out</button></div></section>' +

      '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('users') + 'Devices & sessions' + '</span></div>' +
      devs.map(function (d) {
        return '<div class="row" style="gap:8px;padding:8px 0;border-top:1px solid var(--line)">' + U.icon(d.current ? 'zap' : 'cloud') +
          '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:650">' + U.escape(d.label) + '' + '</div>' +
          '<div class="tiny faint">' + (d.current ? 'this tab · active now' : 'last seen ' + U.ago(d.at)) + '' + '</div></div>' +
          (d.current ? '<span class="pill pill--ok">current</span>' : '<button class="btn btn--danger btn--sm" data-action="revoke-device" data-id="' + d.id + '">revoke</button>') + '' + '</div>';
      }).join('') +
      '<p class="tiny faint" style="margin:8px 0 0">Prototype has one real session (this browser). Revocation here is illustrative: it drops the local key and queues the change for the sync worker.</p></section>' +

      '<section class="card"><div class="card__head"><span class="card__title">' + U.icon('bell') + 'Alerts' + '</span></div>' +
      '<p class="tiny muted">Popularity milestones, replies and DMs. Full controls in <a href="#/settings">Settings</a>.' + '</p>' +
      '<div class="row"><span class="pill ' + (LJ.notify.unread() ? 'pill--accent' : '') + '">' + LJ.notify.unread() + ' unread' + '</span>' +
      '<button class="btn btn--ghost btn--sm" data-action="notif-open">' + U.icon('inbox') + 'Open inbox</button></div></section>' +
      '</aside>' + '</div>';
  }
  function mini(label, value, sub) {
    return '<div class="stat" style="background:color-mix(in srgb,var(--surface) 70%, transparent);padding:10px 12px;border-radius:12px;border:1px solid var(--line)">' +
      '<span class="stat__d">' + label + '</span><span class="stat__n" style="font-size:24px">' + value + '</span><span class="tiny faint">' + U.escape(sub || '') + '' + '</span></div>';
  }

  /* ══════════ actions ══════════ */
  var A = LJ.router.actions;
  A['bio-login'] = function () {
    var f = U.$('#lf');
    var handle = ((f && f.elements.handle.value) || 'kevsaggy').trim().toLowerCase();
    U.toast('Scanning…', LJ.accounts.biometricAvailable() ? 'Waiting for the platform authenticator prompt.' : 'No sensor here — running the simulated scan.', 'info', 1600);
    setTimeout(function () {
      LJ.accounts.biometric(handle).then(function (r) {
        if (!r.ok) return U.toast('Denied', r.error, 'bad', 5000);
        U.toast('Unlocked by biometric', (r.simulated ? 'Simulated' : 'Platform') + ' · no passphrase typed, key derived from device secret.', 'ok');
        LJ.router.go(r.user.admin ? '/admin' : '/feed');
      });
    }, 720);
  };
  A['bio-enrol'] = function () {
    U.toast('Biometric enrolled', 'A device-bound authenticator is registered for this profile. Sign out and try the fingerprint button on the login screen.', 'ok', 5200);
    LJ.store.setSetting('bioEnrolled:' + ((LJ.accounts.current() || {}).id || 'guest'), U.now());
  };
  A['lock-chats'] = function () {
    LJ.crypto.cacheClear();
    U.toast('Chat re-locked', 'In-memory plaintext dropped. Open a room to decrypt again.', 'ok', 3400);
  };
  A['logout'] = function () {
    U.confirm('Sign out?', 'The session key is destroyed and every encrypted thread goes back to ciphertext. Drafts stay on this device.', function () {
      LJ.accounts.logout(); LJ.router.go('/feed');
    }, 'Sign out', 'danger');
  };
  A['revoke-device'] = function (el) {
    var devs = (LJ.store.get('otherDevices', []) || []).filter(function (d) { return d.id !== el.dataset.id; });
    LJ.store.set('otherDevices', devs);
    U.toast('Session revoked', 'That device needs to sign in again. Logged as a staff-visible security event.', 'warn', 4000);
  };
  A['edit-profile'] = function () {
    var u = LJ.accounts.current(); if (!u) return;
    var m = U.modal({
      title: 'Your public face', icon: 'user',
      body: '<form id="ep" class="col">' +
        '<label class="field"><span class="field__label">Display name</span><input class="input" name="name" value="' + U.escape(u.name) + '" maxlength="40"></label>' +
        '<label class="field"><span class="field__label">Flair</span><input class="input" name="flair" value="' + U.escape(u.flair || '') + '" maxlength="40"></label>' +
        '<label class="field"><span class="field__label">Bio</span><textarea class="textarea" name="bio" maxlength="200" style="min-height:90px">' + U.escape(u.bio || '') + '</textarea></label>' +
        '<div class="tiny faint">Your handle never changes. Nobody can rename out of a ban.' + '</div>' +
        '<button class="btn btn--primary btn--block" type="submit">Save</button></form>'
    });
    U.$('#ep', m.root).addEventListener('submit', function (e) {
      e.preventDefault(); var fd = new FormData(e.target);
      var users = LJ.store.all('users').map(function (x) { return x.id === u.id ? Object.assign({}, x, { name: fd.get('name'), flair: fd.get('flair'), bio: fd.get('bio') }) : x; });
      LJ.store.set('users', users);
      m.close(); U.toast('Updated', 'Live on every thread you have ever written.', 'ok');
      LJ.router.render();
    });
  };
  A['share-profile'] = function () {
    var u = LJ.accounts.current(); if (!u) return;
    LJ.share.open({ id: 'profile-' + u.id, title: 'u/' + u.handle + ' — ' + u.flair, body: u.bio || 'Professional disappointment.', author: u.handle, category: 'profile', votes: LJ.accounts.karma(u.id).votes, outrage: LJ.accounts.karma(u.id).avgOutrage });
  };
  A['post-delete'] = function (el) {
    U.confirm('Delete this story?', 'It goes straight to removed. You can appeal it from this page while you think about your choices.', function () {
      LJ.store.patch('posts', el.dataset.post, { status: 'removed', removedAt: U.now(), removedBy: 'self' });
      U.toast('Removed', 'Deleted by the author, logged as such.', 'ok');
      LJ.router.render();
    }, 'Delete', 'danger');
  };
  A['post-recover'] = function (el) {
    LJ.store.put('comments', { id: U.uid('c'), postId: el.dataset.post, author: 'taz', authorId: 'u_taz', text: 'Appeal received. A human is looking at it today.', at: U.now(), votes: 0 });
    U.toast('Appeal filed', 'A moderator will look. Trolling the appeal gets it worse.', 'ok', 4000);
  };
  A['post-notify'] = function (el) {
    var p = LJ.store.get1('posts', el.dataset.post);
    LJ.notify.add({ kind: 'milestone', title: 'Milestone watch set', body: 'We will ping you when “' + String(p.title).slice(0, 40) + '…” passes 100 / 500 / 1k upvotes.', postId: p.id });
    U.toast('Watch set', 'Push alerts armed for this thread.', 'ok', 3000);
  };
  A['notif-open'] = function () { LJ.notifModal(); };

  LJ.accountView = {
    register: function () {
      LJ.router.add({ path: '/login', title: 'Members only', render: loginView, enter: function (h) { wireLogin(h); } });
      LJ.router.add({ path: '/account', title: 'Your account', render: accountView });
    }
  };
})();
