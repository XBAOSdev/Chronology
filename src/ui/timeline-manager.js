/* ===================================================================
   大事年表 — 时间轴管理
   定位 / 折叠 / 显示隐藏 / 上移下移排序 / 改名（内置除外）/ 复制 / 导出 / 删除
   · 面板打开期间监听数据变化，任何外部改动都会即时反映到列表
   · 系统内置时间轴只读：改名等写操作会先提示「需复制副本」
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var R = C.renderer;

  var UI = C.ui;
  var TMGR = {};

  var api = null;
  var bodyEl = null;

  function toggleHidden(id) {
    if (S.hidden[id]) delete S.hidden[id];
    else S.hidden[id] = true;
    refresh();
  }

  function toggleCollapsed(id) {
    if (S.collapsed[id]) delete S.collapsed[id];
    else S.collapsed[id] = true;
    refresh();
  }

  function refresh() {
    C.store.refreshBounds();
    S.emit('data', { kind: 'visibility' });
    R.markDirty();
    if (bodyEl) paint();
    if (UI.toolbar) UI.toolbar.updateStatus();
  }

  TMGR.open = function () {
    if (api) { paint(); return; }
    api = UI.modal.open({
      title: '时间轴管理',
      subtitle: '系统内置内容只读；如需修改请先复制副本',
      size: 'lg',
      body: '<div id="tlm-body"></div>',
      footer: [
        { text: '新建时间轴', ghost: true, close: false, onClick: function () { UI.editor.openTimelineForm(null); } },
        { text: '导出全部（ZIP）', close: false, onClick: function () { UI.io.exportZip(); } },
        { spacer: true },
        { text: '关闭', primary: true }
      ],
      onClose: function () { api = null; bodyEl = null; },
      onMount: function (b) {
        bodyEl = b.querySelector('#tlm-body');
        paint();
      }
    });
  };

  function levelCounts(tl) {
    var c = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (var i = 0; i < tl.events.length; i++) {
      var l = Math.min(tl.events[i].level, 5);
      c[l] = (c[l] || 0) + 1;
    }
    return c;
  }

  function iconBtn(act, icon, label, cls) {
    return '<button type="button" class="btn btn--sm btn--icon' + (cls ? ' ' + cls : '') +
      '" data-act="' + act + '" title="' + U.escapeHtml(label) + '" aria-label="' + U.escapeHtml(label) + '">' +
      U.icon(icon) + '</button>';
  }

  function textBtn(act, label, cls) {
    return '<button type="button" class="btn btn--sm' + (cls ? ' ' + cls : '') +
      '" data-act="' + act + '" title="' + U.escapeHtml(label) + '">' + U.escapeHtml(label) + '</button>';
  }

  function paint() {
    if (!bodyEl) return;
    var list = S.timelines;
    if (!list.length) {
      bodyEl.innerHTML = '<div class="empty">还没有任何时间轴</div>';
      return;
    }

    var userCount = C.store.userCount();

    var html = '<div class="note" style="margin-bottom:.7rem">' +
      '共 ' + list.length + ' 条时间轴（内置 ' + C.store.builtins.length + ' 条，用户 ' + userCount + ' 条）。' +
      '内置时间轴永远只读，不会被覆盖。可用 ↑ ↓ 调整上下顺序，方便对照。</div>' +
      '<div class="list">' + list.map(function (tl, idx) {
        var builtin = C.store.isBuiltin(tl.id);
        var hidden = !!S.hidden[tl.id];
        var collapsed = !!S.collapsed[tl.id];
        var lc = levelCounts(tl);
        return '<div class="item item--tl" data-id="' + U.escapeHtml(tl.id) + '">' +
          '<span class="item__bar" style="background:' + U.escapeHtml(tl.color) + '"></span>' +
          '<span class="item__main">' +
            '<span class="item__title"><span class="item__name">' + U.escapeHtml(tl.title) + '</span>' +
              (builtin
                ? '<span class="pill">内置 · 只读</span>'
                : '<span class="pill pill--accent">用户</span>') +
              (tl.copyOf ? '<span class="pill">副本</span>' : '') +
              (hidden ? '<span class="pill">已隐藏</span>' : '') +
              (collapsed ? '<span class="pill">已折叠</span>' : '') +
            '</span>' +
            '<span class="item__meta">' +
              '<span class="mi">' + U.escapeHtml(tl.category) + '</span>' +
              (tl.subtitle ? '<span class="mi">' + U.escapeHtml(tl.subtitle) + '</span>' : '') +
              '<span class="mi">' + tl.events.length + ' 个事件</span>' +
              '<span class="mi">◆ 1级 ' + lc[1] + '</span>' +
              '<span class="mi">● 2级 ' + lc[2] + '</span>' +
              '<span class="mi">○ 3级 ' + lc[3] + '</span>' +
            '</span>' +
          '</span>' +
          '<span class="item__actions">' +
            '<span class="act-pair">' +
              iconBtn('up', 'arrowUp', '上移', idx === 0 ? 'is-disabled' : '') +
              iconBtn('down', 'arrowDown', '下移', idx === list.length - 1 ? 'is-disabled' : '') +
            '</span>' +
            textBtn('fit', '定位') +
            textBtn('collapse', collapsed ? '展开' : '折叠') +
            textBtn('hide', hidden ? '显示' : '隐藏') +
            textBtn('rename', '改名') +
            textBtn('copy', '复制') +
            textBtn('export', '导出') +
            (builtin ? '' : textBtn('delete', '删除', 'btn--danger')) +
          '</span>' +
        '</div>';
      }).join('') + '</div>';

    bodyEl.innerHTML = html;

    bodyEl.querySelectorAll('.item').forEach(function (row) {
      var id = row.getAttribute('data-id');
      row.querySelectorAll('[data-act]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (btn.classList.contains('is-disabled')) return;
          var act = btn.getAttribute('data-act');
          var tl = C.store.get(id);
          if (!tl) return;
          switch (act) {
            case 'up':
              C.store.moveTimeline(id, -1);
              paint();
              break;
            case 'down':
              C.store.moveTimeline(id, 1);
              paint();
              break;
            case 'fit':
              if (S.hidden[id]) { delete S.hidden[id]; refresh(); }
              R.fitTimeline(id, true);
              if (api) api.close();
              break;
            case 'collapse':
              toggleCollapsed(id);
              break;
            case 'hide':
              toggleHidden(id);
              break;
            case 'rename':
              doRename(id);
              break;
            case 'copy':
              doCopy(id);
              break;
            case 'export':
              UI.io.exportOne(id);
              break;
            case 'delete':
              doDelete(id);
              break;
          }
        });
      });
    });
  }

  /* ------------------------------ 改名 ------------------------------ */

  function doRename(id) {
    var tl = C.store.get(id);
    if (!tl) return;
    if (C.store.isBuiltin(id)) {
      /* 系统内置不可重命名 —— 先提示，确认后复制副本再改名 */
      C.store.ensureEditablePrompt(id, '重命名这条时间轴').then(function (copy) {
        if (!copy) return;
        openRenameForm(copy.id);
      });
      return;
    }
    openRenameForm(id);
  }

  function openRenameForm(id) {
    var tl = C.store.get(id);
    if (!tl) return;
    var COLORS = ['#e0625a', '#e08a4f', '#d9b64f', '#6fbf73', '#4f9bd9', '#6a6ad9', '#b45fc4', '#3fa8a8'];

    var body =
      '<div class="field">' +
        '<label class="field__label" for="rn-title">时间轴名称</label>' +
        '<input type="text" id="rn-title" value="' + U.escapeHtml(tl.title) + '" ' +
        'placeholder="例如：科技史" autocomplete="off" data-autofocus>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="rn-category">分类</label>' +
          '<input type="text" id="rn-category" value="' + U.escapeHtml(tl.category) + '" list="rn-cat" autocomplete="off">' +
          '<datalist id="rn-cat"><option value="中国史"><option value="世界史"><option value="专题史"></datalist>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="rn-sub">副标题（可选）</label>' +
          '<input type="text" id="rn-sub" value="' + U.escapeHtml(tl.subtitle || '') + '" autocomplete="off">' +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label">主题色</label>' +
        '<div class="swatches" id="rn-colors">' +
          COLORS.map(function (c) {
            return '<button type="button" class="swatch' + (c === tl.color ? ' is-on' : '') +
              '" data-color="' + c + '" style="--sw:' + c + '" aria-label="' + c + '"></button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label" for="rn-desc">描述（可选）</label>' +
        '<textarea id="rn-desc" maxlength="300" style="min-height:4rem">' + U.escapeHtml(tl.description || '') + '</textarea>' +
      '</div>' +
      '<div class="note">改名与调整只影响这条时间轴本身，事件内容不变。</div>';

    var color = tl.color;
    var form = null;

    /* 注意：save 必须定义在外层作用域 —— footer 的 onClick 在 onMount 之前
       就被求值，若 save 声明在 onMount 内部，会抛出「save is not defined」，
       表现为点「保存」毫无反应（DOM 事件派发会吞掉该异常）。 */
    function save() {
      if (!form) return false;
      var title = form.querySelector('#rn-title').value.trim();
      if (!title) { UI.toast('请填写名称', 'warn'); return false; }
      var ok = C.store.updateTimeline(id, {
        title: title,
        subtitle: form.querySelector('#rn-sub').value.trim(),
        category: form.querySelector('#rn-category').value.trim() || tl.category,
        color: color,
        description: form.querySelector('#rn-desc').value.trim()
      });
      if (!ok) { UI.toast('保存失败', 'err'); return false; }
      UI.toast('已保存', 'ok');
      paint();
      return true;
    }

    UI.modal.open({
      title: '重命名 / 编辑信息',
      subtitle: tl.events.length + ' 个事件',
      size: 'md',
      body: body,
      footer: [
        { text: '取消' },
        { text: '保存', primary: true, onClick: function () { return save(); } }
      ],
      onMount: function (b) {
        form = b;
        b.querySelectorAll('[data-color]').forEach(function (sw) {
          sw.addEventListener('click', function () {
            color = sw.getAttribute('data-color');
            b.querySelectorAll('[data-color]').forEach(function (x) { x.classList.remove('is-on'); });
            sw.classList.add('is-on');
          });
        });
      }
    });
  }

  /* ------------------------------ 复制 ------------------------------ */

  function doCopy(id) {
    var copy = C.store.copyTimeline(id);
    if (!copy) { UI.toast('复制失败', 'err'); return; }
    UI.toast('已复制为「' + copy.title + '」，可直接编辑', 'ok', 3200);
    paint();
    if (UI.toolbar) UI.toolbar.updateStatus();
  }

  /* ------------------------------ 删除 ------------------------------ */

  function doDelete(id) {
    var tl = C.store.get(id);
    if (!tl) return;
    UI.confirm({
      title: '删除时间轴',
      html: '确定删除「<b>' + U.escapeHtml(tl.title) + '</b>」及其 ' + tl.events.length +
        ' 个事件吗？<br>系统内置时间轴不受影响，此操作可通过撤销恢复。',
      okText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      C.store.deleteTimeline(id);
      paint();
      if (UI.toolbar) UI.toolbar.updateStatus();
      UI.toast('已删除时间轴', 'ok');
    });
  }

  TMGR.refresh = refresh;

  /* 面板打开期间，外部数据变化（新建/复制/导入/撤销等）即时刷新列表 */
  S.on('data', function () { if (api && bodyEl) paint(); });

  UI.timelineManager = TMGR;
})();
