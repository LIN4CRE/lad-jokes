/* ═══════════════════════════════════════════════════════════════════════
   lib/crypto.js — passphrase → AES-GCM key (PBKDF2), envelope encryption
   for stored chat payloads, password verification without storing the
   password, device tokens for anonymous ratings.
   Module: LJ.crypto
   NOTE: this is a browser-resident prototype. It shows the *shape* of real
   E2EE/crypto-at-rest (never store plaintext, never store the password,
   key only exists while unlocked). A production build needs a server-side
   key service, per-user keypairs, key rotation and recovery.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var subtle = (window.crypto && window.crypto.subtle) || null;
  var hasAES = !!subtle && !!Uint8Array.prototype.set;

  var b64 = {
    enc: function (buf) {
      var b = new Uint8Array(buf), s = '', i;
      for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
      return btoa(s);
    },
    dec: function (str) {
      var s = atob(str), a = new Uint8Array(s.length), i;
      for (i = 0; i < s.length; i++) a[i] = s.charCodeAt(i);
      return a;
    }
  };
  var te = new TextEncoder(), td = new TextDecoder();

  function rand(n) {
    var a = new Uint8Array(n);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (var i = 0; i < n; i++) a[i] = Math.floor(Math.random() * 256);
    return a;
  }

  /* ── key derivation ───────────────────────────────────────────────── */
  function newSalt() { return b64.enc(rand(16)); }

  function derive(passphrase, saltB64, iter) {
    iter = iter || 150000;
    if (!hasAES) { // sandbox without SubtleCrypto: deterministic fallback
      return Promise.resolve({
        fallback: true, iter: iter,
        key: null,
        material: U.hash(passphrase + '|' + saltB64 + '|' + iter),
        verifier: U.hash('ver|' + passphrase + '|' + saltB64 + '|' + iter)
      });
    }
    return subtle.importKey('raw', te.encode(String(passphrase)), 'PBKDF2', false, ['deriveKey', 'deriveBits'])
      .then(function (base) {
        return Promise.all([
          subtle.deriveKey({ name: 'PBKDF2', salt: b64.dec(saltB64), iterations: iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']),
          subtle.deriveBits({ name: 'PBKDF2', salt: b64.dec(saltB64), iterations: iter, hash: 'SHA-256' }, base, 256)
        ]);
      })
      .then(function (r) {
        return { key: r[0], bits: r[1], material: b64.enc(r[1]), verifier: b64.enc(r[1]).slice(0, 43), iter: iter, fallback: false };
      });
  }

  /* ── payload encryption ───────────────────────────────────────────── */
  function encrypt(plaintext, key) {
    if (!plaintext) return Promise.resolve({ c: '', iv: '' });
    if (!key || key.fallback || !hasAES) {
      var mat = (key && (key.material || key)) || 'lj-fallback-key';
      return Promise.resolve({ c: b64.enc(xor(te.encode(String(plaintext)), String(mat))), iv: '', alg: 'xor-demo' });
    }
    var iv = rand(12);
    return subtle.encrypt({ name: 'AES-GCM', iv: iv }, key.key || key, te.encode(String(plaintext)))
      .then(function (ct) { return { c: b64.enc(ct), iv: b64.enc(iv), alg: 'AES-GCM-128' }; });
  }

  function decrypt(env, key, syncSecret, syncSalt) {
    if (!env || !env.c) return Promise.resolve('');
    if (env.alg === 'xor-demo') {
      return Promise.resolve(syncSecret ? decryptSync(env, syncSecret, syncSalt) : '');
    }
    if (env.alg === 'xor-demo' || !key || !key.key || !hasAES) {
      var mat = (key && (key.material || key)) || 'lj-fallback-key';
      try { return td.decode(xor(b64.dec(env.c), String(mat))); } catch (e) { return ''; }
    }
    return subtle.decrypt({ name: 'AES-GCM', iv: b64.dec(env.iv) }, key.key, b64.dec(env.c))
      .then(function (pt) { return td.decode(pt); })
      .catch(function () { return null; }); // null = wrong key
  }

  function xor(bytes, key) {
    var k = te.encode(key), out = new Uint8Array(bytes.length);
    for (var i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k[i % k.length];
    return out;
  }

  /* ── synchronous path (demo seed data + first-paint, before PBKDF2 done) */
  function dk(secret, salt) { return U.hash('lj-synchk|' + secret + '|' + (salt || '')); }
  function encryptSync(plaintext, secret, salt) {
    return { c: b64.enc(xor(te.encode(String(plaintext)), dk(secret, salt))), iv: '', alg: 'xor-demo' };
  }
  function decryptSync(env, secret, salt) {
    if (!env || !env.c) return '';
    try { return td.decode(xor(b64.dec(env.c), dk(secret, salt))); } catch (e) { return null; }
  }

  /* ── synchronous cache for render paths (store is read during render) */
  var cache = {}; // msgId -> plaintext (only lives in memory)

  LJ.crypto = {
    supported: hasAES,
    algorithm: hasAES ? 'AES-GCM-128 · PBKDF2-SHA256/150k' : 'fallback hash (SubtleCrypto unavailable in this context)',
    newSalt: newSalt,
    derive: derive,
    encrypt: encrypt,
    decrypt: decrypt,
    encryptSync: encryptSync,
    decryptSync: decryptSync,
    xor: xor,
    randB64: function (n) { return b64.enc(rand(n || 16)); },
    token: function () { return b64.enc(rand(18)).replace(/[+/=]/g, '').toLowerCase(); },
    /* caches keep decryption off the render path; cleared on lock/logout */
    cachePut: function (id, text) { cache[id] = text; return text; },
    cacheGet: function (id) { return cache[id]; },
    cacheClear: function () { cache = {}; }
  };
})();
