/*
 * 黄豆短剧（hdmgdj.com 系）解锁脚本 —— 三平台统一版 v2.0.0
 * Build 2026-09-10
 *
 * ── 协议（真机抓包复核，未变） ──────────────────────────────
 *   请求/响应 body = IV(16B) || AES-256-CBC(PKCS7, gzip(JSON))
 *   AESKey(32B)   = HMAC-SHA256(key=UTF8(平台KeyHex), msg=hexDecode(requestId 去横线))
 *   平台 Key：web=7961beb44246e3012ce228d6b5ced05a
 *             ios=6be13f303785864aac6a6cc2cb3c9dc6
 *             其它=c10ca2986a31fb46d4481ce8631c2725
 *   请求头：requestId / deviceType / version / time / sign / sessionId
 *          （sign = md5("Dart|sessionId|requestId|time|path")+"-"+time，盐是字面量，非密钥）
 *   响应头：Requestid 回显 requestId
 *
 * ── 与 v1（lzlukvca.cc 时代）的差异 ──────────────────────────
 *   1) 域名整体更换（本脚本不写死域名，规则侧匹配，m3u8 用请求自身 host）
 *   2) 客户端判定顺序改为「先 type==="vip" 弹会员窗，再看 is_buy」
 *      → detail 必须把所有剧集 type 置为 "free"，绝不能留 vip
 *   3) play 成功响应新增 is_preview（缺省 true）→ 伪造时必须显式 false
 *   4) hls_key 客户端已不使用 → 全流程同步 $done，无异步
 *   5) 付费错误码新增 813103
 *
 * ── ⚠️ 必须知道的事实（2026-09-10 实测） ─────────────────────
 *   付费集的 m3u8 由服务端硬闸门控制：`seq > free_episodes` 一律 403，
 *   签名 sig 用服务端私钥（不可伪造），CDN 分片要 auth_key（不可伪造）。
 *   因此**客户端无法解开付费集正片**，本脚本对付费集的处理是：
 *   把播放地址指向该集公开的 6 秒试看片 preview.mp4（可播放，但不是正片）。
 *   关闭方式：$argument 里设 previewFallback=false（此时付费集保留原弹窗）。
 */
