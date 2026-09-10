/* ===================================================================
   大事年表 — 编辑表单（事件新增/修改、时间轴新建/修改）
   - 系统内置时间轴只读：保存前会弹窗提醒，确认后复制副本再写入
   - 描述上限 150 字
   注意：保存函数必须定义在外层作用域，footer 的 onClick 才能引用到
   （早期版本把 save 定义在 onMount 内部，导致点击保存抛出
    “save is not defined”，表现为「新建时间轴没反应」）。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;
  var TM = C.time;

  var UI = C.ui;
  var ED = {};

  var MAX_SUMMARY = C.schema.MAX_SUMMARY;

  var PRECISIONS = [
    ['auto', '自动识别'],
    ['century', '世纪'],
    ['decade', '年代'],
    ['year', '年'],
    ['month', '月'],
    ['day', '日'],
    ['hour', '时'],
    ['minute', '分'],
    ['circa', '约数'],
    ['range', '区间']
  ];

  var COLORS = ['#e0625a', '#e08a4f', '#d9b64f', '#6fbf73', '#4f9bd9', '#6a6ad9', '#b45fc4', '#3fa8a8'];

  /* ==================================================================
     事件表单
     ================================================================== */

  ED.openEventForm = function (ref) {
    ref = ref || {};
    var isEdit = !!ref.eventId;
    var tlId = ref.timelineId || (S.timelines[0] && S.timelines[0].id);
    var tl = C.store.get(tlId);
    if (!tl) { UI.toast('找不到所属时间轴', 'err'); return; }
    var ev = isEdit ? C.store.findEvent(tlId, ref.eventId) : null;

    var date0 = ev ? U.deepClone(ev.date) : (ref.date ? U.deepClone(ref.date) : { year: 1949, precision: 'year' });
    var timeText = TM.formatPrecise(date0);

    var body =
      '<div class="field">' +
        '<label class="field__label" for="ed-time">时间</label>' +
        '<input type="text" id="ed-time" value="' + U.escapeHtml(timeText) + '" ' +
        'placeholder="公元前221年 / 1949-10-01 / 19世纪60年代" autocomplete="off" ' +
        'spellcheck="false" data-autofocus>' +
        '<div class="field__hint" id="ed-time-hint"></div>' +
      '</div>' +

      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="ed-precision">精度</label>' +
          '<select id="ed-precision">' +
            PRECISIONS.map(function (p) {
              return '<option value="' + p[0] + '">' + p[1] + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ed-level">等级（1 级最重要）</label>' +
          '<select id="ed-level">' +
            [1, 2, 3, 4, 5].map(function (l) {
              var shape = l === 1 ? '◆ ' : (l === 2 ? '● ' : (l === 3 ? '○ ' : ''));
              return '<option value="' + l + '">' + shape + (C.schema.LEVEL_LABEL[l] || l + ' 级') + '</option>';
            }).join('') +
          '</select>' +
        '</div>' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="ed-display">时间显示文本（可选，留空自动生成）</label>' +
        '<input type="text" id="ed-display" value="' + U.escapeHtml(date0.display || '') + '" ' +
        'placeholder="例如：约公元前2070年" autocomplete="off">' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="ed-title">事件名称</label>' +
        '<input type="text" id="ed-title" value="' + U.escapeHtml(ev ? ev.title : '') + '" ' +
        'placeholder="例如：秦统一六国" autocomplete="off">' +
      '</div>' +

      '<div class="field">' +
        '<label class="field__label" for="ed-summary">具体内容</label>' +
        '<textarea id="ed-summary" maxlength="' + MAX_SUMMARY + '" ' +
        'placeholder="简洁、客观，适合高中生阅读，不超过 ' + MAX_SUMMARY + ' 字">' +
        U.escapeHtml(ev ? ev.summary : '') + '</textarea>' +
        '<div class="counter" id="ed-count">0 / ' + MAX_SUMMARY + '</div>' +
      '</div>' +

      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="ed-tags">标签（逗号分隔）</label>' +
          '<input type="text" id="ed-tags" value="' + U.escapeHtml(ev ? (ev.tags || []).join('，') : '') + '" ' +
          'placeholder="战争，条约" autocomplete="off">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ed-region">地区（可选）</label>' +
          '<input type="text" id="ed-region" value="' + U.escapeHtml(ev ? ev.region : '') + '" ' +
          'placeholder="中原 / 欧洲" autocomplete="off">' +
        '</div>' +
      '</div>' +

      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="ed-viewpoint">视角（可选）</label>' +
          '<input type="text" id="ed-viewpoint" value="' + U.escapeHtml(ev ? ev.viewpoint : '') + '" ' +
          'placeholder="中国视角 / 世界视角" autocomplete="off">' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="ed-shared">共享事件 ID（跨时间轴关联，可选）</label>' +
          '<input type="text" id="ed-shared" value="' + U.escapeHtml(ev && ev.sharedEventId ? ev.sharedEventId : '') + '" ' +
          'placeholder="例如：wwii" autocomplete="off">' +
        '</div>' +
      '</div>' +

      (isEdit ? '' :
        '<div class="field">' +
          '<label class="field__label" for="ed-timeline">所属时间轴</label>' +
          '<select id="ed-timeline">' +
            S.timelines.map(function (t) {
              return '<option value="' + U.escapeHtml(t.id) + '"' + (t.id === tlId ? ' selected' : '') + '>' +
                U.escapeHtml(t.title) + (C.store.isBuiltin(t.id) ? '（内置，需复制）' : '') + '</option>';
            }).join('') +
          '</select>' +
          '<div class="field__hint">选择系统内置时间轴时，会先提醒并复制出副本，事件写入副本。</div>' +
        '</div>') +

      '<div class="note' + (C.store.isBuiltin(tlId) ? ' note--warn' : '') + '" id="ed-tip">' +
        (C.store.isBuiltin(tlId)
          ? '当前为系统内置时间轴（只读）：保存时会先提醒，确认后复制副本再写入。'
          : '编辑内容只保存在当前页面内存中，关闭页面后不会保留，请及时导出。') +
      '</div>';

    var form = null;
    var $ = function (id) { return form ? form.querySelector('#' + id) : null; };
    var timeEl = null, hintEl = null, summaryEl = null, countEl = null, precEl = null, displayEl = null;

    function updateHint() {
      if (!timeEl) return;
      var txt = timeEl.value.trim();
      if (!txt) { hintEl.textContent = ''; hintEl.className = 'field__hint'; return; }
      var r = TM.parse(txt);
      if (!r.ok) {
        hintEl.textContent = '✕ ' + r.error;
        hintEl.className = 'field__err';
        return;
      }
      hintEl.textContent = '✓ 解析为 ' + r.date.display + '（精度：' + TM.precisionName(r.date.precision) + '）';
      hintEl.className = 'field__hint';
      if (!displayEl.dataset.touched) displayEl.value = r.date.display;
    }

    function updateCount() {
      if (!summaryEl) return;
      var n = summaryEl.value.length;
      countEl.textContent = n + ' / ' + MAX_SUMMARY;
      countEl.classList.toggle('is-over', n > MAX_SUMMARY);
    }

    function collect() {
      var title = $('ed-title').value.trim();
      if (!title) { UI.toast('请填写事件名称', 'warn'); return null; }

      var rr = TM.parse(timeEl.value.trim());
      if (!rr.ok) {
        hintEl.textContent = '✕ ' + rr.error;
        hintEl.className = 'field__err';
        UI.toast('时间格式无法识别', 'err');
        return null;
      }

      var date = U.deepClone(rr.date);
      var p = precEl.value;
      if (p !== 'auto' && p !== date.precision) {
        if (p !== 'range') { delete date.rangeStart; delete date.rangeEnd; }
        date.precision = p;
        if (p === 'circa') date.circa = true;
        date.display = null;
        date.display = TM.format(Object.assign({}, date, { display: null }));
      }
      var dTxt = displayEl.value.trim();
      if (dTxt) date.display = dTxt;

      return {
        title: title,
        summary: summaryEl.value.trim().slice(0, MAX_SUMMARY),
        date: date,
        level: parseInt($('ed-level').value, 10) || 2,
        tags: ($('ed-tags').value || '').split(/[,，、;；]/).map(function (t) { return t.trim(); }).filter(Boolean),
        region: ($('ed-region').value || '').trim(),
        viewpoint: ($('ed-viewpoint').value || '').trim(),
        sharedEventId: ($('ed-shared').value || '').trim() || null
      };
    }

    function save(m) {
      if (!form) return false;
      var data = collect();
      if (!data) return false;   /* 校验失败：保持弹窗打开 */

      if (isEdit) {
        C.store.ensureEditablePrompt(tlId, '修改这条事件').then(function (target) {
          if (!target) return;
          var saved = C.store.updateEvent({ timelineId: target.id, eventId: ref.eventId }, data);
          if (!saved) { UI.toast('保存失败：事件不存在', 'err'); return; }
          UI.toast('已保存「' + saved.title + '」', 'ok');
          S.selectedEvent = { timelineId: saved.timelineId, eventId: saved.id };
          C.renderer.focusEvent(saved.timelineId, saved.id);
          m.close();
        });
        return false;
      }

      var targetId = $('ed-timeline') ? $('ed-timeline').value : tlId;
      C.store.ensureEditablePrompt(targetId, '在这条时间轴上新增事件').then(function (target) {
        if (!target) return;
        var created = C.store.addEvent(target.id, data);
        if (!created) { UI.toast('新增失败', 'err'); return; }
        UI.toast('已新增「' + created.title + '」', 'ok');
        S.selectedEvent = { timelineId: created.timelineId, eventId: created.id };
        C.renderer.focusEvent(created.timelineId, created.id);
        m.close();
      });
      return false;
    }

    UI.modal.open({
      title: isEdit ? '编辑事件' : '新增事件',
      subtitle: tl.title,
      size: 'lg',
      body: body,
      footer: [
        { text: '取消' },
        { text: isEdit ? '保存' : '新增', primary: true, onClick: function (m) { return save(m); } }
      ],
      onMount: function (b) {
        form = b;
        timeEl = $('ed-time'); hintEl = $('ed-time-hint');
        summaryEl = $('ed-summary'); countEl = $('ed-count');
        precEl = $('ed-precision'); displayEl = $('ed-display');

        precEl.value = ev ? (ev.date.precision || 'auto') : 'auto';

        timeEl.addEventListener('input', U.debounce(updateHint, 120));
        summaryEl.addEventListener('input', updateCount);
        displayEl.addEventListener('input', function () { displayEl.dataset.touched = '1'; });
        updateHint();
        updateCount();
      }
    });
  };

  /* ==================================================================
     时间轴表单（新建 / 编辑用户时间轴）
     ================================================================== */

  ED.openTimelineForm = function (id) {
    if (id && C.store.isBuiltin(id)) {
      /* 内置时间轴 → 先提醒，确认后复制副本再编辑 */
      C.store.ensureEditablePrompt(id, '编辑时间轴信息').then(function (copy) {
        if (copy) ED.openTimelineForm(copy.id);
      });
      return;
    }

    var tl = id ? C.store.get(id) : null;
    if (id && !tl) { UI.toast('找不到该时间轴', 'err'); return; }
    var isEdit = !!tl;
    var curColor = tl ? tl.color : COLORS[4];

    var body =
      '<div class="field">' +
        '<label class="field__label" for="tl-title">标题</label>' +
        '<input type="text" id="tl-title" value="' + U.escapeHtml(tl ? tl.title : '') + '" ' +
        'placeholder="例如：科技史" autocomplete="off" data-autofocus>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label" for="tl-subtitle">副标题（可选）</label>' +
        '<input type="text" id="tl-subtitle" value="' + U.escapeHtml(tl ? tl.subtitle : '') + '" ' +
        'placeholder="一句话概括这条时间轴" autocomplete="off">' +
      '</div>' +
      '<div class="row">' +
        '<div class="field">' +
          '<label class="field__label" for="tl-category">分类</label>' +
          '<input type="text" id="tl-category" value="' + U.escapeHtml(tl ? tl.category : '专题史') + '" ' +
          'placeholder="中国史 / 世界史 / 专题史" autocomplete="off" list="tl-cat-list">' +
          '<datalist id="tl-cat-list"><option value="中国史"><option value="世界史"><option value="专题史"></datalist>' +
        '</div>' +
        '<div class="field">' +
          '<label class="field__label" for="tl-order">排序（数字越小越靠上）</label>' +
          '<input type="number" id="tl-order" value="' + (tl ? tl.order : 200 + C.store.userCount()) + '" min="-9999" max="9999">' +
        '</div>' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label">主题色</label>' +
        '<div class="swatches" id="tl-colors">' +
          COLORS.map(function (c) {
            return '<button type="button" class="swatch' + (c === curColor ? ' is-on' : '') + '" data-color="' + c +
              '" style="background:' + c + '" aria-label="' + c + '"></button>';
          }).join('') +
        '</div>' +
        '<input type="hidden" id="tl-color" value="' + U.escapeHtml(curColor) + '">' +
      '</div>' +
      '<div class="field">' +
        '<label class="field__label" for="tl-desc">描述（可选）</label>' +
        '<textarea id="tl-desc" maxlength="300" style="min-height:4.4rem">' +
          U.escapeHtml(tl ? tl.description : '') + '</textarea>' +
      '</div>' +
      '<div class="note">用户自建时间轴的内容只保存在当前页面内存中，请及时导出。</div>';

    var form = null;
    var $ = function (id2) { return form ? form.querySelector('#' + id2) : null; };

    function save() {
      if (!form) return false;
      var title = $('tl-title').value.trim();
      if (!title) { UI.toast('请填写标题', 'warn'); return false; }
      var color = $('tl-color').value.trim();
      var meta = {
        title: title,
        subtitle: $('tl-subtitle').value.trim(),
        category: $('tl-category').value.trim() || '专题史',
        color: /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : COLORS[4],
        order: parseInt($('tl-order').value, 10) || 0,
        description: $('tl-desc').value.trim()
      };

      if (!isEdit) {
        var created = C.store.createTimeline(meta);
        UI.toast('已新建时间轴「' + title + '」', 'ok', 3200);
        C.renderer.fitTimeline(created.id, true);
        return true;
      }
      if (!C.store.updateTimeline(tl.id, meta)) { UI.toast('保存失败', 'err'); return false; }
      UI.toast('已保存时间轴「' + meta.title + '」', 'ok');
      return true;
    }

    UI.modal.open({
      title: isEdit ? '编辑时间轴' : '新建时间轴',
      size: 'md',
      body: body,
      footer: [
        { text: '取消' },
        { text: isEdit ? '保存' : '新建', primary: true, onClick: function () { return save(); } }
      ],
      onMount: function (b) {
        form = b;
        b.querySelectorAll('#tl-colors .swatch').forEach(function (sw) {
          sw.addEventListener('click', function () {
            $('tl-color').value = sw.getAttribute('data-color');
            b.querySelectorAll('#tl-colors .swatch').forEach(function (x) { x.classList.remove('is-on'); });
            sw.classList.add('is-on');
          });
        });
      }
    });
  };

  UI.editor = ED;
})();
