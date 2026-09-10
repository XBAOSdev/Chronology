/* ===================================================================
   大事年表 — 主题
   自动读取系统浅色/深色，支持手动切换并记住选择；
   Canvas 绘制颜色从 CSS 变量读取，保证与 DOM 层一致。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  var KEY = 'chrono.theme';
  var mql = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

  var TH = {};
  var resolved = 'dark';
  var cached = null;

  function systemTheme() { return (mql && mql.matches) ? 'dark' : 'light'; }

  TH.resolve = function () {
    return S.theme === 'auto' ? systemTheme() : S.theme;
  };

  TH.current = function () { return resolved; };

  /* CSS 变量读取（避免两处维护颜色表） */
  function v(name, fallback) {
    var val = getComputedStyle(document.documentElement).getPropertyValue(name);
    val = (val || '').trim();
    return val || fallback;
  }

  TH.palette = function () {
    if (cached) return cached;
    cached = {
      bg: v('--bg', '#0f1115'),
      grid: v('--c-grid', 'rgba(255,255,255,0.04)'),
      gridStrong: v('--c-grid-strong', 'rgba(255,255,255,0.09)'),
      axis: v('--c-axis', 'rgba(255,255,255,0.16)'),
      tick: v('--c-tick', 'rgba(255,255,255,0.22)'),
      tickLabel: v('--c-ticklabel', '#8b95a4'),
      laneTitle: v('--c-lane-title', '#e9edf4'),
      laneSub: v('--c-lane-sub', '#7d8796'),
      laneFoot: v('--c-lane-foot', 'rgba(255,255,255,0.045)'),
      cursor: v('--c-cursor', 'rgba(110,200,255,0.55)'),
      select: v('--c-select', '#ffffff'),
      labelBg: v('--c-label-bg', '#171c24'),
      labelText: v('--c-label-text', '#e3e8f0'),
      clusterBg: v('--c-cluster-bg', '#232a35'),
      accent: v('--accent', '#6aa6ff'),
      textDim: v('--text-dim', '#99a3b2'),
      isDark: resolved === 'dark'
    };
    return cached;
  };

  TH.apply = function (emit) {
    resolved = TH.resolve();
    cached = null;
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-motion', S.reduceMotion ? 'off' : 'on');

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0f1115' : '#f4f6f9');

    if (emit !== false) {
      C.state.emit('theme', resolved);
      if (C.renderer && C.renderer.markDirty) C.renderer.markDirty();
    }
  };

  TH.set = function (mode, remember) {
    S.theme = (mode === 'light' || mode === 'dark') ? mode : 'auto';
    if (remember !== false) U.storage.set(KEY, S.theme);
    TH.apply(true);
  };

  TH.toggle = function () {
    var cur = resolved;
    var next;
    if (S.theme === 'auto') next = cur === 'dark' ? 'light' : 'dark';
    else next = S.theme === 'dark' ? 'light' : 'dark';
    TH.set(next, true);
    return next;
  };

  TH.init = function () {
    var saved = U.storage.get(KEY, 'auto');
    S.theme = (saved === 'light' || saved === 'dark') ? saved : 'auto';
    var rm = U.storage.get('chrono.motion', null);
    if (rm === 'off') S.reduceMotion = true;
    else if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      S.reduceMotion = true;
    }
    TH.apply(false);

    if (mql) {
      var onChange = function () { if (S.theme === 'auto') TH.apply(true); };
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }
  };

  C.theme = TH;
})();
