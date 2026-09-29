/* ═══════════════════════════════════════════════════════════════════════
   lib/share.js — distribution layer. Native Web Share when available,
   otherwise a share sheet with per-network deep links, copy-link, and a
   canvas-rendered share card you can download and post as an image.
   Module: LJ.share
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;

  var NETS = [
    { id: 'x', label: 'Post on X', dot: '#000', icon: '𝕏', url: function (t, u) { return 'https://twitter.com/intent/tweet?text=' + enc(t) + '&url=' + enc(u); } },
    { id: 'fb', label: 'Facebook', dot: '#1877F2', icon: 'f', url: function (t, u) { return 'https://www.facebook.com/sharer/sharer.php?u=' + enc(u) + '&quote=' + enc(t); } },
    { id: 'wa', label: 'WhatsApp', dot: '#25D366', icon: 'w', url: function (t, u) { return 'https://wa.me/?text=' + enc(t + ' ' + u); } },
    { id: 'tg', label: 'Telegram', dot: '#229ED9', icon: 't', url: function (t, u) { return 'https://t.me/share/url?url=' + enc(u) + '&text=' + enc(t); } },
    { id: 'rd', label: 'Reddit', dot: '#FF4500', icon: 'r', url: function (t, u) { return 'https://www.reddit.com/submit?title=' + enc(t) + '&url=' + enc(u); } },
    { id: 'li', label: 'LinkedIn', dot: '#0A66C2', icon: 'in', url: function (t, u) { return 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(u); } },
    { id: 'mail', label: 'Email', dot: '#7C7C8A', icon: '@', url: function (t, u) { return 'mailto:?subject=' + enc(t) + '&body=' + enc(u + '\n\n18+. Contents are fiction, mostly.' + '\n\n' + t); } }
  ];
  function enc(s) { return encodeURIComponent(String(s || '')); }

  function urlFor(post) {
    return location.href.split('#')[0] + '#/story/' + post.id;
  }

  var SH = {
    nets: NETS,

    /* ── share card (canvas → PNG) ─────────────────────────────────── */
    card: function (post, opts) {
      opts = opts || {};
      var W = 1080, H = 607, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      if (!x) return null;
      var theme = LJ.theme.get();
      var dark = theme.mode === 'dark';
      var accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#FF2D55';
      var accent2 = getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#FFB020';
      var bg = dark ? '#0B0B0E' : '#FFF6F1', fg = dark ? '#F4F1EE' : '#16121A';

      x.fillStyle = bg; x.fillRect(0, 0, W, H);
      var g = x.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, hexA(accent, .34)); g.addColorStop(.55, hexA(accent2, .10)); g.addColorStop(1, 'transparent');
      x.fillStyle = g; x.fillRect(0, 0, W, H);
      x.strokeStyle = hexA(accent, .5); x.lineWidth = 4; x.strokeRect(18, 18, W - 36, H - 36);

      x.fillStyle = accent;
      x.font = '700 26px system-ui, sans-serif';
      x.fillText('LAD JOKES', 62, 96);
      x.fillStyle = fg; x.globalAlpha = .6;
      x.font = '500 21px system-ui, sans-serif';
      x.fillText('18+ · ' + (post.category || 'confessions').toUpperCase() + ' · ' + U.fmt(post.votes || 0) + ' upvotes · outrage ' + (post.outrage || 0).toFixed(1) + '/10', 62, 132);
      x.globalAlpha = 1;

      x.fillStyle = fg;
      wrapAt(x, post.title.toUpperCase(), 62, 214, W - 124, '900 52px system-ui, sans-serif', 60, 3);
      x.globalAlpha = .72;
      wrapAt(x, String(post.body || '').split('\n')[0], 62, 452, W - 124, '400 27px system-ui, sans-serif', 38, 3);
      x.globalAlpha = 1;

      x.fillStyle = accent; x.font = '700 24px system-ui, sans-serif';
      x.fillText('u/' + (post.author || 'lad') + '  ·  ' + (opts.url || urlFor(post)).replace(/^https?:\/\//, '').slice(0, 64), 62, H - 62);
      return c.toDataURL('image/png');
    },

    open: function (post) {
      var url = urlFor(post);
      var title = post.title + ' — Lad Jokes (18+)';
      var text = '@' + (post.author || 'lad') + ': ' + String(post.body || '').split('\n')[0].slice(0, 140);
      var native = !!navigator.share;
      var body =
        (native ? '<button class="btn btn--primary btn--block" id="sh-native" style="margin-bottom:12px">' + U.icon('share') + 'System share sheet</button>' : '') +
        '<div class="shares">' + NETS.map(function (n) {
          return '<button class="share" data-own data-net="' + n.id + '"><span class="dot" style="background:' + n.dot + '">' + n.icon + '' + '</span>' + n.label + '' + '</button>';
        }).join('') + '' + '</div>' +
        '<hr class="divider">' +
        '<div class="field"><span class="field__label">Permalink' + '</span>' +
        '<div class="row"><input class="input mono" id="sh-url" readonly value="' + U.escape(url) + '">' +
        '<button class="btn btn--ghost" data-action="copy-url">' + U.icon('copy') + 'Copy' + '</button></div></div>' +
        '<div class="row row--between" style="margin-top:14px">' +
        '<label class="check" style="align-items:center"><input type="checkbox" id="sh-img" checked>Attach generated share card</label>' +
        '<button class="btn btn--ghost btn--sm" id="sh-dl">' + U.icon('download') + 'Download card' + '</button></div>' +
        '<div class="row" style="margin-top:10px"><img id="sh-preview" alt="Share card preview" style="border-radius:12px;border:1px solid var(--line);width:100%">' + '</div>';

      var m = U.modal({
        title: 'Spread the filth', icon: 'share', body: body,
        foot: '<span class="tiny muted">Sharing is opt-in. Nothing posts itself.</span>'
      });

      var img = U.$('#sh-preview', m.root);
      var data = null;
      try { data = SH.card(post, { url: url }); } catch (e) {}
      if (data) img.src = data; else { img.remove(); }

      U.$$('[data-net]', m.root).forEach(function (b) {
        b.addEventListener('click', function () {
          var n = NETS.filter(function (x) { return x.id === b.dataset.net; })[0];
          var finalText = (U.$('#sh-img', m.root) || {}).checked && data ? text + ' [card attached — download it first]' : text;
          var w = window.open(n.url(finalText, url), '_blank', 'noopener,width=680,height=620');
          if (!w) U.toast('Popup blocked', 'Your browser blocked the window. Copy the link instead.', 'warn');
          else U.toast('Opened ' + n.label, 'Check the new window — then come back and rate your own story.', 'ok', 3600);
          LJ.store.logShare && LJ.store.logShare(post.id, n.id);
          bump(post, n.id);
        });
      });
      var cu = U.$('[data-action="copy-url"]', m.root);
      if (cu) cu.addEventListener('click', function () {
        U.copy(url).then(function () { U.toast('Copied', url.slice(0, 54) + '…', 'ok', 2600); });
      });
      var dl = U.$('#sh-dl', m.root);
      if (dl) dl.addEventListener('click', function () {
        if (!data) return U.toast('No canvas', 'This browser blocked the card render.', 'bad');
        var a = document.createElement('a'); a.href = data; a.download = 'lad-jokes-' + post.id + '.png';
        document.body.appendChild(a); a.click(); a.remove();
        U.toast('Card downloaded', 'lad-jokes-' + post.id + '.png', 'ok');
      });
      var nb = U.$('#sh-native', m.root);
      if (nb) nb.addEventListener('click', function () {
        navigator.share({ title: title, text: text, url: url }).then(function () {
          bump(post, 'native'); U.toast('Shared', 'Native sheet completed.', 'ok');
        }).catch(function () {});
      });
    }
  };

  function bump(post, net) {
    var s = {}; s['shares'] = (post.shares || 0) + 1;
    s.lastShareAt = U.now();
    LJ.store.patch('posts', post.id, s);
  }

  function hexA(hex, a) {
    hex = (hex || '#FF2D55').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function wrapLines(ctx, text, maxW, font, maxLines) {
    ctx.font = font;
    var words = String(text || '').split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length && lines.length < maxLines; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; }
      else cur = t;
    }
    if (cur && lines.length < maxLines) lines.push(cur);
    return lines;
  }
  function wrapAt(ctx, text, x, y, maxW, font, lineH, maxLines) {
    var lines = wrapLines(ctx, text, maxW - 26, font, maxLines);
    var all = String(text || '').split(/\s+/).join(' ');
    ctx.font = font;
    if (ctx.measureText(lines.join(' ')).width < ctx.measureText(all).width) lines[lines.length - 1] = lines[lines.length - 1].replace(/\s*$/, ' …');
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lineH); });
    return y + lines.length * lineH;
  }

  LJ.share = SH;
})();
