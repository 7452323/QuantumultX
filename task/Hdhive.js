/*
RE0(影巢每日签到) 因为每日签到和赌狗签到每天只能二选一，所以目前只有每日签到
版本：2.0.3（2026-09-06）— 通知显示站内昵称/积分；修复 Set-Cookie 解析
变量名：re0_accounts       多账号 user#pass&user2#pass2
可选：re0_cookie          手动/Cookie采集得到的完整 Cookie（未配账号时使用）
可选：re0_base_url        默认 https://re0.me
可选：re0_login_action    登录 action id（留空自动从 /login 页扫描）
可选：re0_checkin_action  签到 action id（留空用内置默认，登录后可自动扫描刷新）

[rewrite_local]
^https?:\/\/re0\.me url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[task_local]
20 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=RE0每日签到, enabled=true

[MITM]
hostname = %APPEND% re0.me
*/

// ============ 常量与默认值 ============
const DEF_BASE = 'https://re0.me';
const DEF_LOGIN_ACTION = '60fa5517c023301ab84757ba19fd91f0ef5cc482dd';   // createServerReference(...,"login")
const DEF_CHECKIN_ACTION = '4004fe56299e6451fc007a19f6df5f592551ab9c78'; // createServerReference(...,"checkIn")
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

let $ = new Env('RE0每日签到');
let allMsg = '';