(function () {
  'use strict';

  /* ================= 配置（$argument 可选） ================= */
  var ARG = (typeof $argument !== 'undefined' && $argument) ? String($argument) : '';
  function argVal(k, dflt) {
    try {
      var m = ARG.match(new RegExp('[?&]' + k + '=([^&]*)'));
      if (m) return decodeURIComponent(m[1]);
    } catch (e) {}
    return dflt;
  }
  var CFG = {
    previewFallback: argVal('previewFallback', 'true') !== 'false', // 付费集退化为 6 秒试看
    stripAds: argVal('stripAds', 'true') !== 'false',               // 去广告/去启动页
    fakeVip: argVal('fakeVip', 'true') !== 'false',                 // 我的页显示会员+余额
    debug: argVal('debug', 'false') === 'true'
  };

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
      for (var t2 = 16; t2 < 64; t2++) {
        var s0 = rotr(w[t2 - 15], 7) ^ rotr(w[t2 - 15], 18) ^ (w[t2 - 15] >>> 3);
        var s1 = rotr(w[t2 - 2], 17) ^ rotr(w[t2 - 2], 19) ^ (w[t2 - 2] >>> 10);
        w[t2] = (w[t2 - 16] + s0 + w[t2 - 7] + s1) >>> 0;
      }
      var a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
      for (var t3 = 0; t3 < 64; t3++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var temp1 = (h + S1 + ch + K256[t3] + w[t3]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var temp2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + temp1) >>> 0;
        d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
      }
      h0 = (h0 + a) >>> 0; h1 = (h1 + b) >>> 0; h2 = (h2 + c) >>> 0; h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0; h5 = (h5 + f) >>> 0; h6 = (h6 + g) >>> 0; h7 = (h7 + h) >>> 0;
    }
    var out = [], hs = [h0, h1, h2, h3, h4, h5, h6, h7];
    for (var j = 0; j < 8; j++) out.push((hs[j] >>> 24) & 0xff, (hs[j] >>> 16) & 0xff, (hs[j] >>> 8) & 0xff, hs[j] & 0xff);
    return out;
  }
  function hmacSha256(keyBytes, msgBytes) {
    var k = keyBytes.slice();
    if (k.length > 64) k = sha256Bytes(k);
    while (k.length < 64) k.push(0);
    var ipad = [], opad = [];
    for (var i = 0; i < 64; i++) { ipad.push(k[i] ^ 0x36); opad.push(k[i] ^ 0x5c); }
    return sha256Bytes(opad.concat(sha256Bytes(ipad.concat(msgBytes))));
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
  function xtime(a) { return ((a << 1) ^ (a & 0x80 ? 0x1b : 0)) & 0xff; }
  function aesExpandKey(keyBytes) {
    var Nk = keyBytes.length / 4, Nr = Nk + 6, w = [];
    for (var i = 0; i < Nk; i++) w[i] = [keyBytes[i * 4], keyBytes[i * 4 + 1], keyBytes[i * 4 + 2], keyBytes[i * 4 + 3]];
    var rcon = 1;
    for (var j = Nk; j < 4 * (Nr + 1); j++) {
      var temp = w[j - 1].slice();
      if (j % Nk === 0) {
        temp = [temp[1], temp[2], temp[3], temp[0]];
        temp = [SBOX[temp[0]], SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]]];
        temp[0] ^= rcon;
        rcon = (rcon << 1) ^ (rcon & 0x80 ? 0x11b : 0);
      } else if (Nk > 6 && j % Nk === 4) {
        temp = [SBOX[temp[0]], SBOX[temp[1]], SBOX[temp[2]], SBOX[temp[3]]];
      }
      var prev = w[j - Nk];
      w[j] = [prev[0] ^ temp[0], prev[1] ^ temp[1], prev[2] ^ temp[2], prev[3] ^ temp[3]];
    }
    var rk = new Array((Nr + 1) * 16);
    for (var r = 0; r < Nr + 1; r++) for (var c = 0; c < 4; c++) {
      var wv = w[r * 4 + c];
      rk[r * 16 + c * 4] = wv[0]; rk[r * 16 + c * 4 + 1] = wv[1];
      rk[r * 16 + c * 4 + 2] = wv[2]; rk[r * 16 + c * 4 + 3] = wv[3];
    }
    return { rk: rk, Nr: Nr };
  }
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
        var i = c * 4, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
        s[i] = mul14(a0) ^ mul11(a1) ^ mul13(a2) ^ mul9(a3);
        s[i + 1] = mul9(a0) ^ mul14(a1) ^ mul11(a2) ^ mul13(a3);
        s[i + 2] = mul13(a0) ^ mul9(a1) ^ mul14(a2) ^ mul11(a3);
        s[i + 3] = mul11(a0) ^ mul13(a1) ^ mul9(a2) ^ mul14(a3);
      }
    }
    addRoundKey(Nr);
    for (var r = Nr - 1; r > 0; r--) { invShiftRows(); invSubBytes(); addRoundKey(r); invMixColumns(); }
    invShiftRows(); invSubBytes(); addRoundKey(0);
    return s;
  }
  function aesBlockEncrypt(state, rk, Nr) {
    var s = state.slice();
    function addRoundKey(r) { for (var i = 0; i < 16; i++) s[i] ^= rk[r * 16 + i]; }
    function subBytes() { for (var i = 0; i < 16; i++) s[i] = SBOX[s[i]]; }
    function shiftRows() {
      var t = s.slice();
      s[0] = t[0]; s[1] = t[5]; s[2] = t[10]; s[3] = t[15];
      s[4] = t[4]; s[5] = t[9]; s[6] = t[14]; s[7] = t[3];
      s[8] = t[8]; s[9] = t[13]; s[10] = t[2]; s[11] = t[7];
      s[12] = t[12]; s[13] = t[1]; s[14] = t[6]; s[15] = t[11];
    }
    function mixColumns() {
      for (var c = 0; c < 4; c++) {
        var i = c * 4, a0 = s[i], a1 = s[i + 1], a2 = s[i + 2], a3 = s[i + 3];
        s[i] = xtime(a0) ^ xtime(a1) ^ a1 ^ a2 ^ a3;
        s[i + 1] = a0 ^ xtime(a1) ^ xtime(a2) ^ a2 ^ a3;
        s[i + 2] = a0 ^ a1 ^ xtime(a2) ^ xtime(a3) ^ a3;
        s[i + 3] = xtime(a0) ^ a0 ^ a1 ^ a2 ^ xtime(a3);
      }
    }
    addRoundKey(0);
    for (var r = 1; r < Nr; r++) { subBytes(); shiftRows(); mixColumns(); addRoundKey(r); }
    subBytes(); shiftRows(); addRoundKey(Nr);
    return s;
  }
  function aesCbcDecrypt(cipherBytes, keyBytes, ivBytes) {
    var rkObj = aesExpandKey(keyBytes), rk = rkObj.rk, Nr = rkObj.Nr;
    var out = [], prev = ivBytes.slice();
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
  function aesCbcEncrypt(plainBytes, keyBytes, ivBytes) {
    var rkObj = aesExpandKey(keyBytes), rk = rkObj.rk, Nr = rkObj.Nr;
    var out = [], prev = ivBytes.slice();
    for (var off = 0; off < plainBytes.length; off += 16) {
      var block = plainBytes.slice(off, off + 16), xored = [];
      for (var i = 0; i < 16; i++) xored.push(block[i] ^ prev[i]);
      var enc = aesBlockEncrypt(xored, rk, Nr);
      for (var j = 0; j < 16; j++) out.push(enc[j]);
      prev = enc;
    }
    return out;
  }
  function pkcs7Pad(data) {
    var padLen = 16 - (data.length % 16), out = data.slice();
    for (var i = 0; i < padLen; i++) out.push(padLen);
    return out;
  }
  function randomBytes(n) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.floor(Math.random() * 256));
    return out;
  }

  /* ================= 编解码 ================= */
  var B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  var B64_REV = (function () { var m = {}; for (var i = 0; i < 64; i++) m[B64_CHARS[i]] = i; return m; })();
  function base64ToBytes(str) {
    str = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
    var out = [], buffer = 0, bits = 0;
    for (var j = 0; j < str.length; j++) {
      var ch = str[j];
      if (ch === '=') break;
      buffer = (buffer << 6) | B64_REV[ch];
      bits += 6;
      if (bits >= 8) { bits -= 8; out.push((buffer >> bits) & 0xff); }
    }
    return out;
  }
  function hexToBytes(hexStr) {
    var s = String(hexStr).replace(/[^0-9a-fA-F]/g, ''), out = [];
    for (var i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
  }
  function utf8ToBytes(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var c2 = str.charCodeAt(i + 1);
        if (c2 >= 0xdc00 && c2 <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); i++; }
      }
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return out;
  }
  function bytesToUtf8(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length;) {
      var b = bytes[i];
      if (b < 0x80) { out += String.fromCharCode(b); i++; }
      else if (b < 0xe0) { out += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2; }
      else if (b < 0xf0) { out += String.fromCharCode(((b & 0xf) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3; }
      else {
        var cp = ((b & 0x7) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
        var v = cp - 0x10000;
        out += String.fromCharCode(0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff));
        i += 4;
      }
    }
    return out;
  }
  function bytesToBase64(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = i + 1 < bytes.length ? bytes[i + 1] : 0, b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
      var n = (b0 << 16) | (b1 << 8) | b2;
      out += B64_CHARS[(n >>> 18) & 63] + B64_CHARS[(n >>> 12) & 63] + B64_CHARS[(n >>> 6) & 63] + B64_CHARS[n & 63];
    }
    var rem = bytes.length % 3;
    if (rem === 1) out = out.slice(0, -2) + '==';
    else if (rem === 2) out = out.slice(0, -1) + '=';
    return out;
  }

  /* ================= inflate（gzip/zlib） ================= */
  function BitReader(bytes) { this.bytes = bytes; this.pos = 0; this.bitPos = 0; }
  BitReader.prototype.readBits = function (n) {
    var val = 0;
    for (var i = 0; i < n; i++) {
      var bit = (this.bytes[this.pos] >> this.bitPos) & 1;
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
    for (var j2 = 0; j2 < lengths.length; j2++) if (lengths[j2] > 0) blCount[lengths[j2]]++;
    var nextCode = new Array(maxLen + 1), code = 0;
    for (var bits = 1; bits <= maxLen; bits++) { code = (code + blCount[bits - 1]) << 1; nextCode[bits] = code; }
    var codes = new Array(lengths.length);
    for (var sym = 0; sym < lengths.length; sym++) {
      var l = lengths[sym];
      if (l > 0) { codes[sym] = nextCode[l]; nextCode[l]++; } else codes[sym] = -1;
    }
    return { lengths: lengths, codes: codes, maxLen: maxLen };
  }
  function huffmanDecode(reader, table) {
    var code = 0, first = 0;
    for (var len = 1; len <= table.maxLen; len++) {
      code |= reader.readBits(1);
      var count = 0;
      for (var j = 0; j < table.lengths.length; j++) if (table.lengths[j] === len) count++;
      if (code - first < count) {
        var seen = 0;
        for (var sym = 0; sym < table.lengths.length; sym++) {
          if (table.lengths[sym] === len) { if (seen === code - first) return sym; seen++; }
        }
      }
      first += count; first <<= 1; code <<= 1;
    }
    throw new Error('huffman decode fail');
  }
  var LENGTH_BASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  var LENGTH_EXTRA = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  var DIST_BASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  var DIST_EXTRA = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  var FIXED_LIT = new Array(288), FIXED_DIST = new Array(30);
  for (var fi = 0; fi < 144; fi++) FIXED_LIT[fi] = 8;
  for (var fi2 = 144; fi2 < 256; fi2++) FIXED_LIT[fi2] = 9;
  for (var fi3 = 256; fi3 < 280; fi3++) FIXED_LIT[fi3] = 7;
  for (var fi4 = 280; fi4 < 288; fi4++) FIXED_LIT[fi4] = 8;
  for (var fd = 0; fd < 30; fd++) FIXED_DIST[fd] = 5;
  var FIXED_LIT_TABLE = buildHuffmanTable(FIXED_LIT), FIXED_DIST_TABLE = buildHuffmanTable(FIXED_DIST);
  function inflateHuffmanBlock(reader, out, tableLit, tableDist) {
    var guard = 0;
    for (;;) {
      if (++guard > 300000) throw new Error('inflate guard lit');
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
    var guard = 0;
    for (;;) {
      if (++guard > 2000) throw new Error('inflate guard block');
      var bfinal = reader.readBits(1), btype = reader.readBits(2);
      if (btype === 0) {
        reader.alignByte();
        var len = reader.readUint16LE();
        reader.readUint16LE();
        for (var i = 0; i < len; i++) out.push(reader.readByte());
      } else if (btype === 1) {
        inflateHuffmanBlock(reader, out, FIXED_LIT_TABLE, FIXED_DIST_TABLE);
      } else if (btype === 2) {
        var hlit = reader.readBits(5) + 257, hdist = reader.readBits(5) + 1, hclen = reader.readBits(4) + 4;
        var order = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
        var clLengths = new Array(19);
        for (var j = 0; j < 19; j++) clLengths[j] = 0;
        for (var j2 = 0; j2 < hclen; j2++) clLengths[order[j2]] = reader.readBits(3);
        var clTable = buildHuffmanTable(clLengths), lengths = [], dguard = 0;
        while (lengths.length < hlit + hdist) {
          if (++dguard > 30000) throw new Error('inflate guard dynamic');
          var s = huffmanDecode(reader, clTable);
          if (s < 16) lengths.push(s);
          else if (s === 16) { var prev = lengths[lengths.length - 1], rep = reader.readBits(2) + 3; for (var r = 0; r < rep; r++) lengths.push(prev); }
          else if (s === 17) { var rep2 = reader.readBits(3) + 3; for (var r2 = 0; r2 < rep2; r2++) lengths.push(0); }
          else { var rep3 = reader.readBits(7) + 11; for (var r3 = 0; r3 < rep3; r3++) lengths.push(0); }
        }
        inflateHuffmanBlock(reader, out, buildHuffmanTable(lengths.slice(0, hlit)), buildHuffmanTable(lengths.slice(hlit)));
      }
      if (bfinal) break;
    }
  }
  function gunzipBytes(data) {
    var out = [];
    if (data[0] === 0x1f && data[1] === 0x8b) {
      var p = 10, flags = data[3];
      if (flags & 4) { var xlen = data[p] | (data[p + 1] << 8); p += 2 + xlen; }
      if (flags & 8) { while (data[p] !== 0) p++; p++; }
      if (flags & 16) { while (data[p] !== 0) p++; p++; }
      if (flags & 2) p += 2;
      inflateDeflate(new BitReader(data.slice(p)), out);
    } else if ((data[0] & 0x0f) === 8) {
      inflateDeflate(new BitReader(data.slice(2, data.length - 4)), out);
    } else throw new Error('unknown compression');
    return out;
  }
  function adler32(data) {
    var a = 1, b = 0;
    for (var i = 0; i < data.length; i++) { a = (a + data[i]) % 65521; b = (b + a) % 65521; }
    return ((b << 16) | a) >>> 0;
  }
  function zlibStoredBlock(data) {
    var out = [0x78, 0x9c], offset = 0;
    while (offset < data.length) {
      var chunk = data.slice(offset, Math.min(offset + 65535, data.length)), len = chunk.length;
      out.push(offset + len >= data.length ? 1 : 0);
      out.push(len & 0xff, (len >> 8) & 0xff, (~len) & 0xff, ((~len) >> 8) & 0xff);
      for (var i = 0; i < len; i++) out.push(chunk[i]);
      offset += len;
    }
    var adler = adler32(data);
    out.push((adler >> 24) & 0xff, (adler >> 16) & 0xff, (adler >> 8) & 0xff, adler & 0xff);
    return out;
  }

  /* ================= 平台层 ================= */
  function isQX() { return typeof $task !== 'undefined'; }
  function toU8(bytes) { return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes); }
  var KEY_WEB = '7961beb44246e3012ce228d6b5ced05a';
  var KEY_IOS = '6be13f303785864aac6a6cc2cb3c9dc6';
  var KEY_OTHER = 'c10ca2986a31fb46d4481ce8631c2725';
  function platformKey(t) {
    t = String(t || 'web').toLowerCase();
    if (t === 'web') return KEY_WEB;
    if (t === 'ios' || t === 'iphone' || t === 'ipad' || t === 'macos') return KEY_IOS;
    return KEY_OTHER;
  }
  function deriveKey(requestId, keyHex) {
    return hmacSha256(utf8ToBytes(keyHex), hexToBytes(String(requestId).replace(/-/g, '')));
  }
  function storeRead(key) {
    try {
      if (typeof $persistentStore !== 'undefined' && $persistentStore && $persistentStore.read) return $persistentStore.read(key);
      if (typeof $prefs !== 'undefined' && $prefs && $prefs.valueForKey) return $prefs.valueForKey(key);
    } catch (e) {}
    return null;
  }
  function storeWrite(key, val) {
    try {
      if (typeof $persistentStore !== 'undefined' && $persistentStore && $persistentStore.write) { $persistentStore.write(val, key); return; }
      if (typeof $prefs !== 'undefined' && $prefs && $prefs.setValueForKey) { $prefs.setValueForKey(val, key); return; }
    } catch (e) {}
  }
  function bodyToBytes(body) {
    if (body == null) return null;
    var tag = Object.prototype.toString.call(body);
    if (tag === '[object Uint8Array]' || tag === '[object Array]') return Array.prototype.slice.call(body);
    if (tag === '[object ArrayBuffer]') return Array.prototype.slice.call(new Uint8Array(body));
    if (typeof body === 'string' && body.length > 0) return isQX() ? utf8ToBytes(body) : base64ToBytes(body);
    return null;
  }
  function rawBodyBytes(target) {
    if (!target) return null;
    var src = (target.bodyBytes !== undefined && target.bodyBytes !== null) ? target.bodyBytes : target.body;
    if (src == null) return null;
    var tag = Object.prototype.toString.call(src);
    if (tag === '[object Uint8Array]' || tag === '[object Array]' || tag === '[object ArrayBuffer]') {
      var bb = bodyToBytes(src);
      return bb ? toU8(bb) : null;
    }
    if (typeof src === 'string' && src.length > 0) return isQX() ? utf8ToBytes(src) : base64ToBytes(src);
    return null;
  }
  function reqBodyBytes() {
    if (typeof $request === 'undefined' || !$request) return null;
    if ($request.bodyBytes !== undefined && $request.bodyBytes !== null) {
      var bb = bodyToBytes($request.bodyBytes);
      return bb ? toU8(bb) : null;
    }
    var b = $request.body;
    if (b == null) return null;
    var tag = Object.prototype.toString.call(b);
    if (tag === '[object Uint8Array]' || tag === '[object Array]' || tag === '[object ArrayBuffer]') {
      var bb2 = bodyToBytes(b);
      return bb2 ? toU8(bb2) : null;
    }
    if (typeof b === 'string' && b.length > 0) return base64ToBytes(b);
    return null;
  }
  function doneWithBytes(bytes) {
    var u8 = toU8(bytes);
    if (isQX()) $done({ bodyBytes: u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) });
    else $done({ body: Uint8Array.from(u8) });
  }
  function decryptBody(bytes, requestId, deviceType) {
    if (!bytes || bytes.length < 32) return null;
    try {
      var key = deriveKey(requestId, platformKey(deviceType));
      var pt = aesCbcDecrypt(bytes.slice(16), key, bytes.slice(0, 16));
      if (pt.length > 0 && (pt[0] === 0x1f || (pt[0] & 0x0f) === 8)) pt = gunzipBytes(pt);
      return JSON.parse(bytesToUtf8(pt));
    } catch (e) { return null; }
  }
  // 部分接口（如 /api/ad/policy）返回明文 JSON —— 与加密体统一处理
  function parseBody(bytes, requestId, deviceType) {
    if (!bytes || bytes.length === 0) return null;
    var j = decryptBody(bytes, requestId, deviceType);
    if (j) return { json: j, plain: false };
    try {
      var t = bytesToUtf8(bytes);
      var i = t.indexOf('{');
      if (i >= 0) {
        var o = JSON.parse(t.slice(i));
        if (o && (o.status !== undefined || o.code !== undefined || o.data !== undefined)) return { json: o, plain: true };
      }
    } catch (e) {}
    return null;
  }
  function emit(json, plain, requestId, deviceType) {
    if (plain) {
      var s = JSON.stringify(json);
      if (isQX()) $done({ body: s });
      else $done({ body: s });
    } else {
      doneWithBytes(encryptBody(json, requestId, deviceType));
    }
  }
  function encryptBody(json, requestId, deviceType) {
    var pt = utf8ToBytes(JSON.stringify(json));
    var zlib = zlibStoredBlock(pt);
    var iv = randomBytes(16);
    var ct = aesCbcEncrypt(pkcs7Pad(zlib), deriveKey(requestId, platformKey(deviceType)), iv);
    return iv.concat(ct);
  }

  /* ================= 主流程 ================= */
  var isResponse = typeof $response !== 'undefined';
  var url = (typeof $request !== 'undefined' && $request && $request.url) || '';
  var hostMatch = String(url).match(/^https?:\/\/([^\/]+)/);
  var host = hostMatch ? hostMatch[1] : '';
  var path = String(url).replace(/^https?:\/\/[^\/]+/, '');
  var target = isResponse ? $response : $request;

  function log(m) { try { if (CFG.debug) console.log('[hdmgdj] ' + m); } catch (e) {} }
  function passThrough() { $done({}); }
  function lowerHeaders(h) {
    var out = {};
    if (!h) return out;
    for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) out[String(k).toLowerCase()] = h[k];
    return out;
  }
  function ctxKey(name) { return 'hdmgdj_' + name + '_' + host; }
  function ts() {
    var d = new Date(), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }

  var hdrs = lowerHeaders((target && target.headers) || {});
  var requestId = hdrs['requestid'] || '';
  var deviceType = hdrs['devicetype'] || 'web';
  var ctxId = storeRead(ctxKey('req_id')), ctxDev = storeRead(ctxKey('req_dev'));
  if (ctxId) requestId = ctxId;
  if (ctxDev) deviceType = ctxDev;

  var isPlay = /\/api\/drama\/play/.test(path);

  /* ---------- REQUEST 阶段：缓存 ctx ---------- */
  if (!isResponse) {
    var rh = lowerHeaders(($request && $request.headers) || {});
    storeWrite(ctxKey('req_id'), rh['requestid'] || '');
    storeWrite(ctxKey('req_dev'), rh['devicetype'] || 'web');
    if (isPlay) {
      var rb = reqBodyBytes();
      if (rb && rb.length > 0) {
        storeWrite(ctxKey('req_body'), bytesToBase64(rb));
        log('REQ play ctx host=' + host + ' reqId=' + (rh['requestid'] || ''));
      }
    }
    passThrough();
    return;
  }

  var raw = rawBodyBytes(target);
  if (raw == null) { passThrough(); return; }

  /* ---------- 1) 广告/启动页/弹窗清理：system/info ---------- */
  if (CFG.stripAds && /\/api\/system\/info/.test(path)) {
    var sb = parseBody(raw, requestId, deviceType);
    var sjson = sb && sb.json;
    if (sjson && sjson.data) {
      var d = sjson.data;
      ['splash', 'startup_popups', 'page_ad_slots'].forEach(function (k) { if (d[k]) d[k] = Array.isArray(d[k]) ? [] : {}; });
      if (d.ads && typeof d.ads === 'object') for (var ak in d.ads) if (Array.isArray(d.ads[ak])) d.ads[ak] = [];
      ['splash_time', 'splash_rotate_secs'].forEach(function (k) { if (d[k] !== undefined) d[k] = '0'; });
      ['splash_skippable', 'ad_popup_skippable', 'ad_pause_skippable', 'ad_gap_skippable',
       'splash_skippable_vip', 'ad_popup_vip_skip', 'ad_pause_vip_skip', 'ad_gap_vip_skip',
       'splash_auto_jump'].forEach(function (k) { if (d[k] !== undefined) d[k] = 'y'; });
      if (d.ad_label !== undefined) d.ad_label = 'n';
      if (d.place_ad !== undefined) d.place_ad = '';
      emit(sjson, sb.plain, requestId, deviceType);
      log('system/info ads stripped');
      return;
    }
    passThrough();
    return;
  }

  /* ---------- 2) ad/policy ---------- */
  if (CFG.stripAds && /\/api\/ad\/policy/.test(path)) {
    var ab = parseBody(raw, requestId, deviceType);
    var ajson = ab && ab.json;
    if (ajson && ajson.data) {
      var ad = ajson.data;
      ad.no_ad = true;
      ['insert_every', 'pre_roll_every_vip', 'pre_roll_every_normal', 'base_every_vip',
       'base_every_normal', 'popup_every_vip', 'popup_every_normal', 'pause_every_episodes',
       'session_cap', 'global_cap', 'daily_cap', 'cooldown_sec'].forEach(function (k) { if (ad[k] !== undefined) ad[k] = 0; });
      ['pre_roll_ok', 'popup_ok', 'pause_ok', 'apply'].forEach(function (k) { if (ad[k] !== undefined) ad[k] = false; });
      emit(ajson, ab.plain, requestId, deviceType);
      log('ad/policy stripped');
      return;
    }
    passThrough();
    return;
  }

  /* ---------- 3) 账户：VIP + 余额 ---------- */
  if (CFG.fakeVip && /\/api\/user\/(info|recharge|vip)/.test(path)) {
    var ujson = decryptBody(raw, requestId, deviceType);
    if (ujson && ujson.data) {
      var targets = [];
      if (Array.isArray(ujson.data)) targets.push(ujson);           // user/vip 返回套餐数组
      else {
        if (ujson.data.user_info) targets.push(ujson.data.user_info);
        targets.push(ujson.data);
      }
      var touched = false;
      for (var ti = 0; ti < targets.length; ti++) {
        var u = targets[ti];
        if (!u || typeof u !== 'object' || Array.isArray(u)) continue;
        if (u.is_vip !== undefined || u.balance !== undefined) {
          if (u.is_vip !== undefined) u.is_vip = 'y';
          if (u.is_up !== undefined) u.is_up = 'y';
          if (u.up_status !== undefined) u.up_status = 1;
          if (u.balance !== undefined) u.balance = '999999';
          if (u.score !== undefined) u.score = '999999';
          if (u.level !== undefined) u.level = '99';
          if (u.play_num !== undefined) u.play_num = '999999/999999';
          if (u.need_bind_email !== undefined) u.need_bind_email = false;
          if (u.need_bind_contact !== undefined) u.need_bind_contact = false;
          if (u.group_name !== undefined && !u.group_name) u.group_name = '至尊SVIP';
          if (u.group_end_time !== undefined && !u.group_end_time) u.group_end_time = '2099-12-31';
          touched = true;
        }
      }
      if (touched) {
        doneWithBytes(encryptBody(ujson, requestId, deviceType));
        log('user forged vip host=' + host);
        return;
      }
    }
    passThrough();
    return;
  }

  /* ---------- 4) detail：全剧集解锁 ---------- */
  // 新版判定：先 type==="vip" → 弹会员窗；再 is_buy → 放行。故必须 type=free 且 is_buy=true
  if (/\/api\/(drama|movie)\/(detail|topicDetail)/.test(path)) {
    var djson = decryptBody(raw, requestId, deviceType);
    if (djson && djson.data && typeof djson.data === 'object') {
      var dd = djson.data;
      var eps = dd.episodes || dd.episode_list || dd.list || [];
      var covers = {};
      try { covers = storeRead(ctxKey('covers')) ? JSON.parse(storeRead(ctxKey('covers'))) : {}; } catch (e) { covers = {}; }
      var did = dd.drama_id || dd.id || '';
      for (var ei = 0; ei < eps.length; ei++) {
        var ep = eps[ei];
        if (!ep || typeof ep !== 'object') continue;
        ep.type = 'free';
        ep.is_buy = true;
        ep.can_view = true;
        ep.ep_is_free = true;
        if (ep.price !== undefined) ep.price = 0;
        if (ep.money !== undefined) ep.money = 0;
        if (ep.cost_gold !== undefined) ep.cost_gold = '0';
        if (ep.ep_price_coin !== undefined) ep.ep_price_coin = 0;
        ep.methods = [];
        if (did && ep.seq !== undefined && ep.cover) covers[did + '_' + ep.seq] = ep.cover;
      }
      if (dd.pay_type !== undefined) dd.pay_type = 'free';
      if (dd.money !== undefined) dd.money = '0';
      if (dd.episode_price !== undefined) dd.episode_price = 0;
      if (dd.points_price !== undefined) dd.points_price = 0;
      if (dd.free_episodes !== undefined) dd.free_episodes = eps.length || dd.episode_count || 0;
      dd.vip_episodes = []; dd.coin_episodes = []; dd.points_episodes = [];
      if (dd.is_buy_whole !== undefined) dd.is_buy_whole = true;
      if (dd.can_vip_watch !== undefined) dd.can_vip_watch = true;
      if (dd.corner !== undefined) dd.corner = '';
      if (Array.isArray(dd.play_ads)) dd.play_ads = [];
      storeWrite(ctxKey('covers'), JSON.stringify(covers));
      doneWithBytes(encryptBody(djson, requestId, deviceType));
      log('detail unlocked eps=' + eps.length + ' host=' + host);
      return;
    }
    passThrough();
    return;
  }

  /* ---------- 5) 列表类：抹掉付费标记 ---------- */
  if (/\/(navBlock|navFilter|searchResult|search\/movie|drama\/(list|rank|more|favorite|love|wish|topicList)|movie\/(favorite|love|history)|user\/(favorite|home))/.test(path)) {
    var ljson = decryptBody(raw, requestId, deviceType);
    if (ljson) {
      var touched2 = false;
      var walk = function (o, depth) {
        if (!o || typeof o !== 'object' || depth > 4) return;
        if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) walk(o[i], depth + 1); return; }
        if (o.pay_type !== undefined && o.pay_type !== 'free') { o.pay_type = 'free'; touched2 = true; }
        if (o.money !== undefined && String(o.money) !== '0') { o.money = '0'; touched2 = true; }
        if (o.cost_gold !== undefined && String(o.cost_gold) !== '0') { o.cost_gold = '0'; touched2 = true; }
        if (o.corner !== undefined && o.corner !== '' && o.corner !== '免费') { o.corner = ''; touched2 = true; }
        if (o.ad_insert_every !== undefined && o.ad_insert_every !== 0) { o.ad_insert_every = 0; touched2 = true; }
        if (o.ad_source !== undefined && o.ad_source !== '') { o.ad_source = ''; touched2 = true; }
        if (o.ad_every !== undefined && o.ad_every !== 0) { o.ad_every = 0; touched2 = true; }
        for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) walk(o[k], depth + 1);
      };
      walk(ljson.data !== undefined ? ljson.data : ljson, 0);
      if (touched2) {
        doneWithBytes(encryptBody(ljson, requestId, deviceType));
        log('list cleaned host=' + host);
        return;
      }
    }
    passThrough();
    return;
  }

  /* ---------- 6) play：付费错误 → 伪造成功 ---------- */
  // 服务端闸门不可破（见文件头说明）；此处把播放地址指向该集公开的 6 秒试看片
  if (isPlay) {
    var pjson = decryptBody(raw, requestId, deviceType);
    var ec = pjson && (pjson.errorCode === 813004 || pjson.errorCode === 813005 ||
                       pjson.errorCode === 813006 || pjson.errorCode === 813103);
    if (ec) {
      var ctxB64 = storeRead(ctxKey('req_body'));
      var reqBytes = ctxB64 ? base64ToBytes(ctxB64) : null;
      var rjson = reqBytes ? decryptBody(reqBytes, requestId, deviceType) : null;
      var rd = rjson && rjson.data ? rjson.data : null;
      var dramaId = rd ? (rd.id || rd.drama_id) : null;
      var seq = rd ? rd.seq : null;
      if (CFG.previewFallback && dramaId && seq != null) {
        var covers2 = {};
        try { covers2 = storeRead(ctxKey('covers')) ? JSON.parse(storeRead(ctxKey('covers'))) : {}; } catch (e) { covers2 = {}; }
        var cover = covers2[dramaId + '_' + seq] || covers2['rp_' + dramaId + '_' + seq];
        var previewUrl = cover ? String(cover).replace(/\/cover\.[a-z]+$/i, '/preview.mp4') : null;
        if (previewUrl && previewUrl !== cover) {
          var forged = {
            status: 'y',
            data: {
              drama_id: dramaId, duration: 0, hls_key: '',
              lines: [
                { id: '0', lid: '0', code: 'free', name: 'free', m3u8_url: previewUrl, url: previewUrl }
              ],
              m3u8: previewUrl, name: String(seq), preview_m3u8: previewUrl,
              is_preview: false, preview_seconds: 0,
              seq: typeof seq === 'number' ? seq : (parseInt(seq, 10) || seq)
            },
            time: ts()
          };
          doneWithBytes(encryptBody(forged, requestId, deviceType));
          log('play ' + pjson.errorCode + ' → preview fallback ' + previewUrl.slice(-40));
          return;
        }
      }
      log('play ' + pjson.errorCode + ' ctx=' + (ctxB64 ? 1 : 0) + ' cover=' + (CFG.previewFallback ? 0 : 'off'));
      passThrough();
    } else {
      if (pjson && pjson.data && pjson.data.is_preview !== undefined && pjson.data.is_preview !== false) {
        pjson.data.is_preview = false;
        pjson.data.preview_seconds = 0;
        doneWithBytes(encryptBody(pjson, requestId, deviceType));
        log('play is_preview→false');
        return;
      }
      passThrough();
    }
    return;
  }

  /* ---------- 7) doBuy / up 解锁类：一律伪造成功 ---------- */
  if (/\/api\/(drama\/doBuy|up\/(unlock|access|subscribe|episodePreview))/.test(path)) {
    var bjson = decryptBody(raw, requestId, deviceType);
    if (bjson) {
      bjson.status = true;
      delete bjson.error;
      delete bjson.errorCode;
      if (bjson.data === undefined) bjson.data = {};
      if (/up\/(unlock|access|subscribe)/.test(path)) {
        bjson.data.can_view = true;
        bjson.data.is_buy = true;
        bjson.data.unlocked = true;
      }
      doneWithBytes(encryptBody(bjson, requestId, deviceType));
      log('forge ok ' + path);
      return;
    }
    passThrough();
    return;
  }

  passThrough();
})();
