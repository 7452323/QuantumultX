/*
微信读书 每日领取阅读奖励 (Web版)

凭证变量名：weread_auth (JSON: {vid, skey, cookie, nickname})
多账号 JSON 用 | 分隔

[rewrite_local]
^https?:\/\/weread\.qq\.com\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading.js, tag=微信读书(领取阅读奖励), enabled=true

[MITM]
hostname = weread.qq.com
*/

const APP_API = 'https://i.weread.qq.com';
const WEB_API = 'https://weread.qq.com';
const AUTH_KEY = 'weread_auth';

// 解析 $argument（query-string 格式：key1=val1&key2=val2）
const ARG = {};
if (typeof $argument === 'string') {
  $argument.split('&').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) ARG[p.slice(0, idx)] = p.slice(idx + 1);
  });
}

// 奖励类型: 1=体验卡, 2=书币
const CHOICE_TYPE = parseInt(ARG.choiceType) || 1;
// Cookie采集开关: 0=关闭, 1=开启
const ENABLE_COOKIE = ARG.Cookie !== '0';

let $ = new Env('微信读书');

(async () => {
  try {
    if (typeof $request !== 'undefined') {
      if (ENABLE_COOKIE) saveAuth();
      $done({});
      return;
    }
    await runClaim();
  } catch (e) {
    $.msg('WeRead', '执行异常', String(e));
  }
  $done({});
})();

/* ======== 采集 Web 凭证 ======== */
async function saveAuth() {
  const h = $request.headers || {};
  let cookie;
  for (let k in h) {
    if (k.toLowerCase() === 'cookie') { cookie = h[k]; break; }
  }
  if (!cookie) return;

  // 提取 wr_vid 和 wr_skey
  const vidMatch = cookie.match(/wr_vid=(\d+)/);
  const skeyMatch = cookie.match(/wr_skey=([^;]+)/);
  if (!vidMatch || !skeyMatch) return;

  const vid = vidMatch[1];
  const skey = skeyMatch[1];

  const existing = getAuth();
  if (existing && existing.vid === vid && existing.skey === skey) return;

  const auth = { vid, skey, cookie };
  const nickname = await fetchNickname(auth);
  if (nickname) auth.nickname = nickname;
  $.setdata(JSON.stringify(auth), AUTH_KEY);
  $.msg(`「${nickname || '微信读书'}」`, '凭证采集成功', '');
  $.log('[WeRead] web auth saved');
}

function notify(name, sub, body) {
  $.msg(`「${name || '微信读书'}」`, sub, body);
}

/* ======== 获取账号昵称 ======== */
async function fetchNickname(auth) {
  try {
    const headers = {
      'Cookie': auth.cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };
    const resp = await get(WEB_API + '/web/profile', headers);
    const data = JSON.parse(resp.body);
    if (data?.errcode) return null;
    if (data?.name) return data.name;
    if (data?.user?.name) return data.user.name;
    if (data?.data?.user?.name) return data.data.user.name;
    return null;
  } catch (e) {
    console.log('fetchNickname error: ' + e.message);
    return null;
  }
}

/* ======== 主流程：领取奖励 ======== */
async function runClaim() {
  const auth = getAuth();
  const name = auth?.nickname || '微信读书';

  if (!auth) {
    notify(name, '请重新获取凭证', '');
    return;
  }

  let result = await claimWithWeb(auth);

  if (!result.success && result.needRefresh) {
    const refreshed = await refreshWebCookie(auth);
    if (refreshed) {
      result = await claimWithWeb(refreshed);
    }
  }

  if (!result.success && result.needRefresh) {
    notify(name, '请重新获取凭证', '');
    return;
  }

  if (result.claimed > 0) {
    if (CHOICE_TYPE === 2) {
      notify(name, '领取书币', `${result.before}+${result.claimed}`);
    } else {
      notify(name, '领取体验卡', `${result.before}+${result.claimed}`);
    }
  } else {
    notify(name, '重复领取', '');
  }
}

