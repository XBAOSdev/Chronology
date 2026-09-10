/* ===================================================================
   大事年表 — 事件节点层
   · 分级显示：横向越压缩，只显示越高等级的事件
   · 上下交错 + 引线布局，避免标签重叠
   · 距离过近时聚合为「聚合节点」，放大后自动拆分；聚合不丢数据
   · 等级视觉编码：形状 + 尺寸 + 描边 + 字重
       1 级  ◆ 菱形实心、描边最重、字重 600（主干事件）
       2 级  ● 圆形实心、中等描边、字重 500
       3 级  ○ 空心小圆、细描边、字重 500（次要补充，文字略淡）
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  var EV = {};

  var ROWS = 4;
  var ROWS_COLLAPSED = 1;
  var GAP = 6;            /* 相邻标签最小间距 */

  var FONT_STACK = '"Noto Sans SC","Source Han Sans SC","HarmonyOS Sans SC","MiSans","OPPO Sans","vivo Sans",' +
    '"PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';

  EV.FONT_STACK = FONT_STACK;

  /* ------------------------- 文本测量缓存 ------------------------- */

  var measureCache = Object.create(null);
  var cacheFont = '';

  /* 统一设置字体（供本模块与渲染器共用，避免 ctx.font 被绕过导致缓存失效） */
  function setFont(ctx, size, weight) {
    var f = (weight || 400) + ' ' + size.toFixed(1) + 'px ' + FONT_STACK;
    if (f !== cacheFont) { ctx.font = f; cacheFont = f; }
    return f;
  }

  EV.setFont = setFont;

  function measure(ctx, text, size, weight) {
    var key = size.toFixed(1) + '|' + (weight || 400) + '|' + text;
    var v = measureCache[key];
    if (v != null) return v;
    setFont(ctx, size, weight);
    v = ctx.measureText(text).width;
    if (Object.keys(measureCache).length > 6000) measureCache = Object.create(null);
    measureCache[key] = v;
    return v;
  }

  EV.measureText = measure;

  function fitText(ctx, text, maxW, size, weight) {
    if (!text) return '';
    if (measure(ctx, text, size, weight) <= maxW) return text;
    var lo = 1, hi = text.length;
    /* 二分找到能放下并留出一个省略号的最长前缀 */
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (measure(ctx, text.slice(0, mid) + '…', size, weight) <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return text.slice(0, Math.max(lo, 1)) + '…';
  }

  EV.fitText = fitText;

  /* ------------------------- 等级视觉参数 ------------------------- */

  function levelStyle(level) {
    if (level <= 1) {
      return { weight: 600, borderW: 1.5, borderA: 0.72, tintA: 0.11, dotScale: 1.6, shape: 'diamond', textA: 1 };
    }
    if (level === 2) {
      return { weight: 500, borderW: 1.1, borderA: 0.34, tintA: 0, dotScale: 1.0, shape: 'circle', textA: 1 };
    }
    return { weight: 500, borderW: 1.0, borderA: 0.20, tintA: 0, dotScale: 0.66, shape: 'hollow', textA: 0.76 };
  }

  EV.levelStyle = levelStyle;

  /* ------------------------- 圆角矩形 ------------------------- */

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, h / 2, w / 2);
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  EV.roundRect = roundRect;

  function hexToRgba(hex, a) {
    if (!hex) return 'rgba(128,128,128,' + a + ')';
    var h = String(hex).trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6 && h.length !== 8) return 'rgba(128,128,128,' + a + ')';
    var n = parseInt(h.slice(0, 6), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  EV.hexToRgba = hexToRgba;

  /* ------------------------- 布局 ------------------------- */

  EV.layout = function (ctx, tf, size, lanes) {
    var nodes = [];
    var byEventId = Object.create(null);
    var zoom = tf.zoom;

    var fontSize = U.clamp(12.5 * zoom, 10, 22);
    var rowH = fontSize + 7;
    var rowPitch = rowH + 5;
    var radius = rowH / 2;
    /* 关键修复：文字左右留白必须≥胶囊端部圆角半径，否则首尾字会溢出圆角 */
    var padX = Math.ceil(radius) + 1;
    var maxLabelPx = U.clamp(fontSize * 7.6, 62, 230);
    var dotR = U.clamp(4.6 * Math.max(zoom, 0.7), 3.2, 9);
    var clusterRadius = 190 * U.clamp(zoom, 0.6, 2);

    setFont(ctx, fontSize, 500);

    for (var li = 0; li < lanes.length; li++) {
      var lane = lanes[li];
      var tl = lane.tl;
      var maxLevel = lane.collapsed ? 1 : S.maxLevel(tf.pxPerYear);
      var rows = lane.collapsed ? ROWS_COLLAPSED : ROWS;
      /* 轴线在屏幕坐标系中的位置；下方所有纵向取值都基于屏幕像素 */
      var axesY = tf.y2s(lane.axisY);

      var rowRight = new Array(rows);
      for (var r0 = 0; r0 < rows; r0++) rowRight[r0] = -Infinity;

      var laneNodes = [];
      var evs = tl.events;

      for (var i = 0; i < evs.length; i++) {
        var ev = evs[i];
        if (ev.level > maxLevel) continue;
        var sx = tf.x2s(ev._x);
        if (sx < -80 || sx > size.w + 80) continue;

        var st = levelStyle(ev.level);
        var label = fitText(ctx, ev.title, maxLabelPx, fontSize, st.weight);
        var w = measure(ctx, label, fontSize, st.weight) + padX * 2;
        var left = sx - w / 2;
        var right = sx + w / 2;

        var placedRow = -1;
        for (var r = 0; r < rows; r++) {
          if (left > rowRight[r] + GAP) { placedRow = r; break; }
        }

        if (placedRow >= 0) {
          rowRight[placedRow] = right;
          var y = axesY - 22 - placedRow * rowPitch - rowH;
          var node = {
            kind: 'event',
            lane: lane,
            ev: ev,
            evs: [ev],
            count: 1,
            sx: sx,
            axisY: axesY,
            row: placedRow,
            fontSize: fontSize,
            weight: st.weight,
            padX: padX,
            radius: radius,
            dotR: dotR,
            box: { x: left, y: y, w: w, h: rowH },
            label: label
          };
          laneNodes.push(node);
          nodes.push(node);
          byEventId[ev.id] = node;
          continue;
        }

        /* 无空行 → 就近聚合 */
        var target = null, bestD = Infinity;
        for (var k = laneNodes.length - 1; k >= 0; k--) {
          var n = laneNodes[k];
          var d = Math.abs(n.sx - sx);
          if (d < bestD) { bestD = d; target = n; if (d < 1) break; }
          /* 已按 x 升序，继续往前只会更远 */
          if (n.sx < sx - clusterRadius && d > clusterRadius) break;
        }

        if (target && bestD <= clusterRadius && target.evs) {
          target.evs.push(ev);
          target.count = target.evs.length;
          target.label = target.count > 99 ? '99+' : String(target.count);
          var cw = Math.max(padX * 2 + 14, measure(ctx, target.label, fontSize, 600) + padX * 2);
          target.box.w = cw;
          target.box.x = target.sx - cw / 2;
          target.kind = 'cluster';
          target.weight = 600;
          rowRight[target.row] = target.box.x + cw;
        } else {
          /* 极端情况下强制放置到最宽松的一行，保证数据不丢 */
          var best = 0;
          for (var rr = 1; rr < rows; rr++) if (rowRight[rr] < rowRight[best]) best = rr;
          var y2 = axesY - 22 - best * rowPitch - rowH;
          var node2 = {
            kind: 'event',
            lane: lane,
            ev: ev,
            evs: [ev],
            count: 1,
            sx: sx,
            axisY: axesY,
            row: best,
            fontSize: fontSize,
            weight: st.weight,
            padX: padX,
            radius: radius,
            dotR: dotR,
            box: { x: left, y: y2, w: w, h: rowH },
            label: label
          };
          rowRight[best] = Math.max(rowRight[best], right);
          laneNodes.push(node2);
          nodes.push(node2);
          byEventId[ev.id] = node2;
        }
      }

      lane.nodes = laneNodes;
    }

    EV.nodes = nodes;
    EV.byEventId = byEventId;
    return nodes;
  };

  /* ------------------------- 绘制 ------------------------- */

  EV.draw = function (ctx, tf, size, pal) {
    var nodes = EV.nodes || [];
    var zoom = tf.zoom;
    var sel = S.selectedEvent;
    var hl = S.highlight;
    var now = Date.now();
    if (hl && now > hl.until) { S.highlight = null; hl = null; }
    var matchIds = S.matchIds;

    ctx.save();
    ctx.textBaseline = 'middle';

    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var lane = n.lane;
      var color = lane.tl.color;
      var isCluster = n.kind === 'cluster';
      var primary = isCluster ? n.evs[0] : n.ev;

      var evsOfNode = n.evs || [primary];
      var matched = !matchIds || matchIds.has(primary.id);
      for (var m = 0; m < evsOfNode.length && !matched; m++) {
        if (matchIds.has(evsOfNode[m].id)) matched = true;
      }

      var isSel = !!sel && !isCluster &&
        sel.timelineId === primary.timelineId && sel.eventId === primary.id;
      var isHl = !!hl && !isCluster && Math.abs(n.sx - tf.x2s(hl.x)) < 3 &&
        (hl.timelineId ? hl.timelineId === primary.timelineId : true);

      var baseAlpha = (matchIds && !matched && !isSel && !isHl) ? 0.20 : 1;
      ctx.globalAlpha = baseAlpha;

      var box = n.box;
      var axisY = n.axisY;
      var padX = n.padX || 8;
      var radius = n.radius || box.h / 2;
      var st = isCluster ? null : levelStyle(primary.level);

      /* 引线 */
      if (!lane.collapsed || box.y + box.h < axisY - 2) {
        ctx.strokeStyle = hexToRgba(color, isSel || isHl ? 0.85 : (primary.level === 1 && !isCluster ? 0.46 : 0.32));
        ctx.lineWidth = Math.max(1, zoom);
        ctx.beginPath();
        ctx.moveTo(n.sx, box.y + box.h);
        ctx.lineTo(n.sx, axisY - (n.dotR || 4));
        ctx.stroke();
      }

      /* 轴线上的节点标记 */
      var dr = isCluster ? (n.dotR + 1) : n.dotR;
      if (isCluster) {
        ctx.fillStyle = hexToRgba(color, 0.9);
        ctx.beginPath();
        ctx.arc(n.sx, axisY, dr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = pal.bg;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(n.sx, axisY, dr * 0.55, 0, Math.PI * 2);
        ctx.stroke();
      } else if (st.shape === 'diamond') {
        /* 1 级：实心菱形，最醒目 */
        var s = dr * st.dotScale;
        ctx.save();
        ctx.translate(n.sx, axisY);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = color;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.strokeStyle = pal.bg;
        ctx.lineWidth = Math.max(1.3, zoom * 1.6);
        ctx.strokeRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else if (st.shape === 'hollow') {
        /* 3 级：空心小圆 */
        ctx.strokeStyle = hexToRgba(color, 0.75);
        ctx.lineWidth = Math.max(1.2, zoom * 1.2);
        ctx.beginPath();
        ctx.arc(n.sx, axisY, dr * st.dotScale, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        /* 2 级：实心圆 */
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(n.sx, axisY, dr, 0, Math.PI * 2);
        ctx.fill();
      }

      /* 标签胶囊 */
      roundRect(ctx, box.x, box.y, box.w, box.h, radius);
      if (isCluster) {
        ctx.fillStyle = pal.clusterBg;
        ctx.globalAlpha = baseAlpha * 0.94;
        ctx.fill();
        ctx.globalAlpha = baseAlpha;
        ctx.strokeStyle = hexToRgba(color, 0.55);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillStyle = pal.labelBg;
        ctx.fill();
        if (st.tintA > 0) {
          ctx.fillStyle = hexToRgba(color, st.tintA);
          ctx.fill();
        }
        ctx.strokeStyle = hexToRgba(color, st.borderA);
        ctx.lineWidth = st.borderW;
        ctx.stroke();
      }

      /* 选中 / 高亮描边 */
      if (isSel || isHl) {
        ctx.save();
        ctx.shadowColor = hexToRgba(color, 0.85);
        ctx.shadowBlur = 14;
        ctx.strokeStyle = isSel ? pal.select : color;
        ctx.lineWidth = 2;
        roundRect(ctx, box.x - 1.5, box.y - 1.5, box.w + 3, box.h + 3, radius + 1.5);
        ctx.stroke();
        ctx.restore();
      }

      /* 标签文字 */
      if (!isCluster && st.textA < 1) ctx.globalAlpha = baseAlpha * st.textA;
      ctx.fillStyle = pal.labelText;
      setFont(ctx, n.fontSize, isCluster ? 600 : n.weight);
      ctx.fillText(n.label, box.x + padX, box.y + box.h / 2 + 0.5);
      ctx.globalAlpha = baseAlpha;
    }

    /* 共享事件关联线 */
    if (S.showSharedLinks) drawSharedLinks(ctx, tf, sel);

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  function drawSharedLinks(ctx, tf, sel) {
    if (!sel) return;
    var map = EV.byEventId;
    var base = map[sel.eventId];
    if (!base) return;
    var sharedId = base.ev.sharedEventId;
    if (!sharedId) return;

    var group = [];
    for (var i = 0; i < EV.nodes.length; i++) {
      var n = EV.nodes[i];
      if (n.kind !== 'event') continue;
      if (n.ev.sharedEventId === sharedId) group.push(n);
    }
    if (group.length < 2) return;

    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = C.theme.palette().accent;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.2;
    for (var k = 1; k < group.length; k++) {
      ctx.beginPath();
      ctx.moveTo(group[k - 1].sx, group[k - 1].axisY);
      ctx.lineTo(group[k].sx, group[k].axisY);
      ctx.stroke();
    }
    ctx.restore();
  }

  /** 生成命中区域（从后往前，后绘制的优先命中） */
  EV.hits = function () {
    var out = [];
    var nodes = EV.nodes || [];
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      var b = n.box;
      out.push({
        x: b.x, y: b.y, w: b.w, h: b.h,
        kind: n.kind,
        node: n,
        timelineId: n.lane.tl.id,
        eventId: n.kind === 'event' ? n.ev.id : null
      });
      out.push({
        x: n.sx - 9, y: n.axisY - 9, w: 18, h: 18,
        kind: n.kind, node: n,
        timelineId: n.lane.tl.id,
        eventId: n.kind === 'event' ? n.ev.id : null
      });
    }
    return out;
  };

  C.events = EV;
})();
