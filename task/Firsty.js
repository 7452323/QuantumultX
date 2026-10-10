/*
Firsty 看广告领流量 — 一个广告 20MB
版本：1.2.0

协议（2026-10 逆向，无签名无加密）：
  GET  /api/mobile/advertisements/v2/{uid}/eligibility            查今日剩余次数
  POST /api/mobile/advertisements/v2/{uid}/custom                 创建广告 → adId
  POST /api/mobile/advertisements/v2/{uid}/custom/{adId}/complete 204, 发放 20MB
  必需头：device-info + app-version + app-build（缺任一返回"版本太低"）

两种跑法：
  [代理模式] 拦截 App 请求抠实时 token 自动刷满，并把最新 refresh token 存进本地存储
  [青龙模式] 用 refresh token 自行刷新 ID token 刷满，刷新轮换后自动落盘续用

环境变量：FIRSTY_REFRESH_TOKEN  青龙模式必填
          FIRSTY_APPCHECK       complete 必需的反作弊头(已内置兜底值, 一般不用填)
可选变量：FIRSTY_AD_WAIT_MIN/MAX 广告间随机等待秒数(默认15~45) / FIRSTY_MAX_ROUNDS 最多刷几次(默认0=刷满)

★ complete 接口必须带 x-firebase-appcheck，不带一律 401 INVALID_TOKEN（已实测）。
  该值长期有效（3 天前的旧值仍可用），每个 App 安装生成一个固定值，服务端不校验设备绑定。
  脚本内置兜底值，代理模式拦截到 complete 时会自动更新它。
  连续刷 6-9 个后可能撞 409 concurrent_limit_reached（已内置退避重试）。

[rewrite_local]
^https?:\/\/(api\.firsty\.app|mobile\.firsty\.app|35\.186\.203\.117)\/api\/mobile\/(advertisements\/v2\/[^\/]+\/eligibility|bundles\/v4\/[^\/]+\/data-bundles) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js
^https?:\/\/(api\.firsty\.app|mobile\.firsty\.app|35\.186\.203\.117)\/api\/mobile\/advertisements\/v2\/[^\/]+\/custom\/[^\/]+\/complete url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js
^https?:\/\/securetoken\.googleapis\.com\/v1\/token url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js

[task_local]
0 8,20 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js, tag=Firsty看广告, enabled=true

[MITM]
hostname = api.firsty.app, mobile.firsty.app, 35.186.203.117, securetoken.googleapis.com

----- Surge -----
[Script]
Firsty-ads = type=http-response,pattern=^https?://(api\.firsty\.app|mobile\.firsty\.app|35\.186\.203\.117)/api/mobile/(advertisements/v2/[^/]+/eligibility|bundles/v4/[^/]+/data-bundles),requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js,timeout=900
Firsty-appcheck = type=http-request,pattern=^https?://(api\.firsty\.app|mobile\.firsty\.app|35\.186\.203\.117)/api/mobile/advertisements/v2/[^/]+/custom/[^/]+/complete,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js
Firsty-token = type=http-response,pattern=^https?://securetoken\.googleapis\.com/v1/token,requires-body=1,max-size=0,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js
Firsty-cron = type=cron,cronexp="0 8,20 * * *",wakeup=true,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js,timeout=1800
[MITM]
hostname = %APPEND% api.firsty.app, mobile.firsty.app, 35.186.203.117, securetoken.googleapis.com

----- Loon -----
[Script]
http-response ^https?://(api\.firsty\.app|mobile\.firsty\.app|35\.186\.203\.117)/api/mobile/(advertisements/v2/[^/]+/eligibility|bundles/v4/[^/]+/data-bundles) script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js, requires-body=true, timeout=900, tag=Firsty刷广告
http-request ^https?://(api\.firsty\.app|mobile\.firsty\.app|35\.186\.203\.117)/api/mobile/advertisements/v2/[^/]+/custom/[^/]+/complete script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js, tag=Firsty抓appcheck
http-response ^https?://securetoken\.googleapis\.com/v1/token script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js, requires-body=true, tag=Firsty存token
cron "0 8,20 * * *" script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Firsty.js, tag=Firsty定时刷, enable=true
[MITM]
hostname = api.firsty.app, mobile.firsty.app, 35.186.203.117, securetoken.googleapis.com

----- JSBox（手动/定时运行，先在 BoxJS 或 $prefs 填 FIRSTY_REFRESH_TOKEN）-----
  本脚本已适配 JSBox：$http / $prefs / $notification 自动识别，无 $done
*/

const $ = new Env('Firsty');

