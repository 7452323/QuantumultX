/*
酷我音乐 每日任务 

Cookie 变量名：kuwo_data

多账号用 & 分隔

[rewrite_local]
^https?:\/\/integralapi\.kuwo\.cn\/api\/v1\/online\/sign\/v1\/music\/userBase url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwoczz.js

[task_local]
30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwoczz.js, tag=酷我音乐(每日任务), enabled=true

[MITM]
hostname = integralapi.kuwo.cn
*/

const API = 'https://integralapi.kuwo.cn';
const KEY = 'kuwo_data';
const SEP = '&';  // 多账号分隔符

let $ = typeof $environment !== 'undefined' ? new Env('酷我音乐') : null;

// ======== Cookie 采集 ========
function handleCookie() {
  const url = $request.url || '';
  if (url.includes('integralapi.kuwo.cn') && url.includes('userBase')) {
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) {
      const uid = cookie.match(/userid=(\d+)/);
      const sid = cookie.match(/websid=(\d+)/);
      if (uid && sid) {
        const val = uid[1] + '@' + sid[1];
        let list = ($.getdata(KEY) || '').split(SEP).filter(Boolean);
        if (!list.includes(val)) {
          list.push(val);
          $.setdata(list.join(SEP), KEY);
        }
        $.msg($.name, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
      }
    }
  }
  $.done();
}

