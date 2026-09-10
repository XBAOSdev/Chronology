/* ===================================================================
   大事年表 — 事件节点层
   - 分级显示：横向越压缩，只显示越高等级的事件
   - 上下交错 + 引线布局，避免标签重叠
   - 距离过近时聚合为「聚合节点」，放大后自动拆分；聚合不丢数据
   - 等级视觉编码：形状 + 尺寸 + 描边 + 字重
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

  /*
     性能要点（v1.6.0 优化，缩放卡顿的真凶就在这里）：
     1) 缓存容量判断必须用「增量计数器」。原实现是
          if (Object.keys(measureCache).length > 6000) measureCache = Object.create(null);
        它在**每一次缓存未命中**时都要把全部键枚举成数组。缩放时字号逐帧变化，
        一帧可能有 500+ 次未命中，于是每帧白白分配 500 个 6000 元素的数组，
        实测单帧 layout 冲到 545ms —— 表现就是「缩放时偶发卡死一下」。
     2) 字号必须量化。原始 zoom 连续变化会让 size.toFixed(1) 每帧都是新键，
        缓存命中率归零。量化到 0.5px 后，一次缩放动画里只有少数几个字号桶，
        同一桶内的后续帧全部命中缓存（视觉上 0.5px 的差异不可察觉）。
  */

  var measureCache = Object.create(null);
  var measureCount = 0;
  var MEASURE_CAP = 12000;
  var cacheFont = '';

  /* 把字号（及其派生量）量化到固定步长，让缓存键在动画过程中稳定下来 */
  function quant(v, step) { return Math.round(v / step) * step; }
  EV.quant = quant;

  /* 统一设置字体（供本模块与渲染器共用，避免 ctx.font 被绕过导致缓存失效） */
  function setFont(ctx, size, weight) {
    var f = (weight || 400) + ' ' + size.toFixed(1) + 'px ' + FONT_STACK;
    if (f !== cacheFont) { ctx.font = f; cacheFont = f; }
    return f;
  }

  EV.setFont = setFont;

  /*
     文本测量走独立离屏上下文。
     原因：测量时会在「参考字号」和「当前字号」之间来回切换，如果直接改主画布
     的 ctx.font，每一帧都要让浏览器反复重新解析那一长串字体回退栈，
     实测会造成 ~100ms 的偶发单帧尖峰。离屏上下文与绘制状态互不干扰。
  */
  var measCtx = null;
  var measFont = '';

  function getMeasCtx() {
    if (!measCtx) {
      var cv = document.createElement('canvas');
      cv.width = cv.height = 8;
      measCtx = cv.getContext('2d');
    }
    return measCtx;
  }
  EV.measureCtx = getMeasCtx;

  function measFontSet(ctx, size, weight) {
    var f = (weight || 400) + ' ' + size.toFixed(1) + 'px ' + FONT_STACK;
    if (f !== measFont) { ctx.font = f; measFont = f; }
  }

  function measure(ctx, text, size, weight) {
    var key = size.toFixed(1) + '|' + (weight || 400) + '|' + text;
    var v = measureCache[key];
    if (v != null) return v;
    var mc = getMeasCtx();
    measFontSet(mc, size, weight);
    v = mc.measureText(text).width;
    if (measureCount > MEASURE_CAP) { measureCache = Object.create(null); measureCount = 0; }
    measureCache[key] = v;
    measureCount++;
    return v;
  }

  EV.measureText = measure;

  /*
     宽度估算：同一字体下文本宽度与字号近似成正比。
     CPU 采样显示 canvas 的 measureText 是缩放期间唯一的性能大头（实测占总耗时 13.8%，
     且一帧内可能爆发数百次）。因此布局与截断判断**一律**走这里的线性外推，
     每个字符串只在参考字号上精确测一次，之后所有字号都复用 —— 缩放过程中
     文本测量的调用次数几乎降为零（只有首次出现的新文本才需要一次测量）。

     代价是宽度存在很小的比例误差。对此做了两条保险：
       1) 胶囊宽度与截断判断使用同一份估算值，因此「标签一定放得进自己的胶囊」；
       2) 验收里断言「估算值相对精确测量值的误差」有界，防止字体变化后静默劣化。
  */
  var REF_SIZE = 16;
  /* 实测：这套字体栈下宽度与字号严格成正比（18576 个样本偏差 0.00px），
     所以只需一个极小的兜底系数，用于覆盖个别浏览器把字形步进取整到整像素的情况。
     胶囊左右留白 padX（≈7—12px）本身也足以吸收残余误差，文字不会溢出圆角。 */
  var EST_SAFE = 1.004;
  var ELLIPSIS = '…';      /* 保守放大 1.5%：宁可胶囊略宽，也不让文字溢出圆角 */

  function estWidth(ctx, text, size, weight) {
    return measure(ctx, text, REF_SIZE, weight) * (size / REF_SIZE) * EST_SAFE;
  }

  EV.estimateWidth = estWidth;

  /*
     fitText 的结果也缓存。键里的 maxW 取整后无损（maxW 由量化字号派生）。
     截断点用估算定位，不再做逐字精确校正 —— 校正那几次 measureText 正是要消除的开销，
     而偏一个字的截断在视觉上不可分辨。
  */
  var fitCache = Object.create(null);
  var fitCount = 0;
  var FIT_CAP = 8000;

  function fitText(ctx, text, maxW, size, weight) {
    if (!text) return '';
    var key = size.toFixed(1) + '|' + (weight || 400) + '|' + Math.round(maxW) + '|' + text;
    var hit = fitCache[key];
    if (hit !== undefined) return hit;

    var out;
    if (estWidth(ctx, text, size, weight) <= maxW) {
      out = text;
    } else {
      /*
        截断点用「整串均宽」直接算出起点，再按宽度比做一次校正。
        原实现是二分前缀，每个首次出现的标签要测 7 次；改成这样后
        大部分标签 1—2 次即可 —— 这正是「缩放时新事件涌入」那一帧的尖峰来源。
        截断本身是纯展示行为，偏一两个字符不可分辨。
      */
      var n = text.length;
      var ell = estWidth(ctx, ELLIPSIS, size, weight);
      var perChar = estWidth(ctx, text, size, weight) / n;
      var k = Math.floor((maxW - ell) / perChar);
      if (k < 1) k = 1;
      if (k > n) k = n;
      var cand = text.slice(0, k) + ELLIPSIS;
      var w = estWidth(ctx, cand, size, weight);
      if (w > maxW) {
        k = Math.floor(k * maxW / w);
        if (k < 1) k = 1;
        cand = text.slice(0, k) + ELLIPSIS;
      }
      out = cand;
    }

    if (fitCount > FIT_CAP) { fitCache = Object.create(null); fitCount = 0; }
    fitCache[key] = out;
    fitCount++;
    return out;
  }

  EV.fitText = fitText;

  /** 精确测量组件宽度（已过 EST_SAFE 校正），供布局与绘制共用同一口径 */
  EV.labelWidth = function (ctx, label, size, weight) { return estWidth(ctx, label, size, weight); };

  /* 供测试断言缓存规模（不作业务使用） */
  EV.cacheStats = function () {
    return { measure: measureCount, fit: fitCount };
  };

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

  /*
     hexToRgba 记忆化：绘制一个节点要拼 3—4 次 rgba 字符串，
     一帧上百次字符串拼接虽然单次便宜，但会持续制造垃圾。
     颜色只有几条时间轴那么多种、alpha 取值也有限，缓存后基本零成本。
  */
  var rgbaCache = Object.create(null);
  var rgbaCount = 0;

  function hexToRgba(hex, a) {
    if (!hex) return 'rgba(128,128,128,' + a + ')';
    var key = hex + '|' + a;
    var v = rgbaCache[key];
    if (v !== undefined) return v;
    var h = String(hex).trim();
    if (h.charAt(0) === '#') h = h.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    if (h.length !== 6 && h.length !== 8) return 'rgba(128,128,128,' + a + ')';
    var n = parseInt(h.slice(0, 6), 16);
    v = 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    if (rgbaCount > 2000) { rgbaCache = Object.create(null); rgbaCount = 0; }
    rgbaCache[key] = v;
    rgbaCount++;
    return v;
  }

  EV.hexToRgba = hexToRgba;

  /* ------------------------- 布局 ------------------------- */

  /*
     「空缺检测」用的区间集合：按左端升序、互不重叠。
     第 2 遍补充低权重标签时，需要回答「这一行在 [left,right] 上是否空着」，
     二分一次即可，不必逐行线性扫全部已放置节点。
   */
  function segFree(segs, left, right, gap) {
    var lo = 0, hi = segs.length - 1, ans = segs.length;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (segs[mid].r >= left - gap) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
    }
    if (ans >= segs.length) return true;   /* 所有区间都在左侧 → 右侧整段空着 */
    return segs[ans].l > right + gap;
  }

  function segPut(segs, left, right) {
    var i = segs.length;
    while (i > 0 && segs[i - 1].l > left) i--;
    segs.splice(i, 0, { l: left, r: right });
  }

  EV.layout = function (ctx, tf, size, lanes) {
    var nodes = [];
    var zoom = tf.zoom;

    /* 字号量化到 0.5px：缩放动画过程中同一字号桶内可复用全部文本测量结果 */
    var fontSize = quant(U.clamp(12.5 * zoom, 10, 22), 0.5);
    var rowH = fontSize + 7;
    var rowPitch = rowH + 5;
    var radius = rowH / 2;
    /* 关键修复：文字左右留白必须≥胶囊端部圆角半径，否则首尾字会溢出圆角 */
    var padX = Math.ceil(radius) + 1;
    var maxLabelPx = quant(U.clamp(fontSize * 7.6, 62, 230), 1);
    var dotR = U.clamp(4.6 * Math.max(zoom, 0.7), 3.2, 9);
    var clusterRadius = 190 * U.clamp(zoom, 0.6, 2);

    setFont(ctx, fontSize, 500);

    /*
       自动模式下的「机会性补充」。

       原逻辑只按 pxPerYear 定一个全局等级上限，于是「整体纵览」时上限被压到 1 级，
       前 9000 年的远古史整段只剩「夏朝建立」一个节点 —— 那段明明空旷得能放下几十个标签，
       低权重事件却是被等级门槛挡掉的，用户连它们的位置都无从判断。

       现在拆成两遍：
         第 1 遍  等级达标的核心事件，行为与过去完全一致（含就近聚合）；
         第 2 遍  等级未达标的补充事件，只在该行确实空着时按正常节点放进来，
                 放不下就整条舍弃 —— 不聚合、不抢占，绝不改变第 1 遍的结果。
       因此「拥挤」仍然会自然地把低权重标签淘汰掉，只是不再「一刀切地全员隐藏」。

       手动指定等级（设置里的「仅 1 级 / 至 2 级 …」）时不做补充：
       那是用户明确表达的意图，不该被自动化推翻。
    */
    var autoBonus = (S.levelFilter === 0);

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
        var w = estWidth(ctx, label, fontSize, st.weight) + padX * 2;
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
          var cw = Math.max(padX * 2 + 14, estWidth(ctx, target.label, fontSize, 600) + padX * 2);
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
        }
      }

      lane.nodes = laneNodes;

      /* ---------- 第 2 遍：机会性补充（仅自动模式） ---------- */
      if (!autoBonus) continue;

      /* 把第 1 遍落定的节点转成「每行的占用区间」；
         聚合节点的 box 在合并时会变宽，所以这里统一用最终 box 重建，
         而不是复用第 1 遍过程中滚动更新的 rowRight。 */
      var rowSegs = new Array(rows);
      for (var rs = 0; rs < rows; rs++) rowSegs[rs] = [];
      for (var pn = 0; pn < laneNodes.length; pn++) {
        var placed = laneNodes[pn];
        rowSegs[placed.row].push({ l: placed.box.x, r: placed.box.x + placed.box.w });
      }
      for (var so = 0; so < rows; so++) {
        rowSegs[so].sort(function (p, q) { return p.l - q.l; });
      }

      for (var bi = 0; bi < evs.length; bi++) {
        var bev = evs[bi];
        if (bev.level <= maxLevel) continue;
        var bsx = tf.x2s(bev._x);
        if (bsx < -80 || bsx > size.w + 80) continue;

        var bst = levelStyle(bev.level);
        var blabel = fitText(ctx, bev.title, maxLabelPx, fontSize, bst.weight);
        var bw = estWidth(ctx, blabel, fontSize, bst.weight) + padX * 2;
        var bleft = bsx - bw / 2;
        var bright = bsx + bw / 2;

        var slot = -1;
        for (var br = 0; br < rows; br++) {
          if (segFree(rowSegs[br], bleft, bright, GAP)) { slot = br; break; }
        }
        if (slot < 0) continue;          /* 真的摆不下 → 舍弃这条补充标签 */

        var bnode = {
          kind: 'event',
          lane: lane,
          ev: bev,
          evs: [bev],
          count: 1,
          bonus: true,
          sx: bsx,
          axisY: axesY,
          row: slot,
          fontSize: fontSize,
          weight: bst.weight,
          padX: padX,
          radius: radius,
          dotR: dotR,
          box: { x: bleft, y: axesY - 22 - slot * rowPitch - rowH, w: bw, h: rowH },
          label: blabel
        };
        segPut(rowSegs[slot], bleft, bright);
        laneNodes.push(bnode);
        nodes.push(bnode);
      }
    }

    EV.nodes = nodes;
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
    if (S.showSharedLinks) drawSharedLinks(ctx, tf, size, sel);

    ctx.restore();
    ctx.globalAlpha = 1;
  };

  /**
   * 跨时间轴共享事件关联线。
   *
   * 端点直接由「事件数据 + 变换矩阵」算出，不使用 EV.nodes：
   *   - EV.nodes 会随缩放/平移发生分级过滤、视口裁剪与就近聚合，
   *     端点在视口边缘或缩放档位切换时会在不同事件之间跳动；
   *   - 事件 id 在不同时间轴之间可以重名（例如复制出的内置副本），
   *     用全局 id 反查会取到另一条轴上的同名事件。
   * 因此这里按「时间轴 id + 事件 id」定位锚点事件，再收集所有可见轨道上
   * 具有同一 sharedEventId 的事件端点，按时间排序后依次连线：
   * 结构只与数据有关，与轨道排列顺序、缩放、折叠、聚合都无关。
   */
  function drawSharedLinks(ctx, tf, size, sel) {
    if (!sel || !sel.timelineId || !sel.eventId) return;

    var tls = S.timelines || [];
    var anchor = null;
    for (var t = 0; t < tls.length; t++) {
      if (tls[t].id !== sel.timelineId) continue;
      var list = tls[t].events || [];
      for (var q = 0; q < list.length; q++) {
        if (list[q].id === sel.eventId) { anchor = list[q]; break; }
      }
      break;
    }
    if (!anchor || !anchor.sharedEventId) return;

    var sharedId = anchor.sharedEventId;
    var lanes = C.renderer.lanes || [];
    var pts = [];
    for (var i = 0; i < lanes.length; i++) {
      var lane = lanes[i];
      var evs = lane.tl.events || [];
      for (var j = 0; j < evs.length; j++) {
        if (evs[j].sharedEventId !== sharedId) continue;
        pts.push({ x: tf.x2s(evs[j]._x), y: tf.y2s(lane.axisY) });
      }
    }
    if (pts.length < 2) return;

    pts.sort(function (a, b) { return a.x - b.x; });

    var pad = 60;
    ctx.save();
    ctx.setLineDash([4, 5]);
    ctx.strokeStyle = C.theme.palette().accent;
    ctx.globalAlpha = 0.42;
    ctx.lineWidth = 1.2;
    for (var k = 1; k < pts.length; k++) {
      var a = pts[k - 1], b = pts[k];
      var aIn = a.x > -pad && a.x < size.w + pad;
      var bIn = b.x > -pad && b.x < size.w + pad;
      if (!aIn && !bIn) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
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
