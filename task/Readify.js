/*
Readify(深读) 7天连续阅读签到

登录方式：邮箱+密码（密码SHA256后传输）
自动刷新token：userToken 7天过期，过期后用邮箱+密码重新登录获取新token
                refreshToken 60天有效，无需额外刷新接口

变量名：readify_accounts     多账号 email#password 用 | 分隔
                             password 为明文（脚本内SHA256哈希）
可选：readify_device_id      设备ID（默认随机UUID）

[rewrite_local]
^https?:\/\/readifyapp\.voiceclub\.cn\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Readify.js

[task_local]
20 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Readify.js, tag=Readify深读签到, enabled=true

[MITM]
hostname = readifyapp.voiceclub.cn
*/

const API_BASE = 'https://readifyapp.voiceclub.cn';
const CAMPAIGN_ID = 'reading-streak-7d-202607';
const DEVICE_ID = 'E668DEEC-9E34-46A7-AECA-9EFF8BAA60FE';

let $ = new Env('Readify深读');
let allMsg = [];

// ============ 配置读取 ============
const CONFIG = (() => {
  const args = {};
  if (typeof $argument === 'string' && $argument) {
    $argument.split('&').forEach(p => {
      const i = p.indexOf('=');
      if (i > 0) args[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
  }
  const get = (k, f) => {
    if (args[k] != null) {
      try { return decodeURIComponent(args[k]); } catch { return args[k]; }
    }
    if (typeof $persistentStore !== 'undefined') {
      const v = $persistentStore.read(k);
      if (v) return v;
    }
    if ($.isNode() && process.env[k.toUpperCase()]) return process.env[k.toUpperCase()];
    if ($.isQX() && $.getdata) return $.getdata(k) || f;
    if ($.isSurge() && $.getdata) return $.getdata(k) || f;
    return f;
  };
  return {
    accounts: get('readify_accounts', ''),
    device_id: get('readify_device_id', DEVICE_ID),
  };
})();

// ============ SHA256 (纯JS实现，兼容所有运行时) ============
function sha256(message) {
  // Node.js 内置 crypto
  if (typeof require === 'function') {
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(message).digest('hex');
    } catch (e) {}
  }
  // 纯JS fallback
  return sha256Pure(message);
}

function sha256Pure(message) {
  // 标准SHA-256常量
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const H = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];

  function rr(x, n) { return (x >>> n) | (x << (32 - n)); }

  // 预处理
  const bytes = [];
  for (let i = 0; i < message.length; i++) bytes.push(message.charCodeAt(i) & 0xff);
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  const bitLen = message.length * 8;
  // 追加64位长度（大端）
  bytes.push(0, 0, 0, 0, (bitLen >>> 24) & 0xff, (bitLen >>> 16) & 0xff, (bitLen >>> 8) & 0xff, bitLen & 0xff);

  const hash = H.slice();

  for (let blk = 0; blk < bytes.length; blk += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[blk + i * 4] << 24) | (bytes[blk + i * 4 + 1] << 16) | (bytes[blk + i * 4 + 2] << 8) | bytes[blk + i * 4 + 3];
      w[i] >>>= 0;
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = ((w[i - 16] + s0 + w[i - 7] + s1) | 0) >>> 0;
    }

    let a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    let e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = ((h + S1 + ch + K[i] + w[i]) | 0) >>> 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = ((S0 + maj) | 0) >>> 0;

      h = g; g = f; f = e;
      e = ((d + t1) | 0) >>> 0;
      d = c; c = b; b = a;
      a = ((t1 + t2) | 0) >>> 0;
    }

    hash[0] = ((hash[0] + a) | 0) >>> 0;
    hash[1] = ((hash[1] + b) | 0) >>> 0;
    hash[2] = ((hash[2] + c) | 0) >>> 0;
    hash[3] = ((hash[3] + d) | 0) >>> 0;
    hash[4] = ((hash[4] + e) | 0) >>> 0;
    hash[5] = ((hash[5] + f) | 0) >>> 0;
    hash[6] = ((hash[6] + g) | 0) >>> 0;
    hash[7] = ((hash[7] + h) | 0) >>> 0;
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    let s = hash[i].toString(16);
    while (s.length < 8) s = '0' + s;
    result += s;
  }
  return result;
}

