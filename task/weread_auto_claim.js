/*
微信读书 每日领取阅读奖励 — i.weread.qq.com

Cookie 变量名：weread_data (refreshToken@deviceId 格式)
多账号用 & 分隔

[rewrite_local]
^https?:\/\/i\.weread\.qq\.com\/login url script-request-body https://raw.githubusercontent.com/7452323/QuantumultX/main/task/weread_auto_claim.js

[task_local]
30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/weread_auto_claim.js, tag=微信读书(每日领奖励), enabled=true

[MITM]
hostname = i.weread.qq.com
*/

const API = 'https://i.weread.qq.com';
const KEY = 'weread_data';
const SEP = '&';
const PF = 'weread_wx-2001-iap-2001-iphone';

let $ = typeof $environment !== 'undefined' ? new Env('微信读书') : null;

// ======== 凭证采集 ========
function handleLogin() {
  if (!$request.body) return;
  try {
    const body = JSON.parse($request.body);
    const { refreshToken, deviceId } = body;
    if (refreshToken && deviceId) {
      const val = refreshToken + '@' + deviceId;
      let list = ($.getdata(KEY) || '').split(SEP).filter(Boolean);
      if (!list.includes(val)) {
        list.push(val);
        $.setdata(list.join(SEP), KEY);
      }
      $.msg($.name, `✅ 凭证已保存 (${list.length} 个账号)`, '');
    }
  } catch(e) {}
  $.done();
}

!(async () => {
  // --- rewrite 模式: 采集凭证 ---
  if (typeof $request !== 'undefined') {
    handleLogin();
    return;
  }

  // --- cron 模式: 领取奖励 ---
  const raw = $.getdata(KEY);
  if (!raw) {
    $.msg($.name, '', '⚠️ 未获取到凭证\n\n请先登录微信读书触发采集\n\n🎯 失败');
    $.done();
    return;
  }

  const accounts = raw.split(SEP).map(s => s.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  const allBodies = [];
  let validAccounts = 0;
  let expiredAccounts = 0;

  for (const acc of accounts) {
    const [refreshToken, deviceId] = acc.split('@');
    if (!refreshToken || !deviceId) continue;

    // 1. 刷新 skey
    const loginRes = await httpPost(`${API}/login`, JSON.stringify({
      deviceId: deviceId,
      refCgi: '',
      refreshToken: refreshToken
    }));
    const loginData = tryParse(loginRes.body);
    
    if (!loginData || !loginData.vid) {
      $.log(`[${refreshToken.slice(0,8)}] 凭证已失效，跳过`);
      expiredAccounts++;
      allBodies.push(`👤 ${refreshToken.slice(0,8)}\n${ts()}  ❌ 凭证已过期`);
      continue;
    }

    const { vid, skey } = loginData;
    validAccounts++;
    $.log(`[${vid}] 登录成功`);

    // 2. 查询可领取的奖励
    const queryRes = await httpPost(`${API}/weekly/exchange`, JSON.stringify({
      awardLevelId: 0,
      awardChoiceType: 0,
      isExchangeAward: 0,
      pf: PF
    }), vid, skey);
    const queryData = tryParse(queryRes.body);

    // 3. 领取奖励 (readtimeAwards + readdayAwards)
    const awards = [
      ...(queryData?.data?.readtimeAwards || []),
      ...(queryData?.data?.readdayAwards || [])
    ];
    
    const res = {};
    let claimed = 0;
    
    for (const award of awards) {
      if (award.awardStatus === 1) { // 可领取
        const choice = award.awardChoices.find(c => c.canChoice === 1);
        if (!choice) continue;
        
        const exchangeRes = await httpPost(`${API}/weekly/exchange`, JSON.stringify({
          awardLevelId: award.awardLevelId,
          awardChoiceType: choice.choiceType,
          isExchangeAward: 1,
          pf: PF
        }), vid, skey);
        const exchangeData = tryParse(exchangeRes.body);
        
        if (exchangeData?.errcode === 0 || exchangeData?.readingTime !== undefined) {
          claimed++;
          const type = choice.choiceType === 1 ? '体验卡' : '书币';
          res[award.awardLevelDesc] = `+${choice.awardNum} ${type}`;
        }
        
        await rwait(1000, 2000);
      }
    }

    if (claimed > 0) {
      const lines = Object.entries(res).map(([k, v]) => `${ts()}  ✅ ${k}: ${v}`);
      allBodies.push(`👤 ${vid}\n${lines.join('\n')}`);
    } else {
      allBodies.push(`👤 ${vid}\n${ts()}  ℹ️ 无奖励可领`);
    }
  }

  // 通知
  let body;
  if (allBodies.length === 0) {
    body = '⚠️ 没有可用账号\n\n🎯 失败';
  } else if (validAccounts === 0 && expiredAccounts > 0) {
    body = `${allBodies.join('\n\n')}\n\n🎯 凭证全部过期  ${expiredAccounts}/${accounts.length}`;
  } else {
    body = `${allBodies.join('\n\n')}\n\n🎯 完成`;
  }
  $.msg($.name, '', body);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

// ====== 工具函数 ======

function tryParse(str) {
  try { return JSON.parse(str); } catch(e) { return null; }
}

function ts() {
  return new Date().toLocaleTimeString('zh-CN', { hour12: false });
}

function rwait(min, max) {
  return new Promise(r => setTimeout(r, min + Math.random() * (max - min)));
}

async function httpPost(url, body, vid, skey) {
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'WeRead/7.0.0 WRBrand/huawei Dalvik/2.1.0'
  };
  if (vid) headers.vid = vid.toString();
  if (skey) headers.skey = skey;
  
  return new Promise(resolve => {
    $.post({ url, headers, body }, (err, resp, body) => {
      resolve({ err, resp, body });
    });
  });
}

async function httpGet(url, vid, skey) {
  const headers = {
    'User-Agent': 'WeRead/7.0.0 WRBrand/huawei Dalvik/2.1.0'
  };
  if (vid) headers.vid = vid.toString();
  if (skey) headers.skey = skey;
  
  return new Promise(resolve => {
    $.get({ url, headers }, (err, resp, body) => {
      resolve({ err, resp, body });
    });
  });
}
