/* ===================================================================
   大事年表 — 悬浮按钮组 + 状态区 + 横向折叠控制面板
   无顶栏无底栏：上下贴边的毛玻璃悬浮按钮，移动端收纳到「更多」面板。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  var UI = C.ui;
  var TB = {};

  var topEl = null, bottomEl = null, statusEl = null;
  var foldBtn = null, foldPanel = null, foldRange = null, foldNow = null;
  var ACTIONS = [];

  function A(id, label, icon, group, run, opts) {
    return Object.assign({
      id: id, label: label, icon: icon, group: group, run: run,
      mobile: 'sheet', active: null
    }, opts || {});
  }

  ACTIONS = [
    A('timelines', '时间轴管理', 'timeline', 'top', function () { UI.timelineManager.open(); }),
    A('search', '搜索', 'search', 'top', function () { UI.search.open(); }, { mobile: 'bar' }),
    A('jump', '日期跳转', 'jump', 'top', function () { UI.dateJump.open(); }, { mobile: 'bar' }),
    A('undo', '撤销', 'undo', 'top', function () {
      if (C.store.undo()) UI.toast('已撤销');
      else UI.toast('没有可撤销的操作', 'warn');
    }),
    A('redo', '重做', 'redo', 'top', function () {
      if (C.store.redo()) UI.toast('已重做');
      else UI.toast('没有可重做的操作', 'warn');
    }),
    A('theme', '主题', 'theme', 'top', function () {
      var t = C.theme.toggle();
      TB.render();
      UI.toast('已切换到' + (t === 'dark' ? '深色' : '浅色') + '模式');
    }),
    A('settings', '设置', 'settings', 'top', function () { UI.settings.open(); }),
    A('help', '帮助', 'help', 'top', function () { UI.settings.openHelp(); }),

    A('zoomOut', '缩小', 'minus', 'bottom', function () {
      C.renderer.zoomAt(C.renderer.size.w / 2, C.renderer.size.h / 2, 1 / 1.2);
    }, { mobile: 'bar' }),
    A('zoomIn', '放大', 'plus', 'bottom', function () {
      C.renderer.zoomAt(C.renderer.size.w / 2, C.renderer.size.h / 2, 1.2);
    }, { mobile: 'bar' }),
    A('fold', '折叠率', 'fold', 'bottom', function () { TB.toggleFoldPanel(); }, {
      mobile: 'bar',
      active: function () { return foldOpen(); }
    }),
    A('reset', '重置视图', 'fit', 'bottom', function () { C.renderer.resetView(); }),
    A('edit', '编辑模式', 'edit', 'bottom', function () { TB.toggleEdit(); }, {
      mobile: 'bar',
      active: function () { return S.editMode; }
    }),
    A('import', '导入', 'upload', 'bottom', function () { UI.io.openImport(); }),
    A('export', '导出', 'download', 'bottom', function () { UI.io.openExport(); })
  ];

  function isNarrow() { return window.innerWidth <= 640; }

  function makeButton(a) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tbtn';
    b.setAttribute('data-action', a.id);
    b.setAttribute('aria-label', a.label);
    b.title = a.label;
    b.innerHTML = U.icon(a.icon) + '<span class="tbtn__label">' + U.escapeHtml(a.label) + '</span>';
    b.addEventListener('click', function () { a.run(); });
    return b;
  }

  function makeMoreButton(kind) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'tbtn';
    b.setAttribute('aria-label', '更多');
    b.title = '更多';
    b.innerHTML = U.icon('more') + '<span class="tbtn__label">更多</span>';
    b.addEventListener('click', function () { openMore(kind); });
    return b;
  }

  TB.render = function () {
    if (!topEl) {
      topEl = document.getElementById('toolbar-top');
      bottomEl = document.getElementById('toolbar-bottom');
      statusEl = document.getElementById('status');
    }
    topEl.innerHTML = '';
    bottomEl.innerHTML = '';

    var narrow = isNarrow();

    var topActions = ACTIONS.filter(function (a) { return a.group === 'top'; });
    var bottomActions = ACTIONS.filter(function (a) { return a.group === 'bottom'; });

    topActions.forEach(function (a) {
      if (narrow && a.mobile === 'sheet') return;
      topEl.appendChild(makeButton(a));
    });
    if (narrow) topEl.appendChild(makeMoreButton('top'));

    bottomActions.forEach(function (a) {
      if (narrow && a.mobile === 'sheet') return;
      bottomEl.appendChild(makeButton(a));
    });
    if (narrow) bottomEl.appendChild(makeMoreButton('bottom'));

    syncState();
    updateStatus();
    updateHistoryButtons();
    if (foldOpen()) { positionFoldPanel(); syncFoldPanel(); }
  };

  function openMore(kind) {
    var list = ACTIONS.filter(function (a) {
      return a.group === kind && a.mobile === 'sheet';
    });
    var other = ACTIONS.filter(function (a) {
      return a.group !== kind && a.mobile === 'sheet';
    });
    var all = list.concat(other);

    var html = '<div class="grid-actions">' + all.map(function (a) {
      return '<button type="button" class="btn" data-more="' + a.id + '">' +
        U.icon(a.icon) + '<span>' + U.escapeHtml(a.label) + '</span></button>';
    }).join('') + '</div>';

    var api = UI.modal.open({
      title: '更多操作',
      size: 'sm',
      body: html,
      onMount: function (body) {
        body.querySelectorAll('[data-more]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-more');
            var act = ACTIONS.filter(function (x) { return x.id === id; })[0];
            api.close();
            if (act) act.run();
          });
        });
      }
    });
  }

  function syncState() {
    ACTIONS.forEach(function (a) {
      if (!a.active) return;
      var btn = document.querySelector('[data-action="' + a.id + '"]');
      if (!btn) return;
      var on = !!a.active();
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function updateHistoryButtons() {
    ['undo', 'redo'].forEach(function (id) {
      var btn = document.querySelector('[data-action="' + id + '"]');
      if (!btn) return;
      btn.disabled = id === 'undo' ? !C.store.canUndo() : !C.store.canRedo();
    });
  }

  /* ==================================================================
     横向折叠控制面板（浮层，不遮挡画布，便于实时观察效果）
     ================================================================== */

  /** 面板是否「真正打开」（关闭动画进行中不算打开） */
  function foldOpen() { return !!(foldPanel && !foldPanel.hidden && !U.isClosing(foldPanel)); }

  TB.toggleFoldPanel = function () {
    if (!foldPanel) buildFoldPanel();
    if (foldOpen()) closeFoldPanel(); else openFoldPanel();
  };

  function buildFoldPanel() {
    foldPanel = document.createElement('div');
    foldPanel.className = 'fold-panel';
    foldPanel.hidden = true;
    foldPanel.setAttribute('role', 'dialog');
    foldPanel.setAttribute('aria-label', '横向折叠控制');

    var presets = [
      ['100', '世纪'],
      ['10', '十年'],
      ['1', '年'],
      [(1 / 12).toFixed(6), '月'],
      [(1 / 365.25).toFixed(8), '日']
    ];

    foldPanel.innerHTML =
      '<div class="fold-panel__head">' +
        '<span class="fold-panel__title">' + U.icon('fold') + '横向折叠率</span>' +
        '<button type="button" class="tbtn fold-panel__x" data-fp="close" aria-label="关闭">' + U.icon('close') + '</button>' +
      '</div>' +
      '<div class="fold-panel__row">' +
        '<button type="button" class="btn btn--sm fp-btn" data-fp="in" title="更紧凑（一屏看到更多时间）">' +
          U.icon('minus') + '紧凑</button>' +
        '<input type="range" id="fp-range" min="0" max="400" step="1" value="200" aria-label="折叠率">' +
        '<button type="button" class="btn btn--sm fp-btn" data-fp="out" title="更宽松（一屏看到更少时间）">' +
          '宽松' + U.icon('plus') + '</button>' +
      '</div>' +
      '<div class="fold-panel__now" id="fp-now"></div>' +
      '<div class="fold-panel__presets">' +
        presets.map(function (p) {
          return '<button type="button" class="btn btn--sm" data-fp="preset" data-years="' + p[0] + '">1 ' + p[1] + '/屏</button>';
        }).join('') +
      '</div>' +
      '<button type="button" class="btn btn--sm fp-full" data-fp="reset">恢复默认折叠</button>' +
      '<div class="fold-panel__hint">横向折叠只压缩时间密度，<b>节点与文字大小不变</b>；' +
      '「＋ / −」是整体缩放，两者都会变化。</div>';

    document.body.appendChild(foldPanel);

    foldRange = foldPanel.querySelector('#fp-range');
    foldNow = foldPanel.querySelector('#fp-now');

    foldRange.addEventListener('input', function () {
      var v = parseInt(foldRange.value, 10);
      C.renderer.setFold(Math.pow(10, v / 100 - 2));
      syncFoldPanel();
    });

    foldPanel.querySelectorAll('[data-fp]').forEach(function (b) {
      b.addEventListener('click', function () {
        var act = b.getAttribute('data-fp');
        if (act === 'close') { closeFoldPanel(); return; }
        if (act === 'in') { C.renderer.foldBy(1 / 1.4); syncFoldPanel(); return; }
        if (act === 'out') { C.renderer.foldBy(1.4); syncFoldPanel(); return; }
        if (act === 'reset') { C.renderer.setFold(1); syncFoldPanel(); return; }
        if (act === 'preset') {
          C.renderer.setYearsPerScreen(parseFloat(b.getAttribute('data-years')));
          syncFoldPanel();
        }
      });
    });

    /* 点击面板外 / 按 Esc 关闭 */
    document.addEventListener('pointerdown', function (e) {
      if (!foldOpen()) return;
      if (foldPanel.contains(e.target)) return;
      var btn = document.querySelector('[data-action="fold"]');
      if (btn && btn.contains(e.target)) return;
      closeFoldPanel();
    }, true);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && foldOpen()) closeFoldPanel();
    });
  }

  function openFoldPanel() {
    if (!foldPanel) return;
    var btn = document.querySelector('[data-action="fold"]');
    foldBtn = btn;
    /* 关闭动画还没播完就又被打开：取消它，避免被旧定时器隐藏 */
    U.animIn(foldPanel);
    positionFoldPanel();
    syncFoldPanel();
    syncState();
  }

  function closeFoldPanel() {
    if (!foldPanel || foldPanel.hidden) return;
    U.animOut(foldPanel);
    syncState();
  }

  function positionFoldPanel() {
    if (!foldPanel || foldPanel.hidden || !bottomEl) return;
    /* 定位只依赖几何，与关闭动画无关 */
    var r = bottomEl.getBoundingClientRect();
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    var panelW = foldPanel.offsetWidth || 320;
    var bottom = Math.max(8, vh - r.top + 8);
    var right = Math.max(8, Math.min(vw - panelW - 8, vw - r.right));
    foldPanel.style.bottom = Math.round(bottom) + 'px';
    foldPanel.style.right = Math.round(right) + 'px';
  }

  function syncFoldPanel() {
    if (!foldPanel || foldPanel.hidden) return;
    var f = S.view.fold;
    var v = Math.round((Math.log(Math.max(f, 1e-9)) / Math.LN10 + 2) * 100);
    foldRange.value = U.clamp(v, 0, 400);
    var years = C.renderer.yearsPerScreen();
    var span;
    if (years >= 1000) span = Math.round(years / 100) + ' 世纪/屏';
    else if (years >= 2) span = Math.round(years) + ' 年/屏';
    else if (years >= 1 / 12) span = Math.max(1, Math.round(years * 12)) + ' 月/屏';
    else if (years >= 1 / 365) span = Math.max(1, Math.round(years * 365)) + ' 天/屏';
    else span = Math.max(1, Math.round(years * 525960)) + ' 分钟/屏';
    foldNow.innerHTML = '当前折叠 ×' + formatFold(f) + '　　' + span;
  }

  /* ------------------------------ 状态区 ------------------------------ */

  function chip(text, cls) {
    return '<span class="chip' + (cls ? ' ' + cls : '') + '">' + text + '</span>';
  }

  function updateStatus() {
    if (!statusEl) return;
    var tf = C.renderer.tf;
    var ppy = tf ? tf.pxPerYear : C.transform.pxPerYear(S.view);

    var parts = [];
    parts.push(chip('<span class="chip__dot"></span>整体 ' + Math.round(S.view.zoom * 100) + '%'));

    var foldTxt;
    var yearsPerScreen = C.renderer.size.w / ppy;
    if (yearsPerScreen >= 1000) foldTxt = '跨度 ' + Math.round(yearsPerScreen / 100) + ' 世纪/屏';
    else if (yearsPerScreen >= 2) foldTxt = '跨度 ' + Math.round(yearsPerScreen) + ' 年/屏';
    else if (yearsPerScreen >= 1 / 12) foldTxt = '跨度 ' + Math.max(1, Math.round(yearsPerScreen * 12)) + ' 月/屏';
    else if (yearsPerScreen >= 1 / 365) foldTxt = '跨度 ' + Math.max(1, Math.round(yearsPerScreen * 365)) + ' 天/屏';
    else foldTxt = '跨度 ' + Math.max(1, Math.round(yearsPerScreen * 525960)) + ' 分钟/屏';
    parts.push(chip('折叠 ×' + formatFold(S.view.fold) + '　' + foldTxt));

    var maxLevel = S.maxLevel(ppy);
    /* 自动模式下低等级标签会在「确实空旷」的地方被机会性地补显出来，
       所以状态里要说明这一点，否则用户会以为等级筛选失效了。 */
    parts.push(chip('显示至 ' + maxLevel + ' 级' +
      (S.levelFilter ? '（手动）' : '（自动，空旷处补充）')));

    if (S.matchIds) {
      parts.push(chip('命中 ' + S.matchIds.size + ' 条', 'chip--edit'));
    }

    if (S.editMode) {
      parts.push(chip('<span class="chip__dot"></span>编辑模式　数据仅存于当前页面', 'chip--edit'));
    }
    if (S.dirty) {
      parts.push(chip('<span class="chip__dot"></span>有未导出的修改', 'chip--dirty'));
    }

    statusEl.innerHTML = parts.join('');
  }

  function formatFold(f) {
    if (f >= 1000) return Math.round(f).toString();
    if (f >= 10) return f.toFixed(0);
    if (f >= 1) return f.toFixed(2).replace(/\.?0+$/, '');
    if (f >= 0.01) return f.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    return f.toExponential(1);
  }

  /* ------------------------------ 编辑模式 ------------------------------ */

  TB.toggleEdit = function () {
    S.editMode = !S.editMode;
    S.emit('edit', S.editMode);
    syncState();
    updateStatus();
    C.renderer.markDirty();
    UI.toast(S.editMode
      ? '已进入编辑模式：点击事件可修改，点击轨道空白处可新增，拖动节点可改时间'
      : '已退出编辑模式', S.editMode ? 'ok' : null, 3400);
    if (S.editMode && !S.editTipDismissed) showEditTip();
  };

  function showEditTip() {
    S.editTipDismissed = true;
    UI.modal.open({
      title: '编辑模式已开启',
      size: 'sm',
      body:
        '<div class="note note--warn"><b>编辑内容只保存在当前页面内存中。</b><br>' +
        '刷新或关闭标签页后，所有新建、修改、导入的内容都会消失。请随时使用「导出」保存为文件。</div>' +
        '<div class="note" style="margin-top:.6rem">' +
        '　点击事件节点 → 直接在卡片里改时间、标题、层级、标签、简介<br>' +
        '　点击轨道空白处 → 在该时间点新增事件<br>' +
        '　按住事件节点左右拖动 → 调整事件时间（轻微点击不会误触发拖动）<br>' +
        '　系统内置时间轴为<b>只读</b>，编辑时会弹窗提醒并复制出副本</div>',
      footer: [{ text: '知道了', primary: true }]
    });
  }

  TB.updateStatus = updateStatus;
  TB.syncState = syncState;
  TB.positionFoldPanel = positionFoldPanel;

  TB.init = function () {
    TB.render();
    window.addEventListener('resize', U.debounce(function () {
      TB.render();
    }, 220));

    S.on('view', U.throttle(function () {
      updateStatus();
      if (foldOpen()) syncFoldPanel();
    }, 90));
    S.on('data', updateStatus);
    S.on('dirty', updateStatus);
    S.on('edit', function () { syncState(); updateStatus(); });
    S.on('history', updateHistoryButtons);
  };

  C.ui.toolbar = TB;
})();
