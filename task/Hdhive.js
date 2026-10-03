/*
RE0(影巢) 签到 — re0.me

Cookie 变量：re0_cookie
账号变量：re0_accounts（user#pass，多账号用 & 分隔）
模式变量：re0_mode（1 每日签到 / 2 赌狗签到，每天二选一）

认证：re0_cookie 有效则免密直签；否则用账号密码登录，登录后 Cookie 缓存复用。
cf_clearance 绑定出网 IP —— 浏览器抓 Cookie 时需与脚本走同一节点。

[rewrite_local]
^https?:\/\/re0\.me url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[task_local]
20 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=RE0签到, enabled=true

[MITM]
hostname = re0.me
*/

const $ = new Env('RE0签到');

// ============ chavyleung's Env.js ============
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;"POST"===e&&(s=this.post);const i=new Promise(((e,i)=>{s.call(this,t,((t,s,o)=>{t?i(t):e(s)}))}));return t.timeout?((t,e=1e3)=>Promise.race([t,new Promise(((t,s)=>{setTimeout((()=>{s(new Error("请求超时"))}),e)}))]))(i,t.timeout):i}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=t,this.http=this,this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null,...s){try{return JSON.stringify(t,...s)}catch{return e}}getjson(t,e){let s=e;if(this.getdata(t))try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise((e=>{this.get({url:t},((t,s,i)=>e(i)))}))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),o=JSON.stringify(this.data);s?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(e,o):this.fs.writeFileSync(t,o)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return s;return o}lodash_set(t,e,s){return Object(t)!==t||(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce(((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{}),t)[e[e.length-1]]=s),t}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),o=s?this.getval(s):"";if(o)try{const t=JSON.parse(o);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(e),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,o,t),s=this.setval(JSON.stringify(e),i)}catch(e){const r={};this.lodash_set(r,o,t),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":const s=require("iconv-lite");this.initGotEnv(t),this.got(t).then((t=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:i,response:o}=t;e(i,o,o&&s.decode(o.rawBody,this.encoding))}));break}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t);const{url:o,...r}=t;this.got[s](o,r).then((t=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:s,response:o}=t;e(s,o,o&&i.decode(o.rawBody,this.encoding))}));break}}queryStr(t){let e="";for(const s in t){let i=t[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),e+=`${s}=${i}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",i="",o={}){if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,i,o);break;case"Quantumult X":$notify(e,s,i,o);break;case"Node.js":break}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t],console.log(t.map((t=>t??String(t))).join(this.logSeparator)))}logErr(t,e){this.log("",`❗️${this.name}, 错误!`,e,t)}wait(t){return new Promise((e=>setTimeout(e,t)))}done(t={}){const e=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${e} 秒`),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":break}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.cookie&&void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar)))}}(t,e)}

// ============ 常量 ============
const BASE = 'https://re0.me';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const BROWSER_HEADERS = {
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24", "Google Chrome";v="125"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
};
const KEEP = ['token', 'refresh_token', 'csrf_access_token', 'hdh_uid', 'hdh_sa_token', 'cf_clearance'];

// Next.js Server Action id，随站点构建变化；失效时自动重扫 chunk 刷新
const ACTION_DEFAULT = {
  login: '6014e85b3c42c65c13a43120e9713c84ff6103b035',
  checkin: '4004fe56299e6451fc007a19f6df5f592551ab9c78',
  gambler: '409c3461f006f9de5e010af69e072690dd8b736acd',
};
const ACTION_CACHE = { login: 're0_a_login', checkin: 're0_a_checkin', gambler: 're0_a_gambler' };
// 各自的页面 / chunk 路径特征 / 导出函数名
const ACTION_SOURCE = {
  login: { page: '/login', chunk: 'app/\\(auth\\)/login/page-', fn: 'login' },
  checkin: { page: '/manager/account', chunk: 'app/manager/layout-', fn: 'checkIn' },
  gambler: { page: '/', chunk: 'app/\\(app\\)/layout-', fn: 'checkIn' },
};
const CF_HINT = 'Cloudflare 拦截：Cookie 需含 cf_clearance，且与浏览器同一出网 IP';

// ============ 工具 ============
const BLANK = ['--', '-', 'none', 'null', '无', '空'];
function argValue(key) {
  let v = '';
  if (typeof $argument === 'string' && $argument) {
    // 只在 & 或 , 后紧跟新参数名时断开，值里的 & 不会被切碎
    $argument.split(/[&,](?=[A-Za-z_][A-Za-z0-9_]*=)/).forEach(p => {
      const i = p.indexOf('=');
      if (i > 0 && p.slice(0, i).trim() === key) v = p.slice(i + 1).trim();
    });
  } else if (typeof $argument === 'object' && $argument) {
    v = $argument[key] || '';
  }
  try { v = decodeURIComponent(v); } catch (e) { }
  return (!v || BLANK.indexOf(String(v).trim().toLowerCase()) >= 0) ? '' : v;
}
function b64(s) {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
}
function fmtErr(e) { return (e && e.message) ? e.message : String(e); }
function tryJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function cut(s, n = 200) { return (s || '').slice(0, n).replace(/\n/g, ' '); }
function jwtExp(token) {
  try {
    let seg = String(token || '').split('.')[1];
    if (!seg) return 0;
    seg = seg.replace(/-/g, '+').replace(/_/g, '/');
    while (seg.length % 4) seg += '=';
    const json = typeof Buffer !== 'undefined'
      ? Buffer.from(seg, 'base64').toString('utf8')
      : decodeURIComponent(escape(atob(seg)));
    const exp = JSON.parse(json).exp;
    return typeof exp === 'number' ? exp : 0;
  } catch (e) { return 0; }
}
function tokenExpired(token, skew = 60) {
  const exp = jwtExp(token);
  return exp ? exp <= Math.floor(Date.now() / 1000) + skew : false;
}
function cookieMap(str) {
  const m = {};
  (str || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) m[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return m;
}
function cookieStr(m) { return Object.entries(m).map(([k, v]) => `${k}=${v}`).join('; '); }
function mergeSetCookie(m, sc) {
  const list = Array.isArray(sc) ? sc : (sc ? [sc] : []);
  const re = /([A-Za-z_][A-Za-z0-9_]*)=([^;,\s]*)/g;
  for (const s of list) { let x; while ((x = re.exec(s))) if (KEEP.includes(x[1])) m[x[1]] = x[2]; }
}
// 有 token 且未过期才算有效
function validCookie(str) {
  const m = cookieMap(str);
  return (m.token && !tokenExpired(m.token)) ? m : null;
}

// ============ HTTP（cookie 桶随响应自动更新） ============
function http(opts, method = 'GET') {
  return new Promise((resolve, reject) => {
    const done = (err, status, headers, body) => {
      if (err) return reject(new Error(err));
      const cf = Object.keys(headers || {}).some(k => k.toLowerCase() === 'cf-mitigated')
        || /Just a moment|cf-challenge/i.test(body || '');
      if (cf) return reject(new Error(`${CF_HINT}（HTTP ${status}）`));
      resolve({ status, headers: headers || {}, body: body || '' });
    };
    if (typeof $task !== 'undefined') {
      $task.fetch({ url: opts.url, method, headers: opts.headers || {}, body: opts.body || '', timeout: 30000 })
        .then(r => done(null, r.statusCode, r.headers, r.body))
        .catch(e => done(fmtErr(e)));
    } else if (typeof $httpClient !== 'undefined') {
      const cb = (err, resp, body) => done(err, resp ? (resp.status || resp.statusCode) : 0, resp ? resp.headers : {}, body);
      if (method === 'GET') $httpClient.get(opts, cb); else $httpClient.post(opts, cb);
    } else if (typeof module !== 'undefined' && module.exports) {
      nodeReq(opts, method).then(r => done(null, r.status, r.headers, r.body)).catch(e => done(fmtErr(e)));
    } else reject(new Error('不支持的平台'));
  });
}
function nodeReq(opts, method, retry = 3) {
  return new Promise((resolve, reject) => {
    const u = new URL(opts.url);
    const mod = u.protocol === 'https:' ? require('https') : require('http');
    const req = mod.request({
      hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search, method, headers: opts.headers || {},
    }, resp => {
      const chunks = [];
      resp.on('data', c => chunks.push(c));
      resp.on('end', () => resolve({ status: resp.statusCode, headers: resp.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', e => retry > 0 ? setTimeout(() => nodeReq(opts, method, retry - 1).then(resolve, reject), 1500) : reject(e));
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// ============ 账号 ============
class Re0 {
  constructor(base, account, ids, mode) {
    this.base = base;
    this.user = account.username;
    this.pass = account.password;
    this.ids = ids;
    this.mode = mode;
    this.jar = cookieMap(account.cookie || '');
  }
  get metaKey() { return 're0_meta_' + this.user.replace(/[^a-zA-Z0-9_.-]/g, '_'); }
  get meta() { return $.getjson(this.metaKey, {}) || {}; }
  set meta(m) { $.setdata(JSON.stringify(m), this.metaKey); }

  async req(method, path, headers = {}, body = '') {
    const h = { 'User-Agent': UA, ...BROWSER_HEADERS, ...headers };
    if (Object.keys(this.jar).length) h['Cookie'] = cookieStr(this.jar);
    if (body) h['Content-Type'] = 'text/plain;charset=UTF-8';
    const r = await http({ url: this.base + path, headers: h, body }, method);
    for (const k of Object.keys(r.headers)) {
      if (k.toLowerCase() === 'set-cookie') { mergeSetCookie(this.jar, r.headers[k]); break; }
    }
    return r;
  }
  get(path, accept = 'text/html') {
    const h = accept === 'text/html' ? {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'none', 'Sec-Fetch-User': '?1',
    } : {
      'Accept': accept, 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin',
    };
    return this.req('GET', path, h);
  }
  post(path, action, body = '[true]') {
    return this.req('POST', path, {
      'Accept': 'text/x-component',
      'Origin': this.base, 'Referer': this.base + path, 'Next-Action': action,
      'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin',
    }, body);
  }

  async login() {
    await this.get('/login?redirect=/');   // 先绑 hdh_sa_token，否则 action_token_required
    const body = JSON.stringify([{ username: this.user, password: b64(this.pass), password_transport: 'base64' }, '/']);
    const r = await this.post('/login?redirect=/', this.ids.login, body);
    if (!this.jar.token) throw new Error(`登录失败（HTTP ${r.status}）：${cut(r.body) || '空响应'}`);
  }

  async checkIn() {
    const gambler = this.mode === 'gambler';
    const path = gambler ? '/' : '/manager/account';
    await this.get(path, gambler ? 'text/html' : 'text/x-component');   // 先绑 hdh_sa_token
    return this.post(path, gambler ? this.ids.gambler : this.ids.checkin);
  }
}

// ============ 响应解析 ============
function parseResult(resp) {
  const raw = resp.body || '';
  const body = raw.replace(/\\"/g, '"');
  let j = tryJson(raw) || tryJson(body);
  if (!j) {   // RSC 流里的 action 结果行：1:{"response":{...}}
    const m = body.match(/^1:(\{.*\})$/m);
    if (m) j = tryJson(m[1]);
  }
  const p = (j && j.response) || j || {};
  const err = p.error || {};
  const msg = p.message || err.message || '';
  const text = (msg + ' ' + (p.description || err.description || '')).trim();
  const already = /已签到|签到过|明日再来|明天再来/.test(text);
  const ok = p.success === true || /签到成功|checkin success/i.test(text);
  return { ok: ok || already, already, msg: text || `HTTP ${resp.status}`, gained: (text.match(/获得\s*(\d+)/) || [])[1] };
}
function parseProfile(body) {
  const t = (body || '').replace(/\\"/g, '"');
  const o = {};
  const n = t.match(/"currentUser":\{[^}]*"nickname":"([^"]*)"/);
  if (n) o.nickname = n[1];
  const m = t.match(/"user_meta":\{"points":(\d+),"signin_days_total":(\d+)/);
  if (m) { o.points = +m[1]; o.days = +m[2]; }
  return o;
}

// ============ action 自愈：从 chunk 扫 createServerReference ============
function chunkFrom(html, part) {
  const m = (html || '').match(new RegExp('([^"\']*' + part + '[^"\']*\\.js[^"\']*)'));
  if (!m) return '';
  let c = m[1].replace(/\\+$/, '');
  if (c.charAt(0) !== '/') c = '/_next/' + c.replace(/^\/+/, '');
  return c;
}
function actionFrom(js, fn) {
  const m = (js || '').match(new RegExp('createServerReference\\)?\\s*\\(\\s*["\']([0-9a-f]{20,})["\'][^)]*?,\\s*["\']' + fn + '["\']'));
  return m ? m[1] : '';
}
async function discover(kind, jar, base) {
  const s = ACTION_SOURCE[kind];
  const h = {
    'User-Agent': UA, ...BROWSER_HEADERS, 'Accept': 'text/html',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin',
  };
  if (Object.keys(jar).length) h['Cookie'] = cookieStr(jar);
  const page = await http({ url: base + s.page, headers: h });
  const chunk = chunkFrom(page.body, s.chunk);
  if (!chunk) return '';
  const js = await http({ url: base + chunk, headers: h });
  return actionFrom(js.body, s.fn);
}

// ============ Cookie 采集（rewrite） ============
function captureCookie() {
  const h = $request.headers || {};
  const ck = h['Cookie'] || h['cookie'] || '';
  const m = cookieMap(ck);
  if (!m.token) return;                        // 非登录态，静默
  if (tokenExpired(m.token)) {
    if ($.getdata('re0_cookie_bad') !== ck) {   // 同一份过期 Cookie 只提示一次
      $.setdata(ck, 're0_cookie_bad');
      $.msg('RE0签到', 'Cookie已过期', '请在浏览器重新登录 re0.me');
    }
    return;
  }
  if ($.getdata('re0_cookie') === ck) return;
  $.setdata(ck, 're0_cookie');
  $.msg('RE0签到', 'Cookie已抓取', '定时任务将使用免密签到');
}

// ============ 主流程 ============
!(async () => {
  if (typeof $request !== 'undefined' && $request) return captureCookie();

  const mode = /^(2|gambler|gg|赌狗)$/.test(String(argValue('re0_mode') || $.getdata('re0_mode') || '1').toLowerCase()) ? 'gambler' : 'normal';
  const modeName = mode === 'gambler' ? '赌狗签到' : '每日签到';
  const rawAccounts = argValue('re0_accounts') || $.getdata('re0_accounts') || '';
  const rawCookie = argValue('re0_cookie') || $.getdata('re0_cookie') || '';

  const listed = rawAccounts.split('&').map(s => s.trim()).filter(Boolean).map(item => {
    const p = item.split('#');
    return { username: p[0].trim(), password: (p[1] || '').trim() };
  });
  // 免密优先：全局 Cookie 有效就不走密码登录
  const gMap = validCookie(rawCookie);
  const accounts = gMap ? [{ username: 'cookie', password: '', cookie: rawCookie }] : listed;
  if (!accounts.length) {
    $.msg('RE0签到', '❌ 未配置账号', '填 re0_accounts（user#pass）或开 Cookie 重写后浏览器打开 re0.me');
    return;
  }
  $.log(`[RE0] ${modeName}，${accounts.length} 个账号${gMap ? '（免密）' : ''}`);

  const ids = {
    login: $.getdata(ACTION_CACHE.login) || ACTION_DEFAULT.login,
    checkin: $.getdata(ACTION_CACHE.checkin) || ACTION_DEFAULT.checkin,
    gambler: $.getdata(ACTION_CACHE.gambler) || ACTION_DEFAULT.gambler,
  };
  const key = mode === 'gambler' ? 'gambler' : 'checkin';
  const out = [];

  for (const acc of accounts) {
    try {
      const w = new Re0(BASE, acc, ids, mode);

      if (acc.password) {
        const cached = validCookie(w.meta.cookie || '');
        if (cached) { w.jar = cached; $.log(`[RE0] ${acc.username} 复用缓存 Cookie`); }
        else await w.login();
      } else if (!validCookie(cookieStr(w.jar))) {
        throw new Error('Cookie 无效或已过期：请在浏览器重新登录 re0.me');
      }

      let resp = await w.checkIn();
      let r = parseResult(resp);

      // action 疑似失效 → 重扫 chunk 后重试一次
      if (!r.already && /action|Action|未知/.test(r.msg)) {
        const nid = await discover(key, w.jar, BASE).catch(() => '');
        if (nid && nid !== ids[key]) {
          ids[key] = nid; w.ids[key] = nid;
          $.setdata(nid, ACTION_CACHE[key]);
          $.log(`[RE0] ${modeName} action 已刷新: ${nid}`);
          r = parseResult(await w.checkIn());
        }
      }

      const pf = parseProfile(resp.body);
      const name = pf.nickname || acc.username;
      const extra = pf.points != null ? ` ${pf.points}${(!r.already && r.gained) ? '+' + r.gained : ''}` : '';
      if (r.already) out.push(`「${name}」重复签到${extra}`);
      else if (r.ok) out.push(`「${name}」签到成功${extra}`);
      else out.push(`「${name}」签到失败 ${r.msg}`);

      w.meta = { cookie: cookieStr(w.jar), display: name, points: pf.points };
    } catch (e) {
      out.push(`「${acc.username}」${fmtErr(e)}`);
    }
  }
  $.msg('RE0签到', '', out.join('\n'));
})()
  .catch(e => { $.logErr(e); $.msg('RE0签到', '❌ 执行异常', fmtErr(e)); })
  .finally(() => $.done({}));
