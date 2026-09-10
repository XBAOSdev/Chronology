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
    TH.applyMotion();

    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#0f1115' : '#f4f6f9');

    if (emit !== false) {
      C.state.emit('theme', resolved);
      if (C.renderer && C.renderer.markDirty) C.renderer.markDirty();
    }
  };

  /**
   * 「减少动效」的唯一落点：把 S.reduceMotion 同步到 data-motion，
   * 并立刻结算在途的视图动画。集中在这里，避免 S.reduceMotion 与
   * data-motion 属性各写一处、任何一处漏写就出现「开关关了但动效还在」。
   */
  TH.applyMotion = function () {
    document.documentElement.setAttribute('data-motion', S.reduceMotion ? 'off' : 'on');
    if (C.renderer && C.renderer.settle) C.renderer.settle();
  };

  /* ==================================================================
     主题切换过场
     ================================================================== */

  var VEIL_FADE = 180;      /* 与 .theme-veil 的 transition 时长保持一致 */
  var VEIL_HOLD = 50;       /* 全遮盖后多停一帧，避免过渡未完成就换色 */
  var veilEl = null;
  var veilTimers = [];

  function clearVeil() {
    for (var i = 0; i < veilTimers.length; i++) clearTimeout(veilTimers[i]);
    veilTimers = [];
    if (veilEl && veilEl.parentNode) veilEl.parentNode.removeChild(veilEl);
    veilEl = null;
  }

  function currentBg() {
    var v = (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '').trim();
    return v || '#0f1115';
  }

  /** 幕布过场：淡入 → 全遮时换主题 → 淡出。连点只会以最后一次为准。 */
  function crossFade(apply) {
    if (!document.body) { apply(); return; }
    clearVeil();

    var veil = document.createElement('div');
    veil.className = 'theme-veil';
    veil.style.background = currentBg();     /* 旧主题的背景色 */
    document.body.appendChild(veil);
    veilEl = veil;

    void veil.offsetWidth;                   /* 强制一次样式计算，让 0→1 真的过渡 */
    veil.style.opacity = '1';

    veilTimers.push(setTimeout(function () {
      apply();                               /* 全遮的一刻换主题，硬跳不可见 */
      veil.style.background = currentBg();   /* 换成新主题背景色（幕布不透明，看不出） */
      requestAnimationFrame(function () {
        veil.style.opacity = '0';
        veilTimers.push(setTimeout(clearVeil, VEIL_FADE + 120));
      });
    }, VEIL_FADE + VEIL_HOLD));
  }

  /**
   * 应用 S.theme：颜色真的会变时走一次过场，否则直接应用。
   * 「减少动效」开启时一步到位 —— 过场本身也是动效。
   */
  TH.switchTo = function () {
    if (TH.resolve() === resolved || S.reduceMotion) { TH.apply(true); return; }
    crossFade(function () { TH.apply(true); });
  };

  TH.set = function (mode, remember) {
    S.theme = (mode === 'light' || mode === 'dark') ? mode : 'auto';
    if (remember !== false) U.storage.set(KEY, S.theme);
    TH.switchTo();
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
      /* 系统主题变化也走一次过场（S.theme === 'auto' 时才会真的变色） */
      var onChange = function () { if (S.theme === 'auto') TH.switchTo(); };
      if (mql.addEventListener) mql.addEventListener('change', onChange);
      else if (mql.addListener) mql.addListener(onChange);
    }
  };

  C.theme = TH;
})();