// ============ JWT工具 ============
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let payload = parts[1];
    // Base64url -> Base64
    payload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const pad = payload.length % 4;
    if (pad) payload += '='.repeat(4 - pad);
    // QX/Surge环境没有atob，用兼容方式
    let json;
    if (typeof atob === 'function') {
      json = JSON.parse(atob(payload));
    } else if (typeof require === 'function') {
      json = JSON.parse(Buffer.from(payload, 'base64').toString());
    } else {
      // 纯JS base64解码
      json = JSON.parse(b64Decode(payload));
    }
    return json;
  } catch (e) {
    return null;
  }
}

function b64Decode(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let str = input.replace(/[^A-Za-z0-9+/]/g, '');
  let output = '';
  for (let i = 0; i < str.length; i += 4) {
    const n1 = chars.indexOf(str[i]);
    const n2 = chars.indexOf(str[i + 1]);
    const n3 = chars.indexOf(str[i + 2]);
    const n4 = chars.indexOf(str[i + 3]);
    output += String.fromCharCode((n1 << 2) | (n2 >> 4));
    if (n3 >= 0) output += String.fromCharCode(((n2 & 15) << 4) | (n3 >> 2));
    if (n4 >= 0) output += String.fromCharCode(((n3 & 3) << 6) | n4);
  }
  return output;
}

function isTokenExpired(token) {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return now >= payload.exp - 60; // 提前60秒判定过期
}

// ============ 存储工具 ============
const STORE_KEY = 'readify_token';

function loadStoredToken() {
  try {
    if ($.isNode()) {
      const fs = require('fs');
      const path = require('path');
      const file = path.join(process.env.HOME || '/tmp', 'readify_token.json');
      if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      const v = $.getdata(STORE_KEY);
      if (v) return JSON.parse(v);
    }
  } catch (e) {}
  return null;
}

function saveStoredToken(data) {
  try {
    const json = JSON.stringify(data);
    if ($.isNode()) {
      const fs = require('fs');
      const path = require('path');
      const file = path.join(process.env.HOME || '/tmp', 'readify_token.json');
      fs.writeFileSync(file, json, 'utf8');
    } else {
      $.setdata(json, STORE_KEY);
    }
  } catch (e) {}
}

// ============ HTTP请求 ============
function httpRequest(method, path, headers, body) {
  return new Promise((resolve) => {
    const url = API_BASE + path;
    const opts = {
      url,
      method,
      headers: headers || {},
      timeout: 15000,
    };
    if (body) opts.body = body;

    if ($.isQX()) {
      opts.body = body || '';
      $task.fetch(opts).then(
        (resp) => resolve({ status: resp.statusCode, body: resp.body }),
        (err) => resolve({ status: 0, body: '' })
      );
    } else if (typeof $httpClient !== 'undefined') {
      // Surge/Loon
      opts.body = body || '';
      $httpClient[method.toLowerCase()](opts, (err, resp, data) => {
        resolve({ status: resp ? resp.status : 0, body: data || '' });
      });
    } else if ($.isNode()) {
      const https = require('https');
      const http = url.startsWith('https') ? https : require('http');
      const urlObj = new URL(url);
      const reqOpts = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        method,
        headers: { ...headers, Host: urlObj.hostname },
      };
      const req = http.request(reqOpts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', () => resolve({ status: 0, body: '' }));
      if (body) req.write(body);
      req.end();
    }
  });
}

