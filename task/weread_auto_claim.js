/*
 * 微信读书 每日领取阅读奖励
 * 
 * ⚠️ 微信读书APP有SSL Pinning，代理无法拦截
 *    必须在浏览器中登录 weread.qq.com 触发采集
 * 
 * Cookie 变量名：weread_data (wr_vid@wr_skey 格式)
 * 多账号用 & 分隔
 * 
 * [rewrite_local]
 * ^https?:\/\/weread\.qq\.com\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/weread_auto_claim.js
 * 
 * [task_local]
 * 30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/weread_auto_claim.js, tag=微信读书(每日领奖励), enabled=true
 * 
 * [MITM]
 * hostname = weread.qq.com
 */

const WEB_API = 'https://weread.qq.com';
const KEY = 'weread_data';
const SEP = '&';

let $ = typeof $environment !== 'undefined' || typeof $task !== 'undefined' ? new Env('微信读书') : null;

// ======== Cookie 采集 ========
function handleCookie() {
  const url = $request.url || '';
  if (!url.includes('weread.qq.com')) {
    $.done();
    return;
  }
  
  const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
  if (!cookie) {
    $.done();
    return;
  }
  
  const vidMatch = cookie.match(/wr_vid=(\d+)/);
  const skeyMatch = cookie.match(/wr_skey=([^;]+)/);
  
  if (vidMatch && skeyMatch) {
    const val = vidMatch[1] + '@' + skeyMatch[1];
    let list = ($.getdata(KEY) || '').split(SEP).filter(Boolean);
    const idx = list.findIndex(x => x.startsWith(vidMatch[1] + '@'));
    if (idx >= 0) list[idx] = val;
    else list.push(val);
    $.setdata(list.join(SEP), KEY);
    $.msg($.name, `✅ Cookie已保存 (${list.length}个账号)`, `wr_vid=${vidMatch[1]}`);
  }
  $.done();
}

