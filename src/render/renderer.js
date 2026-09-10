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

  /* ------------------------------------------------------------------
     视图平滑
     S.view 永远是「当前实际显示」的视图；滚轮 / 按钮改的是 viewTarget，
     渲染循环按 dt 做指数逼近 —— 于是滚轮一格不再是一跳 15%，而是连续过渡。
     拖拽平移仍走 panBy 直接写 S.view，保持 1:1 跟手，不被平滑拖慢。
     任何直接写 S.view 的地方（fitAll / 手势）都必须调用 R.syncViewTarget()，
     否则残留的目标值会把视图又拉回去。
     ------------------------------------------------------------------ */
  var viewTarget = null;      /* { x, y, zoom, fold } 目标视图；null = 与 S.view 同步 */
  var smoothOn = false;
  var SMOOTH_TAU = 58;        /* 毫秒；越小越跟手，越大越绵 */
  var lastFrameT = 0;

  /**
   * 计算「屏幕内某点」的容差对应的 world 阈值，用于判断平滑是否收敛。
   * 直接拿 world 单位比大小会随缩放级别漂移，必须换回像素比较。
   */
  function smoothDone(v, t) {
    var ppy = T.pxPerYear(v);
    var z = v.zoom || 1;
    return Math.abs(t.x - v.x) * ppy < 0.25 &&
      Math.abs(t.y - v.y) * z < 0.25 &&
      Math.abs(Math.log(t.zoom) - Math.log(v.zoom)) < 6e-4 &&
      Math.abs(Math.log(t.fold) - Math.log(v.fold)) < 6e-4;
  }

  function target() {
    if (!viewTarget) {
      viewTarget = { x: S.view.x, y: S.view.y, zoom: S.view.zoom, fold: S.view.fold };
    }
    return viewTarget;
  }

  /** 丢弃目标视图：下一次平滑会以当前 S.view 作为起点 */
  R.syncViewTarget = function () { viewTarget = null; smoothOn = false; };

  /**
   * 立即结算：把「平滑目标 / 补间终点」一次性写进 S.view，不产生任何过渡帧。
   * 关闭动效（设置里的「减少动效」）时，滚轮缩放、折叠、跳转都应一步到位，
   * 否则会出现「明明关了动效，缩放还在自己滑」的割裂感。
   */
  R.settle = function () {
    var changed = false;

    if (tween) {
      var v0 = S.view, t0 = tween.to;
      v0.x = t0.x; v0.y = t0.y;
      v0.zoom = Math.exp(t0.lz); v0.fold = Math.exp(t0.lf);
      tween = null;
      changed = true;
    }
    if (viewTarget) {
      S.view.x = viewTarget.x; S.view.y = viewTarget.y;
      S.view.zoom = viewTarget.zoom; S.view.fold = viewTarget.fold;
      viewTarget = null;
      changed = true;
    }
    smoothOn = false;
    if (changed) { dirty = true; S.emit('view'); }
  };

  /* 减少动效：直接把目标值落到 S.view，跳过指数逼近 */
  R.reducedMotion = function () { return !!S.reduceMotion; };

  function startSmooth() {
    if (S.reduceMotion) { R.settle(); return; }
    smoothOn = true; dirty = true;
  }

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
    var now = performance.now();
    var dt = lastFrameT ? (now - lastFrameT) : 16.7;
    lastFrameT = now;
    if (dt > 64) dt = 64;               /* 切后台回来不要一次跳完 */

    /* 减少动效：任何在途的平滑/补间都立刻结算，不残留过渡帧 */
    if (S.reduceMotion) {
      if (tween || smoothOn) R.settle();
    } else if (tween) stepTween();
    else if (smoothOn) stepSmooth(dt);

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

  /* ------------------------------ 平滑逼近 ------------------------------ */

  function stepSmooth(dt) {
    if (!viewTarget) { smoothOn = false; return; }
    var v = S.view, t = viewTarget;

    /* 帧率无关的指数逼近：60Hz 与 120Hz 的观感一致 */
    var a = 1 - Math.exp(-dt / SMOOTH_TAU);

    if (smoothDone(v, t)) {
      v.x = t.x; v.y = t.y; v.zoom = t.zoom; v.fold = t.fold;
      smoothOn = false;
      dirty = true;
      S.emit('view');
      return;
    }

    v.x += (t.x - v.x) * a;
    v.y += (t.y - v.y) * a;
    /* zoom / fold 在对数域插值：等比变化看起来才是匀速的 */
    v.zoom = Math.exp(Math.log(v.zoom) + (Math.log(t.zoom) - Math.log(v.zoom)) * a);
    v.fold = Math.exp(Math.log(v.fold) + (Math.log(t.fold) - Math.log(v.fold)) * a);

    dirty = true;
    S.emit('view');       /* 订阅方全是节流过的轻活，逐帧发没有压力 */
  }

  /* ------------------------------ 补间 ------------------------------ */

  R.animateTo = function (target, duration) {
    /* 补间与平滑互斥：补间接管后，残留的平滑目标必须清掉 */
    smoothOn = false;
    viewTarget = null;
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
      R.syncViewTarget();
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
    if (p === 1) { tween = null; R.syncViewTarget(); }
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

    var fontSize = EV.quant(U.clamp(11.4 * tf.zoom, 9, 15), 0.5);
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
      var w = EV.estimateWidth(ctx, label, fontSize, 500);
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
      rightW = EV.estimateWidth(ctx, rightTxt, EV.quant(U.clamp(10.5 * tf.zoom, 9, 13), 0.5), 400) + 22;
    }

    var titleSize = EV.quant(U.clamp(13 * tf.zoom, 10, 17), 0.5);
    var subSize = EV.quant(U.clamp(11 * tf.zoom, 9, 14), 0.5);
    var rightEdge = size.w - 14;
    var avail = rightEdge - rightW - tx;

    var titleTxt = EV.fitText(ctx, lane.tl.title, Math.max(20, avail), titleSize, 650);
    EV.setFont(ctx, titleSize, 650);
    ctx.fillStyle = pal.laneTitle;
    ctx.fillText(titleTxt, tx, fy);
    var wTitle = EV.estimateWidth(ctx, titleTxt, titleSize, 650);

    var sub = lane.tl.subtitle || (lane.tl.description ? U.truncate(lane.tl.description, 26) : '');
    if (sub && tf.zoom > 0.55) {
      var sep = '　';
      var sw = EV.estimateWidth(ctx, sep, subSize, 400);
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
      EV.setFont(ctx, EV.quant(U.clamp(10.5 * tf.zoom, 9, 13), 0.5), 400);
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
    else {
      S.view.x = target.x; S.view.y = target.y; S.view.zoom = target.zoom; S.view.fold = target.fold;
      R.syncViewTarget();
      R.markDirty();
    }
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
    else {
      S.view.x = target.x; S.view.y = target.y; S.view.fold = target.fold;
      R.syncViewTarget();
      R.markDirty();
    }
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

  /**
   * 用屏幕坐标缩放（锚点保持不动）
   * 改的是 viewTarget，平滑由渲染循环推进；连续滚轮事件会正确叠加。
   */
  R.zoomAt = function (px, py, factor) {
    var t = target();
    var tf0 = T.make(t, R.size);
    var wx = tf0.s2x(px), wy = tf0.s2y(py);
    t.zoom = T.clampZoom(t.zoom * factor);
    var tf1 = T.make(t, R.size);
    t.x += wx - tf1.s2x(px);
    t.y += wy - tf1.s2y(py);
    startSmooth();
  };

  /** 用屏幕坐标做横向折叠（只影响 X） */
  R.foldAt = function (px, factor, py) {
    var t = target();
    var tf0 = T.make(t, R.size);
    var wx = tf0.s2x(px);
    var wy = (py != null) ? tf0.s2y(py) : null;
    t.fold = T.clampFold(t.fold * factor);
    var tf1 = T.make(t, R.size);
    t.x += wx - tf1.s2x(px);
    if (wy != null) t.y += wy - tf1.s2y(py);
    startSmooth();
  };

  /** 横向折叠：以视口中心为锚点（view.x 即视口中心的世界坐标，故只需改 fold） */
  R.setFold = function (f) {
    var next = T.clampFold(f);
    var t = target();
    if (Math.abs(next - t.fold) < 1e-12) return;
    t.fold = next;
    startSmooth();
  };

  R.foldBy = function (factor) {
    R.setFold(target().fold * factor);
  };

  /** 让「一屏显示的年份数」= years（用于折叠面板的档位快捷设置） */
  R.setYearsPerScreen = function (years) {
    years = Math.max(years, 1e-6);
    var perScreen = R.size.w || window.innerWidth || 1;
    R.setFold((perScreen / years) / (T.BASE_PX_PER_YEAR * target().zoom));
  };

  /** 当前一屏显示的年份数（按实际显示值计算） */
  R.yearsPerScreen = function () {
    var ppy = T.pxPerYear(S.view);
    return (R.size.w || window.innerWidth || 1) / ppy;
  };

  R.yearsPerScreenTarget = function () {
    var ppy = T.pxPerYear(target());
    return (R.size.w || window.innerWidth || 1) / ppy;
  };

  /** 拖拽平移：直接写 S.view 保持跟手，同时把目标视图一起平移，避免被平滑拉回 */
  R.panBy = function (dxScreen, dyScreen) {
    var tf = R.tf || T.make(S.view, R.size);
    var wx = dxScreen / tf.pxPerYear;
    var wy = dyScreen / tf.zoom;
    S.view.x -= wx;
    S.view.y -= wy;
    if (viewTarget) { viewTarget.x -= wx; viewTarget.y -= wy; }
    R.markDirty();
    S.emit('view');
  };

  /* 「重置视图」的参数：聚焦最近 2000 年，一屏约容纳 4 条轨道。
     它和「纵览全部」的分工：纵览全部要装下「所有时间轴 + 全部年代」，
     内置于数据补到约前 9000 年之后，那已经是 1.1 万年一屏的宏观视角，
     主干挤成一团、只剩最高等级的事件；重置视图则给一个「看得清主干」的常规起点。 */
  var RESET_SPAN_YEARS = 2000;
  var RESET_LANES = 4;
  /* 上下各一条悬浮工具栏，纵向排布时要把它们的高度让出来 */
  var TOOLBAR_RESERVE = 150;

  R.resetView = function () {
    var b = C.store.bounds || { minX: 0, maxX: 100 };
    var maxX = b.maxX;
    var minX = maxX - RESET_SPAN_YEARS;

    if (!R.lanes || !R.lanes.length) R.computeLanes();
    var lanes = R.lanes || [];
    var count = lanes.length ? Math.min(RESET_LANES, lanes.length) : RESET_LANES;

    /* 纵向：一屏刚好排下 count 条轨道。
       分子用「整块内容高度 - 末条之后的间距」（stride*count - GAP），
       并预留出上下两条悬浮工具栏的高度 —— 按 h/(stride*count) 算的话，
       末条轨道的轴线会正好压在底部工具栏下面。 */
    var stride = T.LANE_H + T.LANE_GAP;
    var blockH = count * stride - T.LANE_GAP;
    var zoom = T.clampZoom((R.size.h - TOOLBAR_RESERVE) * 0.99 / blockH);

    /* 纵向中心取「这几条轨道的整体中线」，而不是全部内容的中线 ——
       否则轨道很多时会停在一片空白上。 */
    var y = lanes.length
      ? (lanes[0].top + lanes[count - 1].bottom) / 2
      : C.store.contentHeight() / 2;

    /* 横向：让这 2000 年填满约 92% 的宽度 */
    var fold = T.clampFold((R.size.w * 0.92) / (RESET_SPAN_YEARS * T.BASE_PX_PER_YEAR * zoom));

    R.animateTo({
      x: minX + RESET_SPAN_YEARS / 2,
      y: y,
      zoom: zoom,
      fold: fold
    }, 520);
    S.emit('view');
  };

  C.renderer = R;
})();