// ============ 通用Header ============
function baseHeaders(token) {
  const h = {
    'Content-Type': 'application/json',
    'x-app-name': 'readifyai',
    'x-v': 'v1',
    'x-os': '27.0',
    'x-device-id': CONFIG.device_id,
    'x-client-region': 'CN',
    'x-client-sys-region': 'CN',
    'x-time-zone': 'Asia/Shanghai',
    'x-lang': 'zh-Hans',
    'User-Agent': 'aireader/3.5.1 (com.deepreads.reader; build:248; iOS 27.0.0) Alamofire/5.10.2',
  };
  if (token) h['x-token'] = token;
  return h;
}

// ============ 登录 ============
async function login(email, password) {
  const hashedPw = sha256(password);
  const resp = await httpRequest(
    'POST',
    '/api/users/email/login',
    { 'Content-Type': 'application/json' },
    JSON.stringify({ email, password: hashedPw })
  );
  try {
    const data = JSON.parse(resp.body);
    if (data.code === 0 && data.data && data.data.userToken) {
      return {
        userToken: data.data.userToken,
        refreshToken: data.data.refreshToken || '',
        userTokenExpire: data.data.userTokenExpire || 0,
        refreshTokenExpire: data.data.refreshTokenExpire || 0,
        userId: data.data.userId || '',
        nickname: data.data.nickname || email,
      };
    }
    $.log(`[Readify] 登录失败: ${data.message || resp.body}`);
    return null;
  } catch (e) {
    $.log(`[Readify] 登录异常: ${e}`);
    return null;
  }
}

// ============ 获取有效Token ============
async function getValidToken(email, password) {
  // 1. 尝试从存储读取
  const stored = loadStoredToken();
  if (stored && stored[email] && stored[email].userToken) {
    if (!isTokenExpired(stored[email].userToken)) {
      $.log(`[Readify] ${email} token有效，免登录`);
      return stored[email];
    }
    $.log(`[Readify] ${email} userToken已过期`);
  }

  // 2. 重新登录获取新token
  $.log(`[Readify] ${email} 重新登录获取token`);
  const loginData = await login(email, password);
  if (!loginData) return null;

  // 存储
  const store = loadStoredToken() || {};
  store[email] = loginData;
  saveStoredToken(store);

  return loginData;
}

// ============ 签到 ============
async function checkin(email, password) {
  const tokenData = await getValidToken(email, password);
  if (!tokenData) {
    allMsg.push(`「${email}」登录失败`);
    return;
  }

  const token = tokenData.userToken;
  const nickname = tokenData.nickname || email;

  // 1. 查询签到状态
  const statusResp = await httpRequest(
    'GET',
    `/api/campaigns/streaks/status?campaignId=${CAMPAIGN_ID}`,
    baseHeaders(token)
  );

  let statusData;
  try {
    statusData = JSON.parse(statusResp.body);
  } catch (e) {
    allMsg.push(`「${nickname}」状态查询失败`);
    return;
  }

  if (statusData.code !== 0) {
    // token可能无效，清除存储重新登录
    if (statusData.code === 200000) {
      $.log(`[Readify] ${email} token无效，清除后重新登录`);
      const store = loadStoredToken() || {};
      delete store[email];
      saveStoredToken(store);
      // 递归一次
      const newTokenData = await getValidToken(email, password);
      if (newTokenData) {
        return checkinWithToken(email, newTokenData);
      }
    }
    allMsg.push(`「${nickname}」状态查询失败: ${statusData.message}`);
    return;
  }

  const streakInfo = statusData.data || {};

  // 2. 如果今天已签到
  if (streakInfo.streakedToday) {
    allMsg.push(`「${nickname}」签到成功 连续${streakInfo.currentDay || 1}天`);
    return;
  }

  // 3. 执行签到
  await checkinWithToken(email, tokenData, streakInfo);
}

