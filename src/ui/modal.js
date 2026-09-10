/* ===================================================================
   大事年表 — 弹窗基础设施 + Toast
   桌面居中弹窗；移动端底部抽屉（由 CSS 断点切换）。

   关键修复：关闭弹窗时必须移除「遮罩层」本身，而不是只移除里面的盒子。
   否则嵌套弹窗（例如时间轴管理 → 新建时间轴）关闭上层后，会残留一层
   全屏模糊遮罩盖住下层弹窗，表现为「点一下屏幕就全屏发虚、再点就关窗」。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  C.ui = C.ui || {};
  var UI = C.ui;

  var root = null;
  var toastRoot = null;
  var stack = [];
  var openHandlers = [];
  var seq = 0;

  UI.initShell = function () {
    root = document.getElementById('modal-root');
    toastRoot = document.getElementById('toast-root');
  };

  /* ------------------------------ Toast ------------------------------ */

  UI.toast = function (text, type, ms) {
    if (!toastRoot) UI.initShell();
    if (!toastRoot) return null;
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' toast--' + type : '');
    var icon = type === 'ok' ? U.icon('check') : (type === 'warn' || type === 'err' ? U.icon('warn') : '');
    el.innerHTML = (icon ? '<span style="width:15px;height:15px;display:inline-flex">' + icon + '</span>' : '') +
      '<span>' + U.escapeHtml(text) + '</span>';
    toastRoot.appendChild(el);
    var life = ms || 2600;
    setTimeout(function () {
      el.style.transition = 'opacity 200ms ease, transform 200ms ease';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, life);
    return el;
  };

  /* ------------------------------ 弹窗 ------------------------------ */

  function maskClick(e) {
    if (e.target !== e.currentTarget) return;
    var top = stack[stack.length - 1];
    if (!top || top.closeOnMask === false) return;
    UI.modal.close(top);
  }

  function syncRoot() {
    if (root) root.hidden = stack.length === 0;
  }

  UI.modal = {
    open: function (opts) {
      opts = opts || {};
      if (!root) UI.initShell();

      var mask = document.createElement('div');
      mask.className = 'modal-root';
      mask.setAttribute('role', 'dialog');
      mask.setAttribute('aria-modal', 'true');

      var box = document.createElement('div');
      box.className = 'modal modal--' + (opts.size || 'md');

      var head = document.createElement('div');
      head.className = 'modal__head';
      var h = document.createElement('h2');
      h.className = 'modal__title';
      h.innerHTML = U.escapeHtml(opts.title || '') +
        (opts.subtitle ? '<span class="modal__sub">' + U.escapeHtml(opts.subtitle) + '</span>' : '');
      var closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'tbtn modal__close';
      closeBtn.setAttribute('aria-label', '关闭');
      closeBtn.innerHTML = U.icon('close');
      closeBtn.style.cssText = 'width:32px;height:32px;min-height:32px;min-width:32px;padding:0';
      head.appendChild(h);
      head.appendChild(closeBtn);

      var body = document.createElement('div');
      body.className = 'modal__body';

      var api = {
        id: 'modal-' + (++seq),
        el: box,            /* 兼容：指向内容盒子 */
        mask: mask,         /* 遮罩层（关闭时真正移除的对象） */
        body: body,
        opts: opts,
        closeOnMask: opts.closeOnMask !== false,
        close: function () { UI.modal.close(api); },
        setTitle: function (t, sub) {
          h.innerHTML = U.escapeHtml(t || '') +
            (sub ? '<span class="modal__sub">' + U.escapeHtml(sub) + '</span>' : '');
        },
        setFooter: function (items) { buildFooter(items); },
        rebuildFooter: function () { buildFooter(opts.footer); }
      };

      if (opts.body instanceof Node) body.appendChild(opts.body);
      else body.innerHTML = opts.body || '';

      box.appendChild(head);
      box.appendChild(body);

      var footEl = null;
      function buildFooter(items) {
        if (footEl && footEl.parentNode) footEl.parentNode.removeChild(footEl);
        footEl = null;
        if (!items || !items.length) return;
        footEl = document.createElement('div');
        footEl.className = 'modal__foot';
        items.forEach(function (it) {
          if (it.spacer) {
            var sp = document.createElement('div');
            sp.className = 'spacer';
            footEl.appendChild(sp);
            return;
          }
          var b = document.createElement('button');
          b.type = 'button';
          b.className = 'btn' + (it.primary ? ' btn--primary' : '') + (it.danger ? ' btn--danger' : '') +
            (it.ghost ? ' btn--ghost' : '');
          if (it.id) b.id = it.id;
          b.textContent = it.text;
          b.disabled = !!it.disabled;
          b.addEventListener('click', function () {
            var keep = it.onClick ? it.onClick(api) : undefined;
            if (keep === false) return;
            if (it.close !== false) api.close();
          });
          footEl.appendChild(b);
        });
        box.appendChild(footEl);
      }
      buildFooter(opts.footer);

      mask.appendChild(box);
      mask.addEventListener('mousedown', maskClick);
      closeBtn.addEventListener('click', function () { api.close(); });

      root.appendChild(mask);
      /* 必须先把 api 入栈，再同步容器的 hidden —— 顺序反了会让 root 一直
         保持 hidden（display:none），表现为「弹窗已创建但屏幕上根本看不见」。 */
      stack.push(api);
      syncRoot();

      if (opts.onMount) {
        try { opts.onMount(body, api); } catch (e) { /* 忽略挂载异常 */ }
      }

      /* 聚焦第一个可交互元素 */
      setTimeout(function () {
        /* 优先聚焦显式标记的元素，其次才是第一个输入控件，避免落到关闭按钮上 */
        var f = box.querySelector('[data-autofocus]') ||
          box.querySelector('.modal__body input, .modal__body textarea, .modal__body select') ||
          box.querySelector('.modal__body button');
        if (f && f.focus) f.focus();
      }, 30);

      openHandlers.forEach(function (fn) { try { fn(api); } catch (e) {} });
      return api;
    },

    close: function (api) {
      var idx = stack.indexOf(api);
      if (idx < 0) return;
      stack.splice(idx, 1);
      /* 关键：移除遮罩层（不是只移除里面的盒子） */
      var layer = api.mask || api.el;
      if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
      syncRoot();
      if (api.opts && typeof api.opts.onClose === 'function') {
        try { api.opts.onClose(api); } catch (e) {}
      }
    },

    closeTop: function () {
      if (stack.length) UI.modal.close(stack[stack.length - 1]);
    },

    closeAll: function () {
      while (stack.length) UI.modal.close(stack[stack.length - 1]);
    },

    isOpen: function () { return stack.length > 0; },

    /** 顶部弹窗是否为指定 id */
    topId: function () { return stack.length ? stack[stack.length - 1].id : null; },

    /** 最上层的弹窗 api */
    top: function () { return stack.length ? stack[stack.length - 1] : null; }
  };

  /** 简易确认框 */
  UI.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }

      var api = UI.modal.open({
        title: opts.title || '确认',
        size: 'sm',
        body: '<div class="note' + (opts.danger ? ' note--danger' : '') + '">' +
          (opts.html || U.escapeHtml(opts.text || '')) + '</div>',
        closeOnMask: opts.closeOnMask !== false,
        footer: [
          { text: opts.cancelText || '取消', onClick: function () { done(false); } },
          {
            text: opts.okText || '确定',
            primary: !opts.danger,
            danger: !!opts.danger,
            onClick: function () { done(true); }
          }
        ],
        onClose: function () { done(false); }
      });
      return api;
    });
  };

  UI.escape = U.escapeHtml;
  C.ui = UI;
})();
