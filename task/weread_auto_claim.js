/*
 * 微信读书 每日领取阅读奖励
 * 自动采集 vid/skey，领取体验卡和书币
 * 
 * Cookie 变量名：weread_data (vid@skey 格式)
 * 多账号用 & 分隔
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

// ======== 运行时适配层 ========
const ENV = (() => {
  if (typeof $environment !== 'undefined' && $environment['Surge-Module']) return 'Surge';
  if (typeof $task !== 'undefined') return 'QX';
  if (typeof $loon !== 'undefined') return 'Loon';
  if (typeof module !== 'undefined' && typeof process !== 'undefined') return 'Node';
  return 'Unknown';
})();

const KEY = 'weread_data';
const SEP = '&';
const API = 'https://i.weread.qq.com';
const UA = 'WeRead/7.0.0 WRBrand/huawei Dalvik/2.1.0';

function storeGet() {
  try {
    if (ENV === 'Surge' || ENV === 'Loon') return $persistentStore.read(KEY) || '';
    if (ENV === 'QX') return $prefs.valueForKey(KEY) || '';
    if (ENV === 'Node') return require('fs').readFileSync('/tmp/' + KEY + '.txt', 'utf8').trim();
  } catch(e) {}
  return '';
}

function storeSet(val) {
  if (ENV === 'Surge' || ENV === 'Loon') $persistentStore.write(val, KEY);
  else if (ENV === 'QX') $prefs.setValueForKey(val, KEY);
  else if (ENV === 'Node') require('fs').writeFileSync('/tmp/' + KEY + '.txt', val);
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    if (ENV === 'Surge' || ENV === 'Loon') {
      $httpClient.get({ url, headers }, (err, resp, body) => err ? reject(err) : resolve({ status: resp.status, body }));
    } else if (ENV === 'QX') {
      $task.fetch({ url, headers }).then(resp => resolve({ status: resp.statusCode, body: resp.body }), reject);
    } else if (ENV === 'Node') {
      const https = require('https');
      const u = new URL(url);
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, headers, method: 'GET' }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.end();
    } else reject('Unsupported ENV');
  });
}

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    if (ENV === 'Surge' || ENV === 'Loon') {
      $httpClient.post({ url, headers, body }, (err, resp, body) => err ? reject(err) : resolve({ status: resp.status, body }));
    } else if (ENV === 'QX') {
      $task.fetch({ url, headers, method: 'POST', body }).then(resp => resolve({ status: resp.statusCode, body: resp.body }), reject);
    } else if (ENV === 'Node') {
      const https = require('https');
      const u = new URL(url);
      const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, headers: { ...headers, 'Content-Length': Buffer.byteLength(body) }, method: 'POST' }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, body: data }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    } else reject('Unsupported ENV');
  });
}

function notify(title, sub, body) {
  if (ENV === 'Surge') $notification.post(title, sub, body);
  else if (ENV === 'QX') $notify(title, sub, body);
  else if (ENV === 'Loon') $notification.post(title, sub, body);
  else console.log(`[${title}] ${sub} ${body}`);
}

function done() {
  if (ENV === 'Surge' || ENV === 'QX' || ENV === 'Loon') $done();
}

// ======== 采集阶段 ========
function capture() {
  try {
    const headers = $request.headers;
    const vid = headers['vid'] || headers['Vid'] || headers['VID'];
    const skey = headers['skey'] || headers['Skey'] || headers['SKEY'];
    
    if (vid && skey) {
      const val = vid + '@' + skey;
      let list = storeGet().split(SEP).filter(Boolean);
      const idx = list.findIndex(x => x.startsWith(vid + '@'));
      if (idx >= 0) list[idx] = val;
      else list.push(val);
      storeSet(list.join(SEP));
    }
  } catch(e) {}
  done();
}

// ======== 领取阶段 ========
async function claim() {
  const raw = storeGet();
  if (!raw) {
    notify('微信读书', '', '⚠️ 未获取到凭证\n请先打开微信读书APP触发采集\n\n🎯 失败');
    done();
    return;
  }

  const accounts = raw.split(SEP).filter(Boolean);
  let results = [];
  let valid = 0, expired = 0;

  for (const acc of accounts) {
    const [vid, skey] = acc.split('@');
    if (!vid || !skey) continue;

    const headers = { vid: vid.toString(), skey, 'User-Agent': UA, 'Content-Type': 'application/json' };

    let queryData;
    try {
      const res = await httpPost(`${API}/weekly/exchange`, headers, JSON.stringify({
        awardLevelId: 0, awardChoiceType: 0, isExchangeAward: 0, pf: 'weread_wx-2001-iap-2001-iphone'
      }));
      queryData = JSON.parse(res.body);
    } catch(e) {
      results.push(`👤 ${vid}\n${ts()}  ❌ 请求失败`);
      continue;
    }

    if (!queryData || (queryData.errcode && queryData.errcode !== 0)) {
      expired++;
      results.push(`👤 ${vid}\n${ts()}  ❌ 凭证过期`);
      continue;
    }

    valid++;
    const awards = [...(queryData?.data?.readtimeAwards || []), ...(queryData?.data?.readdayAwards || [])];
    let claimed = 0;
    const res = {};

    for (const award of awards) {
      if (award.awardStatus === 1) {
        const choice = award.awardChoices.find(c => c.canChoice === 1);
        if (!choice) continue;
        
        try {
          const exRes = await httpPost(`${API}/weekly/exchange`, headers, JSON.stringify({
            awardLevelId: award.awardLevelId,
            awardChoiceType: choice.choiceType,
            isExchangeAward: 1,
            pf: 'weread_wx-2001-iap-2001-iphone'
          }));
          const exData = JSON.parse(exRes.body);
          
          if (exData?.errcode === 0 || exData?.readingTime !== undefined) {
            claimed++;
            const type = choice.choiceType === 1 ? '体验卡' : '书币';
            res[award.awardLevelDesc] = `+${choice.awardNum} ${type}`;
          }
        } catch(e) {}
        
        await sleep(1000 + Math.random() * 1000);
      }
    }

    if (claimed > 0) {
      const lines = Object.entries(res).map(([k, v]) => `${ts()}  ✅ ${k}: ${v}`);
      results.push(`👤 ${vid}\n${lines.join('\n')}`);
    } else {
      results.push(`👤 ${vid}\n${ts()}  ℹ️ 无奖励可领`);
    }
  }

  let body;
  if (results.length === 0) body = '⚠️ 没有可用账号\n\n🎯 失败';
  else if (valid === 0 && expired > 0) body = `${results.join('\n\n')}\n\n🎯 凭证全部过期 ${expired}/${accounts.length}`;
  else body = `${results.join('\n\n')}\n\n🎯 完成`;
  
  notify('微信读书', '', body);
  done();
}

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ======== 入口 ========
if (typeof $request !== 'undefined') {
  capture();
} else {
  claim();
}
