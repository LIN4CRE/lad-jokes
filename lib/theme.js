/* ═══════════════════════════════════════════════════════════════════════
   lib/theme.js — dark by default, real light mode, accent "loudness" dial,
   density + reduced-motion. Persisted, applied pre-paint, safe to import
   from <head> for FOUC-free theming.
   Module: LJ.theme
   ═════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var LJ = window.LJ || (window.LJ = {});
  var U = LJ.util;
  var KEY = 'lj:theme:v1';

  var state = U.store.get(KEY, null) || { mode: 'dark', accent: 'inferno', auto: false };

  var ACCENTS = [
    { id: 'inferno', label: 'Inferno', dot: '#FF2D55', sub: 'house red & ember' },
    { id: 'punch', label: 'Punch', dot: '#FF5C00', sub: 'orange you sorry' },
    { id: 'toxic', label: 'Toxic', dot: '#C6FF3D', sub: 'radioactive green' },
    { id: 'neon', label: 'Neon', dot: '#B14BFF', sub: 'after the nightclub' },
    { id: 'gold', label: 'Gold', dot: '#FFC93C', sub: 'lad of the hour' }
  ];

  function apply() {
    var h = document.documentElement;
    var mode = state.mode;
    if (state.auto && window.matchMedia) {
      mode = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    h.setAttribute('data-theme', mode);
    h.setAttribute('data-accent', state.accent);
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.setAttribute('content', mode === 'light' ? '#FFF6F1' : '#08080A');
    U.store.set(KEY, state);
    LJ.bus && LJ.bus.emit('theme:change', state);
  }

  var theme = {
    ACCENTS: ACCENTS,
    get: function () { return Object.assign({}, state); },
    set: function (patch) { Object.assign(state, patch || {}); apply(); },
    toggle: function () {
      state.auto = false;
      state.mode = state.mode === 'dark' ? 'light' : 'dark';
      apply();
      U.toast('Theme: ' + state.mode, state.mode === 'dark' ? 'Back in the shadows, where jokes live.' : 'Lights on. Still terrible.', 'ok', 2600);
      return state.mode;
    },
    isDark: function () {
      var m = state.mode;
      if (state.auto && window.matchMedia) m = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
      return m === 'dark';
    },
    setAccent: function (id) { state.accent = id; apply(); }
  };

  if (window.matchMedia) {
    try {
      window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () { if (state.auto) apply(); });
    } catch (e) {}
  }
  apply();
  LJ.theme = theme;
})();
