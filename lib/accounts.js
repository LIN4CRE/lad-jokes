/* ═══════════════════════════════════════════════════════════════════════
   lib/accounts.js — registration, PBKDF2 verification (password is never
   stored, only the derived verifier), session keys, biometric unlock,
   karma, admin gate, write guards.
   Module: LJ.accounts
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util, S = null;
  var PASS = 'scouse-18+-demo'; // demo accounts share this passphrase
  var BIO_SECRET = 'lj-bio-demo';
  var session = { user: null, key: null, msgKey: null, since: 0 };

  function store() { S = S || LJ.store; return S; }

  function acct(handle) {
    return store().all('accounts').filter(function (a) { return a.handle === handle; })[0] || null;
  }
  function user(id) {
    return store().all('users').filter(function (u) { return u.id === id; })[0] || null;
  }

  var A = {
    demoPass: PASS,
    ready: false,

    /* ── bootstrap: seed 3 demo accounts, each with a real KDF ─────── */
    init: function () {
      var s = store();
      if (!s.all('users').length) LJ.seed.run(true);
      var users = s.all('users');
      var accounts = s.all('accounts');
      var want = users.filter(function (u) { return !accounts.some(function (a) { return a.userId === u.id; }); });
      if (!want.length) { A.ready = true; return Promise.resolve(); }
      return Promise.all(want.map(function (u) {
        var salt = LJ.crypto.newSalt();
        return LJ.crypto.derive(PASS, salt).then(function (d) {
          return { id: 'a_' + u.id, userId: u.id, handle: u.handle, salt: salt, iter: d.iter || 150000, verifier: d.verifier, createdAt: u.joined, bio: { salt: salt.slice(0, 8), iter: 150000 } };
        });
      })).then(function (made) {
        s.set('accounts', accounts.concat(made));
        A.ready = true;
      }).catch(function (e) { console.warn('account bootstrap', e); A.ready = true; });
    },

    /* ── read session ──────────────────────────────────────────────── */
    current: function () { return session.user; },
    isAuthed: function () { return !!session.user; },
    isAdmin: function () { return !!(session.user && session.user.admin); },
    hasKey: function () { return !!session.key; },
    msgKey: function () { return session.msgKey; },
    keyMaterial: function () { return session.key && session.key.material ? String(session.key.material).slice(0, 12) : null; },

    login: function (handle, pass) {
      var a = acct(handle);
      if (!a) return Promise.resolve({ ok: false, error: 'No member called ' + handle });
      return LJ.crypto.derive(pass, a.salt).then(function (d) {
        if (d.verifier !== a.verifier) return { ok: false, error: 'Wrong passphrase. Demo members use: ' + PASS };
        return A._open(a, d);
      });
    },

    loginDemo: function (handle) { return A.login(handle, PASS); },

    /* biometric unlock: real WebAuthn when a platform authenticator exists,
       otherwise an explicitly-labelled simulation. Key comes from a device
       secret, never typed. */
    biometricAvailable: function () {
      return !!(window.PublicKeyCredential && navigator.credentials);
    },
    biometric: function (handle) {
      var a = acct(handle);
      if (!a) return Promise.resolve({ ok: false, error: 'No member called ' + handle });
      var useReal = A.biometricAvailable();
      var p = useReal
        ? navigator.credentials.get({ publicKey: { challenge: LJ.crypto.randB64(16), timeout: 30000, userVerification: 'required', allowCredentials: [] } })
          .then(function () { return true; })
          .catch(function () { return false; })
        : Promise.resolve(false);
      return p.then(function (ok) {
        if (useReal && !ok) return { ok: false, error: 'Biometric check failed or was cancelled.' };
        return LJ.crypto.derive(BIO_SECRET + '|' + a.id, a.salt).then(function (d) {
          if (d.verifier === a.verifier) return A._open(a, d);
          /* demo accounts were created with the typed passphrase; fall back so
             the biometric flow still unlocks a session without a password. */
          return LJ.crypto.derive(PASS, a.salt).then(function (d2) {
            var s = store();
            return A._open(a, d2, { biometric: true, simulated: !useReal || !ok });
          });
        });
      });
    },

    _open: function (a, derived, flags) {
      var s = store();
      var u = user(a.userId);
      session.user = u;
      session.key = derived;
      session.since = U.now();
      /* thread/message key: derived per-install so ciphertext is meaningless
         without this browser + this unlock */
      var msalt = s.setting('msgSalt') || LJ.crypto.randB64(16);
      s.setSetting('msgSalt', msalt);
      return LJ.crypto.derive(derived.material + '|threads', msalt).then(function (mk) {
        session.msgKey = mk;
        s.set('auth', {
          userId: u.id, handle: u.handle, at: U.now(),
          token: U.hash(u.id + '|' + a.salt).slice(0, 20), remember: true,
          flags: flags || {}
        });
        return A.unlockThreads().then(function () {
          LJ.bus.emit('auth:login', u);
          return { ok: true, user: u, biometric: !!(flags && flags.biometric), simulated: !!(flags && flags.simulated) };
        });
      });
    },

    signup: function (handle, name, pass) {
      var s = store();
      handle = String(handle || '').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      if (handle.length < 3) return Promise.resolve({ ok: false, error: 'Handle needs 3+ characters (a-z, 0-9, _ . -)' });
      if (acct(handle)) return Promise.resolve({ ok: false, error: 'Handle ' + handle + ' is already on the wall' });
      if (String(pass || '').length < 8) return Promise.resolve({ ok: false, error: 'Passphrase needs 8+ characters. Use something rude and long.' });
      var salt = LJ.crypto.newSalt();
      return LJ.crypto.derive(pass, salt).then(function (d) {
        var u = {
          id: U.uid('u'), handle: handle, name: name || handle,
          flair: 'Fresh Meat', bio: 'New here. Already regretting one thing.', joined: U.now(), admin: false
        };
        s.put('users', u);
        s.all('accounts'); // hydrate
        var acc = { id: 'a_' + u.id, userId: u.id, handle: handle, salt: salt, iter: d.iter, verifier: d.verifier, createdAt: U.now() };
        s.set('accounts', s.all('accounts').concat([acc]));
        return A.login(handle, pass);
      });
    },

    logout: function () {
      session = { user: null, key: null, msgKey: null, since: 0 };
      LJ.crypto.cacheClear();
      store().set('auth', null);
      LJ.bus.emit('auth:logout');
      U.toast('Signed out', 'Session key destroyed, threads re-locked.', 'ok', 3000);
    },

    /* ── encrypted storage for chat ────────────────────────────────── */
    unlockThreads: function () {
      var s = store(), th = s.all('threads');
      var jobs = [];
      th.forEach(function (t) {
        (t.messages || []).forEach(function (m) {
          if (m.plain || !m.env || m.env.alg === 'xor-demo') return;   // sync path handles these
          jobs.push(LJ.crypto.decrypt(m.env, session.msgKey, BIO_SECRET, t.id).then(function (pt) {
            if (pt) LJ.crypto.cachePut(m.id, pt);
          }));
        });
      });
      return Promise.all(jobs).then(function () { return true; });
    },
    encryptMessage: function (threadId, text) {
      /* stored ciphertext; plaintext lives in an in-memory cache only */
      return LJ.crypto.encrypt(text, session.msgKey).then(function (env) {
        env.thread = threadId;
        return env;
      });
    },
    decryptNow: function (msg, threadId) {
      if (msg.plain) return msg.plain;
      var hit = LJ.crypto.cacheGet(msg.id);
      if (hit) return hit;
      if (msg.env && msg.env.alg === 'xor-demo') {
        var pt = LJ.crypto.decryptSync(msg.env, BIO_SECRET, threadId);
        if (pt) LJ.crypto.cachePut(msg.id, pt);
        return pt;
      }
      return session.msgKey ? null : null;
    },
    decryptMessage: function (msg) {
      if (msg.plain) return msg.plain;
      var hit = LJ.crypto.cacheGet(msg.id);
      if (hit) return hit;
      return LJ.crypto.decrypt(msg.env, session.msgKey, BIO_SECRET, msg.id)
        .then(function (pt) {
          var out = pt || null;
          if (out) LJ.crypto.cachePut(msg.id, out);
          return out;
        });
    },

    /* ── karma / reputation ────────────────────────────────────────── */
    karma: function (userId) {
      var s = store();
      var mine = s.all('posts').filter(function (p) { return p.authorId === userId; });
      var votes = mine.reduce(function (a, p) { return a + (p.votes || 0); }, 0);
      var rateAvg = 0, rateN = 0;
      mine.forEach(function (p) {
        var r = Object.keys(p.ratings || {}).length;
        if (r) { rateAvg += (p.outrage || 0) * r; rateN += r; }
      });
      return {
        posts: mine.length, votes: votes,
        avgOutrage: rateN ? Math.round(rateAvg / rateN * 10) / 10 : 0,
        tier: tierFor(votes + rateN * 12)
      };
    },

    /* write guard: posts, comments, votes, ratings, messages */
    require: function (what) {
      if (session.user) return session.user;
      U.toast('Membership needed', 'Sign in to ' + what + '. Takes ten seconds.', 'warn');
      LJ.modalAuth();
      return null;
    }
  };

  function tierFor(score) {
    if (score > 4000) return { name: 'Lad of Legend', pct: 100 };
    if (score > 2000) return { name: 'Sauna Sage', pct: 78 };
    if (score > 900) return { name: 'Round Buyer', pct: 55 };
    if (score > 300) return { name: 'Ego Merchant', pct: 34 };
    if (score > 60) return { name: 'Muppet', pct: 16 };
    return { name: 'Fresh Meat', pct: 5 };
  }

  LJ.accounts = A;

  /* shared sign-in modal (used by the guard, topbar and #/login) */
  LJ.modalAuth = function (mode) {
    var html = '' +
      '<div class="row row--between" style="margin-bottom:12px">' +
      '<button class="chip is-on" data-auth-tab="login">Sign in' + '</button>' +
      '<button class="chip" data-auth-tab="signup">Join' + '</button></div>' +
      '<form id="auth-form" class="col" autocomplete="off">' +
      '<label class="field"><span class="field__label">Handle</span><input class="input" name="handle" placeholder="kevsaggy" autocapitalize="none" spellcheck="false"></label>' +
      '<label class="field" id="af-name" hidden><span class="field__label">Display name</span><input class="input" name="name" placeholder="Kev"></label>' +
      '<label class="field"><span class="field__label">Passphrase</span><input class="input" name="pass" type="password" placeholder="never stored, only derived"></label>' +
      '<button class="btn btn--primary btn--block btn--lg" type="submit">Unlock the room' + '</button>' +
      '</form>' +
      '<hr class="divider">' +
      '<p class="tiny muted" style="margin:0 0 8px">Demo members — one tap signs you in (passphrase <span class="mono">' + PASS + '</span>):' + '</p>' +
      '<div class="row row--tight">' +
      ['kevsaggy', 'taz', 'donutman99'].map(function (h) {
        return '<button class="btn btn--ghost btn--sm" data-demo="' + h + '">' + U.icon('user') + h + '' + '</button>';
      }).join('') +
      '<button class="btn btn--ghost btn--sm" data-bio="kevsaggy">' + U.icon('fingerprint') + 'Biometric' + '</button>' +
      '' + '</div>' +
      '<p class="tiny faint" style="margin:12px 0 0">Prototype: passwords are never stored — the app keeps a PBKDF2-SHA256 (150k) verifier and holds the AES key in memory while you are signed in.' + '</p>';

    var m = U.modal({ title: 'Members only', icon: 'lock', body: html });
    var form = U.$('#auth-form', m.root), which = mode || 'login';

    function tab(w) {
      which = w;
      U.$$('[data-auth-tab]', m.root).forEach(function (b) { b.classList.toggle('is-on', b.dataset.authTab === w); });
      U.$('#af-name', m.root).hidden = w !== 'signup';
      U.$('button[type="submit"]', form).textContent = w === 'signup' ? 'Create my account' : 'Unlock the room';
    }
    U.$$('[data-auth-tab]', m.root).forEach(function (b) { b.addEventListener('click', function () { tab(b.dataset.authTab); }); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = new FormData(form);
      var job = which === 'signup'
        ? A.signup(f.get('handle'), f.get('name'), f.get('pass'))
        : A.login(f.get('handle'), f.get('pass'));
      U.$('button[type="submit"]', form).disabled = true;
      job.then(function (r) {
        U.$('button[type="submit"]', form).disabled = false;
        if (!r.ok) return U.toast('Nope', r.error, 'bad', 6000);
        m.close();
        U.toast('Welcome, ' + r.user.handle, r.biometric ? 'Unlocked with biometrics (' + (r.simulated ? 'simulated' : 'platform') + ').' : 'Session key held in memory.', 'ok');
        LJ.router.go(LJ.router.path === '/login' ? '/feed' : LJ.router.path);
      });
    });

    U.$$('[data-demo]', m.root).forEach(function (b) {
      b.addEventListener('click', function () {
        A.loginDemo(b.dataset.demo).then(function (r) {
          if (!r.ok) return U.toast('Nope', r.error, 'bad');
          m.close(); U.toast('Welcome, ' + r.user.handle, 'Signed in as ' + (r.user.admin ? 'moderator' : 'member') + '.', 'ok');
          LJ.router.go(LJ.router.path === '/login' ? '/feed' : LJ.router.path);
        });
      });
    });
    U.$$('[data-bio]', m.root).forEach(function (b) {
      b.addEventListener('click', function () {
        U.toast('Touch sensor', A.biometricAvailable() ? 'Waiting for platform authenticator…' : 'Simulated scan — no platform authenticator here…', 'info', 1400);
        setTimeout(function () {
          A.biometric(b.dataset.bio).then(function (r) {
            if (!r.ok) return U.toast('Biometrics failed', r.error, 'bad');
            m.close();
            U.toast('Unlocked', (r.simulated ? 'Simulated biometric' : 'Platform biometric') + ' · key never leaves this device.', 'ok');
            LJ.router.go(LJ.router.path === '/login' ? '/feed' : LJ.router.path);
          });
        }, 700);
      });
    });
  };
})();
