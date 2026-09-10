/* ===================================================================
   大事年表 — 时间刻度生成
   刻度由代码自动生成，不手工写死；根据当前横向压缩率自动切换粒度。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var TM = C.time;

  var MIN = 1 / TM.MINUTES;      /* 一分钟 */
  var HOUR = 1 / TM.HOURS;
  var DAY = 1 / TM.DAYS;
  var MON = 1 / 12;

  /* 由细到粗的候选间隔（单位：年） */
  var CANDIDATES = [
    MIN, 2 * MIN, 5 * MIN, 10 * MIN, 15 * MIN, 30 * MIN,
    HOUR, 2 * HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR,
    DAY, 2 * DAY, 7 * DAY, 14 * DAY,
    MON, 2 * MON, 3 * MON, 6 * MON,
    1, 2, 5, 10, 20, 25, 50,
    100, 200, 250, 500, 1000, 2000, 2500, 5000, 10000, 50000
  ];

  var T = {};

  /**
   * 选择刻度间隔
   * @param {number} pxPerYear 横向像素 / 年
   * @param {number} minPx 两个相邻刻度之间期望的最小像素距离
   */
  T.chooseInterval = function (pxPerYear, minPx) {
    if (!pxPerYear || pxPerYear <= 0) return CANDIDATES[CANDIDATES.length - 1];
    for (var i = 0; i < CANDIDATES.length; i++) {
      if (CANDIDATES[i] * pxPerYear >= minPx) return CANDIDATES[i];
    }
    return CANDIDATES[CANDIDATES.length - 1];
  };

  /**
   * 返回完整刻度配置
   * { major, minor, subdiv, mode }
   */
  T.resolve = function (pxPerYear, minPx) {
    var major = T.chooseInterval(pxPerYear, minPx);
    var subdiv = major >= 1 ? 5 : 2;
    var minor = major / subdiv;
    /* 次刻度太密时不再细分 */
    if (minor * pxPerYear < 5) { subdiv = 1; minor = major; }
    return {
      major: major,
      minor: minor,
      subdiv: subdiv,
      mode: TM.modeForInterval(major)
    };
  };

  /** 枚举 [x0, x1] 区间内的刻度点 */
  T.enumerate = function (x0, x1, interval, subdiv) {
    var out = [];
    if (!interval || interval <= 0 || !isFinite(x0) || !isFinite(x1) || x1 < x0) return out;
    var i0 = Math.ceil(x0 / interval);
    var i1 = Math.floor(x1 / interval);
    /* 安全上限，避免极端缩放下生成海量刻度 */
    if (i1 - i0 > 4000) return out;
    for (var i = i0; i <= i1; i++) {
      out.push({
        x: i * interval,
        index: i,
        major: (subdiv <= 1) ? true : (i % subdiv === 0)
      });
    }
    return out;
  };

  T.CANDIDATES = CANDIDATES;
  C.ticks = T;
})();
