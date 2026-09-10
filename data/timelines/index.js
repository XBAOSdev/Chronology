/* ===================================================================
   大事年表 — 内置时间轴注册文件
   只负责建立注册表与数据校验的入口，不写任何具体事件。
   使用普通 script + 全局变量，保证 file:// 双击打开时也能加载。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  C.builtinTimelines = C.builtinTimelines || [];

  /* 事件构造器：各数据文件共用（挂在全局，避免重复实现） */
  C.makeEvent = function (timelineId, id, title, display, date, level, summary, extra) {
    var ev = {
      id: id,
      timelineId: timelineId,
      title: title,
      summary: summary || '',
      date: { display: display },
      level: level || 2,
      tags: [],
      region: '',
      viewpoint: '',
      sharedEventId: null
    };
    if (date) {
      for (var k in date) { if (Object.prototype.hasOwnProperty.call(date, k)) ev.date[k] = date[k]; }
    }
    if (extra) {
      for (var k2 in extra) { if (Object.prototype.hasOwnProperty.call(extra, k2)) ev[k2] = extra[k2]; }
    }
    return ev;
  };
})();
