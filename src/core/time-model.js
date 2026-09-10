/* ===================================================================
   大事年表 — 时间模型
   坐标规则（全项目唯一真源）：
     x = 0        对应公元 1 年
     公元 n 年    x = n - 1
     公元前 n 年  x = -n
   月 / 日 / 时 / 分作为「年内小数」叠加到年份上，形成连续时间坐标。
   所有时间轴共享同一映射函数，保证同一 X 坐标理论时间一致。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;

  var DAYS = 365.25;
  var HOURS = DAYS * 24;      /* 8766 */
  var MINUTES = HOURS * 60;   /* 525960 */

  var TM = {};

  TM.DAYS = DAYS;
  TM.HOURS = HOURS;
  TM.MINUTES = MINUTES;

  /* 在一整年中的占比 */
  TM.YEAR_PER_MONTH = 1 / 12;
  TM.YEAR_PER_DAY = 1 / DAYS;
  TM.YEAR_PER_HOUR = 1 / HOURS;
  TM.YEAR_PER_MINUTE = 1 / MINUTES;

  /** 年份 → 该年起始的 x 值（不含月日小数） */
  TM.yearBase = function (year) {
    var y = Number(year) || 0;
    if (y > 0) return y - 1;
    if (y < 0) return y;
    return 0;   /* 不存在公元 0 年，容错处理为公元 1 年起点 */
  };

  /** 年内小数（月 / 日 / 时 / 分） */
  TM.yearFraction = function (month, day, hour, minute) {
    var f = 0;
    if (month > 0) f += (month - 1) / 12;
    if (day > 0) f += (day - 1) / DAYS;
    if (hour > 0) f += hour / HOURS;
    if (minute > 0) f += minute / MINUTES;
    return f;
  };

  /** 时间对象 → 世界坐标 x */
  TM.toX = function (date) {
    if (!date) return 0;

    if (date.precision === 'range' &&
        typeof date.rangeStart === 'number' && typeof date.rangeEnd === 'number') {
      var a = TM.yearBase(date.rangeStart);
      var b = TM.yearBase(date.rangeEnd);
      return (a + b) / 2;
    }

    var base = TM.yearBase(date.year);
    var frac = TM.yearFraction(date.month, date.day, date.hour, date.minute);
    /* 公元前年份：小数部分向公元元年方向递进 */
    return base + frac;
  };

  /** 时间对象的区间端点（用于 range 精度） */
  TM.rangeOf = function (date) {
    if (!date) return [0, 0];
    if (date.precision === 'range' &&
        typeof date.rangeStart === 'number' && typeof date.rangeEnd === 'number') {
      var a = TM.yearBase(date.rangeStart);
      var b = TM.yearBase(date.rangeEnd);
      return a <= b ? [a, b] : [b, a];
    }
    var x = TM.toX(date);
    var span = 1;
    if (date.precision === 'century') span = 100;
    else if (date.precision === 'decade') span = 10;
    return [x, x + span];
  };

  /** 世界坐标 x → { year, isBC, month, day, hour, minute } */
  TM.fromX = function (x) {
    var floor = Math.floor(x);
    var frac = x - floor;
    var year, isBC;
    if (x >= 0) { year = floor + 1; isBC = false; }
    else { year = -floor; isBC = true; }

    var totalDays = frac * DAYS;
    var month = Math.floor(frac * 12) + 1;
    var dayOfMonth = Math.floor(totalDays - (month - 1) * (DAYS / 12)) + 1;
    var hoursF = frac * HOURS;
    var hour = Math.floor(hoursF) % 24;
    var minute = Math.floor((hoursF - Math.floor(hoursF)) * 60);

    return {
      year: year,
      isBC: isBC,
      month: U.clamp(month, 1, 12),
      day: U.clamp(dayOfMonth, 1, 31),
      hour: U.clamp(hour, 0, 23),
      minute: U.clamp(minute, 0, 59),
      frac: frac
    };
  };

  /** 该 x 对应的公历年份数值（公元前为负） */
  TM.yearAt = function (x) {
    var d = TM.fromX(x);
    return d.isBC ? -d.year : d.year;
  };

  /* ------------------------- 人类可读文本 ------------------------- */

  var CN_NUM = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

  function cnNum(n) {
    n = Math.round(n);
    if (n < 0 || n > 99) return String(n);
    if (n < 10) return CN_NUM[n];
    var tens = Math.floor(n / 10), ones = n % 10;
    return (tens === 1 ? '十' : CN_NUM[tens] + '十') + (ones ? CN_NUM[ones] : '');
  }

  TM.cnNum = cnNum;

  TM.centuryOf = function (year) {
    var y = Math.abs(year);
    return Math.ceil(y / 100) || 1;
  };

  /** 生成可读时间文本；优先使用数据里显式写的 display */
  TM.format = function (date) {
    if (!date) return '';
    if (date.display) return date.display;

    var pre = '';
    var y = date.year;
    if (date.precision === 'range' &&
        typeof date.rangeStart === 'number' && typeof date.rangeEnd === 'number') {
      return TM.formatRange(date.rangeStart, date.rangeEnd);
    }
    if (date.precision === 'century') {
      return (date.circa ? '约' : '') + '公元前' + cnNum(TM.centuryOf(y)) + '世纪';
    }
    if (y < 0) pre = '公元前';
    else if (y > 0 && y < 1000) pre = '公元';   /* 近代年份不再加「公元」前缀 */

    var body;
    if (date.precision === 'circa' || date.circa) body = Math.abs(y) + '年';
    else if (date.precision === 'decade') body = Math.floor(Math.abs(y) / 10) + '0年代';
    else if (date.month && date.day && date.hour) {
      body = Math.abs(y) + '年' + date.month + '月' + date.day + '日' + date.hour + '时';
    } else if (date.month && date.day) {
      body = Math.abs(y) + '年' + date.month + '月' + date.day + '日';
    } else if (date.month) {
      body = Math.abs(y) + '年' + date.month + '月';
    } else {
      body = Math.abs(y) + '年';
    }
    return (date.circa ? '约' : '') + pre + body;
  };

  TM.formatRange = function (a, b) {
    function one(v) { return (v < 0 ? '公元前' + Math.abs(v) : '公元' + v) + '年'; }
    return one(a) + '—' + one(b);
  };

  /** 精度名称（中文） */
  TM.precisionName = function (p) {
    return ({
      century: '世纪', decade: '年代', year: '年', month: '月', day: '日',
      hour: '时', minute: '分', circa: '约数', range: '区间'
    })[p] || (p || '');
  };

  /**
   * 按「数据里实际存在的最高精度」输出完整时间文本。
   * 与 format 的区别：不优先使用简写的 display，而是依据结构化字段还原到最精确，
   * 例如精确到日就输出到日、精确到时/分就输出到时/分（详情卡顶部使用）。
   */
  TM.formatPrecise = function (date) {
    if (!date) return '';
    if (date.precision === 'range' &&
        typeof date.rangeStart === 'number' && typeof date.rangeEnd === 'number') {
      return TM.formatRange(date.rangeStart, date.rangeEnd);
    }

    var y = Number(date.year) || 0;
    var circa = date.circa ? '约' : '';

    if (date.precision === 'century') {
      return '约' + (y < 0 ? '公元前' : '') + cnNum(TM.centuryOf(y)) + '世纪';
    }
    if (date.precision === 'decade') {
      return circa + (y < 0 ? '公元前' : (y > 0 && y < 1000 ? '公元' : '')) +
        (Math.floor(Math.abs(y) / 10) * 10) + '年代';
    }

    var pre = y < 0 ? '公元前' : (y > 0 && y < 1000 ? '公元' : '');
    var s = circa + pre + Math.abs(y) + '年';
    if (date.month) s += date.month + '月';
    if (date.day) s += date.day + '日';
    if (date.hour != null) s += ' ' + U.pad2(date.hour) + '时';
    if (date.minute != null) s += U.pad2(date.minute) + '分';
    return s;
  };

  /* ------------------------- 刻度文本 ------------------------- */

  var TICK_MODE = {
    century: 100,
    decade: 10,
    year: 1,
    month: 1 / 12,
    day: 1 / DAYS,
    hour: 1 / HOURS,
    minute: 1 / MINUTES
  };

  /** 根据刻度间隔决定显示模式 */
  TM.modeForInterval = function (iv) {
    if (iv >= 100) return 'century';
    if (iv >= 10) return 'decade';
    if (iv >= 1) return 'year';
    if (iv >= 1 / 12 - 1e-9) return 'month';
    if (iv >= 1 / DAYS - 1e-12) return 'day';
    if (iv >= 1 / HOURS - 1e-15) return 'hour';
    return 'minute';
  };

  /** 刻度标签：short=true 输出更短的文本（用于密集刻度） */
  TM.formatTick = function (x, interval, mode) {
    mode = mode || TM.modeForInterval(interval);
    var d = TM.fromX(x);
    var ynum = d.isBC ? -d.year : d.year;

    switch (mode) {
      case 'century':
        return (d.isBC ? '前' : '') + TM.centuryOf(ynum) + '世纪';
      case 'decade':
        return (d.isBC ? '前' : '') + ynum + '年';
      case 'year':
        return (d.isBC ? '前' : '') + ynum;
      case 'month':
        return (d.isBC ? '前' : '') + ynum + '年' + d.month + '月';
      case 'day':
        return (d.isBC ? '前' : '') + ynum + '-' + U.pad2(d.month) + '-' + U.pad2(d.day);
      case 'hour':
        return ynum + '-' + U.pad2(d.month) + '-' + U.pad2(d.day) + ' ' + U.pad2(d.hour) + '时';
      default:
        return ynum + '-' + U.pad2(d.month) + '-' + U.pad2(d.day) + ' ' +
          U.pad2(d.hour) + ':' + U.pad2(d.minute);
    }
  };

  /* ------------------------- 日期文本解析 ------------------------- */

  var RE = {
    circa: /^(约|大約|大约)\s*/,
    bc: /^(公元前|西元前|前|BCE|BC|bce|bc)\s*/,
    ad: /^(公元|西元|CE|AD|ce|ad)\s*/,
    range: /^(.+?)\s*(?:—|–|－|~|～|至|到)\s*(.+)$/,
    ymd: /^(\d{1,4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?$/,
    ym: /^(\d{1,4})\s*[-/.年]\s*(\d{1,2})\s*月?$/,
    y: /^(\d{1,6})\s*年?$/,
    negY: /^-\s*(\d{1,6})\s*年?$/,
    /* 19世纪60年代 / 十九世纪六十年代 */
    centuryDecade: /^(\d{1,2}|[一二三四五六七八九十百]+)\s*世纪\s*(\d{1,2}|[一二三四五六七八九十]+)\s*0?\s*年代/,
    /* 1960年代 / 1760年代 */
    decade4: /^(\d{3,4})\s*年代/,
    /* 60年代 */
    decade2: /^(\d{1,2})\s*年代/,
    century: /^(\d{1,2}|[一二三四五六七八九十]+)\s*世纪/,
    hm: /(\d{1,2})\s*[:：时点]\s*(\d{1,2})?\s*分?/
  };

  function cnToInt(s) {
    var map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
    if (!s) return 0;
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s === '十') return 10;
    if (s.length === 2 && s.charAt(0) === '十') return 10 + (map[s.charAt(1)] || 0);
    if (s.length === 2 && s.charAt(1) === '十') return (map[s.charAt(0)] || 0) * 10;
    if (s.length === 3 && s.charAt(1) === '十') return (map[s.charAt(0)] || 0) * 10 + (map[s.charAt(2)] || 0);
    return map[s] || 0;
  }

  /** 抽取「时 / 分」，并把该片段从字符串中移除 */
  function extractTime(s) {
    var m = s.match(RE.hm);
    if (!m) return { s: s, hour: null, minute: null };
    var hour = parseInt(m[1], 10);
    if (isNaN(hour) || hour > 24) return { s: s, hour: null, minute: null };
    var minute = m[2] != null ? parseInt(m[2], 10) : null;
    if (minute != null && (isNaN(minute) || minute > 60)) minute = null;
    var cleaned = s.replace(m[0], ' ').replace(/\s+/g, ' ').trim();
    return { s: cleaned, hour: hour, minute: minute };
  }

  function parseOne(input) {
    var s = String(input || '').trim();
    if (!s) return null;
    s = s.replace(/[，,]/g, '').replace(/\s+/g, ' ').trim();

    var circa = false;
    if (RE.circa.test(s)) { circa = true; s = s.replace(RE.circa, '').trim(); }

    var isBC = false;
    if (RE.bc.test(s)) { isBC = true; s = s.replace(RE.bc, '').trim(); }
    else if (RE.ad.test(s)) { s = s.replace(RE.ad, '').trim(); }

    if (!s) return null;

    var m;

    /* 1. 世纪 + 年代：19世纪60年代 */
    m = s.match(RE.centuryDecade);
    if (m) {
      var c1 = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : cnToInt(m[1]);
      var rawD = /^\d+$/.test(m[2]) ? parseInt(m[2], 10) : cnToInt(m[2]);
      /* 兼容「60」与「6」两种写法，统一取十位 */
      var d1 = rawD >= 10 ? Math.floor(rawD / 10) : rawD;
      if (!c1 || d1 > 9) return null;
      var yr1 = (c1 - 1) * 100 + d1 * 10;
      if (isBC) yr1 = -yr1;
      return {
        year: yr1, month: 1, precision: 'decade', circa: circa,
        display: (circa ? '约' : '') + (isBC ? '公元前' : '') + c1 + '世纪' + d1 + '0年代'
      };
    }

    /* 2. 1960年代 */
    m = s.match(RE.decade4);
    if (m) {
      var yr2 = parseInt(m[1], 10);
      yr2 = Math.floor(yr2 / 10) * 10;
      if (isBC) yr2 = -yr2;
      return {
        year: yr2, month: 1, precision: 'decade', circa: circa,
        display: (circa ? '约' : '') + (isBC ? '公元前' : '') + Math.abs(yr2) + '年代'
      };
    }

    /* 3. 60年代 */
    m = s.match(RE.decade2);
    if (m) {
      var yr3 = parseInt(m[1], 10) * 10;
      if (isBC) yr3 = -yr3;
      return {
        year: yr3, month: 1, precision: 'decade', circa: circa,
        display: (circa ? '约' : '') + (isBC ? '公元前' : '') + Math.abs(yr3) + '年代'
      };
    }

    /* 4. 世纪：统一以该世纪的起始年份定位 */
    m = s.match(RE.century);
    if (m) {
      var n = /^\d+$/.test(m[1]) ? parseInt(m[1], 10) : cnToInt(m[1]);
      if (!n) return null;
      var startYear = isBC ? -(n * 100) : (n * 100 - 99);
      var endYear = isBC ? -(n * 100 - 99) : (n * 100);
      return {
        year: startYear, month: 1, precision: 'century', circa: true,
        display: '约' + (isBC ? '公元前' : '') + n + '世纪（' +
          (isBC ? '前' : '') + Math.abs(startYear) + '—' +
          (isBC ? '前' : '') + Math.abs(endYear) + '年）'
      };
    }

    /* 5. 年月日 */
    m = s.match(RE.ymd);
    if (m) {
      var yy = parseInt(m[1], 10) * (isBC ? -1 : 1);
      var mo = parseInt(m[2], 10), dd = parseInt(m[3], 10);
      return {
        year: yy, month: mo, day: dd, precision: 'day', circa: circa,
        display: (circa ? '约' : '') + (isBC ? '公元前' : '') + m[1] + '年' + mo + '月' + dd + '日'
      };
    }

    /* 6. 年月 */
    m = s.match(RE.ym);
    if (m) {
      var yy2 = parseInt(m[1], 10) * (isBC ? -1 : 1);
      var mo2 = parseInt(m[2], 10);
      return {
        year: yy2, month: mo2, precision: 'month', circa: circa,
        display: (circa ? '约' : '') + (isBC ? '公元前' : '') + m[1] + '年' + mo2 + '月'
      };
    }

    /* 7. -221 形式的公元前年份 */
    m = s.match(RE.negY);
    if (m) {
      var yN = -parseInt(m[1], 10);
      return {
        year: yN, precision: circa ? 'circa' : 'year', circa: circa,
        display: (circa ? '约' : '') + '公元前' + Math.abs(yN) + '年'
      };
    }

    /* 8. 纯年份 */
    m = s.match(RE.y);
    if (m) {
      var y3 = parseInt(m[1], 10) * (isBC ? -1 : 1);
      if (!y3) return null;
      return {
        year: y3, precision: circa ? 'circa' : 'year', circa: circa,
        display: (circa ? '约' : '') + (isBC ? '公元前' :
          (y3 > 0 && y3 < 1000 ? '公元' : '')) + Math.abs(y3) + '年'
      };
    }

    return null;
  }

  /**
   * 解析任意用户输入的时间文本。
   * 支持：公元前221年 / 前221 / -221 / 1949-10-01 / 1949年10月1日 /
   *      19世纪60年代 / 约公元前3000年 / 公元3世纪 / 1949年10月1日15时
   * 返回 { ok, date, x, error }
   */
  TM.parse = function (text) {
    var raw = String(text == null ? '' : text).trim();
    if (!raw) return { ok: false, error: '请输入时间' };

    /* 先抽掉时分，避免被当作日期的一部分 */
    var ex = extractTime(raw.replace(/[，,]/g, '').replace(/\s+/g, ' ').trim());
    var datePart = ex.s;

    /* ① 整体解析 */
    var one = parseOne(datePart);
    if (!one) one = parseOne(raw);

    if (one) {
      if (ex.hour != null && one.precision !== 'century') {
        one.hour = ex.hour;
        if (ex.minute != null) one.minute = ex.minute;
        if (one.month && one.day) {
          one.precision = ex.minute != null ? 'minute' : 'hour';
          one.display = null;
          one.display = TM.format(one);
        }
      }
      var x = TM.toX(one);
      if (!isFinite(x)) return { ok: false, error: '时间数值超出可表示范围' };
      if (Math.abs(x) > 200000) return { ok: false, error: '年份过大，仅支持 20 万年以内的范围' };
      if (!one.display) one.display = TM.format(one);
      return { ok: true, date: one, x: x };
    }

    /* ② 区间：A—B */
    var rm = datePart.match(RE.range);
    if (rm) {
      var a = parseOne(rm[1]);
      var b = parseOne(rm[2]);
      if (a && b) {
        var sa = TM.toX(a), sb = TM.toX(b);
        return {
          ok: true,
          date: {
            year: Math.round((a.year + b.year) / 2),
            precision: 'range',
            rangeStart: a.year, rangeEnd: b.year,
            display: TM.formatRange(a.year, b.year)
          },
          x: (sa + sb) / 2
        };
      }
    }

    return { ok: false, error: '无法识别的时间格式：' + raw };
  };

  /** 判断系统当前时间对应的 x（时间游标） */
  TM.now = function () {
    var d = new Date();
    return TM.toX({
      year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(),
      hour: d.getHours(), minute: d.getMinutes(), precision: 'minute'
    });
  };

  TM.TICK_MODE = TICK_MODE;
  C.time = TM;
})();
