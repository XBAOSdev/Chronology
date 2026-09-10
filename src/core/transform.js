/* ===================================================================
   大事年表 — 视口变换
   世界坐标 → 屏幕坐标。

   · 整体缩放 zoom：X、Y 等比缩放，同时缩放节点与文字。
   · 横向折叠 fold：只改变时间压缩率，不改变节点与文字大小。
     因此 像素/年 = BASE_PX_PER_YEAR × zoom × fold，
     而纵向单位（轨道高度）只乘 zoom。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;

  var T = {
    BASE_PX_PER_YEAR: 2,      /* zoom = 1、fold = 1 时的横轴比例 */

    MIN_ZOOM: 0.40,
    MAX_ZOOM: 4.0,

    MIN_FOLD: 0.008,          /* 约 10 万年一屏 */
    MAX_FOLD: 4000000,        /* 可达分钟级 */

    /* 纵向布局（世界单位，1 单位 = zoom=1 时 1px） */
    LANE_H: 200,
    LANE_GAP: 60,
    COLLAPSED_H: 78,
    AXIS_OFFSET: 150,         /* 轴线距轨道顶部 */
    AXIS_OFFSET_COLLAPSED: 46,

    clampZoom: function (z) { return U.clamp(z, T.MIN_ZOOM, T.MAX_ZOOM); },
    clampFold: function (f) { return U.clamp(f, T.MIN_FOLD, T.MAX_FOLD); },

    pxPerYear: function (view) {
      return T.BASE_PX_PER_YEAR * view.zoom * view.fold;
    },

    /** 生成一个变换器；size = { w, h }（CSS 像素） */
    make: function (view, size) {
      var ppy = T.pxPerYear(view);
      var z = view.zoom;
      var cx = size.w / 2;
      var cy = size.h / 2;

      return {
        pxPerYear: ppy,
        zoom: z,
        half: { w: cx, h: cy },

        x2s: function (wx) { return cx + (wx - view.x) * ppy; },
        s2x: function (sx) { return view.x + (sx - cx) / ppy; },
        y2s: function (wy) { return cy + (wy - view.y) * z; },
        s2y: function (sy) { return view.y + (sy - cy) / z; },

        /** 当前视口对应的世界 X 区间 */
        worldXRange: function (pad) {
          pad = pad || 0;
          return [view.x - (cx / ppy) - pad, view.x + (cx / ppy) + pad];
        },
        /** 当前视口对应的世界 Y 区间 */
        worldYRange: function (pad) {
          pad = pad || 0;
          return [view.y - (cy / z) - pad, view.y + (cy / z) + pad];
        }
      };
    },

    /** 让 view 以屏幕点 (sx, sy) 为锚点保持不变，回调中修改 zoom / fold */
    anchor: function (view, size, sx, sy, mutate) {
      var before = T.make(view, size);
      var wx = before.s2x(sx), wy = before.s2y(sy);
      mutate(view);
      var after = T.make(view, size);
      view.x += wx - after.s2x(sx);
      view.y += wy - after.s2y(sy);
    }
  };

  C.transform = T;
})();
