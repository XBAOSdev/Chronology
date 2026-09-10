/* ===================================================================
   大事年表 — 零依赖 ZIP
   只实现最小结构：本地文件头 + 中央目录 + EOCD，store 模式（不压缩）。
   不使用 JSZip 或任何第三方 ZIP 库。
   =================================================================== */
(function () {
  'use strict';
  var C = window.CHRONO || (window.CHRONO = {});
  var U = C.util;

  /* ---------------- 写入 ---------------- */

  function buildZip(files) {
    /* files: [{ name: string, data: Uint8Array | string }] */
    var enc = U.bytesToUtf8;
    var now = new Date();
    var dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() / 2) & 31);
    var dosDate = (((now.getFullYear() - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

    var parts = [];      /* 所有分片，最终拼成一个 Blob */
    var central = [];
    var offset = 0;

    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      var nameBytes = enc(f.name);
      var data = (f.data instanceof Uint8Array) ? f.data : enc(String(f.data));
      var crc = C.crc32(data);
      var size = data.length;

      /* ---- 本地文件头 ---- */
      var lh = new Uint8Array(30 + nameBytes.length);
      var dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);   /* 签名 */
      dv.setUint16(4, 20, true);           /* 解压所需版本 2.0 */
      dv.setUint16(6, 0x0800, true);       /* 通用标志：文件名为 UTF-8 */
      dv.setUint16(8, 0, true);            /* 压缩方式：0 = store */
      dv.setUint16(10, dosTime, true);
      dv.setUint16(12, dosDate, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, size, true);        /* 压缩后大小 = 原始大小 */
      dv.setUint32(22, size, true);
      dv.setUint16(26, nameBytes.length, true);
      dv.setUint16(28, 0, true);           /* 扩展字段长度 */
      lh.set(nameBytes, 30);

      parts.push(lh);
      parts.push(data);

      /* ---- 中央目录条目 ---- */
      var ch = new Uint8Array(46 + nameBytes.length);
      var dv2 = new DataView(ch.buffer);
      dv2.setUint32(0, 0x02014b50, true);
      dv2.setUint16(4, 20, true);          /* 创建版本 */
      dv2.setUint16(6, 20, true);          /* 解压所需版本 */
      dv2.setUint16(8, 0x0800, true);
      dv2.setUint16(10, 0, true);
      dv2.setUint16(12, dosTime, true);
      dv2.setUint16(14, dosDate, true);
      dv2.setUint32(16, crc, true);
      dv2.setUint32(20, size, true);
      dv2.setUint32(24, size, true);
      dv2.setUint16(28, nameBytes.length, true);
      dv2.setUint16(30, 0, true);          /* 扩展字段 */
      dv2.setUint16(32, 0, true);          /* 注释 */
      dv2.setUint16(34, 0, true);          /* 起始磁盘号 */
      dv2.setUint16(36, 0, true);          /* 内部属性 */
      dv2.setUint32(38, 0, true);          /* 外部属性 */
      dv2.setUint32(42, offset, true);     /* 本地头偏移 */
      ch.set(nameBytes, 46);
      central.push(ch);

      offset += lh.length + data.length;
    }

    var centralSize = 0;
    for (var j = 0; j < central.length; j++) centralSize += central[j].length;

    /* ---- 中央目录结束记录 EOCD ---- */
    var eocd = new Uint8Array(22);
    var dv3 = new DataView(eocd.buffer);
    dv3.setUint32(0, 0x06054b50, true);
    dv3.setUint16(4, 0, true);
    dv3.setUint16(6, 0, true);
    dv3.setUint16(8, files.length, true);
    dv3.setUint16(10, files.length, true);
    dv3.setUint32(12, centralSize, true);
    dv3.setUint32(16, offset, true);
    dv3.setUint16(20, 0, true);

    var all = parts.concat(central);
    all.push(eocd);
    return new Blob(all, { type: 'application/zip' });
  }

  /* ---------------- 读取（只支持 store 模式，用于往返导入） ---------------- */

  function readZip(buffer) {
    var bytes = new Uint8Array(buffer);
    var dv = new DataView(buffer);
    var len = bytes.length;

    /* 从尾部向前找 EOCD 签名 */
    var eocdPos = -1;
    for (var i = len - 22; i >= 0 && i >= len - 22 - 65535; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocdPos = i; break; }
    }
    if (eocdPos < 0) throw new Error('不是有效的 ZIP 文件（未找到中央目录结束记录）');

    var count = dv.getUint16(eocdPos + 10, true);
    var cdOffset = dv.getUint32(eocdPos + 16, true);
    if (cdOffset >= len) throw new Error('ZIP 中央目录偏移越界');

    var out = [];
    var p = cdOffset;
    var dec = (window.TextDecoder) ? new TextDecoder('utf-8') : null;

    for (var n = 0; n < count && p + 46 <= len; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      var method = dv.getUint16(p + 10, true);
      var size = dv.getUint32(p + 24, true);
      var nameLen = dv.getUint16(p + 28, true);
      var extraLen = dv.getUint16(p + 30, true);
      var commentLen = dv.getUint16(p + 32, true);
      var localOffset = dv.getUint32(p + 42, true);
      var nameBytes = bytes.subarray(p + 46, p + 46 + nameLen);
      var name = dec ? dec.decode(nameBytes) : decodeURIComponent(escape(
        String.fromCharCode.apply(null, Array.prototype.slice.call(nameBytes))));

      if (dv.getUint32(localOffset, true) === 0x04034b50) {
        var lNameLen = dv.getUint16(localOffset + 26, true);
        var lExtraLen = dv.getUint16(localOffset + 28, true);
        var dataStart = localOffset + 30 + lNameLen + lExtraLen;
        var data = bytes.subarray(dataStart, dataStart + size);
        out.push({ name: name, data: data, method: method, compressed: method !== 0 });
      }
      p += 46 + nameLen + extraLen + commentLen;
    }
    return out;
  }

  C.zip = {
    /** 打包为 Blob（store 模式，不压缩） */
    pack: buildZip,
    /** 解包，返回 [{name, data: Uint8Array, compressed}]；compressed 为 true 表示需自行解压 */
    unpack: readZip
  };
})();
