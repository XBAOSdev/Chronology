/* ===================================================================
   大事年表 — 数据规范：校验 / 归一化 / 迁移
   文件格式：单文件单时间轴，JSON，含 schemaVersion。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var TM = C.time;

  var SCHEMA_VERSION = 1;

  var PRECISIONS = ['century', 'decade', 'year', 'month', 'day', 'hour', 'minute', 'circa', 'range'];
  var MAX_SUMMARY = 150;
  var MAX_EVENTS_PER_TIMELINE = 3000;

  var SC = {};

  SC.SCHEMA_VERSION = SCHEMA_VERSION;
  SC.MAX_SUMMARY = MAX_SUMMARY;
  SC.PRECISIONS = PRECISIONS;

  SC.LEVEL_LABEL = { 1: '1 级 核心', 2: '2 级 重要', 3: '3 级 补充', 4: '4 级', 5: '5 级' };

  function isStr(v) { return typeof v === 'string' && v.length > 0; }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }

  /** 归一化时间对象 */
  SC.normalizeDate = function (raw) {
    var d = (raw && typeof raw === 'object') ? raw : {};
    var out = {};

    var prec = PRECISIONS.indexOf(d.precision) >= 0 ? d.precision : null;

    if (prec === 'range' && isNum(d.rangeStart) && isNum(d.rangeEnd)) {
      out.precision = 'range';
      out.rangeStart = d.rangeStart;
      out.rangeEnd = d.rangeEnd;
      out.year = Math.round((d.rangeStart + d.rangeEnd) / 2);
      out.circa = !!d.circa;
    } else {
      out.year = isNum(d.year) ? Math.round(d.year) : 0;
      if (isNum(d.month) && d.month >= 1 && d.month <= 12) out.month = Math.round(d.month);
      if (isNum(d.day) && d.day >= 1 && d.day <= 31) out.day = Math.round(d.day);
      if (isNum(d.hour) && d.hour >= 0 && d.hour <= 23) out.hour = Math.round(d.hour);
      if (isNum(d.minute) && d.minute >= 0 && d.minute <= 59) out.minute = Math.round(d.minute);
      out.circa = !!d.circa;
      out.precision = prec || (out.circa ? 'circa' : (out.month ? (out.day ? 'day' : 'month') : 'year'));
    }

    var display = isStr(d.display) ? d.display.trim() : '';
    out.display = display || TM.format(Object.assign({}, out, { display: null }));
    return out;
  };

  /** 归一化事件 */
  SC.normalizeEvent = function (raw, timelineId, warnings) {
    if (!raw || typeof raw !== 'object') return null;
    var title = isStr(raw.title) ? raw.title.trim() : '';
    if (!title) {
      if (warnings) warnings.push('存在缺少名称的事件，已跳过');
      return null;
    }

    var summary = typeof raw.summary === 'string' ? raw.summary : (raw.content || '');
    summary = summary.replace(/\s+/g, ' ').trim();
    if (summary.length > MAX_SUMMARY) {
      summary = summary.slice(0, MAX_SUMMARY);
      if (warnings) warnings.push('事件「' + title + '」描述超过 ' + MAX_SUMMARY + ' 字，已截断');
    }

    var level = isNum(raw.level) ? Math.round(raw.level) : 2;
    level = U.clamp(level, 1, 5);

    var date = SC.normalizeDate(raw.date);

    var ev = {
      id: isStr(raw.id) ? raw.id : U.uid('ev'),
      timelineId: isStr(raw.timelineId) ? raw.timelineId : timelineId,
      title: title,
      summary: summary,
      date: date,
      level: level,
      tags: Array.isArray(raw.tags)
        ? raw.tags.filter(isStr).map(function (t) { return String(t).trim(); }).slice(0, 12)
        : [],
      region: isStr(raw.region) ? raw.region.trim() : '',
      viewpoint: isStr(raw.viewpoint) ? raw.viewpoint.trim() : '',
      sharedEventId: isStr(raw.sharedEventId) ? raw.sharedEventId.trim() : null
    };
    ev._x = TM.toX(ev.date);
    return ev;
  };

  /** 归一化时间轴 */
  SC.normalizeTimeline = function (raw, opts) {
    var warnings = [];
    var errors = [];
    opts = opts || {};

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { ok: false, errors: ['文件内容不是有效的时间轴对象'], warnings: warnings };
    }

    /* 兼容被 { timeline: {...} } 包裹的导出文件 */
    if (!raw.events && raw.timeline && typeof raw.timeline === 'object') raw = raw.timeline;

    var id = isStr(raw.id) ? raw.id.trim() : '';
    if (!id) { errors.push('缺少时间轴 id'); }

    var title = isStr(raw.title) ? raw.title.trim() : '';
    if (!title) { errors.push('缺少时间轴标题 title'); }

    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    /* 版本迁移钩子 */
    var srcVer = isNum(raw.schemaVersion) ? raw.schemaVersion : (isNum(raw.version) ? raw.version : 1);
    if (srcVer > SCHEMA_VERSION) {
      warnings.push('文件版本（' + srcVer + '）高于当前程序（' + SCHEMA_VERSION + '），已按当前规范读取');
    }

    var rawEvents = Array.isArray(raw.events) ? raw.events : [];
    if (rawEvents.length > MAX_EVENTS_PER_TIMELINE) {
      warnings.push('事件数超过 ' + MAX_EVENTS_PER_TIMELINE + ' 条，仅保留前 ' + MAX_EVENTS_PER_TIMELINE + ' 条');
      rawEvents = rawEvents.slice(0, MAX_EVENTS_PER_TIMELINE);
    }

    var seen = Object.create(null);
    var events = [];
    for (var i = 0; i < rawEvents.length; i++) {
      var ev = SC.normalizeEvent(rawEvents[i], id, warnings);
      if (!ev) continue;
      if (seen[ev.id]) {
        warnings.push('事件 id 重复（' + ev.id + '），已重新生成');
        ev.id = U.uid('ev');
      }
      seen[ev.id] = true;
      ev.timelineId = id;
      events.push(ev);
    }
    events.sort(function (a, b) { return a._x - b._x; });

    var tl = {
      id: id,
      title: title,
      subtitle: isStr(raw.subtitle) ? raw.subtitle.trim() : '',
      category: isStr(raw.category) ? raw.category.trim() : '未分类',
      color: /^#[0-9a-fA-F]{3,8}$/.test(raw.color || '') ? raw.color : '#6aa6ff',
      order: isNum(raw.order) ? raw.order : 100,
      description: typeof raw.description === 'string' ? raw.description.trim().slice(0, 300) : '',
      visible: raw.visible !== false,
      source: isStr(raw.source) ? raw.source : (opts.source || 'import'),
      version: isNum(raw.version) ? raw.version : 1,
      schemaVersion: SCHEMA_VERSION,
      copyOf: isStr(raw.copyOf) ? raw.copyOf : null,
      events: events
    };

    tl._minX = Infinity;
    tl._maxX = -Infinity;
    for (var j = 0; j < events.length; j++) {
      if (events[j]._x < tl._minX) tl._minX = events[j]._x;
      if (events[j]._x > tl._maxX) tl._maxX = events[j]._x;
    }
    if (!events.length) { tl._minX = 0; tl._maxX = 0; }
    if (tl._maxX - tl._minX < 1) { tl._maxX = tl._minX + 1; }

    return { ok: true, timeline: tl, errors: [], warnings: warnings };
  };

  /** 序列化为可导出的纯数据（去掉下划线内部字段） */
  SC.serialize = function (tl) {
    var events = tl.events.map(function (ev) {
      var d = ev.date;
      var date = { year: d.year, precision: d.precision, display: d.display, circa: !!d.circa };
      if (d.month != null) date.month = d.month;
      if (d.day != null) date.day = d.day;
      if (d.hour != null) date.hour = d.hour;
      if (d.minute != null) date.minute = d.minute;
      if (d.precision === 'range') { date.rangeStart = d.rangeStart; date.rangeEnd = d.rangeEnd; }
      return {
        id: ev.id,
        timelineId: tl.id,
        title: ev.title,
        summary: ev.summary,
        date: date,
        level: ev.level,
        tags: ev.tags,
        region: ev.region,
        viewpoint: ev.viewpoint,
        sharedEventId: ev.sharedEventId || null,
        links: []
      };
    });
    return {
      schemaVersion: SCHEMA_VERSION,
      version: tl.version || 1,
      id: tl.id,
      title: tl.title,
      subtitle: tl.subtitle,
      category: tl.category,
      color: tl.color,
      order: tl.order,
      description: tl.description,
      visible: true,
      source: 'user',
      copyOf: tl.copyOf || null,
      exportedAt: new Date().toISOString(),
      events: events
    };
  };

  /** 从任意文本解析时间轴（导入用） */
  SC.parseText = function (text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: ['JSON 解析失败：' + e.message], warnings: [] };
    }
    if (Array.isArray(data)) data = data[0];
    return SC.normalizeTimeline(data, { source: 'import' });
  };

  C.schema = SC;
})();