!(async () => {
  if (typeof $request !== 'undefined') {
    handleCookie();
    return;
  }

  // --- cron 模式 ---
  const raw = $.getdata(KEY);
  if (!raw) {
    $.msg($.name, '', '⚠️ 未获取到Cookie\n\n请用浏览器打开 weread.qq.com 登录\n登录后浏览任意页面即可自动采集\n\n🎯 失败');
    $.done();
    return;
  }

  const accounts = raw.split(SEP).filter(Boolean);
  let allBodies = [];
  let valid = 0, expired = 0;

  for (const acc of accounts) {
    const [vid, skey] = acc.split('@');
    if (!vid || !skey) continue;

    const cookie = `wr_vid=${vid}; wr_skey=${skey}`;

    // 先刷新cookie
    let newSkey = await refreshCookie(cookie, vid);
    if (newSkey) {
      skey = newSkey;
      const val = vid + '@' + skey;
      let list = ($.getdata(KEY) || '').split(SEP).filter(Boolean);
      const idx = list.findIndex(x => x.startsWith(vid + '@'));
      if (idx >= 0) list[idx] = val;
      $.setdata(list.join(SEP), KEY);
    }

    const curCookie = `wr_vid=${vid}; wr_skey=${skey}`;
    
    // 验证有效性
    const shelfRes = await httpGet(`${WEB_API}/web/shelf`, curCookie);
    if (!shelfRes.body || shelfRes.body.includes('登录')) {
      expired++;
      allBodies.push(`👤 ${vid}\n${ts()}  ❌ Cookie已过期`);
      continue;
    }

    valid++;
    const res = {};

    // 领取阅读奖励 (体验卡/书币)
    const rewardRes = await httpPost(`${WEB_API}/web/readingAward/claim`, curCookie, JSON.stringify({awardType: 1}));
    const rewardData = tryParse(rewardRes.body);
    if (rewardData?.errcode === 0) {
      res.奖励 = `+${rewardData?.data?.awardNum || 0} ${rewardData?.data?.awardType === 1 ? '体验卡' : '书币'}`;
    } else {
      res.奖励 = rewardData?.errmsg || '无奖励';
    }

    await rwait(1000, 2000);

    // 签到
    const signRes = await httpPost(`${WEB_API}/web/signIn`, curCookie, JSON.stringify({}));
    const signData = tryParse(signRes.body);
    if (signData?.errcode === 0) {
      res.签到 = `+${signData?.data?.score || 0}分`;
    } else {
      res.签到 = signData?.errmsg || '重复';
    }

    const lines = Object.entries(res).map(([k, v]) => `${ts()}  ${v.includes('❌') || v.includes('重复') ? 'ℹ️' : '✅'} ${k}: ${v}`);
    allBodies.push(`👤 ${vid}\n${lines.join('\n')}`);
  }

  let body;
  if (valid === 0 && expired > 0) {
    body = `${allBodies.join('\n\n')}\n\n🎯 凭证全部过期 ${expired}/${accounts.length}`;
  } else {
    body = `${allBodies.join('\n\n')}\n\n🎯 完成`;
  }
  $.msg($.name, '', body);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

// ======== 刷新Cookie ========
async function refreshCookie(cookie, vid) {
  const variants = [
    {rq: "%2Fweb%2Fbook%2Fread", ql: false},
    {rq: "%2Fweb%2Fbook%2Fread", ql: true},
    {rq: "%2Fweb%2Fbook%2Fread"}
  ];
  
  for (const data of variants) {
    try {
      const res = await httpPost(`${WEB_API}/web/login/renewal`, cookie, JSON.stringify(data));
      const setCookie = res.headers?.['Set-Cookie'] || res.headers?.['set-cookie'] || '';
      const skeyMatch = setCookie.match(/wr_skey=([^;]+)/);
      if (skeyMatch) return skeyMatch[1];
      // 也检查response body
      const json = tryParse(res.body);
      if (json?.errcode === 0) {
        // 可能cookie已更新在response header
        const newCookie = res.headers?.['Set-Cookie'] || res.headers?.['set-cookie'] || '';
        const newSkey = newCookie.match(/wr_skey=([^;]+)/);
        if (newSkey) return newSkey[1];
        return null; // 不需要刷新
      }
    } catch(e) {}
  }
  return null;
}

// ======== 工具函数 ========
async function httpGet(url, cookie) {
  return new Promise((resolve, reject) => {
    const opts = { 
      url, 
      headers: { 
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://weread.qq.com/'
      } 
    };
    const handler = (err, resp, body) => err ? reject(err) : resolve({ status: resp?.status || resp?.statusCode, body, headers: resp?.headers });
    if (typeof $task !== 'undefined') $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers })).catch(reject);
    else if (typeof $httpClient !== 'undefined') $httpClient.get(opts, handler);
    else reject(new Error('不支持的平台'));
  });
}

async function httpPost(url, cookie, body) {
  return new Promise((resolve, reject) => {
    const opts = { 
      url, 
      headers: { 
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://weread.qq.com/'
      },
      body
    };
    const handler = (err, resp, body) => err ? reject(err) : resolve({ status: resp?.status || resp?.statusCode, body, headers: resp?.headers });
    if (typeof $task !== 'undefined') $task.fetch({ ...opts, method: 'POST' }).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers })).catch(reject);
    else if (typeof $httpClient !== 'undefined') $httpClient.post(opts, handler);
    else reject(new Error('不支持的平台'));
  });
}

function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }
function rwait(min, max) { return $.wait(min + Math.floor(Math.random() * (max - min))); }
function ts() { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

function Env(name, opts) {
  class _env {
    constructor(n) { this.name = n; this.data = null; this.startTime = Date.now(); this.logs = []; }
    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $rocket !== 'undefined') return 'Shadowrocket';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      return 'Unknown';
    }
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
        case 'Quantumult X': $notify(s, t||'', c||''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $notification.post(s, t||'', c||''); break;
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