!(async () => {
  // --- 如果是 rewrite 请求触发, 采集 Cookie ---
  if (typeof $request !== 'undefined') {
    handleCookie();
    return;
  }

  // --- cron 模式 ---
  if (typeof $task !== 'undefined') {
    $.log('✅ cron 模式启动');
  }

  // --- 从持久化存储读账号 ---
  const raw = $.getdata(KEY);
  if (!raw) {
    $.msg($.name, '',
      `⚠️ 未获取到 Cookie\n\n请先登录酷我音乐触发采集\n\n🎯 失败`);
    $.done();
    return;
  }

  const accounts = raw.split(SEP).map(s => s.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  const allBodies = [];
  let validAccounts = 0;
  let expiredAccounts = 0;
  const startTs = Date.now();

  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;

    // 检测 Cookie 有效性
    const ubRes = await httpGet(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
    const ubData = tryParse(ubRes.body);
    const nickname = ubData?.data?.nickname || '';

    if (!nickname) {
      $.log(`[${uid}] Cookie 已失效，跳过`);
      expiredAccounts++;
      allBodies.push(`👤 ${uid}\n${ts()}  ❌ Cookie 已过期`);
      continue;
    }

    validAccounts++;
    $.log(`\n[${nickname}] uid=${uid}`);

    const res = {};
    const logTime = [];

    // 获取 taskList
    const tlRes = await httpGet(`${API}/openapi/v1/usersystem/taskList?loginUid=${uid}&loginSid=${sid}&appUid=${uid}&version=12.1.8.0&src=kwplayer_ip_12.1.8.0_TJ.ipa`);
    const tlData = tryParse(tlRes.body);
    const tasks = tlData?.data || [];

    function st(name) { return tasks.find(x => x.taskType === name); }

    // 1. 签到
    if (true) {
      const t = st('sign');
      if (t && t.status === 1) {
        res.签到 = '✓';
        $.log('签到: ✅ 已完成');
      } else {
        await doListen(uid, sid, 'sign', 0, 110);
        await rwait(1000, 2000);
        const ok = await finishTask(uid, sid, 'sign', 10);
        res.签到 = ok ? '✓' : '✗';
      }
      logTime.push(ts());
    }
    await rwait(1000, 3000);

    // 2. 评论（先发评论再领奖）
    if (true) {
      const t = st('comment');
      if (t && t.status === 1) {
        res.评论 = '✓';
        $.log('评论: ✅ 已完成');
      } else {
        let content = '好听！';
        try {
          const hRes = await httpGet('https://v1.hitokoto.cn');
          const hData = tryParse(hRes.body);
          if (hData && hData.hitokoto) content = hData.hitokoto;
        } catch(e) {}
        $.log(`评论内容: ${content}`);

        let songId = 28115171;
        try {
          const rankRes = await httpGet(`https://wapi.kuwo.cn/openapi/v1/rank/recommend?loginUid=${uid}&loginSid=${sid}`);
          const rankData = tryParse(rankRes.body);
          if (rankData?.data?.list?.[0]?.id) songId = rankData.data.list[0].id;
        } catch(e) {}

        const cRes = await httpPost(`${API}/openapi/v1/comment/add`, `sid=${songId}&content=${encodeURIComponent(content)}&isreplay=0&type=0&loginUid=${uid}&loginSid=${sid}&appUid=${uid}`);
        const cData = tryParse(cRes.body);
        if (cData?.code === 200) {
          $.log(`发表评论: ✅ 成功`);
          await rwait(1000, 2000);
          await finishTask(uid, sid, 'comment', 10);
          res.评论 = '✓';
        } else {
          $.log(`发表评论: ❌ ${cData?.msg || '失败'}`);
          await finishTask(uid, sid, 'comment', 10);
          res.评论 = '✗';
        }
      }
      logTime.push(ts());
    }
    await rwait(1000, 3000);

    // 3. 创意视频
    if (true) {
      const t = st('advert');
      const total = t?.total || 5;
      if (t && t.status === 1) {
        res[`视频 ${total}/${total}`] = '✓';
        $.log(`视频: ✅ 已完成 ${total}/${total}`);
      } else {
        let okCnt = 0;
        for (let i = 0; i < total; i++) {
          await doListen(uid, sid, 'videoadver', 58);
          okCnt++;
          await rwait(2000, 5000);
        }
        const advOk = await finishTask(uid, sid, 'advert', 10);
        res[`视频 ${okCnt}/${total}`] = advOk ? '✓' : '✗';
      }
      logTime.push(ts());
    }

    // 等级
    let rankStr = '';
    try {
      const rRes = await httpGet(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
      const rData = tryParse(rRes.body);
      if (rData?.code === 200) {
        const r = rData.data;
        rankStr = `Lv.${r.rank} 成长值:${r.score}`;
      }
    } catch(e) {}
    if (rankStr) $.log(rankStr);

    const hasFail = Object.values(res).some(v => v === '✗');
    const lines = Object.entries(res).map(([k, v], i) => {
      const t = logTime[i] || ts();
      return `${t}  ${v === '✓' ? '✅' : '❌'} ${k}`;
    });
    allBodies.push(`👤 ${nickname}\n${lines.join('\n')}\n🏆 ${rankStr}`);
  }

  // 通知
  let body;
  if (allBodies.length === 0) {
    body = '⚠️ 没有可用账号\n\n🎯 失败';
  } else if (validAccounts === 0 && expiredAccounts > 0) {
    body = `${allBodies.join('\n\n')}\n\n🎯 Cookie 全部过期  ${expiredAccounts}/${accounts.length}`;
  } else {
    let finalStatus = `🎯 耗时: ${Date.now() - startTs}ms`;
    if (Object.values(allBodies).some(b => b.includes('❌'))) {
      finalStatus += ' ❌ 部分失败';
    } else {
      finalStatus += ' ✅';
    }
    body = `${allBodies.join('\n\n')}\n\n${finalStatus}`;
  }
  $.msg($.name, '', body);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

// ====== 工具函数 ======

async function doListen(uid, sid, from, goldNum, extraGoldNum) {
  const names = { sign: '签到', mobile: '听歌', novel: '小说', videoadver: '视频' };
  const taskName = names[from] || from;
  let url = `${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=${from}`;
  if (goldNum > 0) url += `&goldNum=${goldNum}`;
  if (extraGoldNum > 0) url += `&extraGoldNum=${extraGoldNum}`;
  const res = await httpGet(url);
  const data = tryParse(res.body);
  $.log(`${taskName}: ${data?.code === 200 ? '✅ ' + (data.data?.description || '成功') : '❌ ' + (data?.msg || '失败')}`);
}

async function finishTask(uid, sid, from, goldNum) {
  const url = `${API}/openapi/v1/usersystem/finishTask?loginUid=${uid}&loginSid=${sid}&appUid=${uid}&from=${from}&goldNum=${goldNum}&mobile=&terminal=ip`;
  const res = await httpGet(url);
  const data = tryParse(res.body);
  if (data?.code === 200) {
    $.log(`领奖(${from}): ✅ ${data.data?.description || '成功'}`);
    return true;
  } else {
    $.log(`领奖(${from}): ❌ ${data?.msg || data?.data?.description || '失败'}`);
    return false;
  }
}

function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }

function rwait(min, max) { return $.wait(min + Math.floor(Math.random() * (max - min))); }

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: { 'User-Agent': 'kwplayer_ip_12.1.8.0', 'Accept': 'application/json, text/plain, */*' } };
    const handler = (err, resp, body) => {
      if (err) reject(err);
      else resolve({ status: resp?.status || resp?.statusCode, body, headers: resp?.headers, cookies: resp?.cookies });
    };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, handler);
    else
      reject(new Error('不支持的平台'));
  });
}

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      url,
      headers: {
        'User-Agent': 'kwplayer_ip_12.1.8.0',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    };
    const handler = (err, resp, body) => {
      if (err) reject(err);
      else resolve({ status: resp?.status || resp?.statusCode, body, headers: resp?.headers });
    };
    if (typeof $task !== 'undefined')
      $task.fetch({ ...opts, method: 'POST' }).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.post(opts, handler);
    else {
      const http = require('http');
      const https = require('https');
      const u = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      return new Promise((res2, rej2) => {
        const req = mod.request(url, {
          method: 'POST',
          headers: opts.headers
        }, (resp2) => {
          let data = '';
          resp2.on('data', c => data += c);
          resp2.on('end', () => res2({ status: resp2.statusCode, body: data, headers: resp2.headers }));
        });
        req.on('error', rej2);
        req.write(body);
        req.end();
      }).then(resolve).catch(reject);
    }
  });
}

function Env(name, opts) {
  class _env {
    constructor(n) { this.name = n; this.data = null; this.startTime = Date.now(); this.logs = []; this.log(`🔔 ${this.name}, 开始!`); }
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
