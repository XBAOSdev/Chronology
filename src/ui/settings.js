/* ===================================================================
   大事年表 — 设置 / 帮助 / 关于
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;
  var S = C.state;

  var UI = C.ui;
  var SE = {};

  /* ==================================================================
     设置
     ================================================================== */

  SE.open = function () {
    var body =
      '<div class="sec-title">外观</div>' +
      '<div class="field">' +
        '<label class="field__label">主题</label>' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap" id="se-theme">' +
          ['auto', 'light', 'dark'].map(function (m) {
            return '<button type="button" class="btn btn--sm' + (S.theme === m ? ' btn--primary' : '') +
              '" data-theme="' + m + '">' + ({ auto: '跟随系统', light: '浅色', dark: '深色' })[m] + '</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      '<label class="check"><input type="checkbox" id="se-motion"> 减少动效（关闭过渡与动画）</label>' +

      '<div class="sec-title">画布</div>' +
      '<label class="check"><input type="checkbox" id="se-grid"> 显示细线网格</label>' +
      '<label class="check"><input type="checkbox" id="se-cursor"> 显示「今天」时间游标</label>' +
      '<label class="check"><input type="checkbox" id="se-links"> 选中事件时显示跨时间轴关联线</label>' +

      '<div class="sec-title">事件显示等级</div>' +
      '<div class="field">' +
        '<div style="display:flex;gap:.4rem;flex-wrap:wrap" id="se-level">' +
          [[0, '自动'], [1, '仅 1 级'], [2, '至 2 级'], [3, '至 3 级'], [5, '全部']].map(function (p) {
            return '<button type="button" class="btn btn--sm' + (S.levelFilter === p[0] ? ' btn--primary' : '') +
              '" data-level="' + p[0] + '">' + p[1] + '</button>';
          }).join('') +
        '</div>' +
        '<div class="field__hint">自动模式下，横向折叠越紧，只保留越高等级的事件。</div>' +
      '</div>' +

      '<div class="sec-title">视图</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap">' +
        '<button class="btn btn--sm" id="se-reset">重置视图</button>' +
        '<button class="btn btn--sm" id="se-fit">纵览全部</button>' +
      '</div>' +

      '<div class="sec-title">数据</div>' +
      '<div class="note">' +
        '· 用户数据（新建、编辑、导入）<b>只存在于当前页面内存</b>，刷新或关闭标签页后消失<br>' +
        '· 程序不会自动保存任何编辑内容，也不会写入 IndexedDB / localStorage<br>' +
        '· 主题与视口偏好保存在 localStorage（不可用时自动降级为内存）<br>' +
        '· 当前 localStorage：<b>' + (U.storage.available ? '可用' : '不可用（已降级）') + '</b>' +
      '</div>' +
      '<div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.6rem">' +
        '<button class="btn btn--sm" id="se-export">导出全部用户数据</button>' +
        '<button class="btn btn--sm btn--danger" id="se-clear">清空用户数据</button>' +
      '</div>';

    var api = UI.modal.open({
      title: '设置',
      size: 'md',
      body: body,
      footer: [
        { text: '帮助与快捷键', ghost: true, close: false, onClick: function () { api.close(); setTimeout(SE.openHelp, 60); } },
        { spacer: true },
        { text: '完成', primary: true }
      ],
      onMount: function (b) {
        var $ = function (id) { return b.querySelector('#' + id); };

        b.querySelectorAll('[data-theme]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            C.theme.set(btn.getAttribute('data-theme'), true);
            b.querySelectorAll('[data-theme]').forEach(function (x) { x.classList.remove('btn--primary'); });
            btn.classList.add('btn--primary');
            if (UI.toolbar) UI.toolbar.render();
          });
        });

        var motion = $('se-motion');
        motion.checked = S.reduceMotion;
        motion.addEventListener('change', function () {
          S.reduceMotion = motion.checked;
          U.storage.set('chrono.motion', S.reduceMotion ? 'off' : 'on');
          document.documentElement.setAttribute('data-motion', S.reduceMotion ? 'off' : 'on');
        });

        var grid = $('se-grid');
        grid.checked = S.showGrid;
        grid.addEventListener('change', function () { S.showGrid = grid.checked; C.renderer.markDirty(); });

        var cursor = $('se-cursor');
        cursor.checked = S.showCursor;
        cursor.addEventListener('change', function () { S.showCursor = cursor.checked; C.renderer.markDirty(); });

        var links = $('se-links');
        links.checked = S.showSharedLinks;
        links.addEventListener('change', function () { S.showSharedLinks = links.checked; C.renderer.markDirty(); });

        b.querySelectorAll('[data-level]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            S.levelFilter = parseInt(btn.getAttribute('data-level'), 10) || 0;
            b.querySelectorAll('[data-level]').forEach(function (x) { x.classList.remove('btn--primary'); });
            btn.classList.add('btn--primary');
            C.renderer.markDirty();
            if (UI.toolbar) UI.toolbar.updateStatus();
          });
        });

        $('se-reset').addEventListener('click', function () { C.renderer.resetView(); });
        $('se-fit').addEventListener('click', function () { C.renderer.fitAll(true); api.close(); });
        $('se-export').addEventListener('click', function () { UI.io.exportZip(); });

        $('se-clear').addEventListener('click', function () {
          if (!C.store.userCount()) { UI.toast('没有用户数据', 'warn'); return; }
          UI.confirm({
            title: '清空用户数据',
            html: '将移除当前页面中所有<b>用户新建 / 编辑 / 导入</b>的时间轴，共 <b>' +
              C.store.userCount() + '</b> 条。<br>系统内置时间轴不受影响。<br>' +
              '若尚未导出，这些内容将无法恢复。',
            okText: '清空',
            danger: true
          }).then(function (ok) {
            if (!ok) return;
            C.store.resetUser();
            UI.toast('已清空用户数据', 'ok');
            api.close();
          });
        });
      }
    });
  };

  /* ==================================================================
     帮助
     ================================================================== */

  SE.openHelp = function () {
    var body =
      '<div class="sec-title">这是什么</div>' +
      '<div class="note">' +
        '「大事年表」把中国史、世界史放在同一张可自由缩放、移动的巨大画布上，' +
        '用统一的时间坐标解决「不同专题、不同地区分开讲，导致时序记忆混乱」的问题。' +
        '支持从宏观全貌到具体年月日的多尺度浏览。' +
      '</div>' +

      '<div class="sec-title">两种缩放的区别</div>' +
      '<div class="note">' +
        '<b>整体缩放</b>（滚轮 / 双指垂直捏合）：画布所有元素等比缩放，网格、轨道、节点、文字一起变大变小。<br>' +
        '<b>横向折叠</b>（Ctrl + 滚轮 / 双指横向捏合）：只改变时间压缩率，' +
        '像剪辑软件折叠轨道一样把时间轴压扁，节点和文字大小不变，方便看全貌。' +
      '</div>' +

      '<div class="sec-title">时间坐标规则</div>' +
      '<div class="note">' +
        'x = 0 对应公元元年。公元 n 年 → x = n − 1；公元前 n 年 → x = −n。<br>' +
        '月、日、时、分作为年内小数叠加，因此所有时间轴共享同一映射，' +
        '同一 X 坐标在任何轨道上都表示同一时刻。' +
      '</div>' +

      '<div class="sec-title">键盘与手势</div>' +
      '<div class="kbd-list">' + C.keyboard.SHORTCUTS.map(function (r) {
        return '<div class="kbd-row"><span style="min-width:170px">' + U.escapeHtml(r[1]) + '</span>' +
          '<span>' + U.escapeHtml(r[0]) + '</span></div>';
      }).join('') + '</div>' +

      '<div class="sec-title">数据与隐私</div>' +
      '<div class="note note--warn">' +
        '<b>用户数据全局内存编辑，手动导出，关闭页面不保存。</b><br>' +
        '· 系统内置时间轴永远只读，编辑时自动另存为副本<br>' +
        '· 不写 IndexedDB、不做草稿恢复、不自动保存编辑数据<br>' +
        '· 存在未导出修改时，关闭标签页会弹出提醒<br>' +
        '· 若已导出或没有用户数据，则不提醒' +
      '</div>' +

      '<div class="sec-title">离线与部署</div>' +
      '<div class="note">' +
        '· 纯 HTML + CSS + JavaScript，不使用任何框架、CDN、在线字体、在线图标、外部 API<br>' +
        '· 内置数据用普通 &lt;script&gt; 注册，双击 <code>index.html</code> 即可离线运行<br>' +
        '· 也可部署到 Cloudflare Pages 等纯静态托管（相对路径，无服务端路由）<br>' +
        '· 断网后刷新仍可使用，内置内容不受影响' +
      '</div>' +

      '<div class="sec-title">第三方与许可</div>' +
      '<div class="note">' +
        '本程序<b>零第三方依赖</b>：无 JSZip、无日期库、无 UI 框架。<br>' +
        'ZIP 打包（本地文件头 + 中央目录 + CRC32）为自实现；模糊检索为自实现。<br>' +
        '字体仅使用系统字体回退：思源黑体 → 鸿蒙/小米/OPPO/vivo 系统字体 → 苹方/微软雅黑 → 浏览器默认。<br>' +
        '内容只写历史常识与高中教材相关表述，不含来源、章节、评论、外部链接。' +
      '</div>' +

      '<div class="sec-title">已知限制</div>' +
      '<div class="note">' +
        '· 导入仅支持 .json 与本人导出的 .zip（store 模式），不支持压缩模式 ZIP<br>' +
        '· 拼音首字母搜索尚未实现<br>' +
        '· 公元前日期按公历扩展年表处理，只写史实与约数，不做历法换算' +
      '</div>' +

      '<div class="sec-title">内置数据概况</div>' +
      '<div class="note">' +
        C.store.builtins.map(function (tl) {
          return '· ' + U.escapeHtml(tl.title) + '：' + tl.events.length + ' 个事件';
        }).join('<br>') +
      '</div>';

    UI.modal.open({
      title: '帮助',
      subtitle: '大事年表 · 纯前端离线历史时间轴',
      size: 'lg',
      body: body,
      footer: [{ text: '知道了', primary: true }]
    });
  };

  UI.settings = SE;
})();
