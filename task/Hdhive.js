/*
------------------------------------------
@Author: 7452323
@Github: https://github.com/7452323/QuantumultX
@Description: RE0(影巢) 签到脚本 — 每日签到 / 赌狗签到 双模式（每天二选一）
@Update: 2026.10.03
------------------------------------------

# Surge
[Script]
RE0签到 = type=cron, cronexp="20 0 * * *", script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, argument="re0_accounts={{{RE0账号}}},re0_mode={{{签到模式}}}"
RE0Cookie = type=http-request, pattern=^https?:\/\/re0\.me, script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[MITM]
hostname = %APPEND% re0.me

# Loon
[Script]
http-request ^https?:\/\/re0\.me script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=RE0Cookie, require-body=false
cron "20 0 * * *" script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, argument="re0_accounts=${re0_accounts},re0_mode=${re0_mode}", tag=RE0签到

[MITM]
hostname = re0.me

# QuantumultX
[task_local]
20 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=RE0签到, enabled=true

[rewrite_local]
^https?:\/\/re0\.me url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[MITM]
hostname = re0.me

变量: re0_accounts / re0_mode
格式: user#pass （多账号用 & 分隔）
模式: re0_mode=normal 每日签到（默认）/ gambler 赌狗签到
BoxJS: re0_accounts, re0_mode

签到协议: Next.js Server Action（免 X-HDH 签名），body 均为 [true]
每日签到: POST /manager/account，action 藏在 manager layout chunk
赌狗签到: POST /，action 藏在首页 (app) layout chunk（抓包 2026-10-02）
action 自愈: 内置默认 id，失效时自动从 chunk 扫描刷新并缓存
*/

const scriptName = 'RE0签到';
const ckName = 're0_accounts';

