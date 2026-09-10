/* ===================================================================
   大事年表 — 指针交互
   Pointer Events 统一鼠标 / 触屏 / 触控笔
   · 左键拖动或单指拖动 → 平移（360°）
   · 滚轮 → 整体缩放；Ctrl/⌘ + 滚轮 → 横向折叠
   · 双指：判断初始移动主轴，垂直捏合→整体缩放，横向捏合→横向折叠
   · 拖动与点击用位移阈值区分
   · 编辑模式下拖动节点可调整事件时间
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var R = C.renderer;
  var TM = C.time;

  var P = {};

  var canvas = null;
  var pointers = Object.create(null);
  var pointerCount = 0;

  var CLICK_THRESHOLD = 6;      /* px */
  var gesture = null;
  var drag = null;
  var wheelAcc = 0;

  P.init = function (cv) {
    canvas = cv;

    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('lostpointercapture', onUp);

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    /* 阻止 iOS 的页面级缩放与滚动 */
    document.addEventListener('touchmove', function (e) {
      if (e.touches.length > 1 && !isUiTarget(e.target)) e.preventDefault();
    }, { passive: false });
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
    });
  };

  P.onResize = function () {
    if (drag) { drag = null; canvas.classList.remove('is-move-time'); }
    gesture = null;
  };

  function isUiTarget(t) {
    if (!t || !t.closest) return false;
    return !!t.closest('.toolbar, .modal-root, .detail, .toast-root, #status-wrap, .status, .dropzone, .fold-panel, .brand');
  }

  function pos(e) { return { x: e.clientX, y: e.clientY }; }

  /* ------------------------------ 按下 ------------------------------ */

  function onDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
    if (isUiTarget(e.target)) return;

    pointers[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: Date.now() };
    pointerCount++;
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}

    if (pointerCount === 2) {
      startGesture();
      drag = null;
      canvas.classList.remove('is-move-time');
      return;
    }
    if (pointerCount > 2) return;

    /* 编辑模式：命中「用户时间轴」的事件节点则准备拖动时间。
       系统内置时间轴不允许拖动，交给点击流程弹窗提醒。 */
    if (S.editMode) {
      var hit = R.hitTest(e.clientX, e.clientY);
      if (hit && hit.kind === 'event' && C.store.isUser(hit.timelineId)) {
        var ref = { timelineId: hit.timelineId, eventId: hit.eventId };
        var ev = C.store.findEvent(ref.timelineId, ref.eventId);
        if (ev) {
          C.store.beginDrag();
          drag = {
            ref: ref,
            origin: U.deepClone(ev.date),
            started: false
          };
          pointers[e.pointerId].drag = true;
          return;
        }
      }
    }

    canvas.classList.add('is-panning');
  }

  /* ------------------------------ 移动 ------------------------------ */

  function onMove(e) {
    var p = pointers[e.pointerId];
    if (!p) {
      updateHover(e);
      return;
    }
    if (e.cancelable) e.preventDefault();

    var prevX = p.x, prevY = p.y;
    p.x = e.clientX; p.y = e.clientY;

    if (pointerCount >= 2) { moveGesture(); return; }

    /* 拖拽调整事件时间 */
    if (drag && p.drag) {
      if (!drag.started) {
        if (Math.abs(p.x - p.sx) < 4) return;
        drag.started = true;
        canvas.classList.add('is-move-time');
        /* 开始拖动即关闭详情卡，避免卡片跟着节点乱跑 */
        if (C.ui && C.ui.details && C.ui.details.isOpen()) C.ui.details.close();
      }
      var tf = R.tf || C.transform.make(S.view, R.size);
      var wx = tf.s2x(p.x);
      var date = dateFromX(wx, drag.origin);
      C.store.moveEventTo(drag.ref, date, true);
      S.selectedEvent = { timelineId: drag.ref.timelineId, eventId: drag.ref.eventId };
      R.markDirty();
      if (C.ui && C.ui.details && C.ui.details.isOpen()) C.ui.details.refresh();
      return;
    }

    /* 平移 */
    var dx = p.x - prevX;
    var dy = p.y - prevY;
    if (!p.panning) {
      if (Math.abs(p.x - p.sx) < CLICK_THRESHOLD && Math.abs(p.y - p.sy) < CLICK_THRESHOLD) return;
      p.panning = true;
      canvas.classList.add('is-panning');
    }
    R.panBy(dx, dy);
    drag = drag || null;
  }

  function updateHover(e) {
    if (e.pointerType === 'touch') return;
    if (!canvas) return;
    var hit = R.hitTest(e.clientX, e.clientY);
    canvas.classList.toggle('is-over-node', !!hit);
  }

  /* ------------------------------ 抬起 ------------------------------ */

  function onUp(e) {
    var p = pointers[e.pointerId];
    if (!p) return;

    delete pointers[e.pointerId];
    pointerCount = Math.max(0, pointerCount - 1);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}

    if (pointerCount === 0) {
      canvas.classList.remove('is-panning');

      if (drag) {
        var started = drag.started;
        canvas.classList.remove('is-move-time');
        if (started) {
          S.emit('data', { kind: 'move' });
          S.emit('toast', { type: 'ok', text: '已调整事件时间（记得导出）' });
          C.store.refreshBounds();
        } else {
          /* 按下但未发生位移 → 视为一次点击 */
          C.store.discardUndo();   /* 丢弃预留的快照 */
          handleClick(p.x, p.y);
        }
        drag = null;
        R.markDirty();
        return;
      }

      gesture = null;

      /* 点击（未超过阈值） */
      if (!p.panning && Math.abs(p.x - p.sx) < CLICK_THRESHOLD && Math.abs(p.y - p.sy) < CLICK_THRESHOLD) {
        handleClick(p.x, p.y);
      }
      return;
    }

    if (pointerCount === 1) {
      /* 从双指回到单指：重置手势基准 */
      var keys = ownKeys(pointers);
      var rest = keys.length ? pointers[keys[0]] : null;
      if (rest) { rest.sx = rest.x; rest.sy = rest.y; }
      gesture = null;
    }
  }

  function handleClick(x, y) {
    var hit = R.hitTest(x, y);

    if (!hit) {
      /* 编辑模式下点击轨道空白处 → 在该时间点新建事件 */
      if (S.editMode) {
        var lane = laneAtY(y);
        if (lane && !lane.collapsed) { openCreateAt(lane, x); return; }
      }
      if (S.selectedEvent) {
        S.selectedEvent = null;
        R.markDirty();
        if (C.ui && C.ui.details) C.ui.details.close();
      }
      return;
    }

    if (hit.kind === 'cluster') {
      C.ui.cluster.open(hit.node);
      return;
    }
    S.selectedEvent = { timelineId: hit.timelineId, eventId: hit.eventId };
    R.markDirty();
    C.ui.details.open(hit.timelineId, hit.eventId, hit.node);
  }

  /* ------------------------------ 在指定位置新建事件 ------------------------------ */

  function openCreateAt(lane, sx) {
    var tf = R.tf || C.transform.make(S.view, R.size);
    var d = TM.fromX(tf.s2x(sx));
    var date = {
      year: d.isBC ? -d.year : d.year,
      month: d.month,
      precision: 'year',
      display: null
    };
    date.display = TM.format(Object.assign({}, date, { display: null }));

    /* 系统内置时间轴：先提醒「需复制副本」，确认后在副本上新增 */
    C.store.ensureEditablePrompt(lane.tl.id, '在这条时间轴上新增事件').then(function (tl) {
      if (!tl) return;
      C.ui.editor.openEventForm({ timelineId: tl.id, date: date });
    });
  }

  function laneAtY(y) {
    for (var i = 0; i < R.lanes.length; i++) {
      var L = R.lanes[i];
      var top = (R.tf ? R.tf.y2s(L.top) : 0);
      var bottom = (R.tf ? R.tf.y2s(L.bottom) : 0);
      if (y >= top && y <= bottom) return L;
    }
    return null;
  }

  /* ------------------------------ 滚轮 ------------------------------ */

  function onWheel(e) {
    if (isUiTarget(e.target)) return;
    e.preventDefault();

    var unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? 100 : 1);
    var dy = e.deltaY * unit;
    var dx = e.deltaX * unit;

    if (e.ctrlKey || e.metaKey) {
      /* 横向折叠 */
      var f = Math.exp(-dy * 0.0022);
      R.foldAt(e.clientX, f, e.clientY);
    } else if (e.shiftKey) {
      /* 横向平移 */
      R.panBy(-dy, 0);
    } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 2) {
      R.panBy(-dx, 0);
    } else {
      wheelAcc += dy;
      var z = Math.exp(-dy * 0.0016);
      R.zoomAt(e.clientX, e.clientY, z);
    }
  }

  /* ------------------------------ 双指手势 ------------------------------ */

  function ownKeys(o) {
    var out = [];
    for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) out.push(k); }
    return out;
  }

  function twoPointers() {
    var keys = ownKeys(pointers);
    var out = [];
    for (var i = 0; i < keys.length; i++) out.push(pointers[keys[i]]);
    return out;
  }

  function startGesture() {
    var pts = twoPointers();
    if (pts.length < 2) return;
    gesture = {
      dx: Math.abs(pts[0].x - pts[1].x) || 1,
      dy: Math.abs(pts[0].y - pts[1].y) || 1,
      zoom: S.view.zoom,
      fold: S.view.fold,
      axis: null,
      cx: (pts[0].x + pts[1].x) / 2,
      cy: (pts[0].y + pts[1].y) / 2,
      x: S.view.x,
      y: S.view.y
    };
  }

  function moveGesture() {
    if (!gesture) { startGesture(); return; }
    var pts = twoPointers();
    if (pts.length < 2) return;

    var dx = Math.abs(pts[0].x - pts[1].x) || 1;
    var dy = Math.abs(pts[0].y - pts[1].y) || 1;
    var rx = dx / gesture.dx;
    var ry = dy / gesture.dy;

    /* 判断主轴：首次明显变化时锁定，避免抖动 */
    if (!gesture.axis) {
      var ex = Math.abs(rx - 1), ey = Math.abs(ry - 1);
      if (ex < 0.06 && ey < 0.06) return;
      gesture.axis = ex > ey ? 'fold' : 'zoom';
    }

    var tf = C.transform.make(S.view, R.size);
    var wx = tf.s2x(gesture.cx);
    var wy = tf.s2y(gesture.cy);

    if (gesture.axis === 'zoom') {
      S.view.zoom = C.transform.clampZoom(gesture.zoom * ry);
    } else {
      S.view.fold = C.transform.clampFold(gesture.fold * rx);
    }
    var tf2 = C.transform.make(S.view, R.size);
    S.view.x += wx - tf2.s2x(gesture.cx);
    S.view.y += wy - tf2.s2y(gesture.cy);

    S.emit('view');
    R.markDirty();
  }

  /* ------------------------------ 工具 ------------------------------ */

  /** 把世界 X 转成日期，尽量保留原有精度 */
  function dateFromX(x, origin) {
    var d = TM.fromX(x);
    var pyear = origin && origin.precision ? origin.precision : 'year';
    var out = { year: d.isBC ? -d.year : d.year, precision: pyear, circa: !!(origin && origin.circa) };

    if (pyear === 'minute' || pyear === 'hour' || pyear === 'day' || pyear === 'month') {
      out.month = d.month;
    }
    if (pyear === 'minute' || pyear === 'hour' || pyear === 'day') {
      out.day = d.day;
    }
    if (pyear === 'minute' || pyear === 'hour') {
      out.hour = d.hour;
    }
    if (pyear === 'minute') {
      out.minute = d.minute;
    }
    if (pyear === 'century' || pyear === 'decade' || pyear === 'range') {
      out.precision = 'year';
      delete out.month; delete out.day; delete out.hour; delete out.minute;
    }
    out.display = TM.format(Object.assign({}, out, { display: null }));
    return out;
  }

  P.dateFromX = dateFromX;
  C.pointer = P;
})();
