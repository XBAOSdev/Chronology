/* ===================================================================
   大事年表 — 键盘快捷键
   方向键平移 / +− 缩放 / Ctrl+滚轮 折叠 / Ctrl+F 搜索 / Ctrl+G 日期跳转
   E 编辑模式 / Esc 关闭弹窗 / Ctrl+Z 撤销 / Ctrl+Shift+Z 重做 / Ctrl+0 重置
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var S = C.state;
  var R = C.renderer;

  var K = {};

  function isTyping(el) {
    if (!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (el.isContentEditable) return true;
    return false;
  }

  K.init = function () {
    window.addEventListener('keydown', onKeyDown, true);
  };

  function onKeyDown(e) {
    var typing = isTyping(e.target);
    var mod = e.ctrlKey || e.metaKey;
    var key = e.key;

    /* Esc 永远有效 */
    if (key === 'Escape') {
      if (C.ui.modal.isOpen()) { C.ui.modal.closeTop(); e.preventDefault(); return; }
      if (C.ui.details && C.ui.details.isOpen()) { C.ui.details.close(); e.preventDefault(); return; }
      if (C.ui.search && C.ui.search.isOpen()) { C.ui.search.close(); e.preventDefault(); return; }
      if (S.selectedEvent) {
        S.selectedEvent = null;
        R.markDirty();
        e.preventDefault();
        return;
      }
      return;
    }

    if (typing && !mod) return;

    /* Ctrl / ⌘ 组合 */
    if (mod) {
      if (key === 'f' || key === 'F') { C.ui.search.open(); e.preventDefault(); return; }
      if (key === 'g' || key === 'G') { C.ui.dateJump.open(); e.preventDefault(); return; }
      if (key === 'z' || key === 'Z') {
        if (e.shiftKey) { if (C.store.redo()) C.ui.toast('已重做'); }
        else { if (C.store.undo()) C.ui.toast('已撤销'); }
        e.preventDefault();
        return;
      }
      if (key === 'y' || key === 'Y') { if (C.store.redo()) C.ui.toast('已重做'); e.preventDefault(); return; }
      if (key === '0') { R.resetView(); e.preventDefault(); return; }
      if (key === 's' || key === 'S') { C.ui.io.openExport(); e.preventDefault(); return; }
      if (key === 'o' || key === 'O') { C.ui.io.openImport(); e.preventDefault(); return; }
      if (key === '+') { R.zoomAt(R.size.w / 2, R.size.h / 2, 1.15); e.preventDefault(); return; }
      if (key === '-') { R.zoomAt(R.size.w / 2, R.size.h / 2, 1 / 1.15); e.preventDefault(); return; }
      return;
    }

    if (typing) return;

    var step = e.shiftKey ? 320 : 90;
    switch (key) {
      case 'ArrowLeft': R.panBy(step, 0); e.preventDefault(); return;
      case 'ArrowRight': R.panBy(-step, 0); e.preventDefault(); return;
      case 'ArrowUp': R.panBy(0, step); e.preventDefault(); return;
      case 'ArrowDown': R.panBy(0, -step); e.preventDefault(); return;
      case '+': case '=': R.zoomAt(R.size.w / 2, R.size.h / 2, 1.18); e.preventDefault(); return;
      case '-': case '_': R.zoomAt(R.size.w / 2, R.size.h / 2, 1 / 1.18); e.preventDefault(); return;
      case 'e': case 'E': C.ui.toolbar.toggleEdit(); e.preventDefault(); return;
      case 'f': case 'F': C.ui.search.open(); e.preventDefault(); return;
      case 'g': case 'G': C.ui.dateJump.open(); e.preventDefault(); return;
      case 'h': case 'H': case '?': C.ui.settings.openHelp(); e.preventDefault(); return;
      case '0': R.resetView(); e.preventDefault(); return;
      case '/': C.ui.search.open(); e.preventDefault(); return;
      default: return;
    }
  }

  K.SHORTCUTS = [
    ['拖动画布 / 单指拖动', '360° 平移'],
    ['滚轮', '整体缩放（含文字）'],
    ['Ctrl / ⌘ + 滚轮', '横向折叠（只压缩时间）'],
    ['双指垂直捏合', '整体缩放'],
    ['双指横向捏合', '横向折叠'],
    ['点击事件节点', '打开详情卡（编辑模式下可内联修改）'],
    ['点击画布空白处', '关闭详情卡'],
    ['方向键', '平移画布'],
    ['+ / −', '整体缩放'],
    ['Ctrl / ⌘ + F', '搜索'],
    ['Ctrl / ⌘ + G', '日期跳转'],
    ['E', '切换编辑模式'],
    ['Ctrl / ⌘ + Z', '撤销'],
    ['Ctrl / ⌘ + Shift + Z', '重做'],
    ['Ctrl / ⌘ + 0', '重置视图'],
    ['Ctrl / ⌘ + S', '导出'],
    ['Ctrl / ⌘ + O', '导入'],
    ['Esc', '关闭弹窗 / 取消选中'],
    ['编辑模式下点击轨道空白处', '在该时间点新建事件'],
    ['编辑模式下拖动节点', '调整事件时间（点击与拖拽自动区分）']
  ];

  C.keyboard = K;
})();
