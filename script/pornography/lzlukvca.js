/*
 * lzlukvca.cc（黄豆短剧）
 *
 * 功能：
 *   1. 解密 /api/drama/detail 与 /api/drama/play 的加密请求/响应体（AES-256-CBC + gzip/zlib）
 *   2. 将解密后的 JSON 输出到控制台，
 *   3. 流量原样放行（$done({})）
 *
 * 支持平台：Quantumult X / Surge / Loon
 *   - QX：body 为 base64 字符串（脚本自动解码）
 *   - Surge/Loon：需 binary-body-mode=true，body 为 Uint8Array（脚本自动识别）
 *
 * 自包含实现：SHA-256 / HMAC-SHA256 / AES-256-CBC / Base64 / Hex / Utf8 / inflate(gzip+zlib)
 * 零网络依赖、零外部库，所有算法均已对照 Node 标准库与真实抓包样本验证。
 *
 * 脚本远程地址（更新源）:
 *   https://raw.githubusercontent.com/7452323/QuantumultX/main/script/pornography/lzlukvca.js
 * 仓库目录:
 *   https://github.com/7452323/QuantumultX/tree/main/script/pornography
 */
(function () {
  'use strict';

  /* ================= SHA-256 ================= */
  var K256 = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];
  function rotr(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256Bytes(data) {
    var bytes = data instanceof Uint8Array ? Array.prototype.slice.call(data) : data.slice();
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 0x100000000), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 0xff, (hi >>> 16) & 0xff, (hi >>> 8) & 0xff, hi & 0xff);
    bytes.push((lo >>> 24) & 0xff, (lo >>> 16) & 0xff, (lo >>> 8) & 0xff, lo & 0xff);
    var h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
    var h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;
    var w = new Array(64);
    for (var i = 0; i < bytes.length; i += 64) {
      for (var t = 0; t < 16; t++) {
        var o = i + t * 4;
        w[t] = ((bytes[o] << 24) | (bytes[o + 1] << 16) | (bytes[o + 2] << 8) | bytes[o + 3]) >>> 0;
      }
      for (var t = 16; t < 64; t++) {
        var s0 = rotr(w[t - 15], 7) ^ rotr(w[t - 15], 18) ^ (w[t - 15] >>> 3);
        var s1 = rotr(w[t - 2], 17) ^ rotr(w[t - 2], 19) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) >>> 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K256[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    var out = [];
    var hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (var j = 0; j < 8; j++) {
      out.push((hs[j] >>> 24) & 0xff, (hs[j] >>> 16) & 0xff, (hs[j] >>> 8) & 0xff, hs[j] & 0xff);
    }
    return out;
  }

  /* ================= HMAC-SHA256 ================= */
  function hmacSha256(keyBytes, msgBytes) {
    var k = keyBytes.slice();
    if (k.length > 64) k = sha256Bytes(k);
    while (k.length < 64) k.push(0);
    var ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
    var inner = sha256Bytes(ipad.concat(msgBytes));
    return sha256Bytes(opad.concat(inner));
  }

  /* ================= AES-256 ================= */
  var SBOX = [
    0x63,0x7c,0x77,0x7b,0xf2,0x6b,0x6f,0xc5,0x30,0x01,0x67,0x2b,0xfe,0xd7,0xab,0x76,
    0xca,0x82,0xc9,0x7d,0xfa,0x59,0x47,0xf0,0xad,0xd4,0xa2,0xaf,0x9c,0xa4,0x72,0xc0,
    0xb7,0xfd,0x93,0x26,0x36,0x3f,0xf7,0xcc,0x34,0xa5,0xe5,0xf1,0x71,0xd8,0x31,0x15,
    0x04,0xc7,0x23,0xc3,0x18,0x96,0x05,0x9a,0x07,0x12,0x80,0xe2,0xeb,0x27,0xb2,0x75,
    0x09,0x83,0x2c,0x1a,0x1b,0x6e,0x5a,0xa0,0x52,0x3b,0xd6,0xb3,0x29,0xe3,0x2f,0x84,
    0x53,0xd1,0x00,0xed,0x20,0xfc,0xb1,0x5b,0x6a,0xcb,0xbe,0x39,0x4a,0x4c,0x58,0xcf,
    0xd0,0xef,0xaa,0xfb,0x43,0x4d,0x33,0x85,0x45,0xf9,0x02,0x7f,0x50,0x3c,0x9f,0xa8,
    0x51,0xa3,0x40,0x8f,0x92,0x9d,0x38,0xf5,0xbc,0xb6,0xda,0x21,0x10,0xff,0xf3,0xd2,
    0xcd,0x0c,0x13,0xec,0x5f,0x97,0x44,0x17,0xc4,0xa7,0x7e,0x3d,0x64,0x5d,0x19,0x73,
    0x60,0x81,0x4f,0xdc,0x22,0x2a,0x90,0x88,0x46,0xee,0xb8,0x14,0xde,0x5e,0x0b,0xdb,
    0xe0,0x32,0x3a,0x0a,0x49,0x06,0x24,0x5c,0xc2,0xd3,0xac,0x62,0x91,0x95,0xe4,0x79,
    0xe7,0xc8,0x37,0x6d,0x8d,0xd5,0x4e,0xa9,0x6c,0x56,0xf4,0xea,0x65,0x7a,0xae,0x08,
    0xba,0x78,0x25,0x2e,0x1c,0xa6,0xb4,0xc6,0xe8,0xdd,0x74,0x1f,0x4b,0xbd,0x8b,0x8a,
    0x70,0x3e,0xb5,0x66,0x48,0x03,0xf6,0x0e,0x61,0x35,0x57,0xb9,0x86,0xc1,0x1d,0x9e,
    0xe1,0xf8,0x98,0x11,0x69,0xd9,0x8e,0x94,0x9b,0x1e,0x87,0xe9,0xce,0x55,0x28,0xdf,
    0x8c,0xa1,0x89,0x0d,0xbf,0xe6,0x42,0x68,0x41,0x99,0x2d,0x0f,0xb0,0x54,0xbb,0x16
  ];
  var INV_SBOX = [
    0x52,0x09,0x6a,0xd5,0x30,0x36,0xa5,0x38,0xbf,0x40,0xa3,0x9e,0x81,0xf3,0xd7,0xfb,
    0x7c,0xe3,0x39,0x82,0x9b,0x2f,0xff,0x87,0x34,0x8e,0x43,0x44,0xc4,0xde,0xe9,0xcb,
    0x54,0x7b,0x94,0x32,0xa6,0xc2,0x23,0x3d,0xee,0x4c,0x95,0x0b,0x42,0xfa,0xc3,0x4e,
    0x08,0x2e,0xa1,0x66,0x28,0xd9,0x24,0xb2,0x76,0x5b,0xa2,0x49,0x6d,0x8b,0xd1,0x25,
    0x72,0xf8,0xf6,0x64,0x86,0x68,0x98,0x16,0xd4,0xa4,0x5c,0xcc,0x5d,0x65,0xb6,0x92,
    0x6c,0x70,0x48,0x50,0xfd,0xed,0xb9,0xda,0x5e,0x15,0x46,0x57,0xa7,0x8d,0x9d,0x84,
    0x90,0xd8,0xab,0x00,0x8c,0xbc,0xd3,0x0a,0xf7,0xe4,0x58,0x05,0xb8,0xb3,0x45,0x06,
    0xd0,0x2c,0x1e,0x8f,0xca,0x3f,0x0f,0x02,0xc1,0xaf,0xbd,0x03,0x01,0x13,0x8a,0x6b,
    0x3a,0x91,0x11,0x41,0x4f,0x67,0xdc,0xea,0x97,0xf2,0xcf,0xce,0xf0,0xb4,0xe6,0x73,
    0x96,0xac,0x74,0x22,0xe7,0xad,0x35,0x85,0xe2,0xf9,0x37,0xe8,0x1c,0x75,0xdf,0x6e,
    0x47,0xf1,0x1a,0x71,0x1d,0x29,0xc5,0x89,0x6f,0xb7,0x62,0x0e,0xaa,0x18,0xbe,0x1b,
    0xfc,0x56,0x3e,0x4b,0xc6,0xd2,0x79,0x20,0x9a,0xdb,0xc0,0xfe,0x78,0xcd,0x5a,0xf4,
    0x1f,0xdd,0xa8,0x33,0x88,0x07,0xc7,0x31,0xb1,0x12,0x10,0x59,0x27,0x80,0xec,0x5f,
    0x60,0x51,0x7f,0xa9,0x19,0xb5,0x4a,0x0d,0x2d,0xe5,0x7a,0x9f,0x93,0xc9,0x9c,0xef,
    0xa0,0xe0,0x3b,0x4d,0xae,0x2a,0xf5,0xb0,0xc8,0xeb,0xbb,0x3c,0x83,0x53,0x99,0x61,
    0x17,0x2b,0x04,0x7e,0xba,0x77,0xd6,0x26,0xe1,0x69,0x14,0x63,0x55,0x21,0x0c,0x7d
  ];
  function aesExpandKey(keyBytes) {
    var Nk = keyBytes.length / 4, Nr = Nk + 6;
    var w = [];
    for (var i = 0; i < Nk; i++) w[i] = [keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]];
    var rcon = 1;
    for (var i = Nk; i < 4 * (Nr + 1); i++) {
      var temp = w[i - 1].slice();
      if (i % Nk === 0) {
        temp = [temp[1], temp[2], temp[3], temp[0]];
        temp = [SBOX[temp[0]], SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]]];
        temp[0] ^= rcon;
        rcon = (rcon << 1) ^ (rcon & 0x80 ? 0x11b : 0);
      } else if (Nk > 6 && i % Nk === 4) {
        temp = [SBOX[temp[0]], SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]]];
      }
      var prev = w[i - Nk];
      w[i] = [prev[0] ^ temp[0], prev[1] ^ temp[1], prev[2] ^ temp[2], prev[3] ^ temp[3]];
    }
    var rk = new Array((Nr + 1) * 16);
    for (var r = 0; r < Nr + 1; r++) {
      for (var c = 0; c < 4; c++) {
        var wv = w[r * 4 + c];
        rk[r * 16 + c * 4] = wv[0]; rk[r * 16 + c * 4 + 1] = wv[1];
        rk[r * 16 + c * 4 + 2] = wv[2]; rk[r * 16 + c * 4 + 3] = wv[3];
      }
    }
    return { rk: rk, Nr: Nr };
  }
  function xtime(a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff; }
  function aesBlockDecrypt(state, rk, Nr) {
    var s = state.slice();
    function addRoundKey(r) { for (var i = 0; i < 16; i++) s[i] ^= rk[r * 16 + i]; }
    function invSubBytes() { for (var i = 0; i < 16; i++) s[i] = INV_SBOX[s[i]]; }
    function invShiftRows() {
      var t = s.slice();
      s[0] = t[0]; s[1] = t[13]; s[2] = t[10]; s[3] = t[7];
      s[4] = t[4]; s[5] = t[1]; s[6] = t[14]; s[7] = t[11];
      s[8] = t[8]; s[9] = t[5]; s[10] = t[2]; s[11] = t[15];
      s[12] = t[12]; s[13] = t[9]; s[14] = t[6]; s[15] = t[3];
    }
    function mul9(a) { return xtime(xtime(xtime(a))) ^ a; }
    function mul11(a) { return xtime(xtime(xtime(a))) ^ xtime(a) ^ a; }
    function mul13(a) { return xtime(xtime(xtime(a))) ^ xtime(xtime(a)) ^ a; }
    function mul14(a) { return xtime(xtime(xtime(a))) ^ xtime(xtime(a)) ^ xtime(a); }
    function invMixColumns() {
      for (var c = 0; c < 4; c++) {
        var i = c * 4;
        var a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
        s[i] = mul14(a0) ^ mul11(a1) ^ mul13(a2) ^ mul9(a3);
        s[i + 1] = mul9(a0) ^ mul14(a1) ^ mul11(a2) ^ mul13(a3);
        s[i + 2] = mul13(a0) ^ mul9(a1) ^ mul14(a2) ^ mul11(a3);
        s[i + 3] = mul11(a0) ^ mul13(a1) ^ mul9(a2) ^ mul14(a3);
      }
    }
    addRoundKey(Nr);
    for (var r = Nr - 1; r > 0; r--) {
      invShiftRows(); invSubBytes(); addRoundKey(r); invMixColumns();
    }
    invShiftRows(); invSubBytes(); addRoundKey(0);
    return s;
  }
  function aesCbcDecrypt(cipherBytes, keyBytes, ivBytes) {
    var rkObj = aesExpandKey(keyBytes);
    var rk = rkObj.rk, Nr = rkObj.Nr;
    var out = [];
    var prev = ivBytes.slice();
    for (var off = 0; off < cipherBytes.length; off += 16) {
      var block = cipherBytes.slice(off, off + 16);
      var dec = aesBlockDecrypt(block, rk, Nr);
      for (var i = 0; i < 16; i++) out.push(dec[i] ^ prev[i]);
      prev = block;
    }
    var padLen = out[out.length - 1];
    if (padLen >= 1 && padLen <= 16) out.length -= padLen;
    return out;
  }

  /* ================= Base64 / Hex / Utf8 ================= */
  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64_REV = (function () {
    var m = {};
    for (var i = 0; i < 64; i++) m[B64_CHARS[i]] = i;
    return m;
  })();
  function base64ToBytes(str) {
    str = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
    var out = [];
    var buffer = 0, bits = 0;
    for (var j = 0; j < str.length; j++) {
      var ch = str[j];
      if (ch === '=') break;
      buffer = (buffer << 6) | B64_REV[ch];
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        out.push((buffer >> bits) & 0xff);
      }
    }
    return out;
  }
  function hexToBytes(hexStr) {
    var s = String(hexStr).replace(/[^0-9a-fA-F]/g, '');
    var out = [];
    for (var i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
  }
  function utf8ToBytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) {
          c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
          i++;
        }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0x10000) { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else { out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
    }
    return out;
  }
  function bytesToUtf8(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length;) {
      var b = bytes[i];
      if (b < 0x80) { out += String.fromCharCode(b); i++; }
      else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
      else if (b < 0xf0) {
        out += String.fromCharCode(((b & 0xf) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3;
      } else {
        var cp = ((b & 0x7) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        var v = cp - 0x10000;
        out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
        i += 4;
      }
    }
    return out;
  }

  /* ================= inflate（gunzip，gzip/zlib + stored/fixed/dynamic） ================= */
  function BitReader(bytes) { this.bytes = bytes; this.pos = 0; this.bitPos = 0; }
  BitReader.prototype.readBits = function (n) {
    var val = 0;
    for (var i = 0; i < n; i++) {
      var byte = this.bytes[this.pos];
      var bit = (byte >> this.bitPos) & 1;
      val |= bit << i;
      this.bitPos++;
      if (this.bitPos === 8) { this.bitPos = 0; this.pos++; }
    }
    return val;
  };
  BitReader.prototype.alignByte = function () { if (this.bitPos > 0) { this.bitPos = 0; this.pos++; } };
  BitReader.prototype.readByte = function () { this.alignByte(); return this.bytes[this.pos++]; };
  BitReader.prototype.readUint16LE = function () { var a = this.readByte(), b = this.readByte(); return a | (b << 8); };
  function buildHuffmanTable(lengths) {
    var maxLen = 0;
    for (var i = 0; i < lengths.length; i++) if (lengths[i] > maxLen) maxLen = lengths[i];
    var blCount = new Array(maxLen + 1);
    for (var j = 0; j <= maxLen; j++) blCount[j] = 0;
    for (var j = 0; j < lengths.length; j++) if (lengths[j] > 0) blCount[lengths[j]]++;
    var nextCode = new Array(maxLen + 1);
    var code = 0;
    for (var bits = 1; bits <= maxLen; bits++) {
      code = (code + blCount[bits - 1]) << 1;
      nextCode[bits] = code;
    }
    var codes = new Array(lengths.length);
    for (var sym = 0; sym < lengths.length; sym++) {
      var l = lengths[sym];
      if (l > 0) { codes[sym] = nextCode[l]; nextCode[l]++; }
      else codes[sym] = -1;
    }
    return { lengths: lengths, codes: codes, maxLen: maxLen };
  }
  function huffmanDecode(reader, table) {
    var code = 0, first = 0, index = 0;
    for (var len = 1; len <= table.maxLen; len++) {
      code |= reader.readBits(1);
      var count = 0;
      for (var j = 0; j < table.lengths.length; j++) if (table.lengths[j] === len) count++;
      if (code - first < count) {
        var seen = 0;
        for (var sym = 0; sym < table.lengths.length; sym++) {
          if (table.lengths[sym] === len) {
            if (seen === code - first) return sym;
            seen++;
          }
        }
      }
      first += count;
      first <<= 1;
      code <<= 1;
    }
    throw new Error('huffman decode fail');
  }
  var LENGTH_BASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  var LENGTH_EXTRA = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  var DIST_BASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
  var DIST_EXTRA = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
  var FIXED_LIT = new Array(288);
  for (var i = 0; i < 144; i++) FIXED_LIT[i] = 8;
  for (var i = 144; i < 256; i++) FIXED_LIT[i] = 9;
  for (var i = 256; i < 280; i++) FIXED_LIT[i] = 7;
  for (var i = 280; i < 288; i++) FIXED_LIT[i] = 8;
  var FIXED_DIST = new Array(30);
  for (var i = 0; i < 30; i++) FIXED_DIST[i] = 5;
  var FIXED_LIT_TABLE = buildHuffmanTable(FIXED_LIT);
  var FIXED_DIST_TABLE = buildHuffmanTable(FIXED_DIST);
  function inflateHuffmanBlock(reader, out, tableLit, tableDist) {
    for (;;) {
      var sym = huffmanDecode(reader, tableLit);
      if (sym < 256) { out.push(sym); continue; }
      if (sym === 256) break;
      var li = sym - 257;
      var length = LENGTH_BASE[li] + reader.readBits(LENGTH_EXTRA[li]);
      var dsym = huffmanDecode(reader, tableDist);
      var dist = DIST_BASE[dsym] + reader.readBits(DIST_EXTRA[dsym]);
      var start = out.length - dist;
      for (var i = 0; i < length; i++) out.push(out[start + i]);
    }
  }
  function inflateDeflate(reader, out) {
    for (;;) {
      var bfinal = reader.readBits(1);
      var btype = reader.readBits(2);
      if (btype === 0) {
        reader.alignByte();
        var len = reader.readUint16LE();
        reader.readUint16LE();
        for (var i = 0; i < len; i++) out.push(reader.readByte());
      } else if (btype === 1) {
        inflateHuffmanBlock(reader, out, FIXED_LIT_TABLE, FIXED_DIST_TABLE);
      } else if (btype === 2) {
        var hlit = reader.readBits(5) + 257;
        var hdist = reader.readBits(5) + 1;
        var hclen = reader.readBits(4) + 4;
        var order = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
        var clLengths = new Array(19);
        for (var j = 0; j < 19; j++) clLengths[j] = 0;
        for (var j = 0; j < hclen; j++) clLengths[order[j]] = reader.readBits(3);
        var clTable = buildHuffmanTable(clLengths);
        var lengths = [];
        while (lengths.length < hlit + hdist) {
          var s = huffmanDecode(reader, clTable);
          if (s < 16) lengths.push(s);
          else if (s === 16) {
            var prev = lengths[lengths.length - 1];
            var rep = reader.readBits(2) + 3;
            for (var r = 0; r < rep; r++) lengths.push(prev);
          } else if (s === 17) {
            var rep = reader.readBits(3) + 3;
            for (var r = 0; r < rep; r++) lengths.push(0);
          } else {
            var rep = reader.readBits(7) + 11;
            for (var r = 0; r < rep; r++) lengths.push(0);
          }
        }
        var litTable = buildHuffmanTable(lengths.slice(0, hlit));
        var distTable = buildHuffmanTable(lengths.slice(hlit));
        inflateHuffmanBlock(reader, out, litTable, distTable);
      }
      if (bfinal) break;
    }
  }
  function gunzipBytes(data) {
    var out = [];
    if (data[0] === 0x1f && data[1] === 0x8b) {
      var p = 10;
      var flags = data[3];
      if (flags & 4) { var xlen = data[p] | (data[p + 1] << 8); p += 2 + xlen; }
      if (flags & 8) { while (data[p] !== 0) p++; p++; }
      if (flags & 16) { while (data[p] !== 0) p++; p++; }
      if (flags & 2) p += 2;
      inflateDeflate(new BitReader(data.slice(p)), out);
    } else if ((data[0] & 0x0f) === 8) {
      inflateDeflate(new BitReader(data.slice(2, data.length - 4)), out);
    } else {
      throw new Error('unknown compression');
    }
    return out;
  }

  /* ================= lzlukvca 协议层 ================= */
  var KEY_WEB = '7961beb44246e3012ce228d6b5ced05a';
  var KEY_IOS = '6be13f303785864aac6a6cc2cb3c9dc6';
  var KEY_OTHER = 'c10ca2986a31fb46d4481ce8631c2725';

  function platformKey(deviceType) {
    var t = String(deviceType || 'web').toLowerCase();
    if (t === 'web') return KEY_WEB;
    if (t === 'ios' || t === 'iphone' || t === 'ipad' || t === 'macos') return KEY_IOS;
    return KEY_OTHER;
  }
  function deriveKey(requestId, keyHex) {
    // AESKey(32B) = HMAC-SHA256(key=UTF8(keyHex), msg=hexDecode(requestId 去横线))
    var keyBytes = utf8ToBytes(keyHex);
    var msgBytes = hexToBytes(String(requestId).replace(/-/g, ''));
    return hmacSha256(keyBytes, msgBytes);
  }
  function bodyToBytes(body) {
    if (body == null) return null;
    // 跨 realm 安全的 Uint8Array 判断（兼容各平台引擎与测试沙箱）
    if (Object.prototype.toString.call(body) === '[object Uint8Array]') return Array.prototype.slice.call(body);
    if (typeof body === 'string' && body.length > 0) return base64ToBytes(body);
    return null;
  }
  function decryptBody(body, requestId, deviceType) {
    var bytes = bodyToBytes(body);
    if (!bytes || bytes.length < 32) return null; // IV(16) + 至少一块密文(16)
    var keyHex = platformKey(deviceType);
    var key = deriveKey(requestId, keyHex);
    try {
      var iv = bytes.slice(0, 16);
      var ct = bytes.slice(16);
      var pt = aesCbcDecrypt(ct, key, iv);
      if (pt.length > 0 && (pt[0] === 0x1f || (pt[0] & 0x0f) === 8)) {
        pt = gunzipBytes(pt);
      }
      return JSON.parse(bytesToUtf8(pt));
    } catch (e) {
      return null;
    }
  }

  /* ================= 主流程（只读诊断 + 原样放行） ================= */
  var isResponse = typeof $response !== 'undefined';
  // 三平台 request/response 阶段均可用 $request.url；response 阶段 body/headers 从 $response 取
  var url = ($request && $request.url) || '';
  var target = isResponse ? $response : $request;
  var body = target ? target.body : undefined;
  var hdrs = (target && target.headers) || {};
  var lower = {};
  for (var k in hdrs) {
    if (Object.prototype.hasOwnProperty.call(hdrs, k)) lower[String(k).toLowerCase()] = hdrs[k];
  }
  var requestId = lower['requestid'] || '';
  var deviceType = lower['devicetype'] || 'web';

  var tag = isResponse ? 'RESP' : 'REQ ';
  if (body != null) {
    var json = decryptBody(body, requestId, deviceType);
    if (json) {
      console.log('[lzlukvca] ' + tag + ' ' + url);
      console.log('[lzlukvca] ' + JSON.stringify(json));
    } else {
      console.log('[lzlukvca] ' + tag + ' ' + url + ' | requestId=' + requestId + ' | deviceType=' + deviceType + ' | bodyLen=' + (body.length || 0) + ' | decrypt=skip/fail');
    }
  } else {
    console.log('[lzlukvca] ' + tag + ' ' + url + ' | no body');
  }

  // 原样放行：不修改任何请求/响应内容
  $done({});
})();
