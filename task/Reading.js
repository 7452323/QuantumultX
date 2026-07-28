/*
微信读书 每日领取阅读奖励 (APP版)

凭证变量名：weread_auth (JSON: {vid, skey, basever, channelid, ua, refreshToken})
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

const ARG = {};
if (typeof $argument === 'string') {
  $argument.split('&').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) ARG[p.slice(0, idx)] = p.slice(idx + 1);
  });
}

const CHOICE_TYPE = parseInt(ARG.choiceType) || 1;
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

async function saveAuth() {
  const h = $request.headers || {};
  let vid, skey;
  for (let k in h) {
    const key = k.toLowerCase();
    if (key === 'vid') vid = h[k];
    if (key === 'skey') skey = h[k];
  }
  if (!vid || !skey) return;

  const existing = getAuth();
  const existingToken = existing?.refreshToken || '';

  // 无论是否相同，只要有 vid/skey 就更新 refreshToken
  const auth = { vid, skey };
  for (let k in h) {
    const key = k.toLowerCase();
    if (key === 'basever') auth.basever = h[k];
    if (key === 'channelid') auth.channelid = h[k];
    if (key === 'user-agent') auth.ua = h[k];
  }
  if (existingToken) auth.refreshToken = existingToken;

  // 先保存，昵称异步获取，避免阻塞通知
  $.setdata(JSON.stringify(auth), AUTH_KEY);
  $.msg(`「${auth.nickname || '微信读书'}」`, '凭证采集成功', '');
  const nickname = await fetchNickname(auth);
  if (nickname) {
    auth.nickname = nickname;
    $.setdata(JSON.stringify(auth), AUTH_KEY);
  }
  $.log('[WeRead] auth saved');
}

function notify(name, sub, body) {
  $.msg(`「${name || '微信读书'}」`, sub, body);
}

async function fetchNickname(auth) {
  try {
    const headers = {
      'vid': auth.vid,
      'skey': auth.skey,
      'User-Agent': auth.ua || 'WeRead/7.0.0 WRBrand/huawei Dalvik/2.1.0',
      'v': '7.4.2.23',
      'Content-Type': 'application/json'
    };
    const resp = await post(APP_API + '/friend/ranking?mine=1&synckey=0', '', headers);
    const data = JSON.parse(resp.body);
    if (data?.errcode) return null;
    if (data?.ranking?.length > 0) {
      const me = data.ranking.find(r => r.user?.userVid == auth.vid);
      if (me?.user?.name) return me.user.name;
      if (data.ranking[0]?.user?.name) return data.ranking[0].user.name;
    }
    if (data?.data?.user?.name) return data.data.user.name;
    if (data?.user?.name) return data.user.name;
    return null;
  } catch (e) {
    console.log('fetchNickname error: ' + e.message);
    return null;
  }
}

async function runClaim() {
  const auth = getAuth();
  const name = auth?.nickname || '微信读书';

  if (!auth) {
    notify(name, '请重新获取凭证', '');
    return;
  }

  let result = await claimWithApp(auth);

  if (!result.success && result.needRefresh) {
    const newAuth = await refreshAppAuth(auth);
    if (newAuth) {
      result = await claimWithApp(newAuth);
    } else {
      const newSkey = await refreshWebCookie(auth.vid);
      if (newSkey) {
        auth.skey = newSkey;
        $.setdata(JSON.stringify(auth), AUTH_KEY);
        result = await claimWithApp(auth);
      }
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

    if (r.status === 200) claimed++;
  }

  return {
    success: true,
    needRefresh: false,
    claimed,
    before,
    detail: claimed > 0 ? `+${claimed}个` : '暂无可领取'
  };
}

async function refreshAppAuth(auth) {
  try {
    const body = JSON.stringify({
      deviceId: '1',
      refCgi: '',
      refreshToken: auth.refreshToken || ''
    });
    const res = await post(APP_API + '/login', body, {
      'User-Agent': auth.ua || 'WeRead/7.0.0 WRBrand/huawei Dalvik/2.1.0',
      'Content-Type': 'application/json'
    });

    if (res.status !== 200) return null;

    const data = JSON.parse(res.body);
    if (data.errcode !== 0 || !data.data) return null;

    const d = data.data;
    auth.vid = d.vid;
    auth.skey = d.skey;
    if (d.refreshToken) auth.refreshToken = d.refreshToken;
    if (d.user?.name) auth.nickname = d.user.name;

    $.setdata(JSON.stringify(auth), AUTH_KEY);
    $.log('[WeRead] auth refreshed');
    return auth;
  } catch (e) {
    $.log('[WeRead] refresh error: ' + e.message);
    return null;
  }
}

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
