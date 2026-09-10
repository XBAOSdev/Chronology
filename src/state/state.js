/* ===================================================================
   大事年表 — 全局状态 + 极简发布订阅
   不引入任何框架。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});

  var listeners = Object.create(null);
  var S = {};

  /* ------------------------------ 状态 ------------------------------ */
  S.view = { x: 0, y: 0, zoom: 1, fold: 1 };   /* 画布中心的世界坐标 + 缩放 */

  S.theme = 'auto';          /* auto | light | dark */
  S.reduceMotion = false;

  S.editMode = false;
  S.selectedEvent = null;    /* { timelineId, eventId } */
  S.highlight = null;        /* { x, until } 搜索跳转后的临时高亮 */
  S.pendingFocus = null;     /* 跨模块请求：定位到某事件 */
  S.builtinEditPrompted = Object.create(null);  /* 本次会话已提醒过「系统时间轴需复制」的时间轴 */

  S.query = '';              /* 搜索关键词 */
  S.searchOpen = false;
  S.matchIds = null;         /* Set，搜索命中集合；null 表示未搜索 */

  S.levelFilter = 0;         /* 0 = 自动，1—3 = 手动上限 */
  S.showGrid = true;
  S.showCursor = true;
  S.showSharedLinks = true;

  S.timelines = [];          /* 合并后的时间轴（内置 + 用户） */
  S.hidden = Object.create(null);
  S.collapsed = Object.create(null);

  S.dirty = false;           /* 是否存在尚未导出的用户数据 */
  S.editTipDismissed = false;

  /* ------------------------------ 订阅 ------------------------------ */

  S.on = function (evt, fn) {
    (listeners[evt] || (listeners[evt] = [])).push(fn);
    return function () { S.off(evt, fn); };
  };

  S.off = function (evt, fn) {
    var arr = listeners[evt];
    if (!arr) return;
    var i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };

  S.emit = function (evt, payload) {
    var arr = listeners[evt];
    if (arr) {
      for (var i = 0; i < arr.length; i++) {
        try { arr[i](payload); } catch (e) { /* 单个订阅出错不影响其它 */ }
      }
    }
    var all = listeners['*'];
    if (all) {
      for (var j = 0; j < all.length; j++) {
        try { all[j](evt, payload); } catch (e) {}
      }
    }
  };

  /* ------------------------------ 派生 ------------------------------ */

  /** 当前应显示的轨道列表 */
  S.visibleTimelines = function () {
    var out = [];
    for (var i = 0; i < S.timelines.length; i++) {
      var tl = S.timelines[i];
      if (!S.hidden[tl.id]) out.push(tl);
    }
    return out;
  };

  /** 自动分级：横向越压缩，只显示越高等级的事件 */
  S.autoMaxLevel = function (pxPerYear) {
    if (pxPerYear >= 8) return 5;
    if (pxPerYear >= 2.5) return 3;
    if (pxPerYear >= 0.8) return 2;
    return 1;
  };

  S.maxLevel = function (pxPerYear) {
    return S.levelFilter > 0 ? S.levelFilter : S.autoMaxLevel(pxPerYear);
  };

  S.markDirty = function () {
    if (!S.dirty) { S.dirty = true; S.emit('dirty'); }
  };

  S.setClean = function () {
    if (S.dirty) { S.dirty = false; S.emit('dirty'); }
  };

  C.state = S;
})();
