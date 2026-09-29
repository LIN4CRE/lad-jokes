/* ═══════════════════════════════════════════════════════════════════════
   lib/utils.js — helpers, icons, toasts, modal, sparklines, formatting.
   Module: LJ.util
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util = {};

  /* ── tiny DOM ─────────────────────────────────────────────────────── */
  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.on = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); };
  U.uid = function (p) { return (p || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  U.escape = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  U.clamp = function (n, a, b) { return Math.max(a, Math.min(b, n)); };
  U.now = function () { return Date.now(); };
  U.hash = function (str) {
    var h = 5381; str = String(str);
    for (var i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
    return (h >>> 0).toString(16);
  };

  /* ── formatting ───────────────────────────────────────────────────── */
  U.fmt = function (n) {
    n = Number(n) || 0;
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'm';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1) + 'k';
    return String(n);
  };
  U.ago = function (ts) {
    var s = Math.max(0, (U.now() - Number(ts)) / 1000);
    if (s < 45) return 'just now';
    if (s < 3600) return Math.round(s / 60) + 'm ago';
    if (s < 86400) return Math.round(s / 3600) + 'h ago';
    if (s < 604800) return Math.round(s / 86400) + 'd ago';
    return new Date(Number(ts)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  U.time = function (ts) {
    var d = new Date(Number(ts));
    var today = new Date().toDateString() === d.toDateString();
    return (today ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' · ') +
      d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  };
  U.bytes = function (b) {
    b = Number(b) || 0; var u = ['B', 'KB', 'MB', 'GB'], i = 0;
    while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
    return (i ? b.toFixed(1) : Math.round(b)) + ' ' + u[i];
  };
  U.pct = function (a, b) { return !b ? 0 : Math.round((a / b) * 100); };

  /* ── deterministic pseudo-random (demo analytics only) ────────────── */
  U.prng = function (seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  };
  U.seedFrom = function (str) { var n = parseInt(U.hash(str), 16); return n >>> 0; };

  /* ── avatars ──────────────────────────────────────────────────────── */
  var PALETTE = ['#FF2D55', '#FFB020', '#2FE08A', '#56B8FF', '#C6FF3D', '#FF7AC8', '#B14BFF', '#FF7A3D', '#28E0C8'];
  U.initials = function (name) {
    var p = String(name || '?').replace(/[^a-z0-9]/gi, ' ').trim().split(/\s+/);
    return ((p[0] || '?')[0] + (p[1] ? p[1][0] : '')).toUpperCase();
  };
  U.avatar = function (name, cls) {
    var hue = parseInt(U.hash(name).slice(0, 4), 16) % PALETTE.length;
    var bg = PALETTE[hue];
    return '<span class="avatar ' + (cls || '') + '" style="background:' + bg +
      ';color:#0b0b0d" aria-hidden="true">' + U.escape(U.initials(name)) + '' + '</span>';
  };
  U.presenceDot = function (on) {
    return '<span style="width:8px;height:8px;border-radius:50%;background:' + (on ? 'var(--ok)' : 'var(--faint)') +
      ';display:inline-block' + (on ? ';box-shadow:0 0 8px var(--ok)' : '') + '">' + '</span>';
  };

  /* ── icons ────────────────────────────────────────────────────────── */
  var P = {
    flame: '<path class="" d="M12 2.6c2.6 4.4-1.7 5.5.1 8 1.7-1 4.3-3.7 3.4-6.3 3.6 2.7 4.5 7 2.5 10.5a6.6 6.6 0 1 1-11.9-2.9C4.5 8 9.6 6.2 12 2.6z"/>',
    home: '<path d="M4 11.2 12 4.4l8 6.8V20a1 1 0 0 1-1 1h-4.6v-6H9.6V21H5a1 1 0 0 1-1-1z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/>',
    poll: '<path d="M4 20V10m5 10V4m5 16v-7m5 7V8"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    user: '<path d="M20 21a8 8 0 1 0-16 0"/><circle cx="12" cy="8" r="4"/>',
    users: '<path d="M17 21v-1.5a5 5 0 0 0-5-5H6a5 5 0 0 0-5 5V21"/><circle cx="9" cy="7" r="3.4"/><path d="M23 21v-1.5a5 5 0 0 0-3.8-4.8M15.5 3.7a3.4 3.4 0 0 1 0 6.6"/>',
    shield: '<path d="M12 2.5l7.5 3v6c0 4.8-3 8.4-7.5 10-4.5-1.6-7.5-5.2-7.5-10v-6z"/>',
    bell: '<path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5z"/><path d="M13.7 20a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20.5 20.5-4.6-4.6"/>',
    share: '<path d="M4 13v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/><path d="M12 15.5V3.5m0 0L8 7.5m4-4 4 4"/>',
    lock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
    unlock: '<rect x="4" y="10.5" width="16" height="10.5" rx="2.2"/><path d="M8 10.5V7a4 4 0 0 1 7.7-1.5"/>',
    key: '<circle cx="8" cy="16" r="4"/><path d="m11 13 8-8 2 2-2 2 2 2-2.5 2.5L18 12l-2-2"/>',
    sun: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2m0 14.6v2.2M4.4 4.4l1.6 1.6m12 12 1.6 1.6M2.5 12h2.2m14.6 0h2.2M4.4 19.6l1.6-1.6m12-12 1.6-1.6"/>',
    moon: '<path d="M20.5 14.5A8.6 8.6 0 0 1 9.5 3.5a8.7 8.7 0 1 0 11 11z"/>',
    cog: '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1 2 2 0 1 1-4 0 1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15a2 2 0 1 1 0-4 1.6 1.6 0 0 0 1.5-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 4.3a2 2 0 1 1 4 0 1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 21 11a2 2 0 1 1 0 4z"/>',
    logout: '<path d="M15.5 4.5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-3.5"/><path d="M10 16.5 4.5 12 10 7.5m-5.5 4.5H16"/>',
    check: '<path d="m4.5 12.8 5 5L20 6.5"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    eye: '<path d="M2.2 12S6 5.5 12 5.5 21.8 12 21.8 12 18 18.5 12 18.5 2.2 12 2.2 12z"/><circle cx="12" cy="12" r="3"/>',
    comment: '<path d="M21 11.5a8 8 0 0 1-11.4 7.2L4 20l1.4-5A8 8 0 1 1 21 11.5z"/>',
    star: '<path d="m12 3.5 2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8z"/>',
    flag: '<path d="M5 21V4.2c4-2 7 1.8 11 0V14c-4 1.8-7-2-11 0"/>',
    clip: '<path d="M20 11.5 12 19.5a5 5 0 0 1-7-7l8.5-8.5a3.4 3.4 0 0 1 4.8 4.8l-8.4 8.4a1.8 1.8 0 0 1-2.5-2.5l7.8-7.8"/>',
    folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.6h7A1.5 1.5 0 0 1 19 10v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 3 18z"/>',
    grid: '<rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5h-11a1 1 0 0 0-1 1v11"/>',
    download: '<path d="M12 3.5v11m0 0 4.2-4.2M12 14.5l-4.2-4.2M4 18.5v1a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19.5v-1"/>',
    upload: '<path d="M12 20.5v-11m0 0L7.8 13.7 12 9.5l4.2 4.2M4 5.5v-1A1.5 1.5 0 0 1 5.5 3h13A1.5 1.5 0 0 1 20 4.5v1"/>',
    refresh: '<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 3.5V9H15"/>',
    send: '<path d="M21 3 10.5 13.5M21 3l-6.8 18-3.7-7.5L3 10z"/>',
    edit: '<path d="M4.5 19.5h4L20 8a2.1 2.1 0 0 0-3-3L5.5 16.5z"/>',
    trash: '<path d="M4.5 6.5h15M9 6.5V4h6v2.5M6.5 6.5 7.5 21h9l1-14.5"/>',
    chart: '<path d="M4 20V4m0 16h16"/><path d="m7.5 15 3.5-4.5 3 2.5L20 6"/>',
    zap: '<path d="M13.5 2.5 5 14h6l-.5 7.5L19 10h-6z"/>',
    ghost: '<path d="M4.5 20V11a7.5 7.5 0 0 1 15 0v9l-2.5-2-2.5 2-2.5-2-2.5 2z"/><path d="M9.5 10.5h.01m4.5 0h.01" stroke-width="2.6"/>',
    wifi: '<path d="M2.5 9a15 15 0 0 1 19 0M5.5 12.6a10.4 10.4 0 0 1 13 0M8.5 16a5.6 5.6 0 0 1 7 0"/><path d="M12 19.4h.01" stroke-width="2.6"/>',
    'wifi-off': '<path d="M2.5 9a15 15 0 0 1 8-4.2m5.5 1.2A15 15 0 0 1 21.5 9M8.5 16a5.6 5.6 0 0 1 5.6-.6M3 3l18 18"/>',
    cloud: '<path d="M17.5 19a4.5 4.5 0 0 0 .4-9A6.5 6.5 0 0 0 5.4 11 4 4 0 0 0 6.5 19z"/>',
    'chev-r': '<path d="m9 5 7 7-7 7"/>',
    filter: '<path d="M3.5 5.5h17l-6.6 8v6l-3.8-2v-4z"/>',
    link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 1 0-6-6l-1.5 1.5"/><path d="M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 1 0 6 6L12.5 17.5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.2"/><circle cx="8.8" cy="9.6" r="1.6"/><path d="m4.5 17.5 4.5-4.5 3.5 3 3-2.5 4.5 4"/>',
    drag: '<path d="M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01" stroke-width="2.6"/>',
    inbox: '<path d="M3.5 13 6 4.5h12l2.5 8.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19z"/><path d="M3.5 13h5l1 2.5h5l1-2.5h5"/>',
    up: '<path d="m12 19.5-.1-15M5 11.4 11.9 4.5l6.9 6.9"/>',
    back: '<path d="M19.5 12H4.5m0 0 6.5-6.5M4.5 12 11 18.5"/>',
    down: '<path d="M12 4.5v15M5 12.6l7 7 7-7"/>',
    logout2: '<path d="M9.5 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4.5"/><path d="M16 16.5 20.5 12 16 7.5M20.5 12H9"/>',
    heart: '<path d="M20.3 5.7a5 5 0 0 0-7.1 0L12 6.9l-1.2-1.2a5 5 0 1 0-7.1 7.1L12 21l8.3-8.2a5 5 0 0 0 0-7.1z"/>',
    mask: '<path d="M3 7.5c6-2 12-2 18 0 0 6-2.5 10.5-6 10.5-1.6 0-2.2-1-3-1s-1.4 1-3 1c-3.5 0-6-4.5-6-10.5z"/><path d="M8 11h.01m8 0h.01" stroke-width="2.6"/>',
    fingerprint: '<path d="M12 3.5a8.5 8.5 0 0 0-8 5.7M20.5 12a8.5 8.5 0 0 0-4-7.2"/><path d="M8 12a4 4 0 0 1 8 0v3.5M12 12v6.5m3-.5v2m-6-3v3.5a6 6 0 0 0 1 3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 6a8.6 8.6 0 0 1 9.4 6 12 12 0 0 1-2.4 3.6M6.3 7.9A12 12 0 0 0 2.6 12a8.6 8.6 0 0 0 11 5.8"/>',
    db: '<ellipse cx="12" cy="6" rx="8" ry="3.2"/><path d="M4 6v12c0 1.8 3.6 3.2 8 3.2s8-1.4 8-3.2V6"/><path d="M20 12c0 1.8-3.6 3.2-8 3.2S4 13.8 4 12"/>'
  };

  U.icon = function (name, opts) {
    opts = opts || {};
    var d = P[name] || P.zap;
    var cls = 'ic' + (opts.fill ? ' ic--fill' : '') + (opts.cls ? ' ' + opts.cls : '');
    return '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true"' +
      (opts.fill ? '' : '') + '>' + d.replace('class=""', '') + '</svg>';
  };

  /* ── toasts ───────────────────────────────────────────────────────── */
  U.toast = function (title, body, kind, ms) {
    var host = U.$('#toasts'); if (!host) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast--' + kind : '');
    var icName = kind === 'ok' ? 'check' : kind === 'bad' ? 'flag' : kind === 'warn' ? 'zap' : 'bell';
    el.innerHTML = '<span class="toast__ic">' + U.icon(icName) + '' + '</span>' +
      '<div style="min-width:0"><div class="toast__t">' + U.escape(title) + '' + '</div>' +
      (body ? '<div class="toast__b">' + U.escape(body) + '</div>' : '') + '' + '</div>' +
      '<button class="toast__x" aria-label="Dismiss">' + U.icon('x') + '' + '</button>';
    var kill = function () {
      if (!el.parentNode) return;
      el.classList.add('is-out');
      setTimeout(function () { el.remove(); }, 240);
    };
    el.querySelector('.toast__x').addEventListener('click', kill);
    host.appendChild(el);
    setTimeout(kill, ms || 5200);
    while (host.children.length > 5) host.firstElementChild.remove();
  };

  /* ── modal ────────────────────────────────────────────────────────── */
  U.modal = function (cfg) {
    var root = U.$('#modal-root'); if (!root) return { close: function () {} };
    var html = '<div class="modal" role="dialog" aria-modal="true" aria-label="' + U.escape(cfg.title || 'Dialog') + '">' +
      '<div class="modal__h"><span style="color:var(--accent)">' + U.icon(cfg.icon || 'zap') + '' + '</span>' +
      '<div class="modal__t">' + U.escape(cfg.title || '') + '</div><div class="spacer">' + '</div>' +
      '<button class="btn btn--ghost btn--icon" data-action="modal-close" aria-label="Close">' + U.icon('x') + '' + '</button></div>' +
      '<div class="modal__b">' + (cfg.body || '') + '' + '</div>' +
      (cfg.foot ? '<div class="modal__f">' + cfg.foot + '</div>' : '') + '' + '</div>';
    root.innerHTML = html;
    root.hidden = false;
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    function close() {
      root.hidden = true; root.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      if (cfg.onClose) cfg.onClose();
    }
    root.onclick = function (e) { if (e.target === root) close(); };
    document.addEventListener('keydown', onKey);
    var first = root.querySelector('input,select,textarea,button:not([data-action="modal-close"])');
    if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 40);
    return { close: close, root: root, body: root.querySelector('.modal__b') };
  };
  U.closeModal = function () { var r = U.$('#modal-root'); if (r) { r.hidden = true; r.innerHTML = ''; } };

  /* ── confirm ──────────────────────────────────────────────────────── */
  U.confirm = function (title, msg, onYes, yesLabel, kind) {
    var m = U.modal({
      title: title, icon: kind === 'danger' ? 'flag' : 'zap',
      body: '<p style="color:var(--muted)">' + U.escape(msg) + '</p>',
      foot: '<button class="btn btn--ghost" data-action="modal-close">Cancel' + '</button>' +
        '<button class="btn ' + (kind === 'danger' ? 'btn--danger' : 'btn--primary') + '" id="cf-yes">' + U.escape(yesLabel || 'Do it') + '</button>'
    });
    var b = U.$('#cf-yes', m.root);
    if (b) b.addEventListener('click', function () { m.close(); onYes && onYes(); });
  };

  /* ── sparkline + donut ────────────────────────────────────────────── */
  U.spark = function (vals, opts) {
    opts = opts || {};
    vals = (vals || []).map(Number); if (vals.length < 2) return '<div class="spark">' + '</div>';
    var w = 100, h = 30, min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    var rng = (max - min) || 1;
    var pts = vals.map(function (v, i) {
      return [(i / (vals.length - 1)) * w, h - ((v - min) / rng) * (h - 4) - 2].map(function (n) { return n.toFixed(2); });
    });
    var line = pts.map(function (p) { return p.join(','); }).join(' ');
    var area = '0,' + h + ' ' + line + ' ' + w + ',' + h;
    var id = 'sp' + U.hash(line);
    return '<svg class="spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" role="img" aria-label="' +
      U.escape(opts.label || 'trend') + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="var(--accent)" stop-opacity=".42"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/>' +
      '</linearGradient></defs>' +
      '<polygon points="' + area + '" fill="url(#' + id + ')"/>' +
      '<polyline points="' + line + '" fill="none" stroke="var(--accent)" stroke-width="1.7" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '<circle cx="' + pts[pts.length - 1][0] + '" cy="' + pts[pts.length - 1][1] + '" r="1.9" fill="var(--accent)"/></svg>';
  };

  U.donut = function (slices, centerLabel, centerSub) {
    var total = slices.reduce(function (a, s) { return a + (s.value || 0); }, 0) || 1;
    var r = 42, c = 2 * Math.PI * r, off = 0, segs = '';
    slices.forEach(function (s) {
      var frac = (s.value || 0) / total;
      segs += '<circle cx="60" cy="60" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="15" ' +
        'stroke-dasharray="' + (frac * c - 1.6).toFixed(2) + ' ' + c.toFixed(2) + '" ' +
        'stroke-dashoffset="' + (-off * c).toFixed(2) + '" transform="rotate(-90 60 60)" stroke-linecap="butt"><title>' +
        U.escape(s.label) + ': ' + s.value + '</title></circle>';
      off += frac;
    });
    return '<div class="donut"><svg viewBox="0 0 120 120" width="120" height="120" role="img" aria-label="category share">' +
      '<circle cx="60" cy="60" r="42" fill="none" stroke="var(--surface-3)" stroke-width="15"/>' + segs +
      '<text x="60" y="57" text-anchor="middle" font-family="var(--ff-display)" font-size="19" fill="var(--fg)">' +
      U.escape(centerLabel || '') + '</text>' +
      '<text x="60" y="73" text-anchor="middle" font-size="8.5" letter-spacing="1.4" fill="var(--muted)">' +
      U.escape((centerSub || '').toUpperCase()) + '</text></svg>' +
      '<div class="legend">' + slices.map(function (s) {
        return '<div><i style="background:' + s.color + '"></i>' + U.escape(s.label) +
          ' <b style="color:var(--fg)">' + U.pct(s.value, total) + '%' + '</b></div>';
      }).join('') + '' + '</div></div>';
  };

  /* ── user activity (used to suppress noise when the tab is idle) ─── */
  var ACT = window.LJ.activity = window.LJ.activity || { last: Date.now() };
  ['pointerdown', 'keydown', 'wheel', 'focus', 'mousemove'].forEach(function (ev) {
    document.addEventListener(ev, function () { ACT.last = Date.now(); }, { passive: true });
  });
  window.LJ.activity = ACT;
  U.activity = ACT;

  /* ── storage with graceful degradation ────────────────────────────── */
  var MEM = {};
  var ls = (function () { try { var k = '__ljt'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return null; } })();
  U.store = {
    available: !!ls,
    get: function (k, fb) {
      try {
        var raw = ls ? ls.getItem(k) : MEM[k];
        return raw == null ? fb : JSON.parse(raw);
      } catch (e) { return fb; }
    },
    set: function (k, v) {
      try { var raw = JSON.stringify(v); if (ls) ls.setItem(k, raw); else MEM[k] = raw; return true; }
      catch (e) { return false; }
    },
    del: function (k) { try { if (ls) ls.removeItem(k); else delete MEM[k]; } catch (e) {} },
    keys: function () { return ls ? Object.keys(ls) : Object.keys(MEM); }
  };
  U.download = function (filename, text, mime) {
    try {
      var blob = new Blob([text], { type: mime || 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      return true;
    } catch (e) { U.toast('Download blocked', 'This sandbox refused a blob download.', 'warn'); return false; }
  };
  U.copy = function (text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); } catch (e) {} t.remove();
    return Promise.resolve();
  };
  U.debounce = function (fn, ms) {
    var h; return function () { var a = arguments, s = this; clearTimeout(h); h = setTimeout(function () { fn.apply(s, a); }, ms || 220); };
  };
})();
