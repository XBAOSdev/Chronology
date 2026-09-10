/* ===================================================================
   大事年表 — 启动
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  var VIEW_KEY = 'chrono.view';
  var HINT_KEY = 'chrono.hintSeen';

  function boot() {
    /* -------- 主题 -------- */
    C.theme.init();

    /* -------- 数据 -------- */
    var report = C.store.init();
    if (report && report.length) {
      var msgs = [];
      report.forEach(function (r) { (r.warnings || []).forEach(function (w) { msgs.push(r.id + '：' + w); }); });
      if (msgs.length) console.warn('[大事年表] 内置数据提示：\n' + msgs.join('\n'));
    }

    /* -------- 渲染 -------- */
    C.renderer.init(document.getElementById('stage'));

    /* -------- UI -------- */
    C.ui.initShell();
    C.ui.toolbar.init();
    C.ui.io.initDropZone();

    /* -------- 交互 -------- */
    C.pointer.init(document.getElementById('stage'));
    C.keyboard.init();

    /* -------- 全局订阅 -------- */
    S.on('toast', function (p) {
      if (!p) return;
      C.ui.toast(p.text, p.type, p.ms);
    });

    S.on('data', function () { C.renderer.markDirty(); });
    S.on('theme', function () { C.renderer.markDirty(); });

    /* -------- 视图偏好 -------- */
    restoreView();
    S.on('view', U.throttle(persistView, 600));

    /* -------- 首屏提示 -------- */
    showHint();

    /* -------- 站点图标回退 -------- */
    initSiteIcon();

    /* -------- 关闭提醒 -------- */
    window.addEventListener('beforeunload', function (e) {
      if (!S.dirty) return;
      var msg = '你有未导出的时间轴修改，关闭后不会保存。确定离开吗？';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    });

    /* -------- 空数据兜底 -------- */
    if (!S.timelines.length) {
      C.ui.toast('没有加载到任何时间轴，请检查 data/timelines 目录', 'err', 6000);
    }

    /* 便于排查 */
    window.CHRONO.version = '1.8.0';
  }

  function restoreView() {
    var saved = U.storage.get(VIEW_KEY, null);
    var ok = saved && typeof saved === 'object' &&
      isFinite(saved.x) && isFinite(saved.y) && isFinite(saved.zoom) && isFinite(saved.fold);

    if (ok) {
      S.view.x = saved.x;
      S.view.y = saved.y;
      S.view.zoom = C.transform.clampZoom(saved.zoom);
      S.view.fold = C.transform.clampFold(saved.fold);
      C.renderer.markDirty();
      /* 视口可能因窗口尺寸变化而偏离内容，做一次纵向兜底 */
      var h = C.store.contentHeight();
      if (S.view.y < -400 || S.view.y > h + 400) C.renderer.fitAll(false);
    } else {
      C.renderer.fitAll(false);
    }
    if (C.ui.toolbar) C.ui.toolbar.updateStatus();
  }

  function persistView() {
    U.storage.set(VIEW_KEY, {
      x: S.view.x, y: S.view.y, zoom: S.view.zoom, fold: S.view.fold
    });
  }

  /** 窄屏（手机）判定：断点与 styles/layout.css 保持一致 */
  function isNarrowScreen() {
    return window.matchMedia
      ? window.matchMedia('(max-width: 640px)').matches
      : window.innerWidth <= 640;
  }

  function showHint() {
    var el = document.getElementById('hint');
    if (!el) return;
    /* 窄屏不显示操作提示：提示里的键位在触屏上基本不可用，且窄屏排版拥挤 */
    if (isNarrowScreen()) {
      if (el.parentNode) el.parentNode.removeChild(el);
      return;
    }
    el.innerHTML = '<b>拖动</b> 平移　　<b>滚轮</b> 整体缩放　　' +
      '<b>Ctrl + 滚轮</b> 横向折叠　　<b>点击节点</b> 查看详情　　<b>Ctrl + F</b> 搜索';

    var seen = U.storage.get(HINT_KEY, false);
    el.classList.add('is-on');

    var hide = function () {
      el.classList.remove('is-on');
      window.removeEventListener('pointerdown', hide);
      window.removeEventListener('wheel', hide);
      window.removeEventListener('keydown', hide);
      U.storage.set(HINT_KEY, true);
    };

    if (seen) {
      setTimeout(hide, 5200);
      window.addEventListener('pointerdown', hide, { once: true });
      window.addEventListener('wheel', hide, { once: true, passive: true });
      window.addEventListener('keydown', hide, { once: true });
    } else {
      setTimeout(hide, 11000);
      window.addEventListener('pointerdown', hide);
      window.addEventListener('wheel', hide, { passive: true });
      window.addEventListener('keydown', hide);
    }
  }

  /**
   * 站点图标：优先使用官网图标 /bin/logo.webp；
   * 若该文件不可用（例如以 file:// 双击离线打开，绝对路径无对应文件），
   * 自动回退为内联 SVG，图标不会缺失，也不会产生任何外部网络请求。
   */
  function initSiteIcon() {
    var FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E" +
      "%3Crect width='32' height='32' rx='7' fill='%230f1115'/%3E" +
      "%3Cpath d='M5 16h22M9 11v10M16 8v16M23 11v10' stroke='%235b9cf8' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E";

    /* 图标整条链路由脚本创建，不在 HTML 里静态声明 <link rel="icon">：
       file:// 下 /bin/logo.webp 这种绝对路径必然取不到，浏览器还会因此往控制台
       抛一条「Unsafe attempt to load URL … 'file:' URLs are treated as unique
       security origins」——对离线双击打开的用户是纯噪音。 */
    var http = location.protocol === 'http:' || location.protocol === 'https:';

    var link = document.getElementById('site-icon');
    if (!link) {
      link = document.createElement('link');
      link.id = 'site-icon';
      link.rel = 'icon';
    }

    /* 关键顺序：必须先把 href/type 写好，再把 <link> 挂进文档。
       若以「href 为空」的状态插入，浏览器会立刻用文档自身的地址去取图标
       （file:// 下就是那条 Unsafe attempt 报错的真正来源），事后补 href 已来不及。 */
    link.type = http ? 'image/webp' : 'image/svg+xml';
    link.href = http ? '/bin/logo.webp' : FALLBACK;
    if (!link.parentNode) document.head.appendChild(link);

    if (!http) return;

    var probe = new Image();
    probe.onerror = function () {
      link.type = 'image/svg+xml';
      link.href = FALLBACK;
    };
    probe.src = '/bin/logo.webp';
  }

  /* ------------------------------ 启动 ------------------------------ */

  function fail(err) {
    console.error('[大事年表] 启动失败', err);
    var box = document.createElement('div');
    box.className = 'noscript';
    box.innerHTML = '<div><p><b>「大事年表」启动失败</b></p>' +
      '<p style="font-size:.78rem;color:#888">' + U.escapeHtml(err && err.message ? err.message : String(err)) + '</p>' +
      '<p style="font-size:.78rem;color:#888">请确认 src/ 与 data/ 目录完整，或使用支持 ES2017 的现代浏览器打开。</p></div>';
    document.body.appendChild(box);
  }

  function start() {
    try {
      boot();
    } catch (e) {
      fail(e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