const API_KEYS = [
  'AIzaSyAw4dSOEuZNgBWLAiwSAqPJ9qArvSOaZDM',
  'AIzaSyDRkti8LgrV4vLCa9lpeTIG6szb_r7YMnI',
];
const RT_KEY = 'FIRSTY_REFRESH_TOKEN';
const AC_KEY = 'FIRSTY_APPCHECK';
// 每个广告之间随机等待, 模拟真人节奏, 避免固定间隔被风控
const AD_WAIT_MIN = Number($.getenv('FIRSTY_AD_WAIT_MIN') || 15);
const AD_WAIT_MAX = Number($.getenv('FIRSTY_AD_WAIT_MAX') || 45);
const MAX_ROUNDS = Number($.getenv('FIRSTY_MAX_ROUNDS') || 0);
const APP_VERSION = $.getenv('FIRSTY_APP_VERSION') || '1.8.8';
const APP_BUILD = $.getenv('FIRSTY_APP_BUILD') || '8700';
const DEVICE_INFO = $.getenv('FIRSTY_DEVICE_INFO') || 'iPhone9,2 15.7';
// complete 接口必需的反作弊头，不带一律 401 INVALID_TOKEN（已实测）。
// 长期有效：3 天前的旧值仍可用；每个 App 安装生成一个固定值，服务端不校验与设备的绑定。
const DEFAULT_APPCHECK = '122ec9ac6d1a92d8638e0d536aae54c48e96a52348ffaf99b4893df0897c7d8196';

const sleep = s => new Promise(r => setTimeout(r, s * 1000));

function http(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const env = $.getEnv();
    if (env === 'Quantumult X') {
      const opt = { url, method, headers, timeout: 30000 };
      if (body) opt.body = body;
      $task.fetch(opt).then(r => resolve({ status: r.statusCode, body: r.body || '' })).catch(reject);
    } else if (env === 'Node.js') {
      const u = new URL(url);
      const https = require('https');
      const payload = body ? Buffer.from(body) : null;
      const h = Object.assign({}, headers);
      if (payload) h['content-length'] = payload.length;
      const req = https.request({ host: u.hostname, port: 443, path: u.pathname + u.search, method, headers: h }, res => {
        let d = '';
        res.on('data', c => (d += c));
        res.on('end', () => resolve({ status: res.statusCode, body: d }));
      });
      req.on('error', reject);
      req.setTimeout(30000, () => req.destroy(new Error('timeout')));
      if (payload) req.write(payload);
      req.end();
    } else if (env === 'JSBox') {
      // JSBox: $http.get / $http.post, 回调式, 无 $done
      const opt = {
        url, header: headers, timeout: 30,
        handler: resp => {
          const st = (resp && resp.response && resp.response.statusCode) || 0;
          let b = resp && resp.data;
          if (b && typeof b !== 'string') b = JSON.stringify(b);
          resolve({ status: st, body: b || '' });
        },
      };
      if (method === 'GET') $http.get(opt);
      else $http.post(Object.assign({ body: body || '' }, opt));
    } else {
      const opt = { url, headers, body, timeout: 30 };
      const cb = (err, resp, data) => err ? reject(new Error(err)) : resolve({ status: (resp && (resp.status || resp.statusCode)) || 0, body: data || '' });
      if (method === 'GET') $httpClient.get(opt, cb);
      else $httpClient.post(opt, cb);
    }
  });
}

function tokenHeaders(token, base) {
  const h = {
    'user-agent': 'Dart/3.13 (dart:io)',
    'content-type': 'application/json',
    'app-version': APP_VERSION,
    'app-build': APP_BUILD,
    'device-info': DEVICE_INFO,
    'platform': 'iOS',
  };
  Object.assign(h, base || {});
  if (token) h.authorization = token.startsWith('Bearer ') ? token : 'Bearer ' + token;
  return h;
}

function b64url(s) {
  s += '='.repeat((4 - (s.length % 4)) % 4);
  if (typeof Buffer !== 'undefined') return JSON.parse(Buffer.from(s, 'base64').toString());
  return JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')));
}

