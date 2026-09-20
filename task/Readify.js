/*
------------------------------------------
@Author: 7452323
@Github: https://github.com/7452323/QuantumultX
@Description: Readify深读 签到脚本
@Update: 2026.09.20
------------------------------------------

[task_local]
0 8 * * ? https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Readify.js, tag=Readify深读, enabled=true

[rewrite_local]
^https:\/\/readifyapp\.voiceclub\.cn\/api url script-an-header-echo https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Readify.js

[MITM]
hostname = readifyapp.voiceclub.cn

变量: readify_accounts
格式: email#password （多账号用 | 分隔）
BoxJS: readify_accounts

密码传输方式: SHA256哈希后发送
自动刷新token: userToken 7天过期，过期后自动用邮箱密码重新登录
*/

const scriptName = 'Readify深读';
const ckName = 'readify_accounts';

// ============ chavyleung's Env.js ============
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;"POST"===e&&(s=this.post);const i=new Promise(((e,i)=>{s.call(this,t,((t,s,o)=>{t?i(t):e(s)}))}));return t.timeout?((t,e=1e3)=>Promise.race([t,new Promise(((t,s)=>{setTimeout((()=>{s(new Error("请求超时"))}),e)}))]))(i,t.timeout):i}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.logLevels={debug:0,info:1,warn:2,error:3},this.logLevelPrefixs={debug:"[DEBUG] ",info:"[INFO] ",warn:"[WARN] ",error:"[ERROR] "},this.logLevel="info",this.name=t,this.http=this,this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null,...s){try{return JSON.stringify(t,...s)}catch{return e}}getjson(t,e){let s=e;if(this.getdata(t))try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise((e=>{this.get({url:t},((t,s,i)=>e(i)))}))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e);if(!s&&!i)return{};{const i=s?t:e;try{return JSON.parse(this.fs.readFileSync(i))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),i=!s&&this.fs.existsSync(e),o=JSON.stringify(this.data);s?this.fs.writeFileSync(t,o):i?this.fs.writeFileSync(e,o):this.fs.writeFileSync(t,o)}}lodash_get(t,e,s){const i=e.replace(/\[(\d+)\]/g,".$1").split(".");let o=t;for(const t of i)if(o=Object(o)[t],void 0===o)return s;return o}lodash_set(t,e,s){return Object(t)!==t||(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce(((t,s,i)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[i+1])>>0==+e[i+1]?[]:{}),t)[e[e.length-1]]=s),t}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,i]=/^@(.*?)\.(.*?)$/.exec(t),o=s?this.getval(s):"";if(o)try{const t=JSON.parse(o);e=t?this.lodash_get(t,i,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,i,o]=/^@(.*?)\.(.*?)$/.exec(e),r=this.getval(i),a=i?"null"===r?null:r||"{}":"{}";try{const e=JSON.parse(a);this.lodash_set(e,o,t),s=this.setval(JSON.stringify(e),i)}catch(e){const r={};this.lodash_set(r,o,t),s=this.setval(JSON.stringify(r),i)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":const s=require("iconv-lite");this.initGotEnv(t),this.got(t).then((t=>{const{statusCode:i,statusCode:o,headers:r,rawBody:a}=t,n=s.decode(a,this.encoding);e(null,{status:i,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:i,response:o}=t;e(i,o,o&&s.decode(o.rawBody,this.encoding))}));break}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),void 0===t.followRedirect||t.followRedirect||((this.isSurge()||this.isLoon())&&(t["auto-redirect"]=!1),this.isQuanX()&&t.opts?t.opts.redirection=!1:t.opts={redirection:!1}),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,((t,s,i)=>{!t&&s&&(s.body=i,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,i)}));break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then((t=>{const{statusCode:s,statusCode:i,headers:o,body:r}=t;e(null,{status:s,statusCode:i,headers:o,body:r},r)}),(t=>e(t&&t.error||"UndefinedError")));break;case"Node.js":let i=require("iconv-lite");this.initGotEnv(t);const{url:o,...r}=t;this.got[s](o,r).then((t=>{const{statusCode:s,statusCode:o,headers:r,rawBody:a}=t,n=i.decode(a,this.encoding);e(null,{status:s,statusCode:o,headers:r,rawBody:a,body:n},n)}),(t=>{const{message:s,response:o}=t;e(s,o,o&&i.decode(o.rawBody,this.encoding))}));break}}queryStr(t){let e="";for(const s in t){let i=t[s];null!=i&&""!==i&&("object"==typeof i&&(i=JSON.stringify(i)),e+=`${s}=${i}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",i="",o={}){if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,i,o);break;case"Quantumult X":$notify(e,s,i,o);break;case"Node.js":break}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),i&&t.push(i),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t],console.log(t.map((t=>t??String(t))).join(this.logSeparator)))}logErr(t,e){this.log("",`❗️${this.name}, 错误!`,e,t)}wait(t){return new Promise((e=>setTimeout(e,t)))}done(t={}){const e=((new Date).getTime()-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${e} 秒`),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":break}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.cookie&&void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar)))}}(t,e)}

const $ = new Env(scriptName);
const notifyMsg = [];
const API_BASE = 'https://readifyapp.voiceclub.cn';
const CAMPAIGN_ID = 'reading-streak-7d-202607';
const TOKEN_KEY = 'readify_token_store';

// ============ SHA256 ============
function sha256(message) {
  // Node.js
  if (typeof require === 'function') {
    try {
      const crypto = require('crypto');
      return crypto.createHash('sha256').update(message).digest('hex');
    } catch (e) {}
  }
  // QX/Surge: 用标准SHA-256纯JS实现
  return sha256Pure(message);
}

function sha256Pure(message) {
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  function rr(x,n){return(x>>>n)|(x<<(32-n));}
  const bytes=[];
  for(let i=0;i<message.length;i++)bytes.push(message.charCodeAt(i)&0xff);
  bytes.push(0x80);
  while(bytes.length%64!==56)bytes.push(0);
  const bitLen=message.length*8;
  bytes.push(0,0,0,0,(bitLen>>>24)&0xff,(bitLen>>>16)&0xff,(bitLen>>>8)&0xff,bitLen&0xff);
  const hash=H.slice();
  for(let blk=0;blk<bytes.length;blk+=64){
    const w=new Array(64);
    for(let i=0;i<16;i++){w[i]=(bytes[blk+i*4]<<24|bytes[blk+i*4+1]<<16|bytes[blk+i*4+2]<<8|bytes[blk+i*4+3])>>>0;}
    for(let i=16;i<64;i++){const s0=rr(w[i-15],7)^rr(w[i-15],18)^(w[i-15]>>>3);const s1=rr(w[i-2],17)^rr(w[i-2],19)^(w[i-2]>>>10);w[i]=((w[i-16]+s0+w[i-7]+s1)|0)>>>0;}
    let a=hash[0],b=hash[1],c=hash[2],d=hash[3],e=hash[4],f=hash[5],g=hash[6],h=hash[7];
    for(let i=0;i<64;i++){
      const S1=rr(e,6)^rr(e,11)^rr(e,25);const ch=(e&f)^(~e&g);const t1=((h+S1+ch+K[i]+w[i])|0)>>>0;
      const S0=rr(a,2)^rr(a,13)^rr(a,22);const maj=(a&b)^(a&c)^(b&c);const t2=((S0+maj)|0)>>>0;
      h=g;g=f;f=e;e=((d+t1)|0)>>>0;d=c;c=b;b=a;a=((t1+t2)|0)>>>0;
    }
    hash[0]=((hash[0]+a)|0)>>>0;hash[1]=((hash[1]+b)|0)>>>0;hash[2]=((hash[2]+c)|0)>>>0;hash[3]=((hash[3]+d)|0)>>>0;
    hash[4]=((hash[4]+e)|0)>>>0;hash[5]=((hash[5]+f)|0)>>>0;hash[6]=((hash[6]+g)|0)>>>0;hash[7]=((hash[7]+h)|0)>>>0;
  }
  let result='';
  for(let i=0;i<8;i++){let s=hash[i].toString(16);while(s.length<8)s='0'+s;result+=s;}
  return result;
}

// ============ JWT解码 ============
function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = payload.length % 4;
    if (pad) payload += '='.repeat(4 - pad);
    if (typeof atob === 'function') return JSON.parse(atob(payload));
    if (typeof Buffer !== 'undefined') return JSON.parse(Buffer.from(payload, 'base64').toString());
    return null;
  } catch (e) { return null; }
}

// ============ Token存储 ============
function loadTokenStore() {
  return $.getjson(TOKEN_KEY, {}) || {};
}
function saveTokenStore(store) {
  $.setdata(JSON.stringify(store), TOKEN_KEY);
}

// ============ HTTP请求 ============
function http(opts) {
  return new Promise((resolve) => {
    $.http.post(opts, (err, resp, body) => {
      if (err) {
        $.logErr(err);
        resolve({ status: 0, body: '' });
      } else {
        resolve({ status: resp.statusCode, body: body });
      }
    });
  });
}

function httpGet(opts) {
  return new Promise((resolve) => {
    $.http.get(opts, (err, resp, body) => {
      if (err) {
        $.logErr(err);
        resolve({ status: 0, body: '' });
      } else {
        resolve({ status: resp.statusCode, body: body });
      }
    });
  });
}

// ============ 登录 ============
async function login(email, password) {
  const hashedPwd = sha256(password);
  const resp = await http({
    url: `${API_BASE}/api/users/email/login`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: hashedPwd }),
  });
  const data = $.toObj(resp.body) || {};
  if (data.code === 0 && data.data && data.data.userToken) {
    $.log(`[Readify] ${email} 登录成功`);
    return data.data;
  }
  throw new Error(data.message || '登录失败');
}

// ============ 签到 ============
function baseHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'x-app-name': 'readifyai',
    'x-v': 'v1',
    'x-token': token,
  };
}

async function getStreakStatus(token) {
  const resp = await httpGet({
    url: `${API_BASE}/api/campaigns/streaks/status?campaignId=${CAMPAIGN_ID}`,
    headers: baseHeaders(token),
  });
  return $.toObj(resp.body) || {};
}

async function checkIn(token) {
  const resp = await http({
    url: `${API_BASE}/api/campaigns/streaks`,
    headers: baseHeaders(token),
    body: JSON.stringify({ campaignId: CAMPAIGN_ID }),
  });
  return $.toObj(resp.body) || {};
}

// ============ 获取有效Token ============
async function getValidToken(email, password) {
  const store = loadTokenStore();
  const cached = store[email];
  
  // 检查缓存token是否有效
  if (cached && cached.userToken) {
    const payload = decodeJWT(cached.userToken);
    if (payload && payload.exp && payload.exp * 1000 > Date.now() + 60000) {
      $.log(`[Readify] ${email} 使用缓存token`);
      return cached;
    }
  }
  
  // token过期或不存在，重新登录
  $.log(`[Readify] ${email} 重新登录获取token`);
  const data = await login(email, password);
  const newStore = { userToken: data.userToken, refreshToken: data.refreshToken, nickname: data.nickname || email };
  store[email] = newStore;
  saveTokenStore(store);
  return newStore;
}

// ============ MITM采集 ============
async function captureToken() {
  try {
    const h = $request.headers || {};
    let token;
    for (let k in h) {
      if (k.toLowerCase() === 'x-token') token = h[k];
    }
    if (token) {
      const store = loadTokenStore();
      const old = store['_captured'] || {};
      if (old.userToken !== token) {
        store['_captured'] = { userToken: token, capturedAt: Date.now() };
        saveTokenStore(store);
        $.msg(scriptName, 'Token采集成功', '');
      }
    }
  } catch (e) {
    $.logErr(e);
  }
}

// ============ 主流程 ============
!(async () => {
  if (typeof $request !== 'undefined') {
    await captureToken();
    return;
  }
  
  const accountsStr = $.getdata(ckName) || '';
  if (!accountsStr) {
    $.msg(scriptName, '❌ 未配置账号', '请在BoxJS填入 readify_accounts: email#password');
    return;
  }
  
  const accounts = accountsStr.split('|').map(s => s.trim()).filter(Boolean);
  $.log(`共${accounts.length}个账号`);
  
  for (const acc of accounts) {
    const parts = acc.split('#');
    if (parts.length < 2) {
      notifyMsg.push(`❌ 账号格式错误: ${acc}`);
      continue;
    }
    const [email, password] = parts;
    try {
      const tokenData = await getValidToken(email, password);
      const nickname = tokenData.nickname || email;
      
      // 查状态
      const status = await getStreakStatus(tokenData.userToken);
      if (status.code !== 0) {
        // token失效，强制重新登录
        $.log(`[Readify] ${email} token失效，重新登录`);
        const newData = await login(email, password);
        const store = loadTokenStore();
        store[email] = { userToken: newData.userToken, refreshToken: newData.refreshToken, nickname: newData.nickname || email };
        saveTokenStore(store);
        tokenData.userToken = newData.userToken;
        tokenData.nickname = newData.nickname || email;
      }
      
      const streakInfo = status.data || {};
      
      if (streakInfo.streakedToday) {
        notifyMsg.push(`「${nickname}」签到成功 连续${streakInfo.currentDay || 1}天`);
        continue;
      }
      
      // 签到
      const result = await checkIn(tokenData.userToken);
      const checkInData = result.data || {};
      if (result.code === 0 && (checkInData.checkInResult === 'CHECKED_IN' || checkInData.checkInResult === 'ALREADY_CHECKED_IN')) {
        notifyMsg.push(`「${nickname}」签到成功 连续${checkInData.currentDay || 1}天`);
      } else {
        notifyMsg.push(`「${nickname}」签到失败: ${result.message || 'unknown'}`);
      }
    } catch (e) {
      notifyMsg.push(`「${email}」执行失败: ${e.message || e}`);
    }
  }
  
  $.msg(scriptName, '', notifyMsg.join('\n'));
})()
.catch((e) => { $.logErr(e); $.msg(scriptName, '❌ 执行异常', e.message || e); })
.finally(() => { $.done({}); });
