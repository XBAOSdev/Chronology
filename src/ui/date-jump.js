/* ===================================================================
   大事年表 — 日期跳转
   把输入日期对应的 X 坐标移动到视口中心。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var TM = C.time;
  var R = C.renderer;

  var UI = C.ui;
  var DJ = {};

  var api = null;

  var SAMPLES = [
    '公元前221年', '前221', '1949-10-01',
    '1949年10月1日', '19世纪60年代', '约公元前3000年',
    '公元前3世纪', '1937年7月7日', '1919年5月4日'
  ];

  DJ.open = function () {
    if (api) return;

    var body =
      '<div class="field">' +
        '<label class="field__label" for="dj-input">请输入时间</label>' +
        '<input type="text" id="dj-input" placeholder="例如：公元前221年 / 1949-10-01 / 19世纪60年代" ' +
        'autocomplete="off" spellcheck="false" data-autofocus aria-describedby="dj-preview">' +
        '<div class="field__hint" id="dj-preview">正在解析…</div>' +
      '</div>' +
      '<div class="sec-title">常用写法</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:.35rem">' +
        SAMPLES.map(function (s) {
          return '<button type="button" class="btn btn--sm" data-sample="' + U.escapeHtml(s) + '">' +
            U.escapeHtml(s) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="note" style="margin-top:.8rem">' +
        '· 公元前可用「公元前221年」「前221」「-221」<br>' +
        '· 支持世纪、年代、年、月、日、时、分等精度<br>' +
        '· 区间写法：1949年10月—1949年12月' +
      '</div>' +
      '<label class="check" style="margin-top:.6rem">' +
        '<input type="checkbox" id="dj-keepY" checked> 保持当前纵向位置（不自动定位到时间轴）' +
      '</label>';

    var input = null, preview = null, keepY = null;

    /* 与按钮、回车共用同一份实现 */
    function doJump() {
      if (!input) return true;
      var txt = input.value.trim();
      var r = TM.parse(txt);
      if (!r.ok) {
        preview.textContent = '✕ ' + r.error;
        preview.className = 'field__err';
        return false;   /* 解析失败时不关闭弹窗 */
      }
      var opts = { minPxPerYear: 1.2 };
      if (keepY && !keepY.checked) {
        var lane = nearestLane(r.x);
        if (lane) opts.timelineId = lane.tl.id;
      }
      R.jumpToX(r.x, opts);
      S.highlight = { x: r.x, timelineId: null, until: Date.now() + 2000 };
      UI.toast('已跳转到 ' + r.date.display, 'ok');
      return true;
    }

    function update() {
      var txt = input.value.trim();
      if (!txt) { preview.textContent = '请输入时间'; preview.className = 'field__hint'; return; }
      var r = TM.parse(txt);
      if (!r.ok) { preview.textContent = '✕ ' + r.error; preview.className = 'field__err'; return; }
      preview.textContent = '✓ ' + r.date.display + '　（精度：' + precisionName(r.date.precision) + '）';
      preview.className = 'field__hint';
    }

    api = UI.modal.open({
      title: '日期跳转',
      size: 'md',
      body: body,
      footer: [
        { text: '取消' },
        { text: '跳转', primary: true, onClick: function () { return doJump(); } }
      ],
      onClose: function () { api = null; input = null; preview = null; keepY = null; },
      onMount: function (b) {
        input = b.querySelector('#dj-input');
        preview = b.querySelector('#dj-preview');
        keepY = b.querySelector('#dj-keepY');

        input.addEventListener('input', U.debounce(update, 90));
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); if (doJump()) api.close(); }
        });

        b.querySelectorAll('[data-sample]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            input.value = btn.getAttribute('data-sample');
            update();
            input.focus();
          });
        });

        update();
      }
    });
  };

  function nearestLane(x) {
    var best = null, bestD = Infinity;
    for (var i = 0; i < R.lanes.length; i++) {
      var L = R.lanes[i];
      var d = L.minX - x > 0 ? L.minX - x : (x - L.maxX > 0 ? x - L.maxX : 0);
      if (d < bestD) { bestD = d; best = L; }
    }
    return best;
  }

  function precisionName(p) {
    return ({
      century: '世纪', decade: '年代', year: '年', month: '月', day: '日',
      hour: '时', minute: '分', circa: '约数', range: '区间'
    })[p] || p;
  }

  UI.dateJump = DJ;
})();