// 刷满当日广告额度，返回 { ok, fail, quota }
async function runAds(origin, token, hdrBase, quotaHint, appcheck) {
  const uid = b64url(token.split('.')[1]).user_id;
  const EP = p => `${origin}/api/mobile${p}`;
  const H = tokenHeaders(token, hdrBase);

  let quota = quotaHint;
  if (quota === undefined || quota === null) {
    const er = await http('GET', EP(`/advertisements/v2/${uid}/eligibility`), H, null);
    if (er.status !== 200) throw new Error(`eligibility ${er.status}: ${String(er.body).slice(0, 120)}`);
    quota = JSON.parse(er.body).remainingToday || 0;
  }
  if (MAX_ROUNDS > 0) quota = Math.min(quota, MAX_ROUNDS);
  $.log(`uid=${uid} 今日剩余 ${quota} 次`);

  let nick = '';
  try {
    const ir = await http('GET', EP(`/users/v2/${uid}/info`), H, null);
    if (ir.status === 200) nick = (JSON.parse(ir.body).data || {}).userName || '';
  } catch (e) {}
  if (!nick) nick = uid.slice(0, 6);

  let ok = 0, fail = 0;
  for (let i = 1; i <= quota; i++) {
    try {
      let c = null;
      for (let t = 0; t < 4; t++) {
        c = await http('POST', EP(`/advertisements/v2/${uid}/custom`), H, '');
        if (c.status === 200) break;
        if (c.status === 409) { await sleep(4); continue; }  // concurrent_limit_reached: 等上一单结算
        break;
      }
      if (c.status !== 200) { fail++; $.log(`#${i} custom ${c.status}: ${String(c.body).slice(0, 120)}`); break; }
      const adId = JSON.parse(c.body).adId;
      // 模拟广告播放时长, 每次随机等待
      const w = AD_WAIT_MIN + Math.random() * Math.max(0, AD_WAIT_MAX - AD_WAIT_MIN);
      await sleep(Math.round(w));
      const cH = appcheck ? Object.assign({}, H, { 'x-firebase-appcheck': appcheck }) : H;
      const d = await http('POST', EP(`/advertisements/v2/${uid}/custom/${adId}/complete`), cH, '');
      if (d.status === 204) { ok++; $.log(`#${i} ✓`); $.msg(nick, '', `已观看广告${i}/${quota}次`); }
      else { fail++; $.log(`#${i} complete ${d.status}: ${String(d.body).slice(0, 120)}`); break; }
    } catch (e) {
      fail++;
      $.log(`#${i} 异常: ${(e && e.message) || e}`);
      break;
    }
  }
  if (quota > 0 && ok >= quota) $.msg(nick, '', `今日已刷 ${ok}/${quota} 明日再来吧`);
  return { ok, fail, quota, uid, nick };
}

// 用 refresh token 换 ID token，返回 { token, refresh, uid }
async function refreshIdToken(rt) {
  let last = '';
  for (const key of API_KEYS) {
    const r = await http('POST', `https://securetoken.googleapis.com/v1/token?key=${key}`,
      { 'content-type': 'application/x-www-form-urlencoded' },
      `grant_type=refresh_token&refresh_token=${encodeURIComponent(rt)}`);
    let j = null;
    try { j = JSON.parse(r.body); } catch (e) {}
    if (j && j.id_token) {
      return { token: j.id_token, refresh: j.refresh_token || rt, uid: j.user_id || b64url(j.id_token.split('.')[1]).user_id };
    }
    last = j && j.error ? j.error.message : String(r.body).slice(0, 120);
  }
  throw new Error('refresh 失败: ' + last);
}

