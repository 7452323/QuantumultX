/*
微信读书 每日领取阅读奖励

凭证变量名：weread_auth (JSON: {vid, skey, basever, channelid, ua})
多账号 JSON 用 | 分隔

[rewrite_local]
^https?:\/\/i\.weread\.qq\.com\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading.js

[task_local]
0 9 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading.js, tag=微信读书(领取阅读奖励), enabled=true

[MITM]
hostname = i.weread.qq.com
*/

const APP_API = 'https://i.weread.qq.com';
const WEB_API = 'https://weread.qq.com';
const AUTH_KEY = 'weread_auth';
const PF = 'weread_wx-2001-iap-2001-iphone';

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

/* ======== 采集 APP 凭证 ======== */
function saveAuth() {
  const h = $request.headers || {};
  let vid, skey;
  for (let k in h) {
    const key = k.toLowerCase();
    if (key === 'vid') vid = h[k];
    if (key === 'skey') skey = h[k];
  }
  if (!vid || !skey) return;

  const existing = getAuth();
  if (existing && existing.vid === vid && existing.skey === skey) return;

  const auth = { vid, skey };
  for (let k in h) {
    const key = k.toLowerCase();
    if (key === 'basever') auth.basever = h[k];
    if (key === 'channelid') auth.channelid = h[k];
    if (key === 'user-agent') auth.ua = h[k];
  }
  $.setdata(JSON.stringify(auth), AUTH_KEY);
  $.msg('「微信读书」', '凭证已采集', '');
  $.log('[WeRead] auth saved');
}

/* ======== 主流程：领取奖励 ======== */
async function runClaim() {
  const auth = getAuth();
  if (!auth) {
    $.msg('「微信读书」', '请重新获取凭证', '');
    return;
  }

  let result = await claimWithApp(auth);
  
  if (!result.success && result.needRefresh) {
    const newSkey = await refreshWebCookie(auth.vid);
    if (newSkey) {
      auth.skey = newSkey;
      $.setdata(JSON.stringify(auth), AUTH_KEY);
      result = await claimWithApp(auth);
    }
  }

  if (!result.success && result.needRefresh) {
    $.msg('「微信读书」', '请重新获取凭证', '');
    return;
  }

  if (result.claimed > 0) {
    if (CHOICE_TYPE === 2) {
      $.msg('「微信读书」', '领取书币', `${result.before}+${result.claimed}`);
    } else {
      $.msg('「微信读书」', '领取体验卡', `${result.before}+${result.claimed}`);
    }
  } else {
    $.msg('「微信读书」', '重复领取', '');
  }
}

/* ======== APP API 领取 ======== */
async function claimWithApp(auth) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'User-Agent': auth.ua || 'WeRead',
    'channelid': auth.channelid || 'AppStore',
    'basever': auth.basever || '',
    'v': auth.basever || '',
    'vid': auth.vid,
    'skey': auth.skey
  };

  const queryResp = await post(APP_API + '/weekly/exchange', encode({
    awardLevelId: 0, unread: 1, isExchangeAward: 0, pf: PF, awardChoiceType: 0
  }), headers);

  if (queryResp.status === 401) {
    return { success: false, needRefresh: true, detail: '认证过期', claimed: 0, before: 0 };
  }
  if (queryResp.status !== 200) {
    return { success: false, needRefresh: false, detail: 'HTTP ' + queryResp.status, claimed: 0, before: 0 };
  }

  const data = decode(queryResp.body);
  if (!data) return { success: false, needRefresh: false, detail: '解析失败', claimed: 0, before: 0 };
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

    const r = await post(APP_API + '/weekly/exchange', encode({
      unread: 1, awardChoiceType: choice.choiceType,
      awardLevelId: item.awardLevelId, isExchangeAward: 1, pf: PF
    }), headers);

    if (r.status === 200) {
      claimed++;
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

/* ======== Web Cookie 刷新（备用） ======== */
async function refreshWebCookie(vid) {
  const variants = [
    { rq: '%2Fweb%2Fbook%2Fread', ql: false },
    { rq: '%2Fweb%2Fbook%2Fread', ql: true },
    { rq: '%2Fweb%2Fbook%2Fread' }
  ];
  for (const body of variants) {
    try {
      const res = await post(WEB_API + '/web/login/renewal',
        JSON.stringify(body), { 'Content-Type': 'application/json' });
      const setCookie = res.headers?.['Set-Cookie'] || res.headers?.['set-cookie'] || '';
      const m = setCookie.match(/wr_skey=([^;]+)/);
      if (m) return m[1].substring(0, 8);
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

function encode(obj) {
  const str = JSON.stringify(obj);
  if (typeof $base64 !== 'undefined') return $base64.encode(str);
  return str;
}

function decode(str) {
  try {
    if (typeof $base64 !== 'undefined') return JSON.parse($base64.decode(str));
    return JSON.parse(str);
  } catch { return null; }
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
