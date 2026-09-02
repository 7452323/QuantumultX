/*
影巢(HDHive) 多账号签到

变量名：hdhive_accounts
多账号格式：user#pass 或 user#pass#cookie（&分隔多账号）
可选：hdhive_next_action（留空自动动态扫描）
可选：hdhive_base_url（默认 https://hdhive.com）

[rewrite_local]
^https?:\/\/hdhive\.com\/api\/customer\/user\/checkin url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[task_local]
30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=影巢签到, enabled=true

[MITM]
hostname = hdhive.com
*/

const BASE_URL = 'https://hdhive.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36 Edg/145.0.0.0';

let $ = new Env('影巢');

// ========== 全局配置（从 $argument 或环境变量读取） ==========
const CONFIG = (() => {
  let args = {};
  if (typeof $argument === 'string' && $argument) {
    $argument.split('&').forEach(pair => {
      const idx = pair.indexOf('=');
      if (idx > 0) args[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
    });
  }
  const get = (key, fallback = '') => {
    if (args[key] != null) return args[key];
    if ($.isNode() && process.env[key.toUpperCase()]) return process.env[key.toUpperCase()];
    return $.getdata(key) || fallback;
  };
  return {
    base_url: (get('hdhive_base_url') || BASE_URL).replace(/\/+$/, ''),
    accounts: get('hdhive_accounts'),
    next_action: get('hdhive_next_action'),
    max_retries: parseInt(get('hdhive_max_retries') || '3'),
    retry_interval: parseInt(get('hdhive_retry_interval') || '30'),
    history_days: parseInt(get('hdhive_history_days') || '30'),
  };
})();

const REQUESTS_KW = { timeout: 30000 };

// ========== 主入口（延迟执行，等 class 定义完成后调用） ==========
async function main() {
  if (typeof $request !== 'undefined') { handleCookie(); return; }

  $.log(`🔔 ${$.name}, 开始!`);
  $.log(`HDHIVE_BASE_URL = ${CONFIG.base_url}`);

  if (CONFIG.next_action) {
    $.log('[INFO] 已检测到手动配置 hdhive_next_action，将跳过动态扫描');
  }

  const accounts = parseAccounts(CONFIG.accounts);
  if (!accounts.length) {
    $.msg($.name, '', '⚠️ 未配置 hdhive_accounts\n\n示例：user#pass 或 user#pass#cookie\n多账号用 & 分隔\n\n🎯 失败');
    $.done(); return;
  }

  for (let idx = 0; idx < accounts.length; idx++) {
    const acc = accounts[idx];
    $.log(`\n${'─'.repeat(60)}`);
    $.log(`[INFO] 开始处理账号 ${idx + 1} -> ${acc.username}`);

    const worker = new HdhiveSign(CONFIG.base_url, acc.username, acc.password, acc.cookie);
    const result = await worker.signOnce();
    printResultBlock(idx + 1, acc.username, result, worker);
  }

  $.log(`\n[INFO] 所有账号签到流程完成`);

  if (all_message) {
    $.msg($.name, '', all_message);
  }
  $.done();
}

// ========== 通知消息收集（对标 Python all_message） ==========
let all_message = '';
function collectMsg(msg) {
  const clean = msg.trim();
  if (!clean || clean.startsWith('=') || clean.startsWith('-')) return;
  if (clean.includes('[INFO]') || clean.includes('[流程]') || clean.includes('无法从token')) return;
  all_message += msg + '\n';
  if (clean.includes('[本次奖励]')) all_message += '\n';
}

// ========== Cookie 采集 ==========
function handleCookie() {
  const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  if (!cookie) { $.done(); return; }
  const token = (cookie.match(/token=([^;]+)/) || [])[1];
  const csrf = (cookie.match(/csrf_access_token=([^;]+)/) || [])[1];
  if (token) {
    const val = csrf ? `token=${token}; csrf_access_token=${csrf}` : `token=${token}`;
    let list = ($.getdata('hdhive_cookie') || '').split('&').filter(Boolean);
    if (!list.includes(val)) {
      list.push(val);
      $.setdata(list.join('&'), 'hdhive_cookie');
      $.msg($.name, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
    }
  }
  $.done();
}

// ========== 账号解析 ==========
function parseAccounts(envValue) {
  if (!envValue) return [];
  return envValue.split(';').map(item => {
    item = item.trim();
    if (!item) return null;
    const parts = item.split('#');
    if (parts.length < 2) return null;
    return {
      username: parts[0].trim(),
      password: parts[1].trim(),
      cookie: parts.length >= 3 ? parts[2].trim() : '',
    };
  }).filter(Boolean);
}

function safeName(name) {
  return (name || 'default').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

// ========== 签到核心类（1:1 对标 Python HdhiveSignCamoufox） ==========
class HdhiveSign {
  constructor(baseUrl, username, password, cookie = '') {
    this._base_url = (baseUrl || 'https://hdhive.com').replace(/\/+$/, '');
    this._site_url = `${this._base_url}/`;
    this._signin_api = `${this._base_url}/api/customer/user/checkin`;
    this._username = username;
    this._password = password;

    const tag = safeName(username);
    this._history_key = `hdhive_history_${tag}`;
    this._meta_key = `hdhive_meta_${tag}`;
    this._user_info_key = `hdhive_userinfo_${tag}`;

    const meta = this.getMeta();
    this._cookie = cookie || meta.cookie || '';
    this._sessionCookies = {};
  }

  // ---------- 本地数据存取 ----------
  _loadJson(key, def) {
    const val = $.getdata(key);
    if (!val) return def;
    try { return JSON.parse(val); } catch { return def; }
  }
  _saveJson(key, data) {
    try { $.setdata(JSON.stringify(data), key); } catch {}
  }
  getHistory() { return this._loadJson(this._history_key, []); }
  saveHistory(h) { this._saveJson(this._history_key, h); }
  getMeta() { return this._loadJson(this._meta_key, {}); }
  saveMeta(m) { this._saveJson(this._meta_key, m); }
  saveUserInfo(info) { this._saveJson(this._user_info_key, info); }

  // ---------- 签到历史 & 连续签到 ----------
  _saveSignHistory(signData) {
    const history = this.getHistory();
    if (!signData.date) signData.date = nowStr();
    history.push(signData);
    const now = Date.now();
    const valid = history.filter(r => {
      try {
        const rd = new Date(r.date).getTime();
        return (now - rd) < CONFIG.history_days * 86400000;
      } catch {
        r.date = nowStr();
        return true;
      }
    });
    this.saveHistory(valid);
  }

  _isAlreadySignedToday() {
    const history = this.getHistory();
    if (!history.length) return false;
    const today = new Date().toISOString().slice(0, 10);
    return history.some(r =>
      (r.date || '').startsWith(today) &&
      ['签到成功', '已签到'].includes(r.status)
    );
  }

  _updateConsecutive(success) {
    const meta = this.getMeta();
    let consecutive = parseInt(meta.consecutive_days || '0');
    if (!success) return consecutive;

    const todayStr = new Date().toISOString().slice(0, 10);
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    if (meta.last_success_date === todayStr) {
      // pass
    } else if (meta.last_success_date === yesterdayStr) {
      consecutive += 1;
    } else {
      consecutive = 1;
    }

    meta.last_success_date = todayStr;
    meta.consecutive_days = consecutive;
    this.saveMeta(meta);
    return consecutive;
  }

  // ---------- Cookie 工具 ----------
  _parseCookieDict(cookieStr) {
    const cookies = {};
    if (!cookieStr) return cookies;
    for (const item of cookieStr.split(';')) {
      const idx = item.indexOf('=');
      if (idx < 0) continue;
      cookies[item.slice(0, idx).trim()] = item.slice(idx + 1).trim();
    }
    return cookies;
  }

  _cookieLooksExpired() {
    if (!this._cookie) return true;
    const token = (this._cookie.match(/token=([^;]+)/) || [])[1];
    if (!token) return true;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return false;
      return payload.exp <= Math.floor(Date.now() / 1000) + 60;
    } catch { return false; }
  }

  // ---------- 用户信息 ----------
  async _fetchUserInfo(cookies, token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.sub || payload.user_id;
      if (!userId) { $.log('无法从token解析user_id'); return null; }

      const referer = `${this._base_url}/manager/account`;
      const rscUrl = `${this._base_url}/user/${userId}`;
      const headers = {
        'User-Agent': UA,
        'Accept': 'text/x-component',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Origin': this._base_url,
        'Referer': referer,
        'rsc': '1',
        'Authorization': `Bearer ${token}`,
      };

      const resp = await this._httpGet(rscUrl, headers, cookies);
      if (resp.status !== 200) { $.log(`RSC请求失败: ${resp.status}`); return null; }

      const text = resp.body || '';
      const result = { id: userId };

      const mNick = text.match(/"nickname":"([^"]+)"/);
      const mAvatar = text.match(/"avatar_url":"([^"]+)"/);
      const mCreated = text.match(/"created_at":"([^"]+)"/);
      const mPoints = text.match(/"points":(\d+)/);
      const mDays = text.match(/"signin_days_total":(\d+)/);

      if (mNick) result.nickname = mNick[1];
      if (mAvatar) result.avatar_url = mAvatar[1];
      if (mCreated) result.created_at = mCreated[1];
      if (mPoints) result.points = parseInt(mPoints[1]);
      if (mDays) result.signin_days_total = parseInt(mDays[1]);

      if (!result.nickname || result.points == null) {
        const mUser = text.match(/"user":(\{.*?\})/);
        if (mUser) {
          try {
            const obj = JSON.parse(mUser[1]);
            if (!result.nickname) result.nickname = obj.nickname;
            const meta = obj.user_meta || {};
            if (result.points == null) result.points = meta.points;
            if (!result.signin_days_total) result.signin_days_total = meta.signin_days_total;
          } catch {}
        }
      }

      this.saveUserInfo(result);
      return result;
    } catch (e) {
      $.log(`获取用户信息失败: ${e}`);
      return null;
    }
  }

  // ---------- 动态扫描 next-action ----------
  async _getDynamicNextAction() {
    const loginPageUrl = `${this._base_url}/login`;
    const headers = {
      'User-Agent': UA,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    };

    try {
      const resp = await this._httpGet(loginPageUrl, headers, {});
      this._mergeCookies(resp.cookies);
      if (resp.status !== 200) { $.log(` [警告] 获取登录页失败，状态码: ${resp.status}`); return ''; }

      let scriptPaths = (resp.body.match(/src=["']([^"']*\/_next\/static\/chunks\/[^"']+\.js[^"']*)["']/g) || [])
        .map(m => (m.match(/src=["']([^"']+)["']/) || [])[1])
        .filter(Boolean);
      scriptPaths = [...new Set(scriptPaths)];

      if (!scriptPaths.length) { $.log(' [警告] 页面中未找到 Next.js chunk 脚本'); return ''; }

      $.log(` [INFO] 准备扫描 ${scriptPaths.length} 个 JS 脚本以获取 next-action...`);

      const actionRegex = /createServerReference\)\s*\(\s*["']([^"']+)["'][^)]+?,\s*["']login["']\s*\)/;

      for (const path of scriptPaths) {
        const jsUrl = path.startsWith('http') ? path : `${this._base_url}${path}`;
        try {
          const jsResp = await this._httpGet(jsUrl, headers, {});
          this._mergeCookies(jsResp.cookies);
          if (jsResp.status !== 200) continue;
          const match = jsResp.body.match(actionRegex);
          if (match) {
            const actionId = match[1].trim();
            $.log(` [INFO] 精准定位 next-action: ${actionId}`);
            return actionId;
          }
        } catch { continue; }
      }

      $.log(' [警告] 扫描所有 chunk 结束，未找到绑定的 login next-action。');
      return '';
    } catch (e) {
      $.log(` [错误] 动态获取 next-action 出现异常: ${e}`);
      return '';
    }
  }

  async _resolveNextAction() {
    if (CONFIG.next_action) {
      $.log(' [INFO] 使用手动传入的 hdhive_next_action');
      return CONFIG.next_action;
    }
    return this._getDynamicNextAction();
  }

  // ---------- 纯 POST 登录逻辑 ----------
  async loginByPost() {
    const actionId = await this._resolveNextAction();
    if (!actionId) { $.log(' [登录] 未获取到有效的 next-action，放弃登录'); return ''; }

    const loginUrl = `${this._base_url}/login?redirect=/`;
    const data = JSON.stringify([{ username: this._username, password: this._password }, "/"]);
    const domain = this._base_url.replace(/^https?:\/\//, '').replace(/\/+$/, '');

    const headers = {
      'Host': domain,
      'Connection': 'keep-alive',
      'sec-ch-ua-platform': '"Windows"',
      'next-action': actionId,
      'sec-ch-ua': '"Not:A-Brand";v="99", "Microsoft Edge";v="145", "Chromium";v="145"',
      'sec-ch-ua-mobile': '?0',
      'User-Agent': UA,
      'Accept': 'text/x-component',
      'Content-Type': 'text/plain;charset=UTF-8',
      'Origin': this._base_url,
      'Sec-Fetch-Site': 'same-origin',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Dest': 'empty',
      'Referer': loginUrl,
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      'Cookie': this._cookieString(),
    };

    try {
      const resp = await this._httpPostRaw(loginUrl, data, headers);
      this._mergeCookies(resp.cookies);
      if (resp.status !== 200 && resp.status !== 303) {
        $.log(` [登录] POST 登录失败，状态码: ${resp.status}`);
        return '';
      }

      const token = this._sessionCookies.token;
      const csrf = this._sessionCookies.csrf_access_token || this._sessionCookies.csrfaccesstoken;

      if (!token) { $.log(' [登录] 响应成功但未拿到 token'); return ''; }

      $.log(' [登录] POST 登录成功，已获取新 Cookie');
      const newCookie = `token=${token}` + (csrf ? `; csrf_access_token=${csrf}` : '');

      const meta = this.getMeta();
      meta.cookie = newCookie;
      this.saveMeta(meta);
      return newCookie;
    } catch (e) {
      $.log(` [登录] POST 登录异常: ${e}`);
      return '';
    }
  }

  // ---------- 签到接口 ----------
  async _signinApiCall() {
    if (!this._cookie) return { ok: false, message: '未配置Cookie' };

    const cookies = this._parseCookieDict(this._cookie);
    const token = cookies.token;
    const csrfToken = cookies.csrf_access_token || cookies.csrfaccesstoken;
    if (!token) return { ok: false, message: "Cookie中缺少'token'" };

    let referer = this._site_url;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const userId = payload.sub || payload.user_id;
      if (userId) referer = `${this._base_url}/user/${userId}`;
    } catch {}

    const headers = {
      'User-Agent': UA,
      'Accept': 'application/json, text/plain, */*',
      'Origin': this._base_url,
      'Referer': referer,
      'Authorization': `Bearer ${token}`,
    };
    if (csrfToken) headers['x-csrf-token'] = csrfToken;

    // 合并session cookie（登录时的hdh_sa_token等）
    const mergedCookies = { ...cookies, ...this._sessionCookies };

    let resp;
    try {
      resp = await this._httpPost(this._signin_api, '', headers, mergedCookies);
    } catch (e) {
      return { ok: false, message: `网络异常: ${e}` };
    }

    let data;
    try { data = JSON.parse(resp.body); }
    catch { return { ok: false, message: `签到API响应格式错误，HTTP ${resp.status}` }; }

    const msg = data.message || '无明确消息';
    const desc = data.description || '';

    if (data.success) {
      try { await this._fetchUserInfo(mergedCookies, token); } catch {}
      return { ok: true, message: msg };
    }

    if (msg.includes('签到失败') && desc.includes('已经签到')) {
      try { await this._fetchUserInfo(mergedCookies, token); } catch {}
      return { ok: true, message: `已签到: ${desc}` };
    }

    if (msg.includes('已经签到') || msg.includes('签到过')) {
      try { await this._fetchUserInfo(mergedCookies, token); } catch {}
      return { ok: true, message: msg };
    }

    return { ok: false, message: msg };
  }

  // ---------- 对外：一次完整签到 ----------
  async signOnce() {
    $.log(' [流程] 开始签到');

    if (this._isAlreadySignedToday()) {
      $.log(' [流程] 今日已存在成功记录，跳过本次签到');
      const history = this.getHistory();
      const today = new Date().toISOString().slice(0, 10);
      const todaySucc = history.filter(r =>
        (r.date || '').startsWith(today) &&
        ['签到成功', '已签到'].includes(r.status)
      );

      const signDict = { date: nowStr(), status: '跳过: 今日已签到' };
      if (todaySucc.length) {
        const last = todaySucc.reduce((a, b) => (a.date > b.date ? a : b));
        signDict.message = last.message;
        signDict.points = last.points;
        signDict.days = last.days;
      }
      this._saveSignHistory(signDict);
      return signDict;
    }

    if (!this._cookie || this._cookieLooksExpired()) {
      $.log(' [流程] Cookie失效或不存在，尝试POST登录获取新CK...');
      this._cookie = await this.loginByPost() || '';
    } else {
      $.log(' [流程] 使用本地缓存的复用 Cookie');
    }

    if (!this._cookie) {
      const signDict = { date: nowStr(), status: '签到失败: 无法获取 Cookie', message: 'POST 登录失败' };
      this._saveSignHistory(signDict);
      return signDict;
    }

    let retry = 0;
    while (true) {
      const { ok, message } = await this._signinApiCall();
      if (ok) {
        const isAlready = message.includes('已经签到') || message.includes('签到过');
        const status = isAlready ? '已签到' : '签到成功';
        const days = this._updateConsecutive(true);
        const pointsMatch = (message || '').match(/获得 (\d+) 积分/);
        const points = pointsMatch ? parseInt(pointsMatch[1]) : '—';

        const signDict = { date: nowStr(), status, message, points, days };
        this._saveSignHistory(signDict);
        return signDict;
      }

      $.log(` [流程] 签到失败: ${message}`);

      const authKeywords = ['未配置Cookie', "缺少'token'", '未授权', 'Unauthorized', 'token', 'csrf', '登录已过期', '过期', 'expired'];
      if (authKeywords.some(k => (message || '').includes(k))) {
        $.log(' [流程] 检测到鉴权问题，尝试重新POST登录获取新 Cookie');
        this._cookie = await this.loginByPost() || '';
        if (!this._cookie) {
          const signDict = { date: nowStr(), status: '签到失败: 鉴权失败且重新登录失败', message };
          this._saveSignHistory(signDict);
          return signDict;
        }
      }

      if (retry < CONFIG.max_retries) {
        retry++;
        $.log(` [流程] ${CONFIG.retry_interval} 秒后进行第 ${retry} 次重试 ...`);
        await $.wait(CONFIG.retry_interval * 1000);
        continue;
      }

      const signDict = { date: nowStr(), status: `签到失败: ${message}`, message };
      this._saveSignHistory(signDict);
      return signDict;
    }
  }

  // ---------- session cookie 管理（模拟 requests.Session） ----------
  _mergeCookies(cookies) {
    if (cookies && typeof cookies === 'object') {
      for (const k in cookies) this._sessionCookies[k] = cookies[k];
    }
  }
  _cookieString() {
    return Object.entries(this._sessionCookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  // ---------- HTTP 封装 ----------
  async _httpGet(url, headers, cookies) {
    const opts = { url, headers: { 'User-Agent': UA, ...(headers || {}) } };
    const cookieStr = this._buildCookieStr(cookies);
    if (cookieStr) opts.headers['Cookie'] = cookieStr;
    return httpGet(opts);
  }

  async _httpPost(url, body, headers, cookies) {
    const opts = { url, headers: { 'User-Agent': UA, ...(headers || {}) }, body: body || '' };
    const cookieStr = this._buildCookieStr(cookies);
    if (cookieStr) opts.headers['Cookie'] = cookieStr;
    return httpPost(opts, 'POST');
  }

  async _httpPostRaw(url, body, headers) {
    // allowRedirects=false，不跟随重定向
    const opts = { url, headers: { 'User-Agent': UA, ...headers }, body: body || '' };
    return httpPost(opts, 'POST', false);
  }

  _buildCookieStr(cookies) {
    if (!cookies) return '';
    if (typeof cookies === 'string') return cookies;
    return Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

// ========== 结果输出（对标 Python print_result_block） ==========
function printResultBlock(idx, username, result, worker) {
  const status = result.status || '未知';
  const msg = result.message || '—';
  const pts = result.points != null ? result.points : '—';
  const days = result.days != null ? result.days : '—';
  const ts = result.date || nowStr();

  const lines = [];
  lines.push(`${'='.repeat(60)}`);
  lines.push(`[账号 ${idx}] 用户：${username}`);
  lines.push(`[时间] ${ts}`);
  lines.push(`[状态] ${status}`);

  const userInfo = worker._loadJson(worker._user_info_key, {});
  if (userInfo && userInfo.id) {
    lines.push(` 用户ID: ${userInfo.id} | 昵称: ${userInfo.nickname || ''}`);
    lines.push(` 总积分: ${userInfo.points != null ? userInfo.points : '—'} | 登录天数: ${userInfo.signin_days_total != null ? userInfo.signin_days_total : '—'}`);
  }

  if (status.includes('成功') || status.includes('已签到')) {
    lines.push(`[详情] ${msg}`);
    lines.push(`[本次奖励] 积分：${pts} | 连续天数：${days}`);
  } else if (status.includes('跳过')) {
    lines.push(`[说明] ${msg}`);
  } else {
    lines.push(`[错误] ${msg}`);
    lines.push(' 请检查：账号密码是否正确 / 站点是否可访问');
  }
  lines.push(`${'='.repeat(60)}`);

  const block = lines.join('\n');
  $.log(block);
  lines.forEach(l => collectMsg(l));
}

// ========== 工具函数 ==========
function nowStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function atob(str) {
  if (typeof Buffer !== 'undefined') return Buffer.from(str, 'base64').toString('utf-8');
  if (typeof globalThis !== 'undefined' && globalThis.atob) return globalThis.atob(str);
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

// ========== HTTP 底层封装（QX/Surge/Loon/Node.js 通用） ==========
function httpGet(opts) {
  return new Promise((resolve, reject) => {
    const handler = (err, resp, body) => {
      if (err) reject(new Error(err));
      else resolve({
        status: resp?.status || resp?.statusCode,
        body,
        headers: resp?.headers,
        cookies: parseRespCookies(resp?.headers),
      });
    };
    if (typeof $task !== 'undefined') {
      $task.fetch(opts).then(r => resolve({
        status: r.statusCode, body: r.body, headers: r.headers,
        cookies: parseRespCookies(r.headers),
      })).catch(e => reject(e));
    } else if (typeof $httpClient !== 'undefined') {
      $httpClient.get(opts, handler);
    } else if (typeof module !== 'undefined' && module.exports) {
      nodeHttp(opts, 'GET').then(resolve).catch(reject);
    } else reject(new Error('不支持的平台'));
  });
}

function httpPost(opts, method = 'POST', allowRedirects = true) {
  return new Promise((resolve, reject) => {
    const handler = (err, resp, body) => {
      if (err) reject(new Error(err));
      else resolve({
        status: resp?.status || resp?.statusCode,
        body,
        headers: resp?.headers,
        cookies: parseRespCookies(resp?.headers),
      });
    };
    if (typeof $task !== 'undefined') {
      $task.fetch({ ...opts, method }).then(r => resolve({
        status: r.statusCode, body: r.body, headers: r.headers,
        cookies: parseRespCookies(r.headers),
      })).catch(e => reject(e));
    } else if (typeof $httpClient !== 'undefined') {
      $httpClient.post(opts, handler);
    } else if (typeof module !== 'undefined' && module.exports) {
      nodeHttp(opts, method, allowRedirects).then(resolve).catch(reject);
    } else reject(new Error('不支持的平台'));
  });
}

function parseRespCookies(headers) {
  const cookies = {};
  if (!headers) return cookies;
  let setCookie = headers['Set-Cookie'] || headers['set-cookie'] || headers['Set-cookie'] || '';
  if (typeof setCookie === 'string') setCookie = [setCookie];
  if (Array.isArray(setCookie)) {
    for (const part of setCookie) {
      const m = part.match(/(\w+)=([^;]+)/);
      if (m) cookies[m[1]] = m[2];
    }
  }
  return cookies;
}

// Node.js http(s) 实现
function nodeHttp(opts, method, allowRedirects = true) {
  return new Promise((resolve, reject) => {
    const u = new URL(opts.url);
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const reqOpts = {
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: method || 'GET',
      headers: opts.headers || {},
    };
    const req = mod.request(reqOpts, resp => {
      // 不跟随重定向
      if (resp.statusCode >= 300 && resp.statusCode < 400 && !allowRedirects) {
        const cookies = {};
        (resp.headers['set-cookie'] || []).forEach(v => {
          const m = v.match(/(\w+)=([^;]+)/); if (m) cookies[m[1]] = m[2];
        });
        let data = '';
        resp.on('data', () => {});
        resp.on('end', () => resolve({
          status: resp.statusCode, body: data, headers: resp.headers, cookies,
        }));
        return;
      }
      // 自动跟随重定向
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        const newUrl = new URL(resp.headers.location, opts.url).href;
        const newOpts = { ...opts, url: newUrl };
        nodeHttp(newOpts, 'GET', true).then(resolve).catch(reject);
        return;
      }
      const chunks = [];
      const cookies = {};
      (resp.headers['set-cookie'] || []).forEach(v => {
        const m = v.match(/(\w+)=([^;]+)/); if (m) cookies[m[1]] = m[2];
      });
      // gzip/deflate解压
      const encoding = resp.headers['content-encoding'];
      let stream = resp;
      if (encoding === 'gzip') {
        const zlib = require('zlib');
        stream = resp.pipe(zlib.createGunzip());
      } else if (encoding === 'deflate') {
        const zlib = require('zlib');
        stream = resp.pipe(zlib.createInflate());
      } else if (encoding === 'br') {
        const zlib = require('zlib');
        stream = resp.pipe(zlib.createBrotliDecompress());
      }
      let data = '';
      stream.on('data', c => data += c);
      stream.on('end', () => resolve({
        status: resp.statusCode, body: data, headers: resp.headers, cookies,
      }));
      stream.on('error', reject);
    });
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
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

// ========== 启动 ==========
main().catch(e => { $.logErr(e); $.done(); });