/* ======== Web API 领取 ======== */
async function claimWithWeb(auth) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Cookie': auth.cookie
  };

  const queryResp = await post(APP_API + '/weekly/exchange', '', headers);

  if (queryResp.status === 401) {
    return { success: false, needRefresh: true, detail: '认证过期', claimed: 0, before: 0 };
  }
  if (queryResp.status !== 200) {
    return { success: false, needRefresh: false, detail: 'HTTP ' + queryResp.status, claimed: 0, before: 0 };
  }

  let data;
  try { data = JSON.parse(queryResp.body); } catch {
    // 可能是 Base64
    try { data = JSON.parse($base64.decode(queryResp.body)); } catch {
      return { success: false, needRefresh: false, detail: '解析失败', claimed: 0, before: 0 };
    }
  }

  if (data.errcode) {
    return { success: false, needRefresh: true, detail: data.errmsg || '认证失败', claimed: 0, before: 0 };
  }

  const awards = [];
  if (data.readtimeAwards) data.readtimeAwards.forEach(a => { a._src = '阅读时长'; awards.push(a); });
  if (data.readdayAwards) data.readdayAwards.forEach(a => { a._src = '阅读天数'; awards.push(a); });

  let claimed = 0;
  let before = data.currentBalance || data.balance || 0;

  for (const item of awards) {
    if (item.awardStatus !== 1) continue;
    const choices = item.awardChoices || [];
    const choice = choices.find(x => x.choiceType === CHOICE_TYPE && x.canChoice === 1);
    if (!choice) continue;

    const body = JSON.stringify({
      unread: 1, awardChoiceType: choice.choiceType,
      awardLevelId: item.awardLevelId, isExchangeAward: 1, pf: 'weread_wx-2001-iap-2001-iphone'
    });

    const r = await post(APP_API + '/weekly/exchange', body, headers);
    if (r.status === 200) {
      let rd;
      try { rd = JSON.parse(r.body); } catch {
        try { rd = JSON.parse($base64.decode(r.body)); } catch { rd = null; }
      }
      if (rd && !rd.errcode) claimed++;
    }
  }

  return {
    success: true,
    needRefresh: false,
    claimed,
    before,
    detail: claimed > 0 ? `+${claimed}个` : '暂无可领取'
  };
}

/* ======== Web Cookie 刷新 ======== */
async function refreshWebCookie(auth) {
  const variants = [
    { rq: '%2Fweb%2Fbook%2Fread' },
    { rq: '%2Fweb%2Fbook%2Fread', ql: false },
    { rq: '%2Fweb%2Fbook%2Fread', ql: true }
  ];
  for (const body of variants) {
    try {
      const res = await post(WEB_API + '/web/login/renewal',
        JSON.stringify(body), { 'Content-Type': 'application/json' });
      const setCookie = res.headers?.['Set-Cookie'] || res.headers?.['set-cookie'] || '';
      const m = setCookie.match(/wr_skey=([^;]+)/);
      if (m) {
        const newSkey = m[1];
        const newAuth = { ...auth, skey: newSkey };
        // 更新 cookie 中的 wr_skey
        newAuth.cookie = auth.cookie.replace(/wr_skey=[^;]+/, 'wr_skey=' + newSkey);
        // 尝试获取新昵称
        const nickname = await fetchNickname(newAuth);
        if (nickname) newAuth.nickname = nickname;
        $.setdata(JSON.stringify(newAuth), AUTH_KEY);
        $.log('[WeRead] web cookie refreshed');
        return newAuth;
      }
    } catch (e) {}
  }
  return null;
}

/* ======== 工具函数 ======== */
function getAuth() {
  const d = $.getdata(AUTH_KEY);
  if (!d) return null;
  try { return JSON.parse(d); } catch { return null; }
}

function get(url, headers) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url, headers, timeout: 10000 }, (err, res, data) => {
      if (err) reject(err);
      else resolve({ status: res.status, body: data, headers: res.headers });
    });
  });
}

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    $httpClient.post({ url, headers, body, timeout: 10000 }, (err, res, data) => {
      if (err) reject(err);
      else resolve({ status: res.status, body: data, headers: res.headers });
    });
  });
}

/* ======== Env ======== */
function Env(name) {
  this.name = name;
  this.getdata = k => (typeof $persistentStore !== 'undefined') ? $persistentStore.read(k) :
                      (typeof $prefs !== 'undefined') ? $prefs.valueForKey(k) : null;
  this.setdata = (v, k) => (typeof $persistentStore !== 'undefined') ? $persistentStore.write(v, k) :
                            (typeof $prefs !== 'undefined') ? $prefs.setValueForKey(v, k) : false;
  this.msg = (t, s, b) => (typeof $notify !== 'undefined') ? $notify(t, s, b) :
                           (typeof $notification !== 'undefined') ? $notification.post(t, s, b) : null;
  this.log = (...args) => console.log(...args);
}
