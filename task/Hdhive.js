/*
影巢(HDHive) 多账号签到

变量名：hdhive_accounts
多账号格式：user#pass 或 user#pass#cookie（&分隔）
可选：hdhive_next_action（留空自动动态扫描）
Cookie 变量名：hdhive_cookie（留空则自动登录获取）

[rewrite_local]
^https?:\/\/hdhive\.com\/api\/customer\/user\/checkin url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[task_local]
30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=影巢签到, enabled=true

[MITM]
hostname = hdhive.com
*/

const BASE_URL = 'https://hdhive.com';
const KEY = 'hdhive_accounts';
const SEP = '&';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0';

let $ = typeof $environment !== 'undefined' ? new Env('影巢') : null;

// ========== Cookie 采集 ==========
function handleCookie() {
  const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  if (!cookie) { $.done(); return; }

  const token = (cookie.match(/token=([^;]+)/) || [])[1];
  const csrf = (cookie.match(/csrf_access_token=([^;]+)/) || [])[1];

  if (token) {
    const existing = $.getdata('hdhive_cookie') || '';
    const list = existing.split(SEP).filter(Boolean);
    const val = csrf ? `token=${token}; csrf_access_token=${csrf}` : `token=${token}`;
    if (!list.includes(val)) {
      list.push(val);
      $.setdata(list.join(SEP), 'hdhive_cookie');
    }
    $.msg($.name, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
  }
  $.done();
}

// ========== 主入口 ==========
!(async () => {
  if (typeof $request !== 'undefined') { handleCookie(); return; }

  // 优先环境变量，其次持久化cookie
  let accountsRaw = '';
  if ($.isNode()) {
    accountsRaw = process.env.HDHIVE_ACCOUNTS || '';
  }
  // 环境变量格式: user#pass 或 user#pass#cookie
  let accounts = [];
  if (accountsRaw) {
    accounts = accountsRaw.split(SEP).map(s => s.trim()).filter(Boolean).map(s => {
      const parts = s.split('#');
      return { username: parts[0], password: parts[1] || '', cookie: parts[2] || '' };
    });
  }

  // 没有环境变量则用持久化cookie
  if (accounts.length === 0) {
    const cookieRaw = $.getdata('hdhive_cookie') || '';
    if (!cookieRaw) {
      $.msg($.name, '', '⚠️ 未获取到账号\n\n请配置 hdhive_accounts 环境变量\n或登录触发 Cookie 采集\n\n🎯 失败');
      $.done(); return;
    }
    accounts = cookieRaw.split(SEP).map(s => s.trim()).filter(Boolean).map(c => {
      return { username: '', password: '', cookie: c };
    });
  }

  $.log(`检测到 ${accounts.length} 个账号`);

  const results = [];
  let success = 0, failed = 0;
  const startTs = Date.now();

  for (let i = 0; i < accounts.length; i++) {
    const acc = accounts[i];
    $.log(`\n[账号 ${i + 1}] ${acc.username || '(cookie模式)'}`);

    try {
      const res = await signAccount(acc);
      results.push(res);
      res.ok ? success++ : failed++;
    } catch (e) {
      $.log(`❌ 异常: ${e.message}`);
      results.push({ ok: false, msg: `❌ ${e.message}` });
      failed++;
    }
    if (i < accounts.length - 1) await $.wait(2000);
  }

  const elapsed = ((Date.now() - startTs) / 1000).toFixed(1);
  let body = results.map(r => r.msg).join('\n\n');
  body += `\n\n🎯 成功${success} 失败${failed} 耗时${elapsed}s`;
  $.msg($.name, '', body);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

// ========== 签到核心 ==========
async function signAccount(acc) {
  let cookie = acc.cookie || '';

  // Cookie过期则登录获取
  if (!cookie || cookieExpired(cookie)) {
    if (acc.username && acc.password) {
      $.log('Cookie失效，尝试POST登录...');
      const newCookie = await loginByPost(acc.username, acc.password);
      if (newCookie) {
        cookie = newCookie;
        // 持久化新cookie
        if (acc.username) {
          const existing = $.getdata('hdhive_cookie') || '';
          const list = existing.split(SEP).filter(Boolean);
          // 替换同用户cookie
          const idx = list.findIndex(s => s.includes(acc.username));
          if (idx >= 0) list[idx] = cookie;
          else list.push(cookie);
          $.setdata(list.join(SEP), 'hdhive_cookie');
        }
      } else {
        return { ok: false, msg: `❌ ${acc.username} 登录失败` };
      }
    } else {
      return { ok: false, msg: `❌ Cookie过期且无账密` };
    }
  }

  // 签到
  const signRes = await signinApi(cookie);
  if (signRes.ok) {
    // 获取用户信息
    const info = await fetchUserInfo(cookie);
    const nick = info.nickname || acc.username || '?';
    const pts = info.points != null ? info.points : '—';
    const days = info.signin_days_total != null ? info.signin_days_total : '—';

    let statusIcon = '✅';
    let detail = signRes.message;
    if (signRes.already) statusIcon = '✅';

    return {
      ok: true,
      msg: `👤 ${nick}\n${statusIcon} ${detail}\n💰 积分:${pts} | 📅 登录:${days}天`
    };
  } else {
    // 鉴权失败重试
    if (isAuthError(signRes.message) && acc.username && acc.password) {
      $.log('鉴权失败，重新登录...');
      const newCookie = await loginByPost(acc.username, acc.password);
      if (newCookie) {
        cookie = newCookie;
        const retry = await signinApi(cookie);
        if (retry.ok) {
          const info = await fetchUserInfo(cookie);
          const nick = info.nickname || acc.username || '?';
          const pts = info.points != null ? info.points : '—';
          const days = info.signin_days_total != null ? info.signin_days_total : '—';
          return {
            ok: true,
            msg: `👤 ${nick}\n✅ ${retry.message}\n💰 积分:${pts} | 📅 登录:${days}天`
          };
        }
        return { ok: false, msg: `❌ ${acc.username} 重试失败: ${retry.message}` };
      }
    }
    return { ok: false, msg: `❌ ${acc.username || 'cookie'} 签到失败: ${signRes.message}` };
  }
}

// ========== Next.js 动态扫描 next-action ==========
async function getNextAction() {
  // 优先手动配置
  let manual = '';
  if ($.isNode()) manual = process.env.HDHIVE_NEXT_ACTION || '';
  manual = manual || $.getdata('hdhive_next_action') || '';
  if (manual) { $.log('使用手动配置 next-action'); return manual; }

  // 动态扫描
  $.log('动态扫描 next-action...');
  const loginPage = await httpGet(`${BASE_URL}/login`);
  if (loginPage.status !== 200) { $.log('获取登录页失败'); return ''; }

  const scriptPaths = [...new Set(
    (loginPage.body.match(/src=["']([^"']*\/_next\/static\/chunks\/[^"']+\.js[^"']*)["']/g) || [])
      .map(m => (m.match(/src=["']([^"']+)["']/) || [])[1])
      .filter(Boolean)
  )];

  if (!scriptPaths.length) { $.log('页面未找到 chunk 脚本'); return ''; }

  $.log(`扫描 ${scriptPaths.length} 个 JS chunk...`);
  const actionRegex = /createServerReference\)\s*\(\s*["']([^"']+)["'][^)]+?,\s*["']login["']\s*\)/;

  for (const path of scriptPaths) {
    const jsUrl = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    const jsRes = await httpGet(jsUrl);
    if (jsRes.status !== 200) continue;
    const match = jsRes.body.match(actionRegex);
    if (match) {
      const actionId = match[1].trim();
      $.log(`定位 next-action: ${actionId}`);
      $.setdata(actionId, 'hdhive_next_action');
      return actionId;
    }
  }

  $.log('未找到 login next-action');
  return '';
}

// ========== POST 登录 ==========
async function loginByPost(username, password) {
  const actionId = await getNextAction();
  if (!actionId) return '';

  const loginUrl = `${BASE_URL}/login?redirect=/`;
  const body = JSON.stringify([{ username, password }, "/"]);

  const headers = {
    'Host': 'hdhive.com',
    'Connection': 'keep-alive',
    'sec-ch-ua-platform': '"Windows"',
    'next-action': actionId,
    'sec-ch-ua': '"Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"',
    'sec-ch-ua-mobile': '?0',
    'User-Agent': UA,
    'Accept': 'text/x-component',
    'Content-Type': 'text/plain;charset=UTF-8',
    'Origin': BASE_URL,
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
    'Referer': loginUrl,
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
  };

  const res = await httpPostRaw(loginUrl, body, headers, false);
  if (res.status !== 200 && res.status !== 303) {
    $.log(`POST登录失败: ${res.status}`);
    return '';
  }

  // 从Set-Cookie提取token和csrf
  const cookies = parseSetCookies(res.headers, res.cookies);
  const token = cookies.token;
  const csrf = cookies.csrf_access_token || cookies.csrfaccesstoken;

  if (!token) { $.log('登录响应未拿到 token'); return ''; }

  $.log('POST登录成功');
  return csrf ? `token=${token}; csrf_access_token=${csrf}` : `token=${token}`;
}

// ========== 签到API ==========
async function signinApi(cookie) {
  const cookies = parseCookieDict(cookie);
  const token = cookies.token;
  const csrf = cookies.csrf_access_token || cookies.csrfaccesstoken;
  if (!token) return { ok: false, message: 'Cookie缺少token' };

  // 从JWT解析user_id
  let userId = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub || payload.user_id || '';
  } catch (e) {}

  const referer = userId ? `${BASE_URL}/user/${userId}` : `${BASE_URL}/`;
  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/plain, */*',
    'Origin': BASE_URL,
    'Referer': referer,
    'Authorization': `Bearer ${token}`,
  };
  if (csrf) headers['x-csrf-token'] = csrf;

  const res = await httpPost(`${BASE_URL}/api/customer/user/checkin`, '', headers, cookie);
  let data;
  try { data = JSON.parse(res.body); } catch (e) { return { ok: false, message: `API响应格式错误 HTTP${res.status}` }; }

  const msg = data.message || '无明确消息';
  const desc = data.description || '';

  if (data.success) return { ok: true, message: msg, already: false };
  if (msg.includes('签到失败') && desc.includes('已经签到')) return { ok: true, message: `已签到: ${desc}`, already: true };
  if (msg.includes('已经签到') || msg.includes('签到过')) return { ok: true, message: msg, already: true };

  return { ok: false, message: msg };
}

// ========== 用户信息(RSC请求) ==========
async function fetchUserInfo(cookie) {
  const cookies = parseCookieDict(cookie);
  const token = cookies.token;
  if (!token) return {};

  let userId = '';
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    userId = payload.sub || payload.user_id || '';
  } catch (e) { return {}; }

  if (!userId) return {};

  const rscUrl = `${BASE_URL}/user/${userId}`;
  const headers = {
    'User-Agent': UA,
    'Accept': 'text/x-component',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'Origin': BASE_URL,
    'Referer': `${BASE_URL}/manager/account`,
    'rsc': '1',
    'Authorization': `Bearer ${token}`,
  };

  const res = await httpGet(rscUrl, headers, cookie);
  if (res.status !== 200) return {};

  const text = res.body || '';
  const result = { id: userId };

  const mNick = text.match(/"nickname":"([^"]+)"/);
  const mPoints = text.match(/"points":(\d+)/);
  const mDays = text.match(/"signin_days_total":(\d+)/);
  const mAvatar = text.match(/"avatar_url":"([^"]+)"/);

  if (mNick) result.nickname = mNick[1];
  if (mPoints) result.points = parseInt(mPoints[1]);
  if (mDays) result.signin_days_total = parseInt(mDays[1]);
  if (mAvatar) result.avatar_url = mAvatar[1];

  // fallback: 尝试从 user 对象解析
  if (!result.nickname || result.points == null) {
    const mUser = text.match(/"user":(\{.*?\})/);
    if (mUser) {
      try {
        const obj = JSON.parse(mUser[1]);
        if (!result.nickname) result.nickname = obj.nickname;
        const meta = obj.user_meta || {};
        if (result.points == null) result.points = meta.points;
        if (!result.signin_days_total) result.signin_days_total = meta.signin_days_total;
      } catch (e) {}
    }
  }

  return result;
}

// ========== 工具函数 ==========

function cookieExpired(cookie) {
  const token = (cookie.match(/token=([^;]+)/) || [])[1];
  if (!token) return true;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + 60;
  } catch (e) { return false; }
}

function parseCookieDict(cookieStr) {
  const cookies = {};
  if (!cookieStr) return cookies;
  for (const item of cookieStr.split(';')) {
    if (!item.includes('=')) continue;
    const idx = item.indexOf('=');
    const name = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    cookies[name] = value;
  }
  return cookies;
}

function parseSetCookies(headers, resCookies) {
  const cookies = {};
  // 优先从响应cookies解析(QX/Surge)
  if (resCookies && typeof resCookies === 'object') {
    for (const k in resCookies) cookies[k] = resCookies[k];
  }
  // 从Set-Cookie header解析
  let setCookie = headers['Set-Cookie'] || headers['set-cookie'] || '';
  if (typeof setCookie === 'string') {
    for (const part of setCookie.split(',')) {
      const m = part.match(/(\w+)=([^;]+)/);
      if (m) cookies[m[1]] = m[2];
    }
  } else if (Array.isArray(setCookie)) {
    for (const part of setCookie) {
      const m = part.match(/(\w+)=([^;]+)/);
      if (m) cookies[m[1]] = m[2];
    }
  }
  return cookies;
}

function isAuthError(msg) {
  return ['未配置Cookie', "缺少'token'", '未授权', 'Unauthorized', 'token', 'csrf', '登录已过期', '过期', 'expired']
    .some(k => (msg || '').includes(k));
}

function atob(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf-8');
  if (typeof globalThis !== 'undefined' && globalThis.atob) return globalThis.atob(str);
  // 纯JS fallback (QX/Surge无Buffer无atob)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let str2 = str.replace(/=+$/, ''), output = '';
  for (let bc = 0, bs = 0, i = 0; i < str2.length; i++) {
    const c = chars.indexOf(str2[i]);
    if (c < 0) continue;
    bs = bc % 4 ? bs * 64 + c : c;
    if (bc++ % 4) output += String.fromCharCode(255 & bs >> ((-2 * bc) & 6));
  }
  return decodeURIComponent(escape(output));
}

// ========== HTTP 封装 ==========

function httpGet(url, headers, cookie) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: headers || { 'User-Agent': UA } };
    if (cookie) opts.headers['Cookie'] = typeof cookie === 'string' ? cookie : '';
    const handler = (err, resp, body) => {
      if (err) reject(new Error(err));
      else resolve({ status: resp?.status || resp?.statusCode, body, headers: resp?.headers, cookies: resp?.cookies });
    };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers, cookies: r.cookies })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, handler);
    else if (typeof module !== 'undefined' && module.exports) {
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? require('https') : require('http');
      const reqOpts = { hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: opts.headers };
      const req = mod.request(reqOpts, resp => {
        let data = ''; const respCookies = {};
        for (const [k, v] of Object.entries(resp.headers['set-cookie'] ? resp.headers['set-cookie'] : [])) {
          const m = v.match(/(\w+)=([^;]+)/); if (m) respCookies[m[1]] = m[2];
        }
        resp.on('data', c => data += c);
        resp.on('end', () => resolve({ status: resp.statusCode, body: data, headers: resp.headers, cookies: respCookies }));
      });
      req.on('error', reject); req.end();
    } else reject(new Error('不支持的平台'));
  });
}

function httpPost(url, body, headers, cookie) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: headers || {}, body: body || '' };
    if (cookie) opts.headers['Cookie'] = typeof cookie === 'string' ? cookie : '';
    const handler = (err, resp, respBody) => {
      if (err) reject(new Error(err));
      else resolve({ status: resp?.status || resp?.statusCode, body: respBody, headers: resp?.headers, cookies: resp?.cookies });
    };
    if (typeof $task !== 'undefined')
      $task.fetch({ ...opts, method: 'POST' }).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers, cookies: r.cookies })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.post(opts, handler);
    else if (typeof module !== 'undefined' && module.exports) {
      const http = require('http'), https = require('https');
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const reqOpts = { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: opts.headers };
      const req = mod.request(reqOpts, resp => {
        let data = ''; const respCookies = {};
        (resp.headers['set-cookie'] || []).forEach(v => { const m = v.match(/(\w+)=([^;]+)/); if (m) respCookies[m[1]] = m[2]; });
        resp.on('data', c => data += c);
        resp.on('end', () => resolve({ status: resp.statusCode, body: data, headers: resp.headers, cookies: respCookies }));
      });
      req.on('error', reject); if (body) req.write(body); req.end();
    } else reject(new Error('不支持的平台'));
  });
}

// POST登录需要 allowRedirects=false
function httpPostRaw(url, body, headers, allowRedirects) {
  if (typeof $task !== 'undefined' || typeof $httpClient !== 'undefined') {
    // QX/Surge: 不自动跟随重定向需要特殊处理
    // 大部分Next.js登录返回200或303带Set-Cookie
    return httpPost(url, body, headers, '').then(res => {
      // QX/Surge 可能自动跟了303，但Set-Cookie已在headers
      return res;
    });
  }
  // Node.js
  return new Promise((resolve, reject) => {
    const http = require('http'), https = require('https');
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const reqOpts = { hostname: u.hostname, path: u.pathname + u.search, method: 'POST', headers: headers || {} };
    const req = mod.request(reqOpts, resp => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && !allowRedirects) {
        // 不跟随重定向，直接返回
        let data = ''; const respCookies = {};
        (resp.headers['set-cookie'] || []).forEach(v => { const m = v.match(/(\w+)=([^;]+)/); if (m) respCookies[m[1]] = m[2]; });
        resp.on('data', () => {});
        resp.on('end', () => resolve({ status: resp.statusCode, body: '', headers: resp.headers, cookies: respCookies }));
        return;
      }
      let data = ''; const respCookies = {};
      (resp.headers['set-cookie'] || []).forEach(v => { const m = v.match(/(\w+)=([^;]+)/); if (m) respCookies[m[1]] = m[2]; });
      resp.on('data', c => data += c);
      resp.on('end', () => resolve({ status: resp.statusCode, body: data, headers: resp.headers, cookies: respCookies }));
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

// ========== Env.js 框架 ==========
function Env(name, opts) {
  class _env {
    constructor(n) { this.name = n; this.data = null; this.startTime = Date.now(); this.logs = []; this.log(`🔔 ${this.name}, 开始!`); }
    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $rocket !== 'undefined') return 'Shadowrocket';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      return 'Unknown';
    }
    isNode() { return this.getEnv() === 'Node.js'; }
    getdata(k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return $prefs.valueForKey(k) || '';
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.read(k) || '';
        case 'Node.js': return this.data && this.data[k] || process.env[k] || '';
        default: return '';
      }
    }
    setdata(v, k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return $prefs.setValueForKey(v, k);
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.write(v, k);
        case 'Node.js': this.data = this.data || {}; this.data[k] = v; return true;
        default: return false;
      }
    }
    log(...t) { t.length && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
    logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    msg(s, t, c) {
      switch (this.getEnv()) {
        case 'Quantumult X': $notify(s, t || '', c || ''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $notification.post(s, t || '', c || ''); break;
        case 'Node.js': console.log(`${s}: ${t} - ${c}`); break;
      }
    }
    done() {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`结束! ${elapsed}s`);
      switch (this.getEnv()) {
        case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $done(); break;
        case 'Node.js': process.exit(0); break;
      }
    }
  }
  return new _env(name, opts);
}
