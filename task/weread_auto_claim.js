/*
 * 微信读书 每日领取阅读奖励
 * 
 * Cookie 变量名：weread_auth (JSON: {vid, skey, basever, channelid, ua})
 * 多账号用 & 分隔（JSON用|分隔账号）
 * 
 * [rewrite_local]
 * ^https?:\/\/i\.weread\.qq\.com\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/weread_auto_claim.js
 * 
 * [task_local]
 * 30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/weread_auto_claim.js, tag=微信读书(每日领奖励), enabled=true
 * 
 * [MITM]
 * hostname = i.weread.qq.com
 */

const API = 'https://i.weread.qq.com';
const AUTH_KEY = 'weread_auth';
const PF = 'weread_wx-2001-iap-2001-iphone';

let $ = new Env('微信读书');

// ======== Cookie 采集 ========
function handleAuth() {
  const h = $request.headers || {};
  let vid, skey, basever, channelid, ua;
  
  for (let k in h) {
    const key = k.toLowerCase();
    if (key === 'vid') vid = h[k];
    if (key === 'skey') skey = h[k];
    if (key === 'basever') basever = h[k];
    if (key === 'channelid') channelid = h[k];
    if (key === 'user-agent') ua = h[k];
  }
  
  if (!vid || !skey) { $.done(); return; }
  
  const existing = getAuth();
  if (existing && existing.vid === vid && existing.skey === skey) {
    $.done(); return;
  }
  
  const auth = { vid, skey, basever: basever || '', channelid: channelid || 'AppStore', ua: ua || 'WeRead' };
  $.setdata(JSON.stringify(auth), AUTH_KEY);
  $.msg($.name, '✅ 凭证已保存', `vid=${vid}`);
  $.done();
}

// ======== 主流程 ========
!(async () => {
  if (typeof $request !== 'undefined') {
    handleAuth();
    return;
  }
  
  await runClaim();
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

async function runClaim() {
  const auth = getAuth();
  if (!auth) {
    $.msg($.name, '', '⚠️ 未获取到凭证\n请打开微信读书APP刷新任意页面\n\n🎯 失败');
    return;
  }
  
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
  
  // 查询可领取奖励
  const queryRes = await post(API + '/weekly/exchange', 
    encode({ awardLevelId: 0, unread: 1, isExchangeAward: 0, pf: PF, awardChoiceType: 0 }), headers);
  
  if (queryRes.status !== 200) {
    $.msg($.name, '请求失败', 'HTTP ' + queryRes.status);
    return;
  }
  
  const data = decode(queryRes.body);
  if (!data) {
    $.msg($.name, '解析失败', (queryRes.body || '').slice(0, 100));
    return;
  }
  
  const awards = [];
  if (data.readtimeAwards) data.readtimeAwards.forEach(a => { a._src = '阅读时长'; awards.push(a); });
  if (data.readdayAwards) data.readdayAwards.forEach(a => { a._src = '阅读天数'; awards.push(a); });
  
  let count = 0;
  const details = [];
  
  for (const item of awards) {
    if (item.awardStatus !== 1) continue;
    
    const choices = item.awardChoices || [];
    const choice = choices.find(x => x.choiceType === 2 && x.canChoice === 1) ||
                   choices.find(x => x.choiceType === 1 && x.canChoice === 1);
    if (!choice) continue;
    
    const r = await post(API + '/weekly/exchange',
      encode({ unread: 1, awardChoiceType: choice.choiceType, awardLevelId: item.awardLevelId, isExchangeAward: 1, pf: PF }), headers);
    
    if (r.status === 200) {
      count++;
      const name = describeChoice(choice, r);
      details.push(`${item._src}·${name}`);
    }
  }
  
  if (count > 0) {
    $.msg($.name, '领取完成', `成功领取 ${count} 个奖励\n${details.join('、')}\n\n🎯 完成`);
  } else {
    $.msg($.name, '领取完成', '暂无可领取的奖励\n\n🎯 完成');
  }
}

// ======== 工具函数 ========
function getAuth() {
  const d = $.getdata(AUTH_KEY);
  if (!d) return null;
  try { return JSON.parse(d); } catch { return null; }
}

function encode(obj) {
  const str = JSON.stringify(obj);
  if (typeof $base64 !== 'undefined') return $base64.encode(str);
  if (typeof $task !== 'undefined') return $text.base64Encode(str);
  if (typeof $httpClient !== 'undefined') return $base64 ? $base64.encode(str) : str;
  return str;
}

function decode(str) {
  try {
    if (typeof $base64 !== 'undefined') return JSON.parse($base64.decode(str));
    if (typeof $task !== 'undefined') return JSON.parse($text.base64Decode(str));
    return JSON.parse(str);
  } catch { return null; }
}

function describeChoice(choice, resp) {
  if (resp && resp.body) {
    const ex = decode(resp.body);
    if (ex) {
      if (ex.awardName) return ex.awardName;
      if (ex.exchangeName) return ex.exchangeName;
      if (ex.choiceName) return ex.choiceName;
    }
  }
  if (choice.choiceName) return choice.choiceName;
  if (choice.choiceType === 2) return '书币';
  if (choice.choiceType === 1) return '体验卡';
  return '奖励';
}

function post(url, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers, body, timeout: 10000 };
    if (typeof $task !== 'undefined') {
      $task.fetch({ ...opts, method: 'POST' }).then(r => resolve({ status: r.statusCode, body: r.body })).catch(reject);
    } else if (typeof $httpClient !== 'undefined') {
      $httpClient.post(opts, (err, res, data) => err ? reject(err) : resolve({ status: res.status || res.statusCode, body: data }));
    } else {
      reject(new Error('不支持的平台'));
    }
  });
}

function Env(name) {
  this.name = name;
  this.logs = [];
  
  this.getdata = function(k) {
    if (typeof $prefs !== 'undefined') return $prefs.valueForKey(k) || '';
    if (typeof $persistentStore !== 'undefined') return $persistentStore.read(k) || '';
    if (typeof $task !== 'undefined') return $prefs.valueForKey(k) || '';
    return '';
  };
  
  this.setdata = function(v, k) {
    if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(v, k);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.write(v, k);
    if (typeof $task !== 'undefined') return $prefs.setValueForKey(v, k);
    return false;
  };
  
  this.log = function(...t) { this.logs.push(...t); console.log(t.join('\n')); };
  this.logErr = function(t) { this.log(`❗️${this.name}, 错误!`, t?.message || t); };
  this.msg = function(t, s, b) {
    if (typeof $notify !== 'undefined') $notify(t, s || '', b || '');
    else if (typeof $notification !== 'undefined') $notification.post(t, s || '', b || '');
  };
  this.done = function() { $done(); };
}
