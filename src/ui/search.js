/* ===================================================================
   大事年表 — 全局搜索
   检索范围：事件名称、内容、标签、所属时间轴标题、时间显示
   支持模糊检索；按相关度 + 时间排序；键盘上下选择、回车跳转。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var R = C.renderer;

  var UI = C.ui;
  var SR = {};

  var api = null;
  var inputEl = null;
  var listEl = null;
  var results = [];
  var selIndex = 0;

  SR.isOpen = function () { return !!api; };

  SR.open = function () {
    if (api) { if (inputEl) inputEl.focus(); return; }

    var body =
      '<div class="search-box">' + U.icon('search') +
      '<input type="search" id="chrono-search-input" placeholder="搜索事件名称、内容、标签、时间轴…" ' +
      'autocomplete="off" spellcheck="false" data-autofocus aria-label="搜索关键词">' +
      '</div>' +
      '<div class="note" style="margin-bottom:.6rem">支持模糊匹配：连续子串优先，其次按顺序命中。' +
      '上下键选择，回车跳转。</div>' +
      '<div id="chrono-search-list" class="scroll-y"></div>';

    api = UI.modal.open({
      title: '搜索',
      size: 'lg',
      body: body,
      footer: [
        { text: '清除高亮', ghost: true, onClick: function (a) { clearMatches(); a.close(); } },
        { spacer: true },
        { text: '关闭', onClick: function () {} }
      ],
      onClose: function () {
        api = null;
        inputEl = null;
        listEl = null;
        clearMatches();
      },
      onMount: function (b) {
        inputEl = b.querySelector('#chrono-search-input');
        listEl = b.querySelector('#chrono-search-list');
        inputEl.value = S.query || '';
        inputEl.addEventListener('input', U.debounce(run, 110));
        inputEl.addEventListener('keydown', onKey);
        if (inputEl.value) run();
        else renderEmpty('输入关键词开始检索');
      }
    });
  };

  SR.close = function () { if (api) api.close(); };

  SR.openWith = function (q) {
    SR.open();
    if (inputEl) { inputEl.value = q; run(); }
  };

  function onKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(selIndex); }
  }

  function move(d) {
    if (!results.length) return;
    selIndex = U.clamp(selIndex + d, 0, results.length - 1);
    paintSelection();
  }

  function renderEmpty(msg) {
    if (listEl) listEl.innerHTML = '<div class="empty">' + U.escapeHtml(msg) + '</div>';
  }

  /* ------------------------------ 检索 ------------------------------ */

  function run() {
    var q = (inputEl.value || '').trim();
    S.query = q;

    if (!q) {
      results = [];
      clearMatches();
      renderEmpty('输入关键词开始检索');
      return;
    }

    var ql = q.toLowerCase();
    var out = [];
    var timelines = S.timelines;

    for (var t = 0; t < timelines.length; t++) {
      var tl = timelines[t];
      for (var i = 0; i < tl.events.length; i++) {
        var ev = tl.events[i];
        var sc = C.fuzzy.scoreFields([
          { text: ev.title, weight: 3.2 },
          { text: (ev.tags || []).join(' '), weight: 2.4 },
          { text: ev.date.display, weight: 2.0 },
          { text: tl.title, weight: 1.8 },
          { text: ev.region + ' ' + ev.viewpoint, weight: 1.4 },
          { text: ev.summary, weight: 1.0 }
        ], ql);
        if (sc > 0) {
          /* 高等级事件略加分，方便优先看到主干 */
          out.push({ ev: ev, tl: tl, score: sc + (4 - Math.min(ev.level, 4)) * 2 });
        }
      }
    }

    out.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.ev._x - b.ev._x;
    });

    results = out.slice(0, 300);
    selIndex = 0;

    var hits = new Set();
    for (var m = 0; m < results.length; m++) hits.add(results[m].ev.id);
    S.matchIds = hits;
    R.markDirty();
    paint();
  }

  function clearMatches() {
    if (S.matchIds) { S.matchIds = null; R.markDirty(); }
  }

  function paint() {
    if (!listEl) return;
    if (!results.length) {
      listEl.innerHTML = '<div class="empty">没有找到匹配的事件<br><span style="font-size:.72rem">试试更短的关键词，或使用「日期跳转」定位时间</span></div>';
      return;
    }
    var q = S.query;
    listEl.innerHTML = results.map(function (r, i) {
      var ev = r.ev;
      return '<button type="button" class="result' + (i === selIndex ? ' is-sel' : '') + '" data-i="' + i + '">' +
        '<span class="result__top">' +
          '<span class="result__time">' + U.escapeHtml(ev.date.display || '') + '</span>' +
          '<span class="result__name">' + C.fuzzy.highlight(ev.title, q) + '</span>' +
          '<span class="result__tl">' + U.escapeHtml(r.tl.title) + '</span>' +
        '</span>' +
        '<span class="result__snip">' + C.fuzzy.highlight(U.summarize(ev.summary, 72), q) + '</span>' +
      '</button>';
    }).join('');

    listEl.querySelectorAll('[data-i]').forEach(function (b) {
      b.addEventListener('click', function () {
        choose(parseInt(b.getAttribute('data-i'), 10));
      });
      b.addEventListener('mousemove', function () {
        var i = parseInt(b.getAttribute('data-i'), 10);
        if (i !== selIndex) { selIndex = i; paintSelection(); }
      });
    });
  }

  function paintSelection() {
    if (!listEl) return;
    var kids = listEl.querySelectorAll('.result');
    for (var i = 0; i < kids.length; i++) kids[i].classList.toggle('is-sel', i === selIndex);
    var sel = kids[selIndex];
    if (sel && sel.scrollIntoView) sel.scrollIntoView({ block: 'nearest' });
  }

  /* ------------------------------ 跳转 ------------------------------ */

  function choose(i) {
    var r = results[i];
    if (!r) return;
    var ev = r.ev;
    var tl = r.tl;

    /* 若所属时间轴被隐藏则自动显示 */
    if (S.hidden[tl.id]) {
      delete S.hidden[tl.id];
      S.emit('data', { kind: 'visibility' });
    }

    S.selectedEvent = { timelineId: tl.id, eventId: ev.id };
    S.highlight = { x: ev._x, timelineId: tl.id, until: Date.now() + 2000 };
    R.focusEvent(tl.id, ev.id);
    SR.close();

    setTimeout(function () {
      UI.details.open(tl.id, ev.id, R.nodeOf(tl.id, ev.id));
    }, 460);

    UI.toast('已跳转到「' + ev.title + '」', 'ok');
  }

  UI.search = SR;
})();
