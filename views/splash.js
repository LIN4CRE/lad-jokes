/* ═══════════════════════════════════════════════════════════════════════
   views/splash.js — age gate. Nothing renders until this passes; the
   answer is stored, never the raw date.
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var KEY = 'lj:age:v1';

  function ageOk(v) {
    if (!v) return null;
    var d = new Date(v + 'T00:00:00');
    if (isNaN(d)) return null;
    var now = new Date();
    var a = now.getFullYear() - d.getFullYear();
    var m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
    if (d > now) return -1;
    return a;
  }

  LJ.splash = {
    register: function () {
      var form = U.$('#age-form');
      if (form && form.dataset.wired) return;      /* idempotent: boot may retry */
      if (form) form.dataset.wired = '1';
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        var input = U.$('#dob');
        var msg = U.$('#dob-msg');
        var a = ageOk(input.value);
        if (a === null) { msg.textContent = 'Give us a real date, we are rude not stupid.'; msg.style.color = 'var(--bad)'; return; }
        if (a < 0) { msg.textContent = 'That date is in the future. Nice try.'; msg.style.color = 'var(--bad)'; return; }
        if (a < 18) {
          msg.innerHTML = '<b>Not old enough.</b> Come back in ' + (18 - a) + ' years — the archive will still be terrible.';
          msg.style.color = 'var(--bad)';
          U.store.set(KEY, { ok: false, age: a, at: U.now() });
          return;
        }
        U.store.set(KEY, { ok: true, at: U.now() });
        msg.style.color = 'var(--ok)'; msg.textContent = 'In you go.';
        setTimeout(function () { LJ.boot.unGate(); }, 320);
      });
    },
    declined: function () {
      var f = U.$('#age-form');
      if (f) f.innerHTML = '<div class="banner banner--bad" style="width:100%"><span>' + U.icon('shield') + '' + '</span>' +
        '<div><b>Closed.</b> This is an adults-only prototype. Nothing was stored except this decision, and you can clear it from browser settings.' + '</div></div>';
    }
  };
})();