/* ================= 代理模式：拦截 App 请求 ================= */
if (typeof $request !== 'undefined') {
  const reqUrl = ($request && $request.url) || '';
  const reqHeaders = ($request && $request.headers) || {};
  const hasResp = typeof $response !== 'undefined' && $response;
  const outBody = hasResp ? $response.body : null;

  // 1) 拦截 Firebase 刷新响应 → 存下最新 refresh token（轮换后自动跟进）
  if (/securetoken\.googleapis\.com/.test(reqUrl)) {
    try {
      const j = JSON.parse(outBody);
      if (j.refresh_token && $.getdata(RT_KEY) !== j.refresh_token) {
        $.setdata(j.refresh_token, RT_KEY);
        $.log('[Firsty] 已保存最新 refresh token');
      }
    } catch (e) {}
    $done({ body: outBody });
  } else if (/\/complete(\?|$)/.test(reqUrl)) {
    // 2) 拦截 complete 请求 → 抠下 appcheck（complete 是全流程唯一带它的接口）
    const ac = reqHeaders['x-firebase-appcheck'] || reqHeaders['X-Firebase-Appcheck'] || reqHeaders['X-Firebase-AppCheck'] || '';
    if (ac && $.getdata(AC_KEY) !== ac) {
      $.setdata(ac, AC_KEY);
      $.log('[Firsty] 已捕获 appcheck: ' + ac.slice(0, 16) + '...');
      $.msg($.name, '已捕获 appcheck', '下次打开 App 首页即可自动刷满');
    }
    if (hasResp) $done({ body: outBody });
    else $done({});
  } else {
    // 3) 拦截 App 广告相关请求 → 用实时 token + 已存 appcheck 刷满
    (async () => {
      const origin = (reqUrl.match(/^https?:\/\/[^/]+/) || [''])[0];
      const token = reqHeaders['authorization'] || reqHeaders['Authorization'] || '';
      const base = {};
      ['app-version', 'app-build', 'device-info', 'platform', 'session-id'].forEach(k => {
        if (reqHeaders[k]) base[k] = reqHeaders[k];
      });
      if (!token) { $.log('[Firsty] 未取到 authorization, 跳过'); $done({ body: outBody }); return; }

      // 先放行 App 请求, 再后台刷 —— 否则首页要转圈等完所有广告
      $done({ body: outBody });
      try {
        const ac = $.getenv(AC_KEY) || $.getdata(AC_KEY) || DEFAULT_APPCHECK;
        await runAds(origin, token, base, undefined, ac);
      } catch (e) {
        $.log('[Firsty] 出错: ' + ((e && e.message) || e));
        $.msg($.name, '刷广告出错', String((e && e.message) || e).slice(0, 120));
      }
    })();
  }
} else {
  /* ================= 青龙 / Node 模式 ================= */
  (async () => {
    $.log(`🔔 ${$.name}, 开始!`);
    const rt = $.getdata(RT_KEY) || (typeof process !== 'undefined' && process.env[RT_KEY]) || '';
    if (!rt) {
      $.msg($.name, '缺少 refresh token', '请设 FIRSTY_REFRESH_TOKEN，或用代理模式抓一次');
      $.done(); return;
    }

    const origin = $.getenv('FIRSTY_HOST') || 'api.firsty.app';
    const t = await refreshIdToken(rt);
    $.setdata(t.refresh, RT_KEY);
    $.log('[Firsty] token 刷新成功');

    const ac = $.getenv(AC_KEY) || $.getdata(AC_KEY) || DEFAULT_APPCHECK;
    const r = await runAds(origin, t.token, {}, undefined, ac);
    $.log(`「Firsty」${r.nick} 已观看广告 ${r.ok}/${r.quota} 次`);
    $.done();
  })().catch(e => {
    $.log('[Firsty] 错误: ' + ((e && e.message) || e));
    $.msg($.name, '出错', String((e && e.message) || e).slice(0, 120));
    try { $.done(); } catch (_) {}
  });
}

function Env(name) {
  return new (class {
    constructor() { this.name = name; this.data = null; this.startTime = Date.now(); }
    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $rocket !== 'undefined') return 'Shadowrocket';
      if (typeof $jsbox !== 'undefined') return 'JSBox';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      return 'Unknown';
    }
    isNode() { return this.getEnv() === 'Node.js'; }
    getenv(k) {
      switch (this.getEnv()) {
        case 'Node.js': return (typeof process !== 'undefined' && process.env[k]) || '';
        default: return this.getdata(k);
      }
    }
    getdata(k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return $prefs.valueForKey(k) || '';
        case 'JSBox': return $prefs.get(k) || '';
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.read(k) || '';
        case 'Node.js': {
          try {
            const p = require('path').join(__dirname, '.' + k.toLowerCase() + '.dat');
            if (require('fs').existsSync(p)) {
              const v = require('fs').readFileSync(p, 'utf8').trim();
              if (v) return v;
            }
          } catch (e) {}
          return (this.data && this.data[k]) || (typeof process !== 'undefined' && process.env[k]) || '';
        }
        default: return '';
      }
    }
    setdata(v, k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return $prefs.setValueForKey(v, k);
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.write(v, k);
        case 'JSBox': $prefs.set(k, v); return true;
        case 'Node.js': {
          this.data = this.data || {};
          this.data[k] = v;
          try {
            const p = require('path').join(__dirname, '.' + k.toLowerCase() + '.dat');
            require('fs').writeFileSync(p, String(v), { mode: 0o600 });
          } catch (e) {}
          return true;
        }
        default: return false;
      }
    }
    log(...t) { console.log(t.join(' ')); }
    msg(s, t, c) {
      switch (this.getEnv()) {
        case 'Node.js': console.log(`${s}: ${t || ''} - ${c || ''}`); break;
        case 'Quantumult X': $notify(s, t || '', c || ''); break;
        default: $notification.post(s, t || '', c || ''); break;
      }
    }
    done() {
      const el = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`结束! ${el}s`);
      switch (this.getEnv()) {
        case 'Node.js': process.exit(0); break;
        case 'JSBox': break;
        default: $done(); break;
      }
    }
  })();
}