/* 模块参数优先（Surge/Loon 的 argument 值走 $argument），没给才用持久化存储 */
const BLANK = ['--', '-', 'none', 'null', '无', '空'];
function argValue(key) {
  let v = '';
  if (typeof $argument === 'string' && $argument) {
    // 在 & 或 , 后面跟着新参数名时才断开；值里的 &（多账号）和普通逗号不会被切碎
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

// ============ chavyleung's Env.js ============
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;"POST"===e&&(s=this.post);const i=new Promise(((e,i)=>{s.call(this,t,((t,s,o)=>{t?i(t):e(s)}))}));return t.timeout?((t,e=1e3)=>Promise.race([t,new Promise(((t,s)=>{setTimeout((()=>{s(new Error("请求超时"))}),e)}))]))(i,t.timeout):i}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=t,this.http=this,this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null,...s){try{return JSON.stringify(t,...s)}catch{return e}}getjson(t,e){let s=e;if(this.getdata(t))try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise((e=>{this.get({url:t},((t,s,i)=>e(i)))}))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),o=JSON.stringify(this.data);s?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(e,o):this.fs.writeFileSync(t,o)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return s;return o}lodash_set(t,e,s){return Object(t)!==t||(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce(((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{}),t)[e[e.length-1]]=s),t}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),o=s?this.getval(s):"";if(o)try{const t=JSON.parse(o);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(e),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,o,t),s=this.setval(JSON.stringify(e),i)}catch(e){const r={};this.lodash_set(r,o,t),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":const s=require("iconv-lite");this.initGotEnv(t),this.got(t).then((t=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:i,response:o}=t;e(i,o,o&&s.decode(o.rawBody,this.encoding))}));break}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t);const{url:o,...r}=t;this.got[s](o,r).then((t=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:s,response:o}=t;e(s,o,o&&i.decode(o.rawBody,this.encoding))}));break}}queryStr(t){let e="";for(const s in t){let i=t[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),e+=`${s}=${i}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",i="",o={}){if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,i,o);break;case"Quantumult X":$notify(e,s,i,o);break;case"Node.js":break}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t],console.log(t.map((t=>t??String(t))).join(this.logSeparator)))}logErr(t,e){this.log("",`❗️${this.name}, 错误!`,e,t)}wait(t){return new Promise((e=>setTimeout(e,t)))}done(t={}){const e=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${e} 秒`),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":break}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.cookie&&void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar)))}}(t,e)}

const $ = new Env(scriptName);
const notifyMsg = [];

// ============ 常量 ============
const DEF_BASE = 'https://re0.me';
const DEF_LOGIN_ACTION = '60fa5517c023301ab84757ba19fd91f0ef5cc482dd';   // createServerReference(...,"login")
const DEF_CHECKIN_ACTION = '4004fe56299e6451fc007a19f6df5f592551ab9c78'; // 每日签到：manager layout chunk 的 checkIn
const DEF_GAMBLER_ACTION = '409c3461f006f9de5e010af69e072690dd8b736acd'; // 赌狗签到：首页 (app) layout chunk 的 checkIn，抓包 2026-10-02
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
const cacheLoginKey = 're0_cache_login_action';
const cacheCheckinKey = 're0_cache_checkin_action';
const cacheGamblerKey = 're0_cache_gambler_action';
const WANT_COOKIES = ['token', 'refresh_token', 'csrf_access_token', 'csrfaccesstoken', 'hdh_uid', 'hdh_sa_token'];

// ============ 配置 ============
function getConfig() {
  const modeRaw = (argValue('re0_mode') || $.getdata('re0_mode') || 'normal').toLowerCase();
  return {
    base_url: (argValue('re0_base_url') || $.getdata('re0_base_url') || DEF_BASE).replace(/\/+$/, ''),
    accounts: argValue('re0_accounts') || $.getdata(ckName) || '',
    cookie: argValue('re0_cookie') || $.getdata('re0_cookie') || '',
    mode: /gambl|赌狗|^gg$/.test(modeRaw) ? 'gambler' : 'normal',
    login_action: argValue('re0_login_action') || '',
    checkin_action: argValue('re0_checkin_action') || '',
    gambler_action: argValue('re0_gambler_action') || '',
  };
}

// ============ 工具 ============
function safeName(n) { return (n || 'default').replace(/[^a-zA-Z0-9_.-]/g, '_'); }
function b64(s) {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  if (typeof btoa !== 'undefined') return btoa(unescape(encodeURIComponent(s)));
  return s;
}
function fmtErr(e) { return (e && e.message) ? e.message : String(e); }
function tryJson(s) { try { return JSON.parse(s); } catch { return null; } }
function cut(s, n = 400) { return (s || '').slice(0, n).replace(/\n/g, ' '); }

// ============ Cookie ============
function parseCookiesToMap(str) {
  const m = {};
  (str || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) m[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
  return m;
}
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

// ============ HTTP请求（自带 cookie 桶，Set-Cookie 自动并入） ============
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
  constructor(base, username, password, cookie, ids, mode) {
    this.base = base;
    this.username = username;
    this.password = password;
    this.cookie = cookie || '';
    this.jar = parseCookiesToMap(cookie);
    this.ids = ids || {};
    this.mode = mode === 'gambler' ? 'gambler' : 'normal';
    this.tag = safeName(username);
  }
  getMeta() { return $.getjson(`re0_meta_${this.tag}`, {}) || {}; }
  saveMeta(m) { $.setdata(JSON.stringify(m), `re0_meta_${this.tag}`); }

  async req(method, path, { headers = {}, body = '', accept } = {}) {
    const h = { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9', ...headers };
    if (accept) h['Accept'] = accept;
    if (Object.keys(this.jar).length) h['Cookie'] = cookieString(this.jar);
    if (body !== '') h['Content-Type'] = h['Content-Type'] || 'text/plain;charset=UTF-8';
    const r = await httpReq({ url: this.base + path, headers: h, body }, method);
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

  // 登录（server action，免 X-HDH）
  async login() {
    const action = this.ids.login;
    if (!action) throw new Error('未取得 login action');
    await this.get('/login?redirect=/');   // 绑定 hdh_sa_token
    const payload = JSON.stringify([{ username: this.username, password: b64(this.password), password_transport: 'base64' }, '/']);
    const r = await this.post('/login?redirect=/', payload, action);
    const hasToken = !!this.jar['token'];
    const js = tryJson(r.body);
    if (js && js.code === 'action_token_required') throw new Error(`登录需先绑定（GET /login），code=${js.code}`);
    if (!hasToken) {
      const hkeys = Object.keys(r.headers || {});
      let raw = '';
      for (const k of hkeys) { if (k.toLowerCase() === 'set-cookie') raw += String(r.headers[k]); }
      const got = WANT_COOKIES.filter(n => raw.includes(n + '=')).join(',');
      throw new Error(`登录未返回 token：HTTP ${r.status} | set-cookie含[${got || '无'}] | 响应头[${hkeys.join(',')}] | ${cut(r.body)}`);
    }
    const meta = this.getMeta(); meta.cookie = this.cookieNow(); this.saveMeta(meta);
    return r;
  }

  // 签到：normal 走 /manager/account，gambler 走 /
  async checkIn() {
    if (this.mode === 'gambler') {
      const action = this.ids.gambler;
      if (!action) throw new Error('未取得 gambler action');
      await this.get('/', 'text/html');
      const r = await this.post('/', '[true]', action);
      return { http: r.status, body: r.body };
    }
    const action = this.ids.checkin;
    if (!action) throw new Error('未取得 checkIn action');
    await this.get('/manager/account', 'text/x-component');
    const r = await this.post('/manager/account', '[true]', action);
    return { http: r.status, body: r.body };
  }

  // 账号资料（从签到响应 RSC 抠昵称/积分/连续天数）
  parseProfile(rsc) {
    const o = {};
    const t = (rsc || '').replace(/\\"/g, '"');   // flight 数据可能是转义的，先还原
    let m = t.match(/"currentUser":\{"id":\d+,"nickname":"([^"]*)"/);
    if (m) o.nickname = m[1];
    m = t.match(/"user_meta":\{"points":(\d+),"signin_days_total":(\d+)/); if (m) { o.points = +m[1]; o.days = +m[2]; }
    return o;
  }
}

// ============ 结果解析（RSC / JSON） ============
function analyzeCheckin(resp) {
  const raw = (resp && resp.body) || '';
  const body = raw.replace(/\\"/g, '"');   // flight action 结果行可能是转义的，先还原；纯 JSON 无反斜杠不受影响
  let j = tryJson(raw) || tryJson(body);
  if (!j) {
    // Next.js RSC 流里 action 结果行形如：\n1:{"data":...}\n 或 1:{"error":{...}}
    const m = body.match(/^1:(\{.*\})$/m);
    if (m) j = tryJson(m[1]);
  }
  const p = (j && j.response) || j || {};   // action 结果包在 {"response":{...}} 里
  const err = p.error || null;
  let msg = p.message || (err && err.message) || '';
  let desc = p.description || (err && err.description) || '';
  let code = p.code || (err && err.code) || '';
  if (!j) {
    // 实在解析不出结构时才全文兜底（description 不兜底：页面 meta 里也有 description，会污染）
    msg = msg || (body.match(/"message":"([^"]*)"/) || [])[1] || '';
    code = code || (body.match(/"code":"([^"]*)"/) || [])[1] || '';
  }
  const success = !!((p.success === true) || (p.data && p.data.success === true));
  const text = (msg + ' ' + desc).trim();
  const isAlready = /已签到|签到过|明日再来|明天再来/.test(text);
  const isOk = success || /签到成功|成功/.test(text) || /^2/.test(String(resp.http));
  return { ok: isOk || isAlready, isAlready, message: text || ('HTTP ' + resp.http), code };
}

// ============ Action id 发现 ============
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
  const html = await fetchText(base, '/manager/account', { accept: 'text/html', cookie });
  const c = chunkUrlFromHtml(html, '/_next/static/chunks/app/manager/layout-');
  if (!c) return '';
  const js = await fetchText(base, c);
  return scanActionId(js, 'checkIn');
}
async function discoverGamblerAction(base) {
  // 赌狗签到 action 藏在首页 (app) layout chunk 里，名同样叫 checkIn
  const html = await fetchText(base, '/');
  let c = chunkUrlFromHtml(html, 'app/\\(app\\)/layout-');
  if (!c) return '';
  c = c.replace(/\\+$/, '');   // 去掉转义带来的尾部反斜杠
  if (c.charAt(0) !== '/') c = '/_next/' + c.replace(/^\/+/, '');   // 首页里是相对路径 static/chunks/...
  const js = await fetchText(base, c);
  return scanActionId(js, 'checkIn');
}

// ============ MITM采集 ============
async function captureCookie() {
  try {
    const h = ($request && $request.headers) || {};
    const ck = h['Cookie'] || h['cookie'] || '';
    if (!ck) return;
    const m = parseCookiesToMap(ck);
    if (!m['token']) return;   // 只要带 token 的完整登录态
    const old = $.getdata('re0_cookie') || '';
    if (old !== ck) {
      $.setdata(ck, 're0_cookie');
      $.msg(scriptName, 'Cookie采集成功', '');
    }
  } catch (e) { $.logErr(e); }
}

// ============ 主流程 ============
!(async () => {
  if (typeof $request !== 'undefined') {
    await captureCookie();
    return;
  }

  const CONFIG = getConfig();
  const mode = CONFIG.mode;
  const modeName = mode === 'gambler' ? '赌狗签到' : '每日签到';
  const modeIcon = mode === 'gambler' ? '🎲' : '✅';

  const accounts = [];
  CONFIG.accounts.split('&').forEach(item => {
    item = item.trim(); if (!item) return;
    const p = item.split('#');
    if (p.length >= 2) accounts.push({ username: p[0].trim(), password: p[1].trim(), cookie: p[2] ? p[2].trim() : '' });
  });
  if (!accounts.length && CONFIG.cookie) accounts.push({ username: 'cookie', password: '', cookie: CONFIG.cookie });
  if (!accounts.length) {
    $.msg(scriptName, '❌ 未配置账号', '请填入 re0_accounts: user#pass&user2#pass2');
    return;
  }
  $.log(`[RE0] ${modeName}模式，共${accounts.length}个账号`);

  const ids = {
    login: CONFIG.login_action || $.getdata(cacheLoginKey) || DEF_LOGIN_ACTION,
    checkin: CONFIG.checkin_action || $.getdata(cacheCheckinKey) || DEF_CHECKIN_ACTION,
    gambler: CONFIG.gambler_action || $.getdata(cacheGamblerKey) || DEF_GAMBLER_ACTION,
  };

  for (const acc of accounts) {
    try {
      const w = new Re0Worker(CONFIG.base_url, acc.username, acc.password, acc.cookie || '', ids, mode);
      // 保证登录态（密码优先自动登录；action 失效则现场扫描重试一次）
      if (acc.password) {
        $.log(`[RE0] ${acc.username} 自动登录...`);
        try {
          await w.login();
        } catch (e) {
          if (!/action|Action/.test(fmtErr(e))) throw e;
          const nid = await discoverLoginAction(CONFIG.base_url).catch(() => '');
          if (!nid) throw e;
          $.log(`[RE0] login action 已刷新: ${nid}`);
          ids.login = nid; $.setdata(nid, cacheLoginKey);
          w.ids.login = nid;
          await w.login();
        }
      } else if (!w.jar['token']) {
        throw new Error('无 token：请配置账号密码，或先抓包配置 re0_cookie');
      } else {
        $.log(`[RE0] ${acc.username} 使用已有 Cookie`);
      }

      // 登录后自动校准签到 action（未手动配置且未缓存过）
      if (mode === 'gambler') {
        if (!CONFIG.gambler_action && !$.getdata(cacheGamblerKey)) {
          try {
            const id = await discoverGamblerAction(CONFIG.base_url);
            if (id) { ids.gambler = id; $.setdata(id, cacheGamblerKey); $.log(`[RE0] gambler action 已校准: ${id}`); }
          } catch (e) { $.log(`[RE0] gambler action 扫描失败: ${fmtErr(e)}`); }
        }
      } else if (!CONFIG.checkin_action && !$.getdata(cacheCheckinKey)) {
        try {
          const id = await discoverCheckinAction(CONFIG.base_url, w.cookieNow());
          if (id) { ids.checkin = id; $.setdata(id, cacheCheckinKey); }
        } catch (e) { $.log(`[RE0] checkin action 扫描失败: ${fmtErr(e)}`); }
      }

      $.log(`[RE0] ${acc.username} 执行${modeName}...`);
      let resp = await w.checkIn();
      let r = analyzeCheckin(resp);
      // 签到 action 疑似失效 → 重新扫描后重试一次
      const manualAction = mode === 'gambler' ? CONFIG.gambler_action : CONFIG.checkin_action;
      if (!r.isAlready && /action|Action|未知/.test(r.message + ' ' + (r.code || '')) && !manualAction) {
        try {
          const id = mode === 'gambler' ? await discoverGamblerAction(CONFIG.base_url) : await discoverCheckinAction(CONFIG.base_url, w.cookieNow());
          const cur = mode === 'gambler' ? ids.gambler : ids.checkin;
          if (id && id !== cur) {
            const key = mode === 'gambler' ? cacheGamblerKey : cacheCheckinKey;
            if (mode === 'gambler') { ids.gambler = id; w.ids.gambler = id; } else { ids.checkin = id; w.ids.checkin = id; }
            $.setdata(id, key);
            $.log(`[RE0] ${modeName} action 已刷新: ${id}`);
            resp = await w.checkIn();
            r = analyzeCheckin(resp);
          }
        } catch (e2) { $.log(`[RE0] 重扫 action 失败: ${fmtErr(e2)}`); }
      }

      // 真实用户名：优先站内昵称，回退登录账号
      const pf = w.parseProfile(resp.body || '');
      const nickname = pf.nickname || acc.username;
      const extra = (pf.points != null ? ` ｜ 积分 ${pf.points}${pf.days != null ? ' / 连续 ' + pf.days + ' 天' : ''}` : '');

      // 持久化 Cookie（供下次复用 / 展示）
      const meta = w.getMeta(); meta.cookie = w.cookieNow(); meta.display = nickname; meta.points = pf.points; w.saveMeta(meta);

      if (r.isAlready) notifyMsg.push(`「${nickname}」⏭️ 今日已签到${extra}`);
      else if (r.ok) notifyMsg.push(`「${nickname}」${modeIcon} ${r.message || (modeName + '成功')}${extra}`);
      else notifyMsg.push(`「${nickname}」❌ ${modeName}失败：${r.message || ''}`);
    } catch (e) {
      notifyMsg.push(`「${acc.username}」执行失败: ${fmtErr(e)}`);
    }
  }

  $.msg(scriptName, '', notifyMsg.join('\n'));
})()
.catch((e) => { $.logErr(e); $.msg(scriptName, '❌ 执行异常', e.message || e); })
.finally(() => { $.done({}); });
