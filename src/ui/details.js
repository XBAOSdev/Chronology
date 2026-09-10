/* ===================================================================
   大事年表 — 事件详情卡（查看 + 内联编辑）
   · 查看态：标题、最精确时间、等级、标签、简介、归属
   · 编辑态（进入编辑模式后点击节点即进入）：时间 / 标题 / 等级 / 标签 / 简介
   · 点击画布空白处即关闭；系统内置时间轴需先复制副本才能编辑
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var TM = C.time;
  var R = C.renderer;

  var UI = C.ui;
  var D = {};

  var el = null;
  var current = null;      /* { timelineId, eventId } */
  var mode = 'view';       /* view | edit */
  var editing = false;     /* 编辑态正在输入，暂不因数据事件重绘 */
  var draftTags = [];

  var MAX_SUMMARY = C.schema.MAX_SUMMARY;

  function levelPill(level) {
    var shape = level <= 1 ? '◆' : (level === 2 ? '●' : '○');
    return '<span class="pill pill--l' + Math.min(level, 3) + '">' + shape + ' ' +
      (C.schema.LEVEL_LABEL[level] || (level + ' 级')) + '</span>';
  }

  function build() {
    el = document.createElement('div');
    el.className = 'detail';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '事件详情');
    el.hidden = true;
    document.body.appendChild(el);
    /* 阻止卡内滚轮/指针穿透到画布 */
    el.addEventListener('wheel', function (e) { e.stopPropagation(); }, { passive: true });
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  }

  D.isOpen = function () { return !!el && !el.hidden; };

  D.open = function (timelineId, eventId, node, forceEdit) {
    if (!el) build();
    var tl = C.store.get(timelineId);
    if (!tl) return;

    var wantEdit = forceEdit != null ? forceEdit : S.editMode;

    if (wantEdit && C.store.isBuiltin(timelineId)) {
      /* 编辑系统内置时间轴 → 先提醒，确认后复制副本并在副本上编辑 */
      if (!S.builtinEditPrompted[timelineId]) {
        S.builtinEditPrompted[timelineId] = true;
        C.store.ensureEditablePrompt(timelineId, '编辑这条时间轴上的事件').then(function (copy) {
          if (!copy) return;
          var exists = C.store.findEvent(copy.id, eventId);
          if (exists) {
            S.selectedEvent = { timelineId: copy.id, eventId: eventId };
            R.markDirty();
            D.open(copy.id, eventId, R.nodeOf(copy.id, eventId), true);
          } else {
            UI.toast('已在副本中打开，但未找到该事件', 'warn');
          }
        });
        return;
      }
      wantEdit = false;   /* 已提醒过：以只读方式展示，并提供「复制后编辑」入口 */
    }

    current = { timelineId: timelineId, eventId: eventId };
    mode = wantEdit ? 'edit' : 'view';
    editing = false;
    renderContent();
    el.hidden = false;
    position(node);
  };

  D.close = function () {
    if (!el) return;
    el.hidden = true;
    current = null;
    mode = 'view';
    editing = false;
    if (S.selectedEvent) {
      S.selectedEvent = null;
      R.markDirty();
    }
  };

  D.refresh = function () {
    if (!el || el.hidden) return;
    if (editing) { repositionOnly(); return; }
    renderContent();
    repositionOnly();
  };

  function repositionOnly() {
    if (!el || el.hidden || !current) return;
    position(R.nodeOf(current.timelineId, current.eventId));
  }

  /* ==================================================================
     渲染
     ================================================================== */

  function renderContent() {
    if (!current) return;
    var ev = C.store.findEvent(current.timelineId, current.eventId);
    var tl = C.store.get(current.timelineId);
    if (!ev || !tl) { D.close(); return; }

    if (mode === 'edit') renderEdit(ev, tl);
    else renderView(ev, tl);
  }

  /* ------------------------------ 查看态 ------------------------------ */

  function renderView(ev, tl) {
    var tags = (ev.tags || []).map(function (t) {
      return '<span class="pill">' + U.escapeHtml(t) + '</span>';
    }).join('');

    var meta = [];
    if (ev.region) meta.push('地区：' + U.escapeHtml(ev.region));
    if (ev.viewpoint) meta.push('视角：' + U.escapeHtml(ev.viewpoint));
    meta.push('所属：' + U.escapeHtml(tl.title) + (tl.copyOf ? '（副本）' : ''));

    var sharedNote = '';
    if (ev.sharedEventId) {
      var count = 0;
      C.store.allEvents().forEach(function (e) {
        if (e.sharedEventId === ev.sharedEventId) count++;
      });
      if (count > 1) {
        sharedNote = '<div class="note" style="margin-top:.55rem">该事件在 ' + count +
          ' 处出现（跨时间轴交集），已用虚线关联。</div>';
      }
    }

    var editHint = '';
    if (!S.editMode) {
      editHint = '<div class="detail__hintline">进入编辑模式后点击事件即可直接修改</div>';
    } else if (C.store.isBuiltin(tl.id)) {
      editHint = '<div class="detail__hintline">系统内置时间轴只读，' +
        '<button type="button" class="linkbtn" data-act="fork">复制副本后编辑</button></div>';
    }

    el.className = 'detail';
    el.innerHTML =
      '<div class="detail__head">' +
        '<div class="detail__time">' +
          U.escapeHtml(TM.formatPrecise(ev.date)) +
          '<span class="pill pill--mini">精确到' + U.escapeHtml(TM.precisionName(ev.date.precision)) + '</span>' +
        '</div>' +
        '<div class="detail__title">' + U.escapeHtml(ev.title) + '</div>' +
        '<div class="detail__pills">' + levelPill(ev.level) + tags + '</div>' +
      '</div>' +
      '<div class="detail__body">' + (U.escapeHtml(ev.summary) || '<em>暂无内容</em>') + sharedNote + '</div>' +
      '<div class="detail__meta">' + meta.join('　·　') + '</div>' +
      editHint +
      '<div class="detail__hintline detail__hintline--dim">点击画布空白处可关闭</div>';

    el.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { handle(b.getAttribute('data-act')); });
    });
  }

  /* ------------------------------ 编辑态 ------------------------------ */

  function renderEdit(ev, tl) {
    draftTags = (ev.tags || []).slice();

    el.className = 'detail detail--edit';
    el.innerHTML =
      '<div class="detail__head">' +
        '<div class="detail__headrow">' +
          '<span class="detail__eyebrow">编辑事件</span>' +
          '<span class="pill pill--accent">' + U.escapeHtml(tl.title) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="detail__body detail__body--form">' +
        '<div class="field">' +
          '<label class="field__label" for="dt-time">时间</label>' +
          '<input type="text" id="dt-time" value="' + U.escapeHtml(TM.formatPrecise(ev.date)) + '" ' +
          'placeholder="公元前221年 / 1949-10-01 / 19世纪60年代" autocomplete="off" spellcheck="false" data-autofocus>' +
          '<div class="field__hint" id="dt-time-hint"></div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="dt-title">标题</label>' +
          '<input type="text" id="dt-title" value="' + U.escapeHtml(ev.title) + '" autocomplete="off">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="dt-level">层级（1 级最重要）</label>' +
          '<select id="dt-level">' +
            [1, 2, 3, 4, 5].map(function (l) {
              var shape = l === 1 ? '◆ ' : (l === 2 ? '● ' : (l === 3 ? '○ ' : ''));
              return '<option value="' + l + '"' + (ev.level === l ? ' selected' : '') + '>' +
                shape + (C.schema.LEVEL_LABEL[l] || (l + ' 级')) + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label">标签</label>' +
          '<div class="tag-edit" id="dt-tags"></div>' +
          '<div class="tag-add">' +
            '<input type="text" id="dt-tag-input" placeholder="输入标签后回车添加" autocomplete="off">' +
            '<button type="button" class="btn btn--sm" id="dt-tag-add">添加</button>' +
          '</div>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="dt-summary">简介</label>' +
          '<textarea id="dt-summary" maxlength="' + MAX_SUMMARY + '">' + U.escapeHtml(ev.summary) + '</textarea>' +
          '<div class="counter" id="dt-count">0 / ' + MAX_SUMMARY + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="detail__foot">' +
        '<button type="button" class="btn btn--danger btn--sm" data-act="del">删除</button>' +
        '<span class="spacer"></span>' +
        '<button type="button" class="btn btn--sm" data-act="cancel">取消</button>' +
        '<button type="button" class="btn btn--primary btn--sm" data-act="save">保存</button>' +
      '</div>';

    var $ = function (id) { return el.querySelector('#' + id); };
    var timeEl = $('dt-time'), hintEl = $('dt-time-hint');
    var summaryEl = $('dt-summary'), countEl = $('dt-count');
    var tagInput = $('dt-tag-input');

    function paintTags() {
      var box = $('dt-tags');
      if (!box) return;
      box.innerHTML = draftTags.length
        ? draftTags.map(function (t, i) {
            return '<span class="tagchip">' + U.escapeHtml(t) +
              '<button type="button" class="tagchip__x" data-tag="' + i + '" aria-label="删除标签">×</button></span>';
          }).join('')
        : '<span class="tagchip tagchip--empty">暂无标签</span>';
      box.querySelectorAll('[data-tag]').forEach(function (b) {
        b.addEventListener('click', function () {
          draftTags.splice(parseInt(b.getAttribute('data-tag'), 10), 1);
          paintTags();
        });
      });
    }

    function addTag() {
      var v = (tagInput.value || '').trim().replace(/[,，、;；]/g, '');
      if (!v) return;
      if (draftTags.indexOf(v) < 0 && draftTags.length < 12) draftTags.push(v);
      tagInput.value = '';
      paintTags();
    }

    function updateCount() {
      var n = summaryEl.value.length;
      countEl.textContent = n + ' / ' + MAX_SUMMARY;
      countEl.classList.toggle('is-over', n > MAX_SUMMARY);
    }

    function updateHint() {
      var txt = (timeEl.value || '').trim();
      if (!txt) { hintEl.textContent = ''; hintEl.className = 'field__hint'; return; }
      var r = TM.parse(txt);
      if (!r.ok) { hintEl.textContent = '✕ ' + r.error; hintEl.className = 'field__err'; return; }
      hintEl.textContent = '✓ 解析为 ' + r.date.display + '（精度：' + TM.precisionName(r.date.precision) + '）';
      hintEl.className = 'field__hint';
    }

    paintTags();
    updateCount();
    updateHint();

    timeEl.addEventListener('input', U.debounce(updateHint, 120));
    summaryEl.addEventListener('input', updateCount);
    editing = false;

    /* 任何输入都标记为「编辑中」，避免后台数据事件把用户输入冲掉 */
    el.querySelectorAll('input, textarea, select').forEach(function (f) {
      f.addEventListener('input', function () { editing = true; });
      f.addEventListener('change', function () { editing = true; });
    });

    $('dt-tag-add').addEventListener('click', addTag);
    tagInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addTag(); }
      else if (e.key === 'Backspace' && !tagInput.value && draftTags.length) {
        draftTags.pop(); paintTags();
      }
    });

    el.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () { handle(b.getAttribute('data-act')); });
    });
  }

  /* ------------------------------ 动作 ------------------------------ */

  function handle(act) {
    if (!current) return;
    switch (act) {
      case 'save': doSave(); break;
      case 'cancel':
        mode = 'view'; editing = false;
        renderContent(); repositionOnly();
        break;
      case 'del': doDelete(); break;
      case 'fork':
        C.store.ensureEditablePrompt(current.timelineId, '编辑这条时间轴上的事件').then(function (copy) {
          if (!copy) return;
          var eid = current.eventId;
          D.close();
          if (C.store.findEvent(copy.id, eid)) {
            S.selectedEvent = { timelineId: copy.id, eventId: eid };
            R.markDirty();
            D.open(copy.id, eid, R.nodeOf(copy.id, eid), true);
          }
        });
        break;
    }
  }

  function doSave() {
    var ev = C.store.findEvent(current.timelineId, current.eventId);
    if (!ev) return;

    var $ = function (id) { return el.querySelector('#' + id); };
    var title = ($('dt-title').value || '').trim();
    if (!title) { UI.toast('请填写标题', 'warn'); return; }

    var rr = TM.parse(($('dt-time').value || '').trim());
    if (!rr.ok) { UI.toast('时间格式无法识别', 'err'); return; }

    var data = {
      title: title,
      date: U.deepClone(rr.date),
      level: parseInt($('dt-level').value, 10) || 2,
      tags: draftTags.slice(0, 12),
      summary: ($('dt-summary').value || '').replace(/\s+/g, ' ').trim().slice(0, MAX_SUMMARY)
    };

    editing = false;   /* 允许随后的数据事件正常重绘 */
    var saved = C.store.updateEvent({ timelineId: current.timelineId, eventId: current.eventId }, data);
    if (!saved) { UI.toast('保存失败', 'err'); return; }

    current = { timelineId: saved.timelineId, eventId: saved.id };
    S.selectedEvent = { timelineId: saved.timelineId, eventId: saved.id };
    UI.toast('已保存「' + saved.title + '」', 'ok');
    mode = 'edit';
    renderContent();
    repositionOnly();
    R.markDirty();
  }

  function doDelete() {
    var ev = C.store.findEvent(current.timelineId, current.eventId);
    if (!ev) return;
    var ref = { timelineId: current.timelineId, eventId: current.eventId };
    UI.confirm({
      title: '删除事件',
      text: '确定删除「' + ev.title + '」吗？此操作可通过撤销恢复。',
      okText: '删除',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      if (!C.store.deleteEvent(ref)) { UI.toast('删除失败', 'err'); return; }
      D.close();
      UI.toast('已删除事件', 'ok');
    });
  }

  /* ==================================================================
     定位：优先放在节点右下方，超出视口则翻转
     ================================================================== */

  function position(node) {
    if (!el || el.hidden) return;
    var w = el.offsetWidth || 360;
    var h = el.offsetHeight || 240;
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    if (vw <= 640) {
      el.style.left = '';
      el.style.top = '';
      el.style.right = '';
      el.style.bottom = '';
      return;
    }

    var x = vw / 2 - w / 2;
    var y = vh / 2 - h / 2;

    if (node && node.box) {
      x = node.box.x + node.box.w / 2 - w / 2;
      y = node.box.y + node.box.h + 12;
      if (y + h > vh - 12) y = node.box.y - h - 12;
    } else if (node && node.lane) {
      var ay = R.tf ? R.tf.y2s(node.lane.axisY) : vh / 2;
      x = node.sx - w / 2;
      y = ay + 24;
    }

    x = U.clamp(x, 12, Math.max(12, vw - w - 12));
    y = U.clamp(y, 12, Math.max(12, vh - h - 12));
    el.style.left = Math.round(x) + 'px';
    el.style.top = Math.round(y) + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
  }

  D.reposition = function () {
    if (!el || el.hidden || !current) return;
    position(R.nodeOf(current.timelineId, current.eventId));
  };

  /* ==================================================================
     聚合节点展开列表
     ================================================================== */

  var cluster = {};

  cluster.open = function (node) {
    var evs = node.evs.slice().sort(function (a, b) { return a._x - b._x; });
    var tl = node.lane.tl;

    var html = '<div class="note" style="margin-bottom:.6rem">在当前位置有 <b>' + evs.length +
      '</b> 个事件被聚合显示。放大（滚轮或 <kbd>+</kbd>）或展开横向折叠后会拆分为独立节点。</div>' +
      '<div class="list cluster-list">' + evs.map(function (ev, i) {
        var shape = ev.level <= 1 ? '◆' : (ev.level === 2 ? '●' : '○');
        return '<button type="button" class="item" data-i="' + i + '" style="cursor:pointer;text-align:left;width:100%">' +
          '<span class="item__bar" style="background:' + U.escapeHtml(tl.color) + '"></span>' +
          '<span class="item__main">' +
            '<span class="item__title">' + shape + ' ' + U.escapeHtml(ev.title) + '</span>' +
            '<span class="item__meta">' + U.escapeHtml(TM.formatPrecise(ev.date)) +
              '　·　' + (C.schema.LEVEL_LABEL[ev.level] || ev.level + ' 级') + '</span>' +
          '</span>' +
        '</button>';
      }).join('') + '</div>';

    var api = UI.modal.open({
      title: '聚合事件',
      subtitle: tl.title,
      size: 'md',
      body: html,
      footer: [
        {
          text: '展开这条时间轴', onClick: function () {
            R.fitTimeline(tl.id, true);
          }
        },
        { spacer: true },
        { text: '关闭', primary: true }
      ],
      onMount: function (body) {
        body.querySelectorAll('[data-i]').forEach(function (b) {
          b.addEventListener('click', function () {
            var ev = evs[parseInt(b.getAttribute('data-i'), 10)];
            api.close();
            S.selectedEvent = { timelineId: tl.id, eventId: ev.id };
            R.focusEvent(tl.id, ev.id);
            S.highlight = { x: ev._x, timelineId: tl.id, until: Date.now() + 2000 };
            R.markDirty();
            setTimeout(function () { D.open(tl.id, ev.id, R.nodeOf(tl.id, ev.id)); }, 480);
          });
        });
      }
    });
  };

  D.closeCard = D.close;
  D.mode = function () { return mode; };
  UI.details = D;
  UI.cluster = cluster;

  S.on('view', U.throttle(function () { repositionOnly(); }, 60));
  S.on('data', function () { if (D.isOpen()) D.refresh(); });
  S.on('edit', function () {
    if (!D.isOpen() || !current) return;
    var want = S.editMode ? 'edit' : 'view';
    if (want !== mode) { mode = want; editing = false; renderContent(); repositionOnly(); }
  });
  window.addEventListener('resize', U.debounce(function () { repositionOnly(); }, 200));
})();
