/*
------------------------------------------
@Author: 7452323
@Github: https://github.com/7452323/QuantumultX
@Description: RE0影巢 签到脚本（每日签到 / 赌狗签到）
@Update: 2026.10.03
------------------------------------------

# Surge
[Script]
cron "20 0 * * *" script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, timeout=60, tag=RE0签到
http-request ^https?:\/\/re0\.me\/ script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, requires-body=false, timeout=10, tag=RE0Cookie

[MITM]
hostname = re0.me

# Loon
[Script]
cron "20 0 * * *" script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, timeout=60, tag=RE0签到
http-request ^https?:\/\/re0\.me\/ script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, requires-body=false, timeout=10, tag=RE0Cookie

[MITM]
hostname = re0.me

# QuantumultX
[task_local]
20 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js, tag=RE0签到, enabled=true

[rewrite_local]
^https?:\/\/re0\.me\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Hdhive.js

[MITM]
hostname = re0.me

变量: re0_accounts
格式: user#pass（多账号用 & 分隔）
BoxJS: re0_accounts / re0_cookie / re0_mode

*/

const scriptName = 'RE0签到';
const ckName = 're0_accounts';

/* 模块参数优先（Surge/Loon 的 argument 走 $argument），没给才用持久化存储 */
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

// ============ chavyleung's Env.js ============
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;"POST"===e&&(s=this.post);const i=new Promise(((e,i)=>{s.call(this,t,((t,s,o)=>{t?i(t):e(s)}))}));return t.timeout?((t,e=1e3)=>Promise.race([t,new Promise(((t,s)=>{setTimeout((()=>{s(new Error("请求超时"))}),e)}))]))(i,t.timeout):i}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=t,this.http=this,this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null,...s){try{return JSON.stringify(t,...s)}catch{return e}}getjson(t,e){let s=e;if(this.getdata(t))try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise((e=>{this.get({url:t},((t,s,i)=>e(i)))}))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),o=JSON.stringify(this.data);s?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(e,o):this.fs.writeFileSync(t,o)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return s;return o}lodash_set(t,e,s){return Object(t)!==t||(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce(((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{}),t)[e[e.length-1]]=s),t}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),o=s?this.getval(s):"";if(o)try{const t=JSON.parse(o);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(e),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,o,t),s=this.setval(JSON.stringify(e),i)}catch(e){const r={};this.lodash_set(r,o,t),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":const s=require("iconv-lite");this.initGotEnv(t),this.got(t).then((t=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:i,response:o}=t;e(i,o,o&&s.decode(o.rawBody,this.encoding))}));break}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t);const{url:o,...r}=t;this.got[s](o,r).then((t=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:s,response:o}=t;e(s,o,o&&i.decode(o.rawBody,this.encoding))}));break}}queryStr(t){let e="";for(const s in t){let i=t[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),e+=`${s}=${i}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",i="",o={}){if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,i,o);break;case"Quantumult X":$notify(e,s,i,o);break;case"Node.js":break}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t],console.log(t.map((t=>t??String(t))).join(this.logSeparator)))}logErr(t,e){this.log("",`❗️${this.name}, 错误!`,e,t)}wait(t){return new Promise((e=>setTimeout(e,t)))}done(t={}){const e=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${e} 秒`),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":break}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.cookie&&void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar)))}}(t,e)}

const $ = new Env(scriptName);

// ============ 常量 ============
const BASE = 'https://re0.me';
/* cf_clearance 与 UA 绑定：抓 Cookie 时脚本会把浏览器 UA 记到 re0_ua，这里只是兜底 */
const UA_DEFAULT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1';
let UA = UA_DEFAULT;
const KEEP = ['token', 'refresh_token', 'csrf_access_token', 'hdh_uid', 'hdh_sa_token', 'cf_clearance'];

/* 每日签到和赌狗签到是同一个 Server Action，靠请求体区分：每日 [false] / 赌狗 [true] */
const ACTION_DEFAULT = {
  login: '6014e85b3c42c65c13a43120e9713c84ff6103b035',
  checkin: '409c3461f006f9de5e010af69e072690dd8b736acd',
};
const ACTION_CACHE = { login: 're0_action_login', checkin: 're0_action_checkin' };
/* action 自愈用的页面与导出函数名（随站点构建变化） */
const ACTION_SOURCE = {
  login: { page: '/login', fn: 'login' },
  checkin: { page: '/', fn: 'checkIn' },
};
const CF_HINT = 'Cloudflare 拦截：cf_clearance 绑出网 IP + UA，请让脚本与抓 Cookie 的浏览器走同一节点（站点常态屏蔽大陆 IP）';
/* 本次运行的出口 IP（cf_clearance 绑定对象之一，报错时带上便于对比） */
let CUR_IP = '';
function cfHint(status) {
  return `Cloudflare 拦截（HTTP ${status}${CUR_IP ? '｜出口 IP ' + CUR_IP : ''}）：cf_clearance 绑出网 IP + UA，请让脚本与抓 Cookie 的浏览器走同一节点（站点常态屏蔽大陆 IP）`;
}

// ============ 工具 ============
function fmtErr(e) { return (e && e.message) ? e.message : String(e); }
function tryJson(s) { try { return JSON.parse(s); } catch (e) { return null; } }
function cut(s, n = 180) { return (s || '').slice(0, n).replace(/\s+/g, ' '); }
function b64(s) {
  if (typeof Buffer !== 'undefined') return Buffer.from(s, 'utf8').toString('base64');
  return btoa(unescape(encodeURIComponent(s)));
}
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
/* 有 token 且未过期才算有效 */
function validCookie(str) {
  const m = cookieMap(str);
  return (m.token && !tokenExpired(m.token)) ? m : null;
}

// ============ HTTP（cookie 桶随响应自动更新） ============
function http(opts, method = 'GET') {
  return new Promise((resolve, reject) => {
    const done = (err, status, headers, body) => {
      if (err) return reject(new Error(fmtErr(err)));
      const h = headers || {};
      const cf = Object.keys(h).some(k => k.toLowerCase() === 'cf-mitigated')
        || /Just a moment|cf-challenge|Attention Required/i.test(body || '');
      if (cf) return reject(new Error(cfHint(status)));
      resolve({ status, headers: h, body: body || '' });
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
/* 出口 IP 自检：走 re0.me 自己的 /cdn-cgi/trace（同一域名 → 同一条线路/节点，不受 CF 挑战），
   用来确认脚本出网 IP 是否与抓 Cookie 的浏览器一致 */
async function egressIP() {
  try {
    const r = await http({ url: BASE + '/cdn-cgi/trace', headers: { 'User-Agent': UA, 'Accept': 'text/plain' } });
    const m = (r.body || '').match(/^ip=(.+)$/m);
    return m ? m[1].trim() : '';
  } catch (e) { return ''; }
}

// ============ 账号 ============
class Re0 {
  constructor(account, ids, mode) {
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
    const h = { 'User-Agent': UA, ...headers };
    if (Object.keys(this.jar).length) h['Cookie'] = cookieStr(this.jar);
    if (body) h['Content-Type'] = 'text/plain;charset=UTF-8';
    const r = await http({ url: BASE + path, headers: h, body }, method);
    for (const k of Object.keys(r.headers)) {
      if (k.toLowerCase() === 'set-cookie') { mergeSetCookie(this.jar, r.headers[k]); break; }
    }
    return r;
  }
  /* 普通页面请求，顺带把 hdh_sa_token 拿到手 */
  get(path, accept = 'text/html') {
    const h = accept === 'text/html' ? {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin', 'Sec-Fetch-User': '?1',
    } : {
      'Accept': accept, 'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
      'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin',
    };
    return this.req('GET', path, h);
  }
  /* Next.js Server Action */
  post(path, action, body = '[false]') {
    return this.req('POST', path, {
      'Accept': 'text/x-component',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
      'Origin': BASE, 'Referer': BASE + path, 'Next-Action': action,
      'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin',
    }, body);
  }

  async login() {
    await this.get('/login');   // 先绑 hdh_sa_token，否则 action_token_required
    const body = JSON.stringify([{ username: this.user, password: b64(this.pass), password_transport: 'base64' }, '/']);
    const r = await this.post('/login', this.ids.login, body);
    if (!this.jar.token) throw new Error(`登录失败（HTTP ${r.status}）：${cut(r.body) || '空响应'}`);
    $.log(`[RE0] ${this.user} 登录成功`);
  }

  async checkIn() {
    const gambler = this.mode === 'gambler';
    await this.get('/');                                  // 签到前刷新 hdh_sa_token
    return this.post('/', this.ids.checkin, gambler ? '[true]' : '[false]');
  }
}

// ============ 响应解析 ============
/* Server Action 返回 RSC 流，结果行形如：
   1:{"response":{"success":true,"message":"签到成功，获得 8 积分","code":"200"}}
   1:{"error":{"success":false,"message":"签到失败","description":"你已经签到过了，明天再来吧","code":"400"}} */
function parseResult(resp) {
  const raw = resp.body || '';
  const t = raw.replace(/\\"/g, '"');
  let obj = null;
  for (const line of t.split('\n')) {
    const m = line.match(/^\d+:(\{.*\})$/);
    if (!m) continue;
    const o = tryJson(m[1]);
    if (!o) continue;
    const r = o.response || o.error;
    if (r && (r.message || r.description)) { obj = o; break; }
  }
  const r = (obj && (obj.response || obj.error)) || {};
  const text = ((r.message || '') + ' ' + (r.description || '')).trim();
  const already = /已签到|签到过|明天再来|明日再来/.test(text);
  const ok = r.success === true || /签到成功/.test(text);
  return {
    ok: ok || already,
    already,
    msg: text || `HTTP ${resp.status}`,
    gained: (text.match(/获得\s*(\d+)/) || [])[1],
  };
}
function parseProfile(body) {
  const t = (body || '').replace(/\\"/g, '"');
  const o = {};
  const n = t.match(/"currentUser":\{[^}]*?"nickname":"([^"]*)"/);
  if (n) o.nickname = n[1];
  const m = t.match(/"user_meta":\{"points":(\d+),"signin_days_total":(\d+)/);
  if (m) { o.points = +m[1]; o.days = +m[2]; }
  return o;
}

// ============ action 自愈：从页面 chunk 里扫 createServerReference ============
function chunkFrom(html, page) {
  const m = (html || '').match(/["']([^"']*_next\/static\/chunks\/[^"']*app\/[^"']*\.js)["']/g);
  if (!m) return [];
  const out = [];
  for (const raw of m) {
    const c = raw.replace(/^["']|["']$/g, '');
    if (page === '/login' ? !/login/i.test(c) : /login/i.test(c)) continue;
    out.push(c);
  }
  return out;
}
function actionFrom(js, fn) {
  const re = /createServerReference\)?\s*\(\s*["']([0-9a-f]{20,})["'][^)]*?["']([A-Za-z_$][\w$]*)["']/g;
  let m, fallback = '';
  while ((m = re.exec(js || ''))) {
    if (!fallback) fallback = m[1];
    if (fn && m[2] === fn) return m[1];
  }
  return fn ? '' : fallback;
}
async function discover(kind, jar) {
  const s = ACTION_SOURCE[kind];
  const h = {
    'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
    'Sec-Fetch-Dest': 'document', 'Sec-Fetch-Mode': 'navigate', 'Sec-Fetch-Site': 'same-origin',
  };
  if (Object.keys(jar).length) h['Cookie'] = cookieStr(jar);
  const page = await http({ url: BASE + s.page, headers: h });
  for (const c of chunkFrom(page.body, s.page)) {
    try {
      const js = await http({ url: BASE + c, headers: h });
      const id = actionFrom(js.body, s.fn);
      if (id) return id;
    } catch (e) { /* 单个 chunk 失败不影响整体 */ }
  }
  return '';
}

// ============ Cookie 采集（rewrite） ============
function captureCookie() {
  const h = $request.headers || {};
  const ck = h['Cookie'] || h['cookie'] || '';
  const m = cookieMap(ck);
  if (!m.token) return;                                  // 非登录态，静默
  if (tokenExpired(m.token)) {
    if ($.getdata('re0_cookie_bad') !== ck) {            // 同一份过期 Cookie 只提示一次
      $.setdata(ck, 're0_cookie_bad');
      $.msg(scriptName, 'Cookie已过期', '请在浏览器重新登录 re0.me');
    }
    return;
  }
  // cf_clearance 与 UA 绑定，必须连 UA 一起存，否则定时任务必吃 403
  const ua = h['User-Agent'] || h['user-agent'] || '';
  if (ua) $.setdata(ua, 're0_ua');
  if ($.getdata('re0_cookie') === ck) return;
  $.setdata(ck, 're0_cookie');
  $.msg(scriptName, 'Cookie已抓取', '定时任务将使用免密直签');
}

// ============ 单账号执行 ============
async function runAccount(acc, ids, mode, modeName) {
  const w = new Re0(acc, ids, mode);

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
  if (!r.ok && !r.already) {
    const nid = await discover('checkin', w.jar).catch(() => '');
    if (nid && nid !== ids.checkin) {
      ids.checkin = nid; w.ids.checkin = nid;
      $.setdata(nid, ACTION_CACHE.checkin);
      $.log(`[RE0] ${modeName} action 已刷新: ${nid}`);
      resp = await w.checkIn();
      r = parseResult(resp);
    }
  }

  const pf = parseProfile(resp.body);
  const name = pf.nickname || acc.username;
  const extra = pf.points != null ? ` ${pf.points}${(!r.already && r.gained) ? '+' + r.gained : ''}` : '';
  w.meta = { cookie: cookieStr(w.jar), display: name, points: pf.points };

  if (r.already) return { ok: true, line: `「${name}」重复签到${extra}` };
  if (r.ok) return { ok: true, line: `「${name}」签到成功${extra}` };
  return { ok: false, line: `「${name}」签到失败 ${r.msg}` };
}
async function runAll(accounts, ids, mode, modeName) {
  const out = [];
  let ok = 0;
  for (const acc of accounts) {
    try {
      const r = await runAccount(acc, ids, mode, modeName);
      out.push(r.line);
      if (r.ok) ok++;
    } catch (e) {
      out.push(`「${acc.username}」${fmtErr(e)}`);
    }
  }
  return { out, ok };
}

// ============ 主流程 ============
!(async () => {
  if (typeof $request !== 'undefined' && $request) return captureCookie();

  const rawMode = String(argValue('re0_mode') || $.getdata('re0_mode') || '1').toLowerCase();
  const mode = /^(2|gambler|gg|赌狗)$/.test(rawMode) ? 'gambler' : 'normal';
  const modeName = mode === 'gambler' ? '赌狗签到' : '每日签到';

  const rawAccounts = argValue(ckName) || $.getdata(ckName) || '';
  const rawCookie = argValue('re0_cookie') || $.getdata('re0_cookie') || '';
  UA = argValue('re0_ua') || $.getdata('re0_ua') || UA_DEFAULT;
  const cfOverride = argValue('re0_cf') || $.getdata('re0_cf') || '';

  const listed = rawAccounts.split('&').map(s => s.trim()).filter(Boolean).map(item => {
    const p = item.split('#');
    return { username: p[0].trim(), password: (p[1] || '').trim() };
  });
  const gMap = validCookie(rawCookie);
  if (!gMap && !listed.length) {
    $.msg(scriptName, '❌ 未配置账号', '填 re0_accounts（user#pass），或开 Cookie 重写后浏览器打开 re0.me');
    return;
  }
  $.log(`[RE0] ${modeName}｜免密 Cookie ${gMap ? '有效' : '无'}｜账号 ${listed.length} 个`);

  /* 出口 IP 自检：cf_clearance 绑 IP，节点一变必吃 403，先把它打出来 */
  CUR_IP = await egressIP();
  const okIP = $.getdata('re0_ok_ip') || '';
  if (CUR_IP) {
    $.log(`[RE0] 出口 IP ${CUR_IP}` + (okIP && okIP !== CUR_IP ? `（上次成功 ${okIP}，节点已变 → cf_clearance 必失效）` : ''));
    $.setdata(CUR_IP, 're0_last_ip');
  }

  const ids = {
    login: $.getdata(ACTION_CACHE.login) || ACTION_DEFAULT.login,
    checkin: $.getdata(ACTION_CACHE.checkin) || ACTION_DEFAULT.checkin,
  };

  /* 账号密码回落也必须带 cf_clearance：CF 在鉴权之前就拦，光有账密必吃 403 */
  const cfOnly = cfOverride || cookieMap(rawCookie).cf_clearance || '';
  const seeded = listed.map(a => ({ ...a, cookie: cfOnly ? 'cf_clearance=' + cfOnly : '' }));

  let out, ok;
  if (gMap) {
    ({ out, ok } = await runAll([{ username: 'cookie', password: '', cookie: rawCookie }], ids, mode, modeName));
    if (!ok && seeded.length) {                          // 免密挂了（过期 / CF）→ 回落账号密码
      $.log('[RE0] 免密直签失败，回落账号密码登录');
      const r2 = await runAll(seeded, ids, mode, modeName);
      out = out.concat(r2.out); ok = r2.ok;
    }
  } else {
    ({ out, ok } = await runAll(seeded, ids, mode, modeName));
  }

  /* 两条路撞的是同一堵 CF 墙时只报一次 */
  const seen = new Set();
  const lines = out.filter(l => {
    const k = l.replace(/^「[^」]*」/, '');
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  if (ok && CUR_IP) $.setdata(CUR_IP, 're0_ok_ip');
  $.msg(scriptName, '', lines.join('\n'));
})()
  .catch(e => { $.logErr(e); $.msg(scriptName, '❌ 执行异常', fmtErr(e)); })
  .finally(() => $.done({}));
