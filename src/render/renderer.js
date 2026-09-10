/* ===================================================================
   大事年表 — Canvas 渲染器
   分层绘制：网格 → 轨道与刻度 → 事件节点 → 游标 / 高亮
   只渲染视口内的元素；状态变化后按需重绘。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var T = C.transform;
  var TM = C.time;
  var EV = C.events;

  var R = {};

  var canvas = null;
  var ctx = null;
  R.size = { w: 0, h: 0 };
  R.dpr = 1;
  R.lanes = [];
  R.tf = null;
  R.hover = null;

  var dirty = true;
  var rafId = 0;
  var tween = null;

  R.markDirty = function () { dirty = true; };

  /* ------------------------------ 初始化 ------------------------------ */

  R.init = function (cv) {
    canvas = cv;
    ctx = cv.getContext('2d', { alpha: false });
    R.ctx = ctx;

    resize();
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function () { resize(); R.markDirty(); });
      ro.observe(document.documentElement);
    } else {
      window.addEventListener('resize', function () { resize(); R.markDirty(); });
    }
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { resize(); R.markDirty(); }, 220);
    });

    loop();
  };

  function resize() {
    if (!canvas) return;
    var w = Math.max(1, window.innerWidth);
    var h = Math.max(1, window.innerHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    R.dpr = dpr;
    R.size.w = w;
    R.size.h = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dirty = true;
    if (C.pointer) C.pointer.onResize();
  }

  R.resize = resize;

  /* ------------------------------ 渲染循环 ------------------------------ */

  function loop() {
    rafId = requestAnimationFrame(loop);
    if (tween) stepTween();
    if (!dirty) return;
    dirty = false;
    try {
      draw();
    } catch (e) {
      /* 单帧绘制异常不阻断循环，但前几次打印出来便于排查 */
      R._errCount = (R._errCount || 0) + 1;
      if (R._errCount <= 3 && window.console) console.error('[大事年表] 渲染异常', e);
    }
  }

  R.stop = function () { cancelAnimationFrame(rafId); };

  /* ------------------------------ 补间 ------------------------------ */

  R.animateTo = function (target, duration) {
    var cur = S.view;
    var from = { x: cur.x, y: cur.y, zoom: cur.zoom, fold: cur.fold };
    var to = {
      x: target.x != null ? target.x : cur.x,
      y: target.y != null ? target.y : cur.y,
      zoom: T.clampZoom(target.zoom != null ? target.zoom : cur.zoom),
      fold: T.clampFold(target.fold != null ? target.fold : cur.fold)
    };
    if (S.reduceMotion) {
      cur.x = to.x; cur.y = to.y; cur.zoom = to.zoom; cur.fold = to.fold;
      R.markDirty();
      return;
    }
    tween = {
      from: { x: from.x, y: from.y, lz: Math.log(from.zoom), lf: Math.log(from.fold) },
      to: { x: to.x, y: to.y, lz: Math.log(to.zoom), lf: Math.log(to.fold) },
      t0: performance.now(),
      dur: duration || 460
    };
  };

  function stepTween() {
    var p = (performance.now() - tween.t0) / tween.dur;
    if (p >= 1) p = 1;
    var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;   /* easeInOutCubic */
    var v = S.view;
    v.x = tween.from.x + (tween.to.x - tween.from.x) * e;
    v.y = tween.from.y + (tween.to.y - tween.from.y) * e;
    v.zoom = Math.exp(tween.from.lz + (tween.to.lz - tween.from.lz) * e);
    v.fold = Math.exp(tween.from.lf + (tween.to.lf - tween.from.lf) * e);
    dirty = true;
    S.emit('view');
    if (p === 1) tween = null;
  }

  R.isAnimating = function () { return !!tween; };

  /* ------------------------------ 轨道布局 ------------------------------ */

  R.computeLanes = function () {
    var vis = S.visibleTimelines();
    var y = 0;
    var lanes = [];
    for (var i = 0; i < vis.length; i++) {
      var tl = vis[i];
      var collapsed = !!S.collapsed[tl.id];
      var h = collapsed ? T.COLLAPSED_H : T.LANE_H;
      var axisY = y + (collapsed ? T.AXIS_OFFSET_COLLAPSED : T.AXIS_OFFSET);
      lanes.push({
        tl: tl,
        index: i,
        top: y,
        h: h,
        bottom: y + h,
        centerY: y + h / 2,
        axisY: axisY,
        collapsed: collapsed,
        minX: tl._minX,
        maxX: tl._maxX
      });
      y += h + T.LANE_GAP;
    }
    R.lanes = lanes;
    return lanes;
  };

  /* ------------------------------ 主绘制 ------------------------------ */

  function draw() {
    var pal = C.theme.palette();
    var size = R.size;
    var view = S.view;

    ctx.save();
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);

    /* 背景 */
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, size.w, size.h);

    var lanes = R.computeLanes();
    var tf = T.make(view, size);
    R.tf = tf;

    ctx.textBaseline = 'alphabetic';

    if (S.showGrid) drawGrid(tf, size, pal);
    drawLanes(tf, size, pal, lanes);

    /* 事件层 */
    ctx.textBaseline = 'middle';
    EV.layout(ctx, tf, size, lanes);
    EV.draw(ctx, tf, size, pal);

    if (S.showCursor) drawCursor(tf, size, pal, lanes);

    if (S.editMode) drawEditHint(tf, size, pal, lanes);

    ctx.restore();
  }

  /* ------------------------------ 网格 ------------------------------ */

  function drawGrid(tf, size, pal) {
    var soft = C.ticks.chooseInterval(tf.pxPerYear, 34);
    var strong = C.ticks.chooseInterval(tf.pxPerYear, 140);
    var xr = tf.worldXRange(0);

    ctx.lineWidth = 1;

    /* 纵向细线 */
    var softs = C.ticks.enumerate(xr[0], xr[1], soft, 1);
    if (softs.length < 2200) {
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      for (var i = 0; i < softs.length; i++) {
        var sx = Math.round(tf.x2s(softs[i].x)) + 0.5;
        ctx.moveTo(sx, 0);
        ctx.lineTo(sx, size.h);
      }
      ctx.stroke();
    }

    /* 纵向强调线 */
    var strongs = C.ticks.enumerate(xr[0], xr[1], strong, 1);
    if (strongs.length < 1200) {
      ctx.strokeStyle = pal.gridStrong;
      ctx.beginPath();
      for (var j = 0; j < strongs.length; j++) {
        var sx2 = Math.round(tf.x2s(strongs[j].x)) + 0.5;
        ctx.moveTo(sx2, 0);
        ctx.lineTo(sx2, size.h);
      }
      ctx.stroke();
    }

    /* 横向细线（按世界 Y 对齐，随平移缩放） */
    var step = Math.max(36, 90 * tf.zoom);
    var yr = tf.worldYRange(0);
    var y0 = Math.ceil(yr[0] / step) * step;
    ctx.strokeStyle = pal.grid;
    ctx.beginPath();
    var count = 0;
    for (var wy = y0; wy <= yr[1] && count < 400; wy += step, count++) {
      var sy = Math.round(tf.y2s(wy)) + 0.5;
      ctx.moveTo(0, sy);
      ctx.lineTo(size.w, sy);
    }
    ctx.stroke();
  }

  /* ------------------------------ 轨道与刻度 ------------------------------ */

  function drawLanes(tf, size, pal, lanes) {
    var visible = [];
    for (var i = 0; i < lanes.length; i++) {
      var lane = lanes[i];
      var top = tf.y2s(lane.top);
      var bottom = tf.y2s(lane.bottom);
      if (bottom < -60 || top > size.h + 60) continue;
      visible.push({ lane: lane, top: top, bottom: bottom });
    }

    /* 轨道底板 */
    for (var v = 0; v < visible.length; v++) {
      var it = visible[v];
      ctx.fillStyle = pal.laneFoot;
      var y = Math.max(it.top, -40);
      var hh = Math.min(it.bottom, size.h + 40) - y;
      if (hh > 0) ctx.fillRect(0, y, size.w, hh);
    }

    /* 轨道内容 */
    for (var k = 0; k < visible.length; k++) {
      var L = visible[k].lane;
      var axisY = tf.y2s(L.axisY);
      var ts = U.clamp(tf.zoom, 0.62, 1.8);

      var sx0 = Math.max(tf.x2s(L.minX), -6);
      var sx1 = Math.min(tf.x2s(L.maxX), size.w + 6);

      /* 轴线 */
      if (sx1 > sx0) {
        ctx.strokeStyle = EV.hexToRgba(L.tl.color, 0.42);
        ctx.lineWidth = Math.max(1, 1.4 * ts);
        ctx.beginPath();
        ctx.moveTo(sx0, axisY);
        ctx.lineTo(sx1, axisY);
        ctx.stroke();

        /* 两端封口 */
        ctx.fillStyle = EV.hexToRgba(L.tl.color, 0.8);
        ctx.fillRect(sx0 - 1, axisY - 4 * ts, 2, 8 * ts);
        ctx.fillRect(sx1 - 1, axisY - 4 * ts, 2, 8 * ts);

        drawTicks(tf, size, pal, L, axisY, sx0, sx1, ts);
      }

      drawLaneFooter(tf, size, pal, L);
    }
  }

  function drawTicks(tf, size, pal, lane, axisY, sx0, sx1, ts) {
    var cfg = C.ticks.resolve(tf.pxPerYear, 78);
    var w0 = tf.s2x(sx0);
    var w1 = tf.s2x(sx1);
    var ticks = C.ticks.enumerate(w0, w1, cfg.minor, cfg.subdiv);
    if (ticks.length > 1400) return;

    var fontSize = U.clamp(11.4 * tf.zoom, 9, 15);
    EV.setFont(ctx, fontSize, 500);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    var majorLen = 7 * ts;
    var minorLen = 3.5 * ts;

    /* 先画线 */
    ctx.strokeStyle = pal.tick;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var i = 0; i < ticks.length; i++) {
      var sx = Math.round(tf.x2s(ticks[i].x)) + 0.5;
      var len = ticks[i].major ? majorLen : minorLen;
      ctx.moveTo(sx, axisY);
      ctx.lineTo(sx, axisY + len);
    }
    ctx.stroke();

    /* 再画文字 */
    ctx.fillStyle = pal.tickLabel;
    var lastRight = -Infinity;
    for (var j = 0; j < ticks.length; j++) {
      if (!ticks[j].major) continue;
      var label = TM.formatTick(ticks[j].x, cfg.major, cfg.mode);
      var w = ctx.measureText(label).width;
      var cxs = tf.x2s(ticks[j].x);
      var left = cxs - w / 2;
      if (left < lastRight + 8) continue;
      if (cxs < -w || cxs > size.w + w) continue;
      ctx.fillText(label, cxs, axisY + majorLen + 4 * ts);
      lastRight = left + w;
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  function drawLaneFooter(tf, size, pal, lane) {
    var top = tf.y2s(lane.top);
    var bottom = tf.y2s(lane.bottom);
    if (bottom < 0 || top > size.h) return;

    var fy = tf.y2s(lane.bottom) - U.clamp(15 * tf.zoom, 11, 24);
    var x = 14;
    var ts = U.clamp(tf.zoom, 0.7, 1.5);

    /* 色块 */
    ctx.fillStyle = lane.tl.color;
    ctx.beginPath();
    ctx.arc(x + 4, fy, 4 * ts, 0, Math.PI * 2);
    ctx.fill();

    var tx = x + 15 * ts;

    ctx.textBaseline = 'middle';

    /* 右侧信息块先量宽，给左侧标题/副标题留出空间，避免窄屏下压字重叠 */
    var rightTxt = '';
    var rightW = 0;
    if (tf.zoom > 0.75) {
      var rangeTxt = TM.format({ year: Math.round(TM.yearAt(lane.minX)), precision: 'year', display: null }) +
        ' — ' + TM.format({ year: Math.round(TM.yearAt(lane.maxX)), precision: 'year', display: null });
      rightTxt = lane.tl.events.length + ' 个事件   ' + rangeTxt;
      rightW = EV.measureText(ctx, rightTxt, U.clamp(10.5 * tf.zoom, 9, 13), 400) + 22;
    }

    var titleSize = U.clamp(13 * tf.zoom, 10, 17);
    var subSize = U.clamp(11 * tf.zoom, 9, 14);
    var rightEdge = size.w - 14;
    var avail = rightEdge - rightW - tx;

    var titleTxt = EV.fitText(ctx, lane.tl.title, Math.max(20, avail), titleSize, 650);
    EV.setFont(ctx, titleSize, 650);
    ctx.fillStyle = pal.laneTitle;
    ctx.fillText(titleTxt, tx, fy);
    var wTitle = EV.measureText(ctx, titleTxt, titleSize, 650);

    var sub = lane.tl.subtitle || (lane.tl.description ? U.truncate(lane.tl.description, 26) : '');
    if (sub && tf.zoom > 0.55) {
      var sep = '·';
      var sw = EV.measureText(ctx, sep, subSize, 400);
      var sepX = tx + wTitle + 8 * ts;
      var subX = sepX + sw + 6 * ts;
      var subAvail = rightEdge - rightW - subX;
      if (subAvail > 12) {
        EV.setFont(ctx, subSize, 400);
        ctx.fillStyle = pal.laneSub;
        ctx.fillText(sep, sepX, fy);
        ctx.fillText(EV.fitText(ctx, sub, subAvail, subSize, 400), subX, fy);
      }
    }

    /* 事件数量与时间跨度（右侧） */
    if (rightTxt) {
      ctx.textAlign = 'right';
      EV.setFont(ctx, U.clamp(10.5 * tf.zoom, 9, 13), 400);
      ctx.fillStyle = pal.laneSub;
      ctx.fillText(rightTxt, rightEdge, fy);
      ctx.textAlign = 'start';
    }

    ctx.textBaseline = 'alphabetic';
  }

  /* ------------------------------ 时间游标 ------------------------------ */

  function drawCursor(tf, size, pal, lanes) {
    if (!lanes.length) return;
    var x = tf.x2s(TM.now());
    if (x < -40 || x > size.w + 40) return;

    var top = tf.y2s(lanes[0].top);
    var bottom = tf.y2s(lanes[lanes.length - 1].bottom);

    ctx.save();
    ctx.setLineDash([5, 6]);
    ctx.strokeStyle = pal.cursor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, Math.max(top, 0));
    ctx.lineTo(Math.round(x) + 0.5, Math.min(bottom, size.h));
    ctx.stroke();
    ctx.restore();

    var label = '今天';
    EV.setFont(ctx, 10, 600);
    var w = ctx.measureText(label).width + 12;
    var ly = Math.max(top, 0) + 3;
    ctx.fillStyle = pal.cursor;
    EV.roundRect(ctx, x - w / 2, ly, w, 16, 8);
    ctx.fill();
    ctx.fillStyle = pal.bg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, ly + 8.5);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  /* ------------------------------ 编辑态提示 ------------------------------ */

  function drawEditHint(tf, size, pal, lanes) {
    ctx.save();
    ctx.strokeStyle = EV.hexToRgba(pal.accent, 0.5);
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    for (var i = 0; i < lanes.length; i++) {
      var L = lanes[i];
      if (L.collapsed) continue;
      var sx0 = Math.max(tf.x2s(L.minX), 0);
      var sx1 = Math.min(tf.x2s(L.maxX), size.w);
      if (sx1 <= sx0) continue;
      var y = Math.round(tf.y2s(L.bottom)) - 0.5;
      ctx.beginPath();
      ctx.moveTo(sx0, y);
      ctx.lineTo(sx1, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ------------------------------ 命中测试 ------------------------------ */

  R.hitTest = function (px, py) {
    var nodes = EV.nodes || [];
    for (var i = nodes.length - 1; i >= 0; i--) {
      var n = nodes[i];
      var b = n.box;
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        return { kind: n.kind, node: n, timelineId: n.lane.tl.id, eventId: n.kind === 'event' ? n.ev.id : null };
      }
    }
    for (var j = nodes.length - 1; j >= 0; j--) {
      var n2 = nodes[j];
      var dx = px - n2.sx, dy = py - n2.axisY;
      if (dx * dx + dy * dy <= 121) {
        return { kind: n2.kind, node: n2, timelineId: n2.lane.tl.id, eventId: n2.kind === 'event' ? n2.ev.id : null };
      }
    }
    return null;
  };

  /** 命中某个事件的可见节点（用于定位、弹出详情） */
  R.nodeOf = function (timelineId, eventId) {
    var nodes = EV.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.kind !== 'event') continue;
      if (n.ev.id === eventId && n.lane.tl.id === timelineId) return n;
    }
    /* 聚合节点内也可能包含目标事件 */
    for (var j = 0; j < nodes.length; j++) {
      var c = nodes[j];
      if (c.kind !== 'cluster') continue;
      if (c.lane.tl.id !== timelineId) continue;
      for (var k = 0; k < c.evs.length; k++) if (c.evs[k].id === eventId) return c;
    }
    return null;
  };

  /* ------------------------------ 视图操作 ------------------------------ */

  R.laneOf = function (timelineId) {
    for (var i = 0; i < R.lanes.length; i++) if (R.lanes[i].tl.id === timelineId) return R.lanes[i];
    return null;
  };

  /** 横向适配全部内容 */
  R.fitAll = function (animate) {
    var b = C.store.bounds || { minX: 0, maxX: 100 };
    var span = Math.max(b.maxX - b.minX, 1);
    var usable = R.size.w * 0.86;
    var fold = usable / (span * T.BASE_PX_PER_YEAR * 1);
    var h = C.store.contentHeight();
    var target = {
      x: (b.minX + b.maxX) / 2,
      y: h / 2,
      zoom: 1,
      fold: T.clampFold(fold)
    };
    if (animate) R.animateTo(target, 520);
    else { S.view.x = target.x; S.view.y = target.y; S.view.zoom = target.zoom; S.view.fold = target.fold; R.markDirty(); }
    S.emit('view');
  };

  /** 横向适配某条时间轴 */
  R.fitTimeline = function (timelineId, animate) {
    var lane = R.laneOf(timelineId);
    if (!lane) return;
    var span = Math.max(lane.maxX - lane.minX, 1);
    var fold = (R.size.w * 0.85) / (span * T.BASE_PX_PER_YEAR);
    var target = {
      x: (lane.minX + lane.maxX) / 2,
      y: lane.centerY,
      zoom: S.view.zoom,
      fold: T.clampFold(fold)
    };
    if (animate) R.animateTo(target, 480);
    else { S.view.x = target.x; S.view.y = target.y; S.view.fold = target.fold; R.markDirty(); }
    S.emit('view');
  };

  /** 跳到某个世界 X（日期跳转） */
  R.jumpToX = function (x, opts) {
    opts = opts || {};
    var target = {
      x: x,
      y: S.view.y,
      zoom: S.view.zoom,
      fold: S.view.fold
    };
    /* 太宏观时自动放大到能看见年份 */
    var ppy = T.pxPerYear(S.view);
    if (opts.minPxPerYear && ppy < opts.minPxPerYear) {
      target.fold = T.clampFold(opts.minPxPerYear / (T.BASE_PX_PER_YEAR * S.view.zoom));
    }
    if (opts.timelineId) {
      var lane = R.laneOf(opts.timelineId);
      if (lane) target.y = lane.centerY;
    }
    R.animateTo(target, opts.duration || 460);
    S.emit('view');
  };

  /** 定位到某个事件 */
  R.focusEvent = function (timelineId, eventId, animate) {
    var ev = C.store.findEvent(timelineId, eventId);
    if (!ev) return false;
    var lane = R.laneOf(timelineId);
    var target = {
      x: ev._x,
      y: lane ? lane.centerY : S.view.y,
      zoom: S.view.zoom,
      fold: S.view.fold
    };
    var ppy = T.pxPerYear(S.view);
    if (ppy < 3) {
      target.fold = T.clampFold(3 / (T.BASE_PX_PER_YEAR * S.view.zoom));
    }
    R.animateTo(target, animate === false ? 0 : 460);
    S.emit('view');
    return true;
  };

  /** 用屏幕坐标缩放（锚点保持不动） */
  R.zoomAt = function (px, py, factor) {
    var tf0 = T.make(S.view, R.size);
    var wx = tf0.s2x(px), wy = tf0.s2y(py);
    S.view.zoom = T.clampZoom(S.view.zoom * factor);
    var tf1 = T.make(S.view, R.size);
    S.view.x += wx - tf1.s2x(px);
    S.view.y += wy - tf1.s2y(py);
    R.markDirty();
    S.emit('view');
  };

  /** 用屏幕坐标做横向折叠（只影响 X） */
  R.foldAt = function (px, factor, py) {
    var tf0 = T.make(S.view, R.size);
    var wx = tf0.s2x(px);
    S.view.fold = T.clampFold(S.view.fold * factor);
    var tf1 = T.make(S.view, R.size);
    S.view.x += wx - tf1.s2x(px);
    if (py != null) {
      var wy = tf0.s2y(py);
      S.view.y += wy - tf1.s2y(py);
    }
    R.markDirty();
    S.emit('view');
  };

  /** 横向折叠：以视口中心为锚点（view.x 即视口中心的世界坐标，故只需改 fold） */
  R.setFold = function (f) {
    var next = T.clampFold(f);
    if (Math.abs(next - S.view.fold) < 1e-12) return;
    S.view.fold = next;
    R.markDirty();
    S.emit('view');
  };

  R.foldBy = function (factor) {
    R.setFold(S.view.fold * factor);
  };

  /** 让「一屏显示的年份数」= years（用于折叠面板的档位快捷设置） */
  R.setYearsPerScreen = function (years) {
    years = Math.max(years, 1e-6);
    var perScreen = R.size.w || window.innerWidth || 1;
    R.setFold((perScreen / years) / (T.BASE_PX_PER_YEAR * S.view.zoom));
  };

  /** 当前一屏显示的年份数 */
  R.yearsPerScreen = function () {
    var ppy = T.pxPerYear(S.view);
    return (R.size.w || window.innerWidth || 1) / ppy;
  };

  R.panBy = function (dxScreen, dyScreen) {
    var tf = R.tf || T.make(S.view, R.size);
    S.view.x -= dxScreen / tf.pxPerYear;
    S.view.y -= dyScreen / tf.zoom;
    R.markDirty();
    S.emit('view');
  };

  R.resetView = function () {
    S.view.zoom = 1;
    R.fitAll(true);
  };

  C.renderer = R;
})();