// ============ 配置读取 ============
const CONFIG = (() => {
  const args = {};
  if (typeof $argument === 'string' && $argument) {
    $argument.split('&').forEach(p => { const i = p.indexOf('='); if (i > 0) args[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  }
  const get = (k, f) => {
    if (args[k] != null) { try { return decodeURIComponent(args[k]); } catch { return args[k]; } }
    if ($.isNode() && process.env[k.toUpperCase()]) return process.env[k.toUpperCase()];
    return $.getdata(k) || f;
  };
  return {
    base_url: (get('re0_base_url') || DEF_BASE).replace(/\/+$/, ''),
    accounts: get('re0_accounts', ''),
    cookie: get('re0_cookie', ''),
    login_action: get('re0_login_action', ''),
    checkin_action: get('re0_checkin_action', ''),
  };
})();

// ============ 工具 ============
function nowStr() { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; }
function collect(m) { const c = (m || '').trim(); if (!c) return; if (/^[=\-─]+$/.test(c)) return; if (c.includes('[流程]') || c.includes('[INFO]')) return; allMsg += c + '\n'; }

function parseCookiesToMap(str) {
  const m = {};
  (str || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) m[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return m;
}
const WANT_COOKIES = ['token', 'refresh_token', 'csrf_access_token', 'csrfaccesstoken', 'hdh_uid', 'hdh_sa_token'];
function mergeSetCookie(map, setCookie) {
  // 兼容各引擎：数组 / 单串 / 多行拼接；只收白名单 cookie（忽略 Expires/Path 等属性名）
  const list = Array.isArray(setCookie) ? setCookie : (setCookie ? [setCookie] : []);
  const re = /([A-Za-z_][A-Za-z0-9_]*)=([^;,\s]*)/g;
  for (const sc of list) {
    let m;
    while ((m = re.exec(sc))) {
      if (WANT_COOKIES.includes(m[1])) map[m[1]] = m[2];
    }
  }
}
function cookieString(map) { return Object.entries(map).map(([k, v]) => `${k}=${v}`).join('; '); }

function safeName(n) { return (n || 'default').replace(/[^a-zA-Z0-9_.-]/g, '_'); }
function b64(s) {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  if (typeof btoa !== 'undefined') return btoa(unescape(encodeURIComponent(s)));
  return s;
}
function fmtErr(e) { return (e && e.message) ? e.message : String(e); }

// ============ HTTP 封装（跨平台 + Set-Cookie 维持） ============
function httpReq(opts, method = 'GET') {
  return new Promise((resolve, reject) => {
    const done = (err, status, headers, body) => {
      if (err) return reject(new Error(err));
      resolve({ status, headers: headers || {}, body });
    };
    if (typeof $task !== 'undefined') {
      $task.fetch({ url: opts.url, method, headers: opts.headers || {}, body: opts.body || '', timeout: 30000 })
        .then(r => done(null, r.statusCode, r.headers, r.body || ''))
        .catch(e => done(fmtErr(e)));
    } else if (typeof $httpClient !== 'undefined') {
      const cb = (err, resp, body) => done(err, resp ? (resp.status || resp.statusCode) : 0, resp ? resp.headers : {}, body || '');
      if (method === 'GET') $httpClient.get(opts, cb); else $httpClient.post(opts, cb);
    } else if (typeof module !== 'undefined' && module.exports) {
      nodeReq(opts, method).then(r => done(null, r.status, r.headers, r.body)).catch(e => done(fmtErr(e)));
    } else reject(new Error('不支持的平台'));
  });
}
function nodeReq(opts, method) {
  const attempt = (n) => new Promise((resolve, reject) => {
    const u = new URL(opts.url);
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname + u.search, method, headers: opts.headers || {} }, resp => {
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', e => { if (n > 0) { setTimeout(() => attempt(n - 1).then(resolve, reject), 1500); } else { reject(e); } });
    if (opts.body) req.write(opts.body);
    req.end();
  });
  return attempt(4);
}

// ============ 账号 Worker ============
class Re0Worker {
  constructor(base, username, password, cookie, ids) {
    this.base = base;
    this.username = username;
    this.password = password;
    this.cookie = cookie || '';            // 传入的持久化 Cookie
    this.jar = parseCookiesToMap(cookie);  // 运行时 cookie 桶
    this.ids = ids || {};
    this.tag = safeName(username);
    this.metaKey = `re0_meta_${this.tag}`;
    this.historyKey = `re0_history_${this.tag}`;
  }
  _load(k, d) { try { const v = $.getdata(k); return v ? JSON.parse(v) : d; } catch { return d; } }
  _save(k, v) { try { $.setdata(JSON.stringify(v), k); } catch {} }
  getMeta() { return this._load(this.metaKey, {}); }
  saveMeta(m) { this._save(this.metaKey, m); }
  getHistory() { return this._load(this.historyKey, []); }

  // --- HTTP helpers with cookie jar auto-update ---
  async req(method, path, { headers = {}, body = '', accept } = {}) {
    const h = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', ...headers };
    if (accept) h['Accept'] = accept;
    if (Object.keys(this.jar).length) h['Cookie'] = cookieString(this.jar);
    if (body !== '') h['Content-Type'] = h['Content-Type'] || 'text/plain;charset=UTF-8';
    const r = await httpReq({ url: this.base + path, headers: h, body }, method);
    // 轮换 cookie：响应 Set-Cookie 头名大小写不一，统一小写扫描并入
    const hkeys = Object.keys(r.headers || {});
    for (const k of hkeys) { if (k.toLowerCase() === 'set-cookie') { mergeSetCookie(this.jar, r.headers[k]); break; } }
    return r;
  }
  get(path, accept = 'text/html') { return this.req('GET', path, { accept }); }
  post(path, body, actionId) {
    return this.req('POST', path, {
      body,
      headers: { 'Accept': 'text/x-component', 'Origin': this.base, 'Referer': this.base + path, 'next-action': actionId },
    });
  }

  cookieNow() { return cookieString(this.jar); }

  // --- 登录（server action，免 X-HDH） ---
  async login() {
    const action = this.ids.login;
    if (!action) throw new Error('未取得 login action');
    // 1) GET /login 绑定 hdh_sa_token
    await this.get('/login?redirect=/');
    // 2) POST login action
    const payload = JSON.stringify([{ username: this.username, password: b64(this.password), password_transport: 'base64' }, '/']);
    const r = await this.post('/login?redirect=/', payload, action);
    const hasToken = !!this.jar['token'];
    const js = tryJson(r.body);
    if (js && js.code === 'action_token_required') throw new Error(`登录需先绑定（GET /login），code=${js.code}`);
    if (!hasToken) {
      // 诊断：响应头到底有没有 set-cookie / 含哪些目标 cookie
      const hkeys = Object.keys(r.headers || {});
      let raw = '';
      for (const k of hkeys) { if (k.toLowerCase() === 'set-cookie') raw += String(r.headers[k]); }
      const got = WANT_COOKIES.filter(n => raw.includes(n + '=')).join(',');
      throw new Error(`登录未返回 token：HTTP ${r.status} | set-cookie含[${got || '无'}] | 响应头[${hkeys.join(',')}] | ${cut(r.body)}`);
    }
    const meta = this.getMeta(); meta.cookie = this.cookieNow(); this.saveMeta(meta);
    return r;
  }

  // --- 每日签到 ---
  async checkIn() {
    const action = this.ids.checkin;
    if (!action) throw new Error('未取得 checkIn action');
    // GET /manager/account 刷新绑定 + 页面
    const page = await this.get('/manager/account', 'text/x-component');
    // POST action body [true]
    const r = await this.post('/manager/account', '[true]', action);
    return { http: r.status, body: r.body, page };
  }

  // --- 账号资料（从 account 页 RSC 抠昵称/积分/连续天数） ---
  parseProfile(rsc) {
    const o = {};
    let m = rsc.match(/"nickname":"([^"]*)"/); if (m) o.nickname = m[1];
    m = rsc.match(/"user_meta":\{"points":(\d+),"signin_days_total":(\d+)/); if (m) { o.points = +m[1]; o.days = +m[2]; }
    return o;
  }
}

// ============ 结果解析（RSC / JSON） ============
function tryJson(s) { try { return JSON.parse(s); } catch { return null; } }
function cut(s, n = 400) { return (s || '').slice(0, n).replace(/\n/g, ' '); }
function analyzeCheckin(resp) {
  const body = (resp && resp.body) || '';
  let j = tryJson(body);
  if (!j) {
    // Next.js RSC 流里 action 结果行形如：\n1:{"data":...}\n 或 1:{"error":{...}}
    const m = body.match(/^1:(\{.*\})$/m);
    if (m) j = tryJson(m[1]);
  }
  const err = (j && j.error) || null;
  const msg = (j && (j.message || err && err.message)) || (body.match(/"message":"([^"]*)"/) || [])[1] || '';
  const desc = (j && (j.description || err && err.description)) || (body.match(/"description":"([^"]*)"/) || [])[1] || '';
  const code = (j && (j.code || err && err.code)) || (body.match(/"code":"([^"]*)"/) || [])[1] || '';
  const success = j ? !!((j.success === true) || (j.data && j.data.success === true)) : false;
  const text = (msg + ' ' + desc).trim();
  const isAlready = /已经签到|签到过|明日再来|明天再来/.test(text);
  const isOk = success || /签到成功|成功/.test(text) || /^2/.test(String(resp.http));
  return { ok: isOk || isAlready, isAlready, message: text || ('HTTP ' + resp.http), code };
}

// ============ Cookie 采集（rewrite 模式） ============
function handleCookie() {
  const h = ($request && ($request.headers || {})) || {};
  const ck = h['Cookie'] || h['cookie'] || '';
  if (!ck) { $.done(); return; }
  const m = parseCookiesToMap(ck);
  if (!m['token']) { $.done(); return; }   // 只要带 token 的完整登录态
  const old = $.getdata('re0_cookie') || '';
  if (old !== ck) {
    $.setdata(ck, 're0_cookie');
    $.log(`[Cookie] 已保存 RE0 Cookie（含 token）`);
  }
  $.done();
}

// ============ Action id 发现 ============
const cacheLoginKey = 're0_cache_login_action';
const cacheCheckinKey = 're0_cache_checkin_action';

function scanActionId(text, name) {
  const re = new RegExp('createServerReference\\)\\s*\\(\\s*["\']([^"\']+)["\'][^)]*?,\\s*["\']' + name.replace(/[$.*+?^${}()|[\]\\]/g, '\\$&') + '["\']\\s*\\)');
  const m = text.match(re);
  return m ? m[1] : '';
}
async function fetchText(base, path, { accept, cookie } = {}) {
  const h = { 'User-Agent': UA, 'Accept': accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' };
  if (cookie) h['Cookie'] = cookie;
  const r = await httpReq({ url: base + path, headers: h, body: '' }, 'GET');
  return r.body || '';
}
function chunkUrlFromHtml(html, patternPart) {
  const re = new RegExp('([^"\']*' + patternPart + '[^"\']*\\.js[^"\']*)');
  const m = html.match(re);
  return m ? m[1] : '';
}
async function discoverLoginAction(base) {
  const html = await fetchText(base, '/login');
  const c = chunkUrlFromHtml(html, '/_next/static/chunks/app/\\(auth\\)/login/page-');
  if (!c) return '';
  const js = await fetchText(base, c);
  return scanActionId(js, 'login');
}
async function discoverCheckinAction(base, cookie) {
  // manager 布局 chunk 只在登录态页面出现；cookie 可选
  const html = await fetchText(base, '/manager/account', { accept: 'text/html', cookie });
  const c = chunkUrlFromHtml(html, '/_next/static/chunks/app/manager/layout-');
  if (!c) return '';
  const js = await fetchText(base, c);
  return scanActionId(js, 'checkIn');
}

// ============ 主流程 ============
async function main() {
  if (typeof $request !== 'undefined') { handleCookie(); return; }
  $.log(`🔔 ${$.name}, 开始!`);
  $.log(`BASE = ${CONFIG.base_url}`);

  // 解析账号
  const accounts = [];
  (CONFIG.accounts || '').split('&').forEach(item => {
    item = item.trim(); if (!item) return;
    const p = item.split('#');
    if (p.length >= 2) accounts.push({ username: p[0].trim(), password: p[1].trim(), cookie: p[2] ? p[2].trim() : '' });
  });
  if (!accounts.length && CONFIG.cookie) accounts.push({ username: 'cookie', password: '', cookie: CONFIG.cookie });
  if (!accounts.length) {
    $.msg($.name, '', '⚠️ 未配置 re0_accounts\n\n示例：user#pass&user2#pass2\n或抓包后配置 re0_cookie\n\n🎯 失败');
    $.done(); return;
  }

  // action ids：优先缓存/手动，失败再发现
  const ids = {
    login: CONFIG.login_action || $.getdata(cacheLoginKey) || DEF_LOGIN_ACTION,
    checkin: CONFIG.checkin_action || $.getdata(cacheCheckinKey) || DEF_CHECKIN_ACTION,
  };

  for (let idx = 0; idx < accounts.length; idx++) {
    const acc = accounts[idx];
    $.log(`\n${'─'.repeat(56)}`);
    $.log(`[账号 ${idx + 1}] ${acc.username}`);
    try {
      const w = new Re0Worker(CONFIG.base_url, acc.username, acc.password, acc.cookie || '', ids);
      // 保证登录态（密码优先自动登录；action 失效则现场扫描重试一次）
      if (acc.password) {
        $.log(' [流程] 自动登录...');
        try {
          await w.login();
        } catch (e) {
          if (!/action|Action/.test(fmtErr(e))) throw e;
          const nid = await discoverLoginAction(CONFIG.base_url).catch(() => '');
          if (!nid) throw e;
          $.log(` [info] login action 已刷新: ${nid}`);
          ids.login = nid; $.setdata(nid, cacheLoginKey);
          w.ids.login = nid;
          await w.login();
        }
      } else if (!w.jar['token']) {
        throw new Error('无 token：请配置账号密码，或先抓包配置 re0_cookie');
      } else {
        $.log(' [流程] 使用已有 Cookie');
      }

      // 登录后自动校准 checkin action（未手动配置且未缓存过）
      if (!CONFIG.checkin_action && !$.getdata(cacheCheckinKey)) {
        try {
          const id = await discoverCheckinAction(CONFIG.base_url, w.cookieNow());
          if (id) { ids.checkin = id; $.setdata(id, cacheCheckinKey); }
        } catch (e) { $.log(` [warn] checkin action 扫描失败: ${fmtErr(e)}`); }
      }

      $.log(' [流程] 执行每日签到...');
      let resp = await w.checkIn();
      let r = analyzeCheckin(resp);
      // 签到 action 疑似失效 → 重新扫描后重试一次
      if (!r.isAlready && /action|Action|未知/.test(r.message + ' ' + (r.code || '')) && !CONFIG.checkin_action) {
        try {
          const id = await discoverCheckinAction(CONFIG.base_url, w.cookieNow());
          if (id && id !== ids.checkin) {
            ids.checkin = id; $.setdata(id, cacheCheckinKey); w.ids.checkin = id;
            resp = await w.checkIn();
            r = analyzeCheckin(resp);
          }
        } catch (e2) { $.log(` [warn] 重扫 checkin 失败: ${fmtErr(e2)}`); }
      }

      // 真实用户名：优先站内昵称，回退登录账号
      const pf = w.parseProfile((resp.page || '') + ' ' + (resp.body || ''));
      const display = pf.nickname || acc.username;
      const extra = (pf.points != null ? ` ｜ 积分 ${pf.points}${pf.days != null ? ' / 连续 ' + pf.days + ' 天' : ''}` : '');

      // 持久化 Cookie（供下次复用 / 展示）
      const meta = w.getMeta(); meta.cookie = w.cookieNow(); meta.display = display; meta.points = pf.points; w.saveMeta(meta);

      let sub = '';
      if (r.isAlready) { sub = `⏭️ 今日已签到：${r.message || ''}`; }
      else if (r.ok) { sub = `✅ 签到成功：${r.message || ''}`; }
      else { sub = `❌ 签到失败：${r.message || ''}`; }
      $.log(`[账号 ${idx + 1}] ${acc.username} | ${sub}`);
      collect(`${display}${extra}`); collect(sub);
    } catch (e) {
      const msg = fmtErr(e);
      $.log(`[账号 ${idx + 1}] ${acc.username} ❌ ${msg}`);
      collect(`${acc.username} ❌ ${msg}`);
    }
  }

  $.log(`\n${'═'.repeat(56)}`);
  if (allMsg) { $.msg($.name, '', allMsg); }
  $.done();
}

// ============ Env.js 精简框架 ============
function Env(name) {
  return new (class {
    constructor() { this.name = name; this.data = null; this.startTime = Date.now(); }
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
    log(...t) { console.log(t.join('\n')); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    msg(s, t, c) {
      switch (this.getEnv()) {
        case 'Node.js': console.log(`${s}: ${t || ''} - ${c || ''}`); break;
        case 'Quantumult X': $notify(s, t || '', c || ''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $notification.post(s, t || '', c || ''); break;
      }
    }
    done() {
      const el = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`结束! ${el}s`);
      switch (this.getEnv()) {
        case 'Node.js': process.exit(0); break;
        default: $done(); break;
      }
    }
  })();
}

// ============ 启动 ============
main().catch(e => { $.log(`❌ ${$.name} 异常: ${fmtErr(e)}`); try { $.done(); } catch (_) {} });
