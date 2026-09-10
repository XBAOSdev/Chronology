/* ===================================================================
   大事年表 — 模糊检索
   连续子串命中优先，其次按顺序的子序列命中；不依赖任何分词库。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});

  /** 连续子串：命中越靠前、越完整，分数越高 */
  function substringScore(text, q) {
    if (!text || !q) return 0;
    var idx = text.indexOf(q);
    if (idx < 0) return 0;
    var score = 100 - Math.min(idx, 40);
    if (idx === 0) score += 40;
    /* 命中长度占比加成 */
    score += Math.round((q.length / text.length) * 30);
    return score;
  }

  /** 子序列：字符按顺序出现即可，间隔越小分越高 */
  function subsequenceScore(text, q) {
    if (!text || !q || q.length < 2) return 0;
    var ti = 0, gaps = 0, first = -1, matched = 0;
    for (var qi = 0; qi < q.length; qi++) {
      var ch = q.charAt(qi);
      var found = text.indexOf(ch, ti);
      if (found < 0) return 0;
      if (first < 0) first = found;
      if (matched > 0) gaps += (found - ti);
      ti = found + 1;
      matched++;
    }
    var score = 42 - Math.min(gaps, 30) - Math.min(first, 20);
    return Math.max(score, 1);
  }

  function best(text, q) {
    if (!text) return 0;
    var t = text.toLowerCase();
    var s = substringScore(t, q);
    if (s > 0) return s;
    return subsequenceScore(t, q);
  }

  /**
   * 对字段加权打分
   * fields: [{ text, weight }]
   */
  function scoreFields(fields, q) {
    var total = 0;
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      if (!f || !f.text) continue;
      var s = best(String(f.text), q);
      if (s > 0) total += s * (f.weight || 1);
    }
    return total;
  }

  /** 高亮命中的连续片段（安全转义） */
  function highlight(text, q) {
    var esc = C.util.escapeHtml(text || '');
    if (!q) return esc;
    var safe = C.util.escapeReg(C.util.escapeHtml(q));
    try {
      return esc.replace(new RegExp(safe, 'gi'), function (m) { return '<mark>' + m + '</mark>'; });
    } catch (e) {
      return esc;
    }
  }

  C.fuzzy = {
    score: best,
    scoreFields: scoreFields,
    highlight: highlight
  };
})();