async function checkinWithToken(email, tokenData, priorStatus) {
  const token = tokenData.userToken;
  const nickname = tokenData.nickname || email;

  const resp = await httpRequest(
    'POST',
    '/api/campaigns/streaks',
    baseHeaders(token),
    JSON.stringify({ campaignId: CAMPAIGN_ID })
  );

  let data;
  try {
    data = JSON.parse(resp.body);
  } catch (e) {
    allMsg.push(`「${nickname}」签到请求异常`);
    return;
  }

  if (data.code === 0 && data.data) {
    const d = data.data;
    if (d.checkInResult === 'CHECKED_IN' || d.checkInResult === 'ALREADY_CHECKED_IN') {
      allMsg.push(`「${nickname}」签到成功 连续${d.currentDay || 1}天`);
    } else {
      allMsg.push(`「${nickname}」签到结果: ${d.checkInResult || 'unknown'} 连续${d.currentDay || 0}天`);
    }
  } else {
    allMsg.push(`「${nickname}」签到失败: ${data.message || 'unknown'}`);
  }
}

// ============ 主流程 ============
(async () => {
  try {
    // 凭证采集模式（MITM重写）—— 仅采集 x-token，不弹通知
    if (typeof $request !== 'undefined') {
      const h = $request.headers || {};
      let token;
      for (let k in h) {
        if (k.toLowerCase() === 'x-token') token = h[k];
      }
      if (token) {
        const store = loadStoredToken() || {};
        const old = store['_captured'] || {};
        if (old.userToken !== token) {
          store['_captured'] = { userToken: token, capturedAt: Date.now() };
          saveStoredToken(store);
          $.msg('Readify深读', 'Token采集成功', '');
        }
      }
      if (typeof $done === 'function') $done({});
      return;
    }

    // 定时任务模式
    const accountsStr = CONFIG.accounts;
    if (!accountsStr) {
      $.msg('Readify深读', '未配置账号', '请在BoxJS/环境变量配置 readify_accounts: email#password');
      if (typeof $done === 'function') $done({});
      return;
    }

    const accounts = accountsStr.split('|').map(s => s.trim()).filter(Boolean);

    for (const acc of accounts) {
      const parts = acc.split('#');
      if (parts.length < 2) {
        allMsg.push(`账号格式错误: ${acc} (应为 email#password)`);
        continue;
      }
      const [email, password] = [parts[0], parts.slice(1).join('#')];
      await checkin(email, password);
    }

    // 统一通知
    const msg = allMsg.join('\n');
    $.msg('Readify深读', '', msg);
    $.log(`[Readify] ${msg}`);
  } catch (e) {
    $.msg('Readify深读', '执行异常', String(e));
  }
  if (typeof $done === 'function') $done({});
})();

// ============ Env (QX/Surge/Loon/Node 兼容) ============
function Env(name) {
  this.name = name;
  this.isQX = () => typeof $task !== 'undefined';
  this.isSurge = () => typeof $httpClient !== 'undefined' && typeof $persistentStore !== 'undefined';
  this.isLoon = () => typeof $httpClient !== 'undefined' && typeof $persistentStore === 'undefined';
  this.isNode = () => typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== undefined;
  this.done = () => { if (typeof $done === 'function') $done({}); };
  this.getdata = (key) => {
    if (this.isSurge() || this.isLoon()) return $persistentStore.read(key);
    if (this.isQX()) return $prefs.valueForKey(key);
    return undefined;
  };
  this.setdata = (val, key) => {
    if (this.isSurge() || this.isLoon()) return $persistentStore.write(val, key);
    if (this.isQX()) return $prefs.setValueForKey(val, key);
    return false;
  };
  this.msg = (title, subtitle, body) => {
    if (this.isQX()) $notify(title, subtitle, body);
    else if (this.isSurge() || this.isLoon()) $notification.post(title, subtitle, body);
    else if (this.isNode()) console.log(`${title}\n${subtitle}\n${body}`);
  };
  this.log = (msg) => {
    console.log(`[${name}] ${msg}`);
  };
}
