/* ===================================================================
   大事年表 — 导入 / 导出
   导入：点击选择文件 或 拖拽文件到画布；支持多选、批量导入；冲突默认跳过
   导出：单条 JSON；多条 ZIP（零依赖 store 模式，不压缩）
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  var UI = C.ui;
  var IO = {};

  var MAX_FILES = 60;
  var MAX_SIZE = 12 * 1024 * 1024;   /* 单文件 12MB */

  /* ==================================================================
     导入
     ================================================================== */

  IO.openImport = function () {
    if (UI.modal.isOpen()) UI.modal.closeAll();

    var body =
      '<div class="note">' +
        '支持 <b>.json</b>（单条时间轴）与 <b>.zip</b>（由本程序导出的多时间轴包）。<br>' +
        '可一次选择多个文件，也可以直接把文件拖到画布上。<br>' +
        '<b>导入冲突默认跳过</b>：与内置或现有时间轴 ID 相同的文件不会被覆盖、重命名或合并。' +
      '</div>' +
      '<div style="margin-top:.8rem">' +
        '<input type="file" id="io-file" accept=".json,.zip,application/json,application/zip" multiple ' +
        'style="display:none">' +
        '<button class="btn btn--primary" id="io-pick" style="width:100%;min-height:46px">选择文件…</button>' +
      '</div>' +
      '<div class="sec-title">说明</div>' +
      '<div class="note">' +
        '　导入内容只存在于当前页面内存中，刷新即消失，请及时导出<br>' +
        '　事件描述超过 150 字会自动截断<br>' +
        '　单个文件上限 ' + U.formatFileSize(MAX_SIZE) + '，一次最多 ' + MAX_FILES + ' 个文件' +
      '</div>';

    var api = UI.modal.open({
      title: '导入时间轴',
      size: 'md',
      body: body,
      footer: [{ text: '关闭' }],
      onMount: function (b) {
        var input = b.querySelector('#io-file');
        b.querySelector('#io-pick').addEventListener('click', function () { input.click(); });
        input.addEventListener('change', function () {
          var files = Array.prototype.slice.call(input.files || []);
          if (files.length) {
            api.close();
            IO.readFiles(files);
          }
        });
      }
    });
  };

  /** 读取并导入一组 File 对象 */
  IO.readFiles = function (files) {
    if (files.length > MAX_FILES) {
      UI.toast('一次最多导入 ' + MAX_FILES + ' 个文件', 'warn');
      files = files.slice(0, MAX_FILES);
    }

    var items = [];
    var pending = files.length;
    var failures = [];

    if (!pending) return;

    files.forEach(function (f) {
      if (f.size > MAX_SIZE) {
        failures.push({ name: f.name, errors: ['文件超过 ' + U.formatFileSize(MAX_SIZE)] });
        if (--pending === 0) finish();
        return;
      }
      var isZip = /\.zip$/i.test(f.name);
      var reader = new FileReader();
      reader.onerror = function () {
        failures.push({ name: f.name, errors: ['读取失败'] });
        if (--pending === 0) finish();
      };
      reader.onload = function () {
        try {
          if (isZip) {
            var entries = C.zip.unpack(reader.result);
            var found = 0;
            entries.forEach(function (en) {
              if (!/\.json$/i.test(en.name)) return;
              found++;
              if (en.compressed) {
                failures.push({ name: f.name + ' › ' + en.name, errors: ['该 ZIP 使用了压缩模式，暂不支持解压'] });
                return;
              }
              items.push({ name: f.name + ' › ' + en.name, text: utf8Decode(en.data) });
            });
            if (!found) failures.push({ name: f.name, errors: ['ZIP 内没有 .json 文件'] });
          } else {
            items.push({ name: f.name, text: String(reader.result) });
          }
        } catch (err) {
          failures.push({ name: f.name, errors: ['解析失败：' + err.message] });
        }
        if (--pending === 0) finish();
      };

      if (isZip) reader.readAsArrayBuffer(f);
      else reader.readAsText(f, 'utf-8');
    });

    function finish() {
      if (!items.length) {
        showReport({ added: [], skipped: [], invalid: failures, warnings: [] });
        return;
      }
      var r = C.store.importTimelines(items);
      r.invalid = r.invalid.concat(failures);
      showReport(r);
      if (r.added.length) {
        UI.toast('已导入 ' + r.added.length + ' 条时间轴', 'ok');
        setTimeout(function () {
          if (r.added.length === 1) C.renderer.fitTimeline(r.added[0].id, true);
          else C.renderer.fitAll(true);
        }, 120);
      } else {
        UI.toast('没有导入任何内容', 'warn');
      }
    }
  };

  function utf8Decode(bytes) {
    if (window.TextDecoder) return new TextDecoder('utf-8').decode(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
  }

  function showReport(r) {
    var html = '';

    html += '<div class="note" style="margin-bottom:.7rem">' +
      '成功导入 <b>' + r.added.length + '</b> 条　　' +
      '跳过 <b>' + r.skipped.length + '</b> 条　　' +
      '无效 <b>' + r.invalid.length + '</b> 条</div>';

    if (r.added.length) {
      html += '<div class="sec-title">已导入</div><div class="list">' + r.added.map(function (tl) {
        return '<div class="item"><span class="item__bar" style="background:' + U.escapeHtml(tl.color) + '"></span>' +
          '<span class="item__main"><span class="item__title">' + U.escapeHtml(tl.title) + '</span>' +
          '<span class="item__meta">' + U.escapeHtml(tl.id) + '　　' + tl.events.length + ' 个事件</span></span></div>';
      }).join('') + '</div>';
    }

    if (r.skipped.length) {
      html += '<div class="sec-title">已跳过（ID 冲突）</div>' +
        '<div class="note note--warn">默认策略为跳过，不覆盖、不重命名、不合并。</div>' +
        '<div class="list" style="margin-top:.5rem">' + r.skipped.map(function (s) {
          return '<div class="item"><span class="item__main">' +
            '<span class="item__title">' + U.escapeHtml(s.name) + '</span>' +
            '<span class="item__meta">冲突 ID：' + U.escapeHtml(s.id) + '　　' + U.escapeHtml(s.reason) + '</span>' +
            '</span></div>';
        }).join('') + '</div>';
    }

    if (r.invalid.length) {
      html += '<div class="sec-title">无法导入</div><div class="list">' + r.invalid.map(function (s) {
        return '<div class="item"><span class="item__main">' +
          '<span class="item__title">' + U.escapeHtml(s.name) + '</span>' +
          '<span class="item__meta">' + U.escapeHtml((s.errors || []).join('；')) + '</span>' +
          '</span></div>';
      }).join('') + '</div>';
    }

    var wl = [];
    (r.warnings || []).forEach(function (w) {
      (w.warnings || []).forEach(function (t) { wl.push(w.name + '：' + t); });
    });
    if (wl.length) {
      html += '<div class="sec-title">提示</div><div class="note">' +
        wl.map(U.escapeHtml).join('<br>') + '</div>';
    }

    if (!html) html = '<div class="empty">没有可处理的内容</div>';

    UI.modal.open({
      title: '导入结果',
      size: 'lg',
      body: html,
      footer: [{ text: '知道了', primary: true }]
    });
  }

  /* ==================================================================
     导出
     ================================================================== */

  IO.openExport = function () {
    if (UI.modal.isOpen()) UI.modal.closeAll();

    var userIds = C.store.exportableIds();
    var counts = { user: userIds.length, builtin: C.store.builtins.length };

    var body =
      '<div class="note' + (S.dirty ? ' note--warn' : '') + '">' +
        (S.dirty
          ? '当前有 <b>' + C.store.dirtyCount() + '</b> 处尚未导出的修改。关闭页面后这些内容不会保留。'
          : '当前没有未导出的修改。') +
      '</div>' +
      '<div class="sec-title">当前视图</div>' +
      '<div class="list">' +
        '<div class="item"><span class="item__main">' +
          '<span class="item__title">导出当前视图（PNG）</span>' +
          '<span class="item__meta">画布此刻的完整画面，保留当前缩放与横向折叠　　' +
            '<span id="io-png-size">按设备像素导出</span></span>' +
          '</span><button class="btn btn--sm btn--primary" id="io-png">导出 PNG</button></div>' +
      '</div>' +
      '<div class="sec-title">导出用户数据</div>' +
      '<div class="list">' +
        '<div class="item"><span class="item__main">' +
          '<span class="item__title">全部用户时间轴（ZIP）</span>' +
          '<span class="item__meta">共 ' + counts.user + ' 条　　零依赖 store 模式打包，可用常见解压软件打开</span>' +
          '</span><button class="btn btn--sm btn--primary" id="io-zip">导出 ZIP</button></div>' +
      '</div>' +
      '<div class="sec-title">单条导出（JSON）</div>' +
      '<div class="list scroll-y">' +
        S.timelines.map(function (tl) {
          return '<div class="item">' +
            '<span class="item__bar" style="background:' + U.escapeHtml(tl.color) + '"></span>' +
            '<span class="item__main">' +
              '<span class="item__title">' + U.escapeHtml(tl.title) +
                (C.store.isBuiltin(tl.id) ? '<span class="pill">内置</span>' : '') + '</span>' +
              '<span class="item__meta">' + U.escapeHtml(tl.id) + '　　' + tl.events.length + ' 个事件</span>' +
            '</span>' +
            '<button class="btn btn--sm" data-exp="' + U.escapeHtml(tl.id) + '">导出</button>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="sec-title">说明</div>' +
      '<div class="note">' +
        '　单条文件名：<code>时间轴ID.json</code><br>' +
        '　多条文件名：<code>大事年表_用户时间轴_YYYYMMDD.zip</code><br>' +
        '　视图文件名：<code>大事年表_视图_YYYYMMDD_HHMM.png</code>（仅画布内容，不含浮层按钮）<br>' +
        '　导出文件可直接再次导入（往返不丢字段）<br>' +
        '　不引入 JSZip 等第三方库，ZIP 结构（本地头 + 中央目录 + CRC32）由本程序自实现' +
      '</div>';

    var api = UI.modal.open({
      title: '导出',
      size: 'lg',
      body: body,
      footer: [{ text: '关闭' }],
      onMount: function (b) {
        b.querySelector('#io-zip').addEventListener('click', function () { IO.exportZip(); });
        b.querySelectorAll('[data-exp]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            IO.exportOne(btn.getAttribute('data-exp'));
          });
        });
        b.querySelector('#io-png').addEventListener('click', function () { IO.exportViewPNG(); });
        var sizeEl = b.querySelector('#io-png-size');
        if (sizeEl) {
          var cv = document.getElementById('stage');
          if (cv) sizeEl.textContent = cv.width + ' × ' + cv.height + ' px';
        }
        refreshZipButton(b.querySelector('#io-zip'));
      }
    });

    function refreshZipButton(btn) {
      var n = C.store.exportableIds().length;
      if (!n) {
        btn.disabled = true;
        btn.textContent = '没有用户时间轴';
      }
    }
  };

  IO.exportOne = function (id) {
    var out = C.store.exportJSON(id);
    if (!out) { UI.toast('导出失败：找不到时间轴', 'err'); return; }
    U.downloadText(out.text, out.filename, 'application/json');
    var tl = C.store.get(id);
    if (tl && C.store.isUser(id)) C.store.clearDirtyIds([id]);
    UI.toast('已导出 ' + out.filename, 'ok');
  };

  IO.exportZip = function () {
    var ids = C.store.exportableIds();
    if (!ids.length) { UI.toast('没有用户时间轴可导出', 'warn'); return; }
    var out = C.store.exportZip(ids);
    if (!out) { UI.toast('导出失败', 'err'); return; }
    U.downloadBlob(out.blob, out.filename);
    C.store.clearDirtyIds(null);
    UI.toast('已导出 ' + out.count + ' 条时间轴（' + out.filename + '）', 'ok', 3200);
  };

  /* ------------------------------------------------------------------
     导出当前视图为 PNG
     纯前端零依赖：直接取主画布的 backing store（已按 DPR 放大），
     toBlob 得到 PNG。导出的是「画布内容」——不含 DOM 浮层按钮、弹窗，
     这类按钮本身就是工具，落在图片里反而是干扰。
     ------------------------------------------------------------------ */

  IO.exportViewPNG = function () {
    var R = C.renderer;
    var cv = document.getElementById('stage');
    if (!cv || !R) { UI.toast('画布尚未就绪', 'err'); return; }

    /* 先标脏、再等两帧：确保拿到的是「按当前视图完整画完」的那一帧，
       否则可能在补间/平滑进行到一半时截到过渡态。 */
    R.markDirty();
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var w = cv.width, h = cv.height;
        var name = '大事年表_视图_' + U.stampTime() + '.png';

        function done(blob) {
          if (!blob || !blob.size) { UI.toast('导出失败：无法生成图片', 'err'); return; }
          U.downloadBlob(blob, name);
          UI.toast('已导出当前视图（' + w + ' × ' + h + '）', 'ok', 3200);
        }

        if (typeof cv.toBlob === 'function') {
          cv.toBlob(done, 'image/png');
          return;
        }
        /* 兜底：极老浏览器没有 toBlob，退化成 dataURL 再转 Blob */
        try {
          var url = cv.toDataURL('image/png');
          var b64 = url.split(',')[1] || '';
          var bin = atob(b64);
          var buf = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
          done(new Blob([buf], { type: 'image/png' }));
        } catch (e) {
          UI.toast('导出失败：' + (e && e.message ? e.message : e), 'err');
        }
      });
    });
  };

  /* ==================================================================
     拖拽导入
     ================================================================== */

  IO.initDropZone = function () {
    var overlay = document.getElementById('dropzone');
    var depth = 0;

    function hasFiles(e) {
      var dt = e.dataTransfer;
      if (!dt) return false;
      if (dt.types) {
        for (var i = 0; i < dt.types.length; i++) if (dt.types[i] === 'Files') return true;
      }
      return false;
    }

    window.addEventListener('dragenter', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth++;
      overlay.hidden = false;
    });

    window.addEventListener('dragover', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'copy'; } catch (err) {}
    });

    window.addEventListener('dragleave', function (e) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) overlay.hidden = true;
    });

    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      overlay.hidden = true;
      var files = Array.prototype.slice.call(e.dataTransfer.files || []);
      if (!files.length) return;
      if (UI.modal.isOpen()) UI.modal.closeAll();
      IO.readFiles(files);
    });
  };

  UI.io = IO;
})();
