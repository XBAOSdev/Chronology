/* ===================================================================
   大事年表 — 通用工具
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = {};

  U.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };

  var uidSeq = 0;
  U.uid = function (prefix) {
    uidSeq += 1;
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + uidSeq.toString(36) +
      Math.floor(Math.random() * 1296).toString(36);
  };

  U.pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  U.debounce = function (fn, wait) {
    var t = 0;
    return function () {
      var args = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(self, args); }, wait || 160);
    };
  };

  U.throttle = function (fn, wait) {
    var last = 0, timer = 0, lastArgs = null, self = null;
    return function () {
      var now = Date.now();
      lastArgs = arguments; self = this;
      var remain = wait - (now - last);
      if (remain <= 0) {
        if (timer) { clearTimeout(timer); timer = 0; }
        last = now;
        fn.apply(self, lastArgs);
      } else if (!timer) {
        timer = setTimeout(function () { last = Date.now(); timer = 0; fn.apply(self, lastArgs); }, remain);
      }
    };
  };

  U.deepClone = function (o) {
    if (o == null) return o;
    try { return JSON.parse(JSON.stringify(o)); } catch (e) { return o; }
  };

  U.escapeHtml = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  U.truncate = function (s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  };

  /** 截断为「整字」并保留完整语义的摘要（用于搜索摘要 60—80 字） */
  U.summarize = function (s, n) {
    s = String(s || '').replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n) + '…' : s;
  };

  U.escapeReg = function (s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };

  U.bytesToUtf8 = function (str) {
    if (window.TextEncoder) return new TextEncoder().encode(str);
    /* 退化实现（极老浏览器） */
    var utf8 = unescape(encodeURIComponent(str));
    var out = new Uint8Array(utf8.length);
    for (var i = 0; i < utf8.length; i++) out[i] = utf8.charCodeAt(i) & 0xff;
    return out;
  };

  U.downloadBlob = function (blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1500);
  };

  U.downloadText = function (text, filename, mime) {
    U.downloadBlob(new Blob([text], { type: (mime || 'application/json') + ';charset=utf-8' }), filename);
  };

  U.stamp = function (d) {
    d = d || new Date();
    return '' + d.getFullYear() + U.pad2(d.getMonth() + 1) + U.pad2(d.getDate());
  };

  /** 精确到分钟：YYYYMMDD_HHMM（截图 / 多次导出的文件不会互相覆盖） */
  U.stampTime = function (d) {
    d = d || new Date();
    return U.stamp(d) + '_' + U.pad2(d.getHours()) + U.pad2(d.getMinutes());
  };

  U.formatFileSize = function (bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  /* ---------- localStorage 安全封装（不可用时降级为内存） ---------- */
  var memStore = {};
  var lsOK = (function () {
    try {
      var k = '__chrono_probe__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  })();

  U.storage = {
    available: lsOK,
    get: function (k, fallback) {
      try {
        var v = lsOK ? window.localStorage.getItem(k) : (k in memStore ? memStore[k] : null);
        if (v == null) return fallback;
        return JSON.parse(v);
      } catch (e) { return fallback; }
    },
    set: function (k, v) {
      try {
        var s = JSON.stringify(v);
        if (lsOK) window.localStorage.setItem(k, s); else memStore[k] = s;
        return true;
      } catch (e) { return false; }
    },
    remove: function (k) {
      try { if (lsOK) window.localStorage.removeItem(k); else delete memStore[k]; } catch (e) {}
    }
  };

  /* ---------- 简单 SVG 图标（全部为自绘，无第三方图标库） ---------- */

  /* 齿轮：按等分角度计算齿形，保证轮廓闭合、连续（旧版手写路径左上角断开） */
  function gearPath(cx, cy, R, r, teeth) {
    var pts = [];
    var step = Math.PI * 2 / teeth;
    for (var i = 0; i < teeth; i++) {
      var t = i * step;
      var a1 = t - step * 0.50, a2 = t - step * 0.29, a3 = t + step * 0.29, a4 = t + step * 0.50;
      pts.push([cx + r * Math.cos(a1), cy + r * Math.sin(a1)]);
      pts.push([cx + R * Math.cos(a2), cy + R * Math.sin(a2)]);
      pts.push([cx + R * Math.cos(a3), cy + R * Math.sin(a3)]);
      pts.push([cx + r * Math.cos(a4), cy + r * Math.sin(a4)]);
    }
    return 'M' + pts.map(function (p) { return p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('L') + 'Z';
  }

  var GEAR_D = gearPath(12, 12, 9.7, 7.3, 8);

  var I = {
    timeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M3 12h18M3 18h18"/><circle cx="7" cy="6" r="2"/><circle cx="14" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
    /* 日期跳转：日历 + 定位环，语义为「跳到某一天」 */
    jump: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2.6"/><path d="M3 10h18M8 3.2v3.6M16 3.2v3.6"/><circle cx="12" cy="15.4" r="2.6"/><circle cx="12" cy="15.4" r=".9" fill="currentColor" stroke="none"/></svg>',
    theme: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="' + GEAR_D + '"/><circle cx="12" cy="12" r="2.9"/></svg>',
    help: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 1 1 3.6 2.5c-.7.3-1 .9-1 1.6v.3"/><circle cx="12" cy="17" r=".7" fill="currentColor" stroke="none"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 12h14"/></svg>',
    fit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"/><circle cx="12" cy="12" r="2.6"/></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M14.5 5.5L18.5 9.5"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12m0 0l-4.5-4.5M12 16l4.5-4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
    more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg>',
    copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M15 5H6a1 1 0 0 0-1 1v9"/></svg>',
    eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4l16 16"/><path d="M9.5 5.4A9.7 9.7 0 0 1 12 5c6.4 0 10 6 10 6a17 17 0 0 1-3.2 3.9M6.3 7.9A16.6 16.6 0 0 0 2 11s3.6 6 10 6c1 0 1.9-.1 2.7-.4"/></svg>',
    locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2.4"/></svg>',
    undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h9a7 7 0 0 1 0 14H8"/></svg>',
    redo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9h-9a7 7 0 0 0 0 14h5"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4.5 4.5L19 7"/></svg>',
    warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5L21 19.5H3z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.6" r=".8" fill="currentColor" stroke="none"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".8" fill="currentColor" stroke="none"/></svg>',
    link: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1"/><path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1"/></svg>',
    /* 上移 / 下移（调整顺序） */
    arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M6 13l6 6 6-6"/></svg>',
    /* 重命名：字形「T」 */
    rename: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 7V5h14v2"/><path d="M12 5v14"/><path d="M9 19h6"/></svg>',
    /* 横向折叠率（两侧箭头向内） */
    fold: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M9 8.5L4.5 12 9 15.5"/><path d="M15 8.5L19.5 12 15 15.5"/></svg>'
  };
  U.icon = function (name) { return I[name] || ''; };

  /* ==================================================================
     进出场动画小工具
     CSS 只负责「怎么动」，这里负责「什么时候真正从 DOM 移除」。
     时序完全由 CSS 变量 --dur / --dur-slow 决定，避免两处硬编码时长。
     ================================================================== */

  /** 读取元素当前生效的入场/出场动画时长（毫秒） */
  U.animMs = function (el) {
    if (!el || !window.getComputedStyle) return 0;
    var d = getComputedStyle(el).animationDuration || '0s';
    var first = String(d).split(',')[0].trim();
    var v = parseFloat(first);
    if (!isFinite(v)) v = 0;
    return /ms$/.test(first) ? v : v * 1000;
  };

  /**
   * 播放出场动画，结束后回调（默认隐藏元素）。
   * 同一元素重复调用会取消上一次的等待，避免「开→关→开」时被旧的定时器偷掉。
   */
  U.animOut = function (el, done) {
    if (!el) return;
    if (el.__animOut) { clearTimeout(el.__animOut.timer); el.__animOut = null; }
    el.classList.remove('is-in');
    el.classList.add('is-closing');

    var finished = false;
    var finish = function () {
      if (finished) return;
      finished = true;
      if (el.__animOut) clearTimeout(el.__animOut.timer);
      el.__animOut = null;
      el.classList.remove('is-closing');
      if (done) done();
      else el.hidden = true;
    };

    var dur = U.animMs(el);
    /* 减少动效时所有时长被压到 0.001ms，这里直接结束，不留 140ms 空窗 */
    if (!(dur > 8)) { finish(); return; }
    el.__animOut = { finish: finish, timer: setTimeout(finish, dur + 140) };
  };

  /** 取消未完成的出场动画，并把元素置为可见（用于「关闭途中又被打开」） */
  U.animIn = function (el) {
    if (!el) return;
    if (el.__animOut) { clearTimeout(el.__animOut.timer); el.__animOut = null; }
    el.classList.remove('is-closing');
    el.hidden = false;
  };

  /** 元素是否正在播放出场动画 */
  U.isClosing = function (el) { return !!(el && el.__animOut); };

  /* ==================================================================
     滚轮转发
     ================================================================== */

  /** 元素本身是不是一个滚动容器（与「还能不能滚」是两件事） */
  U.isScrollBox = function (el) {
    if (!el || el.nodeType !== 1) return false;
    var cs = window.getComputedStyle(el);
    return /(auto|scroll|overlay)/.test(cs.overflowY);
  };

  /** 元素在给定方向上是否「还能继续滚」 */
  U.canScroll = function (el, dy) {
    if (!U.isScrollBox(el)) return false;
    var max = el.scrollHeight - el.clientHeight;
    if (max <= 1) return false;
    return dy < 0 ? el.scrollTop > 0 : el.scrollTop < max - 1;
  };

  /**
   * 让浮层的「任意位置」都能滚动它的内容区。
   *
   * 起因（导出弹窗滚不动）：
   *   ① .modal__head / .modal__foot / 遮罩 都不是 .modal__body 的后代，
   *      滚轮落在它们上面时，浏览器找不到可滚动的祖先，于是什么也不发生；
   *   ② 内容区里再嵌一层 .scroll-y 时，它的 overscroll-behavior: contain
   *      会切断向 .modal__body 的滚动链，鼠标停在列表上同样滚不动。
   *
   * 规则：目标链上只要还有「确实能继续滚」的容器，就交回浏览器原生处理；
   * 否则把这一格滚轮转给 scroller。因此内层列表该滚时照旧优先滚它，
   * 滚到底后自动接管给外层，与常见桌面软件的观感一致。
   *
   * getScroller 用函数而不是元素：详情卡每次打开都重建 innerHTML，
   * 内容区节点会被替换，必须延迟到事件发生时才取。
   */
  U.wheelForward = function (container, getScroller) {
    if (!container) return;
    container.addEventListener('wheel', function (e) {
      var scroller = typeof getScroller === 'function' ? getScroller() : getScroller;
      if (!scroller) return;
      /* deltaMode: 0=像素 1=行 2=页；统一换算成像素，否则部分浏览器下步进过小 */
      var dy = e.deltaMode === 1 ? e.deltaY * 16
        : (e.deltaMode === 2 ? e.deltaY * (scroller.clientHeight || 400) : e.deltaY);
      if (!dy) return;

      /*
         从事件目标往上找「第一个滚动容器」，由它决定这一格滚轮归谁：
           · 它确实还能滚 → 交回浏览器原生处理（内层列表优先）；
           · 它已经滚不动 / 压根没有 → 由本函数转给 scroller。
         关键是不能只看「祖先链上有没有可滚的容器」：内层 .scroll-y 带着
         overscroll-behavior: contain，浏览器会在这里把滚动链掐断，
         于是哪怕外层 .modal__body 明明能滚，鼠标停在列表上也一动不动。
         所以必须停在「第一个」滚动容器上判断并主动接管。
       */
      var t = e.target, holder = null;
      while (t && t !== container && t.nodeType === 1) {
        if (U.isScrollBox(t)) { holder = t; break; }
        t = t.parentNode;
      }
      if (holder && U.canScroll(holder, dy)) return;   /* 内层还能滚 → 原生优先 */
      if (U.canScroll(scroller, dy)) {
        scroller.scrollTop += dy;
        e.preventDefault();
      }
    }, { passive: false });
  };

  C.util = U;
})();
