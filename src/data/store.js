/* ===================================================================
   大事年表 — 数据仓库
   · 内置时间轴永远只读，用户编辑一律另存副本
   · 用户数据全部只存在于内存，手动导出，刷新即消失
   · 撤销 / 重做覆盖新增、删除、修改、拖拽时间
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var SC = C.schema;
  var S = C.state;

  var ST = {};

  ST.builtins = [];        /* 归一化后的内置时间轴（只读） */
  ST.user = [];            /* 用户时间轴（内存） */

  var undoStack = [];
  var redoStack = [];
  var MAX_HISTORY = 60;

  /* ------------------------------ 初始化 ------------------------------ */

  ST.init = function () {
    var raw = C.builtinTimelines || [];
    var list = [];
    var report = [];
    for (var i = 0; i < raw.length; i++) {
      var r = SC.normalizeTimeline(raw[i], { source: 'builtin' });
      if (r.ok) {
        r.timeline.readonly = true;
        r.timeline._builtin = true;
        list.push(r.timeline);
        if (r.warnings.length) report.push({ id: raw[i].id, warnings: r.warnings });
      } else {
        report.push({ id: raw[i] && raw[i].id, warnings: r.errors });
      }
    }
    list.sort(function (a, b) { return (a.order - b.order) || a.title.localeCompare(b.title); });
    ST.builtins = list;
    ST.report = report;
    ST.rebuild();
    ST.refreshBounds();
    return report;
  };

  /** 合并内置 + 用户，写入 state.timelines */
  ST.rebuild = function () {
    var all = ST.builtins.concat(ST.user);
    all.sort(function (a, b) { return (a.order - b.order) || a.title.localeCompare(b.title); });
    S.timelines = all;
    return all;
  };

  ST.get = function (id) {
    for (var i = 0; i < S.timelines.length; i++) if (S.timelines[i].id === id) return S.timelines[i];
    return null;
  };

  ST.isBuiltin = function (id) {
    for (var i = 0; i < ST.builtins.length; i++) if (ST.builtins[i].id === id) return true;
    return false;
  };

  ST.isUser = function (id) {
    for (var i = 0; i < ST.user.length; i++) if (ST.user[i].id === id) return true;
    return false;
  };

  ST.userCount = function () { return ST.user.length; };

  ST.allEvents = function () {
    var out = [];
    for (var i = 0; i < S.timelines.length; i++) {
      var tl = S.timelines[i];
      for (var j = 0; j < tl.events.length; j++) out.push(tl.events[j]);
    }
    return out;
  };

  ST.findEvent = function (timelineId, eventId) {
    var tl = ST.get(timelineId);
    if (!tl) return null;
    for (var i = 0; i < tl.events.length; i++) if (tl.events[i].id === eventId) return tl.events[i];
    return null;
  };

  /* ------------------------------ 撤销 / 重做 ------------------------------ */

  function snapshot() {
    return U.deepClone(ST.user);
  }

  /* ---------------- 未导出标记：按时间轴 id 记录，导出后逐条清除 ---------------- */

  ST.dirtyIds = Object.create(null);

  function syncDirty() {
    var has = false;
    for (var k in ST.dirtyIds) { if (ST.dirtyIds[k]) { has = true; break; } }
    if (has !== S.dirty) { S.dirty = has; S.emit('dirty'); }
  }

  ST.markDirtyId = function (id) {
    ST.dirtyIds[id || '__global__'] = true;
    syncDirty();
  };

  ST.clearDirtyIds = function (ids) {
    if (!ids) ST.dirtyIds = Object.create(null);
    else for (var i = 0; i < ids.length; i++) delete ST.dirtyIds[ids[i]];
    syncDirty();
  };

  ST.dirtyCount = function () {
    var n = 0;
    for (var k in ST.dirtyIds) if (ST.dirtyIds[k]) n++;
    return n;
  };

  function pushUndo(label) {
    undoStack.push({ label: label || '', data: snapshot() });
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    S.emit('history');
  }

  function afterMutate(label, opts) {
    ST.rebuild();
    ST.refreshBounds();
    if (!opts || opts.mark !== false) ST.markDirtyId(opts && opts.id);
    S.emit('data', { label: label, kind: (opts && opts.kind) || 'mutate' });
    S.emit('history');
  }

  ST.canUndo = function () { return undoStack.length > 0; };
  ST.canRedo = function () { return redoStack.length > 0; };
  ST.undoLabel = function () { return undoStack.length ? undoStack[undoStack.length - 1].label : ''; };
  ST.redoLabel = function () { return redoStack.length ? redoStack[redoStack.length - 1].label : ''; };

  ST.undo = function () {
    if (!undoStack.length) return false;
    var cur = snapshot();
    var item = undoStack.pop();
    redoStack.push({ label: item.label, data: cur });
    ST.user = item.data;
    ST.rebuild();
    ST.refreshBounds();
    S.emit('data', { label: '撤销 ' + item.label, kind: 'undo' });
    S.emit('history');
    return true;
  };

  ST.redo = function () {
    if (!redoStack.length) return false;
    var cur = snapshot();
    var item = redoStack.pop();
    undoStack.push({ label: item.label, data: cur });
    ST.user = item.data;
    ST.rebuild();
    ST.refreshBounds();
    S.emit('data', { label: '重做 ' + item.label, kind: 'redo' });
    S.emit('history');
    return true;
  };

  ST.clearHistory = function () {
    undoStack.length = 0;
    redoStack.length = 0;
    S.emit('history');
  };

  /** 丢弃最近一次压栈的快照（用于「准备拖拽但实际没拖」的情况） */
  ST.discardUndo = function () {
    if (undoStack.length) {
      undoStack.pop();
      S.emit('history');
    }
  };

  ST.historyDepth = function () { return { undo: undoStack.length, redo: redoStack.length }; };

  /* ------------------------------ 边界 ------------------------------ */

  /**
   * 依据当前事件重算某条时间轴的时间跨度缓存 _minX/_maxX。
   * 这两个字段用于轨道底部「范围」文案、横向适配（定位）与全局边界。
   * 它们只在数据归一化时被赋值过，若不在增删改事件后重算，
   * 新建的时间轴会一直停留在「公元 1 年 — 公元 2 年」这类错误跨度，
   * 「定位」也会缩放到一个空区间；编辑模式下把事件拖到原范围之外同样会失效。
   */
  function recomputeSpan(tl) {
    if (!tl) return;
    var min = Infinity, max = -Infinity;
    var evs = tl.events || [];
    for (var i = 0; i < evs.length; i++) {
      var x = evs[i]._x;
      if (typeof x !== 'number' || !isFinite(x)) continue;
      if (x < min) min = x;
      if (x > max) max = x;
    }
    if (!isFinite(min)) { min = 0; max = 0; }
    if (max - min < 1) max = min + 1;
    tl._minX = min;
    tl._maxX = max;
  }
  ST.recomputeSpan = recomputeSpan;

  ST.refreshBounds = function () {
    var tls = S.timelines;
    var minX = Infinity, maxX = -Infinity;
    for (var i = 0; i < tls.length; i++) {
      recomputeSpan(tls[i]);
      if (tls[i]._minX < minX) minX = tls[i]._minX;
      if (tls[i]._maxX > maxX) maxX = tls[i]._maxX;
    }
    if (!isFinite(minX)) { minX = 0; maxX = 100; }
    if (maxX - minX < 10) maxX = minX + 10;
    ST.bounds = { minX: minX, maxX: maxX };
    return ST.bounds;
  };

  ST.contentHeight = function () {
    var T = C.transform;
    var vis = S.visibleTimelines();
    var total = 0;
    for (var i = 0; i < vis.length; i++) {
      total += (S.collapsed[vis[i].id] ? T.COLLAPSED_H : T.LANE_H) + T.LANE_GAP;
    }
    return Math.max(total - T.LANE_GAP, 40);
  };

  /* ------------------------------ 时间轴操作 ------------------------------ */

  /** 生成不重复的标题（避免出现「副本 副本」） */
  function uniqueTitle(base) {
    var t = String(base || '未命名');
    if (!/副本$/.test(t)) t = t + ' 副本';
    var exists = {};
    for (var i = 0; i < S.timelines.length; i++) exists[S.timelines[i].title] = true;
    if (!exists[t]) return t;
    var n = 2;
    while (exists[t + ' ' + n]) n++;
    return t + ' ' + n;
  }

  /** 另存为副本（复制内置或用户时间轴；复制后可自由编辑） */
  ST.forkTimeline = function (sourceId) {
    var src = ST.get(sourceId);
    if (!src) return null;
    var copy = SC.normalizeTimeline(SC.serialize(src), { source: 'user' });
    if (!copy.ok) return null;
    pushUndo('复制时间轴');
    var tl = copy.timeline;
    tl.id = 'user-' + sourceId.replace(/^user-/, '') + '-' + Date.now().toString(36);
    tl.title = uniqueTitle(src.title);
    tl.source = 'user';
    tl.copyOf = sourceId;
    tl._builtin = false;
    tl.readonly = false;
    tl.events.forEach(function (e) { e.timelineId = tl.id; });
    ST.user.push(tl);
    ST.rebuild();
    ST.refreshBounds();
    ST.markDirtyId(tl.id);
    S.emit('data', { label: '复制时间轴', kind: 'fork' });
    S.emit('history');
    return tl;
  };

  /** 复制（对内置与用户时间轴都可用） */
  ST.copyTimeline = function (id) { return ST.forkTimeline(id); };

  /** 重命名（系统内置不可重命名） */
  ST.renameTimeline = function (id, title) {
    var tl = ST.get(id);
    if (!tl || ST.isBuiltin(id)) return false;
    title = String(title || '').replace(/\s+/g, ' ').trim();
    if (!title) return false;
    if (title === tl.title) return true;
    pushUndo('重命名时间轴');
    tl.title = title;
    afterMutate('重命名时间轴', { id: id });
    return true;
  };

  /**
   * 调整时间轴顺序：dir = -1 上移，+1 下移。
   * 排序依据 order（越小越靠上），与相邻一条交换 order 即可。
   * 系统内置时间轴也允许调整显示顺序（不改变其内容，也不视为数据修改）。
   */
  ST.moveTimeline = function (id, dir) {
    var list = S.timelines;
    var idx = -1;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) { idx = i; break; }
    if (idx < 0) return false;
    var j = idx + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= list.length) return false;

    var a = list[idx], b = list[j];
    var oa = typeof a.order === 'number' ? a.order : 100;
    var ob = typeof b.order === 'number' ? b.order : 100;
    a.order = (oa === ob) ? (dir < 0 ? ob - 1 : ob + 1) : ob;
    if (oa !== ob) b.order = oa;

    ST.rebuild();
    if (ST.isUser(a.id) || ST.isUser(b.id)) ST.markDirtyId(a.id);
    S.emit('data', { label: '调整顺序', kind: 'reorder' });
    return true;
  };

  ST.createTimeline = function (meta) {
    pushUndo('新建时间轴');
    var tl = {
      id: U.uid('user-tl'),
      title: meta.title || '未命名时间轴',
      subtitle: meta.subtitle || '',
      category: meta.category || '专题史',
      color: meta.color || '#6aa6ff',
      order: typeof meta.order === 'number' ? meta.order : 200 + ST.user.length,
      description: meta.description || '',
      visible: true,
      source: 'user',
      version: 1,
      schemaVersion: SC.SCHEMA_VERSION,
      copyOf: null,
      readonly: false,
      _builtin: false,
      events: [],
      _minX: 0,
      _maxX: 1
    };
    ST.user.push(tl);
    afterMutate('新建时间轴', { id: tl.id });
    return tl;
  };

  ST.updateTimeline = function (id, patch) {
    var tl = ST.get(id);
    if (!tl) return null;
    if (ST.isBuiltin(id)) return null;      /* 系统内置不可直接修改 */
    pushUndo('修改时间轴');
    var keys = ['title', 'subtitle', 'category', 'color', 'order', 'description'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (patch[k] !== undefined) tl[k] = patch[k];
    }
    if (patch.visible !== undefined) S.hidden[id] = !patch.visible;
    afterMutate('修改时间轴', { id: id });
    return tl;
  };

  ST.deleteTimeline = function (id) {
    if (ST.isBuiltin(id)) return false;
    pushUndo('删除时间轴');
    for (var i = 0; i < ST.user.length; i++) {
      if (ST.user[i].id === id) { ST.user.splice(i, 1); break; }
    }
    afterMutate('删除时间轴', { id: id, mark: false });
    ST.clearDirtyIds([id]);
    return true;
  };

  /* ------------------------------ 事件操作 ------------------------------ */

  /**
   * 取得「可直接编辑」的时间轴。
   * 系统内置时间轴返回 null —— 调用方必须先通过 ST.ensureEditablePrompt 弹出提醒并复制副本。
   */
  ST.ensureEditable = function (timelineId) {
    if (ST.isUser(timelineId)) return ST.get(timelineId);
    return null;
  };

  /**
   * 带提醒的编辑授权：若目标为系统内置时间轴，弹窗告知「不可编辑，需先复制」，
   * 用户确认后复制出副本再返回副本（Promise<timeline|null>）。
   */
  ST.ensureEditablePrompt = function (timelineId, actionLabel) {
    return new Promise(function (resolve) {
      var tl = ST.get(timelineId);
      var UIx = C.ui;
      if (!tl) { resolve(null); return; }
      if (!ST.isBuiltin(timelineId)) { resolve(tl); return; }

      UIx.confirm({
        title: '系统时间轴不可编辑',
        html: '「<b>' + U.escapeHtml(tl.title) + '</b>」是<b>系统内置时间轴</b>，为了保证它始终完整、准确，' +
          '它<b>不能被直接编辑</b>。<br><br>' +
          '若你需要' + U.escapeHtml(actionLabel || '编辑') + '，需要先<b>复制一份你的副本</b>，' +
          '之后所有改动都只保存在副本里，系统内置内容保持原样。',
        okText: '复制副本并继续',
        cancelText: '取消'
      }).then(function (ok) {
        if (!ok) { resolve(null); return; }
        var copy = ST.forkTimeline(timelineId);
        if (!copy) { UIx.toast('复制失败', 'err'); resolve(null); return; }
        UIx.toast('已复制为「' + copy.title + '」', 'ok', 3200);
        resolve(copy);
      });
    });
  };

  function sameEvent(a, b) { return a.timelineId === b.timelineId && a.id === b.id; }

  ST.addEvent = function (timelineId, data) {
    var tl = ST.ensureEditable(timelineId);
    if (!tl) return null;
    var ev = SC.normalizeEvent(data, tl.id, null);
    if (!ev) return null;
    pushUndo('新增事件');
    if (!data.id) ev.id = U.uid('ev');
    var exists = false;
    for (var i = 0; i < tl.events.length; i++) if (tl.events[i].id === ev.id) exists = true;
    if (exists) ev.id = U.uid('ev');
    tl.events.push(ev);
    tl.events.sort(function (a, b) { return a._x - b._x; });
    afterMutate('新增事件', { id: tl.id });
    return ev;
  };

  ST.updateEvent = function (ref, data) {
    var tl = ST.get(ref.timelineId);
    if (!tl) return null;
    if (ST.isBuiltin(tl.id)) return null;   /* 需先复制副本 */

    pushUndo('修改事件');
    var idx = -1;
    for (var i = 0; i < tl.events.length; i++) if (tl.events[i].id === ref.eventId) { idx = i; break; }
    if (idx < 0) return null;

    var old = tl.events[idx];
    var merged = U.deepClone(old);
    var keys = ['title', 'summary', 'level', 'tags', 'region', 'viewpoint', 'sharedEventId'];
    for (var j = 0; j < keys.length; j++) {
      if (data[keys[j]] !== undefined) merged[keys[j]] = data[keys[j]];
    }
    if (data.date) merged.date = data.date;
    if (data.id && data.id !== old.id) merged.id = data.id;

    var ev = SC.normalizeEvent(merged, tl.id, null);
    if (!ev) return null;
    ev.id = merged.id;
    tl.events[idx] = ev;
    tl.events.sort(function (a, b) { return a._x - b._x; });
    afterMutate('修改事件', { id: tl.id });
    return ev;
  };

  /** 拖拽节点改时间：只改 date，不打断撤销栈 */
  ST.beginDrag = function () { pushUndo('拖拽调整时间'); };

  ST.moveEventTo = function (ref, date, silent) {
    var tl = ST.get(ref.timelineId);
    if (!tl || ST.isBuiltin(tl.id)) return null;
    var ev = null;
    for (var i = 0; i < tl.events.length; i++) if (tl.events[i].id === ref.eventId) { ev = tl.events[i]; break; }
    if (!ev) return null;
    ev.date = SC.normalizeDate(date);
    ev.date.display = C.time.format(Object.assign({}, ev.date, { display: null }));
    ev._x = C.time.toX(ev.date);
    ST.refreshBounds();
    ST.markDirtyId(tl.id);
    if (!silent) S.emit('data', { kind: 'move' });
    return ev;
  };

  ST.deleteEvent = function (ref) {
    var tl = ST.get(ref.timelineId);
    if (!tl) return false;
    if (ST.isBuiltin(tl.id)) return false;   /* 需先复制副本 */
    pushUndo('删除事件');
    for (var i = 0; i < tl.events.length; i++) {
      if (tl.events[i].id === ref.eventId) { tl.events.splice(i, 1); break; }
    }
    afterMutate('删除事件', { id: tl.id });
    return true;
  };

  /* ------------------------------ 导入 ------------------------------ */

  /**
   * 导入结果：{ added: [], skipped: [ {name, id, reason} ], invalid: [ {name, errors} ] }
   * 冲突策略：默认跳过，不覆盖、不重命名、不合并。
   */
  ST.importTimelines = function (items) {
    var result = { added: [], skipped: [], invalid: [], warnings: [] };
    var toAdd = [];

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var r = SC.parseText(it.text);
      if (!r.ok) {
        result.invalid.push({ name: it.name, errors: r.errors });
        continue;
      }
      var id = r.timeline.id;
      var conflict = ST.isBuiltin(id) || ST.isUser(id);
      if (!conflict) {
        for (var k = 0; k < toAdd.length; k++) if (toAdd[k].id === id) conflict = true;
      }
      if (conflict) {
        result.skipped.push({
          name: it.name, id: id,
          reason: ST.isBuiltin(id) ? '与系统内置时间轴 ID 冲突' : '与现有时间轴 ID 冲突'
        });
        continue;
      }
      if (r.warnings.length) {
        result.warnings.push({ name: it.name, warnings: r.warnings });
      }
      toAdd.push(r.timeline);
    }

    if (toAdd.length) {
      pushUndo('导入时间轴');
      for (var j = 0; j < toAdd.length; j++) {
        var tl = toAdd[j];
        tl.source = 'user';
        tl._builtin = false;
        tl.readonly = false;
        tl.copyOf = null;
        ST.user.push(tl);
        result.added.push(tl);
      }
      afterMutate('导入时间轴', { id: '__imported__' });
      for (var q = 0; q < toAdd.length; q++) ST.markDirtyId(toAdd[q].id);
    }

    ST.lastImportReport = result;
    return result;
  };

  /* ------------------------------ 导出 ------------------------------ */

  ST.exportJSON = function (id) {
    var tl = ST.get(id);
    if (!tl) return null;
    return {
      filename: safetyName(tl.id) + '.json',
      text: JSON.stringify(SC.serialize(tl), null, 2)
    };
  };

  ST.exportZip = function (ids) {
    var files = [];
    var list = ids && ids.length ? ids : ST.user.map(function (t) { return t.id; });
    for (var i = 0; i < list.length; i++) {
      var tl = ST.get(list[i]);
      if (!tl) continue;
      files.push({
        name: safetyName(tl.id) + '.json',
        data: JSON.stringify(SC.serialize(tl), null, 2)
      });
    }
    if (!files.length) return null;
    return {
      filename: '大事年表_用户时间轴_' + U.stamp() + '.zip',
      blob: C.zip.pack(files),
      count: files.length
    };
  };

  function safetyName(s) {
    return String(s || 'timeline').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 80);
  }

  ST.exportableIds = function () {
    var ids = ST.user.map(function (t) { return t.id; });
    return ids;
  };

  /** 清空全部用户数据（内置内容不受影响） */
  ST.resetUser = function () {
    ST.user = [];
    ST.dirtyIds = Object.create(null);
    ST.rebuild();
    ST.refreshBounds();
    ST.clearHistory();
    syncDirty();
    S.emit('data', { label: '清空用户数据', kind: 'reset' });
  };

  /* 重算所有事件的 _x（导入后或修改规范后调用） */
  ST.recomputeX = function () {
    var all = S.timelines;
    for (var i = 0; i < all.length; i++) {
      var evs = all[i].events;
      for (var j = 0; j < evs.length; j++) evs[j]._x = C.time.toX(evs[j].date);
    }
    ST.refreshBounds();
  };

  C.store = ST;
})();
