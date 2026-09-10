/* ===================================================================
   大事年表 — 指针交互
   Pointer Events 统一鼠标 / 触屏 / 触控笔
   - 左键拖动或单指拖动 → 平移（360°）
   - 滚轮 → 整体缩放；Ctrl/⌘ + 滚轮 → 横向折叠
   - 双指：按「绝对位移」判断主轴，垂直张合→整体缩放，横向张合→横向折叠
        （不能用比值判轴：水平并排时竖直间距基线近 0，抖动会被放大成假信号）
   - 拖动与点击用位移阈值区分
   - 编辑模式下拖动节点可调整事件时间
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

  /* 双指手势的「参考指距」：把绝对位移换算成相对张合比例。
     用固定参考值而不是「初始指距」，是因为两指几乎水平并排时竖直间距接近 0，
     任何除以它的比值都会被抖动放大几倍（实测 8px→26px ⇒ 3.25 倍）。 */
  var GESTURE_REF = 260;        /* px */

  var gesture = null;
  var drag = null;
  var wheelAcc = 0;
  var suppressClick = false;    /* 双指手势结束后抬手不再算作一次点击 */

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

    if (pointerCount === 1) suppressClick = false;

    if (pointerCount === 2) {
      /* 第二指落下：取消可能已经预备好的「拖拽改时间」快照 */
      if (drag) {
        C.store.discardUndo();
        drag = null;
        canvas.classList.remove('is-move-time');
      }
      startGesture();
      suppressClick = true;
      canvas.classList.remove('is-panning');
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

      /* 本次交互只要经历过双指手势，抬手就不再当作点击，
         否则捏合结束会被误判成「点了某个事件 / 在空白处新建事件」。 */
      var wasGesture = suppressClick;
      suppressClick = false;
      gesture = null;

      if (drag) {
        var started = drag.started;
        canvas.classList.remove('is-move-time');
        if (started) {
          S.emit('data', { kind: 'move' });
          S.emit('toast', { type: 'ok', text: '已调整事件时间（记得导出）' });
          C.store.refreshBounds();
        } else {
          C.store.discardUndo();   /* 丢弃预留的快照 */
          /* 按下但未发生位移 → 视为一次点击 */
          if (!wasGesture) handleClick(p.x, p.y);
        }
        drag = null;
        R.markDirty();
        return;
      }

      if (wasGesture) { R.markDirty(); return; }

      /* 点击（未超过阈值） */
      if (!p.panning && Math.abs(p.x - p.sx) < CLICK_THRESHOLD && Math.abs(p.y - p.sy) < CLICK_THRESHOLD) {
        handleClick(p.x, p.y);
      }
      return;
    }

    if (pointerCount === 1) {
      /* 从双指回到单指：重置手势基准与平移阈值，避免单指乱飘 */
      var keys = ownKeys(pointers);
      var rest = keys.length ? pointers[keys[0]] : null;
      if (rest) { rest.sx = rest.x; rest.sy = rest.y; rest.panning = false; }
      gesture = null;
      /* 注意：这里不清 suppressClick —— 要一直抑制到最后一根手指抬起 */
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
    var dx = Math.abs(pts[0].x - pts[1].x);
    var dy = Math.abs(pts[0].y - pts[1].y);
    gesture = {
      /* 起始指距：只用于「累计变化量」的归零基准，不参与比值运算 */
      dx0: dx,
      dy0: dy,
      /* 上一帧指距：用于算这一帧的增量 */
      lastDx: dx,
      lastDy: dy,
      axis: null
      /* 双指重心固定在起始位置：这样两指整体平移 = 平移画布，
         而围绕重心张合 = 缩放 / 折叠，互不干扰 */
    };
    gesture.cx = (pts[0].x + pts[1].x) / 2;
    gesture.cy = (pts[0].y + pts[1].y) / 2;
  }

  /**
   * 主轴判定：比较两轴的「绝对变化量」，绝不比较比值。
   * 两指几乎水平并排时竖直间距基线极小（个位数 px），比值会被抖动放大数倍，
   * 于是「水平捏合」被误判成「垂直捏合」——这是本次要修的核心 bug。
   * 另外要求主轴变化量明显大于次轴（1.6 倍），否则继续等，不急着锁轴。
   */
  function moveGesture() {
    if (!gesture) { startGesture(); return; }
    var pts = twoPointers();
    if (pts.length < 2) return;

    var dx = Math.abs(pts[0].x - pts[1].x);
    var dy = Math.abs(pts[0].y - pts[1].y);

    var ddx = dx - gesture.lastDx;      /* 这一帧的增量，用来推进缩放 */
    var ddy = dy - gesture.lastDy;

    if (!gesture.axis) {
      /* 锁轴用「自起始以来的累计变化量」，抖动会互相抵消 */
      var ax = Math.abs(dx - gesture.dx0) / GESTURE_REF;
      var ay = Math.abs(dy - gesture.dy0) / GESTURE_REF;
      var hi = Math.max(ax, ay), lo = Math.min(ax, ay);
      if (hi < 0.10) return;            /* ≈26px：还没真正张开，先不定轴 */
      if (hi < lo * 1.6) return;        /* 两轴一起动，方向不明，再等等 */
      gesture.axis = ax > ay ? 'fold' : 'zoom';
    }

    /* 步进比例同样用「绝对位移 / 参考指距」，小基数除法不会爆炸 */
    var step = 1 + (gesture.axis === 'zoom' ? ddy : ddx) / GESTURE_REF;
    step = U.clamp(step, 0.6, 1.68);    /* 单帧限幅：防止一帧跳变、也防误触 */

    gesture.lastDx = dx;
    gesture.lastDy = dy;

    var tf = C.transform.make(S.view, R.size);
    var wx = tf.s2x(gesture.cx);
    var wy = tf.s2y(gesture.cy);

    if (gesture.axis === 'zoom') S.view.zoom = C.transform.clampZoom(S.view.zoom * step);
    else S.view.fold = C.transform.clampFold(S.view.fold * step);

    var tf2 = C.transform.make(S.view, R.size);
    S.view.x += wx - tf2.s2x(gesture.cx);
    S.view.y += wy - tf2.s2y(gesture.cy);

    R.syncViewTarget();     /* 手势直接写 S.view，必须丢弃平滑目标，否则会被拉回 */
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
