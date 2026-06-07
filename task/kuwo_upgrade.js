/*
酷我音乐 升级签到 — for Quantumult X / Surge
Quantumult X & Surge 通用版

[rewrite_local]
^https?:\/\/integralapi\.kuwo\.cn\/api\/v1\/online\/sign\/v1\/music\/userBase url script-request-header kuwo_upgrade.js

[task_local]
30 8 * * * kuwo_upgrade.js, tag=酷我音乐(升级), enabled=true

[mitm]
hostname = integralapi.kuwo.cn

流程：
1. 取 taskList 检测各任务状态（已完成的跳过）
2. 只对未完成的任务调 doListen 完成 + finishTask 领奖
3. 创意视频最多 5 次，用 doListen 完成 + finishTask 领奖
4. 通知卡片：C5-3 风格

Cookie 采集：需采集 integralapi（userid@websid）
多账号用 & 分隔

支持环境变量（通过 $argument 传入）：
  enable_cookie: 1=启用Cookie采集(默认) 0=关闭
  tasks: all=全部任务(默认) 或 sign,music,novel,comment,video 指定
*/

const $ = new Env('酷我音乐(升级)');

// 解析 $argument
const ARG = {};
if (typeof $argument === 'string') {
  $argument.split('&').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) ARG[p.slice(0, idx)] = p.slice(idx + 1);
  });
}
const ENABLE_COOKIE = ARG.enable_cookie !== '0';
const TASKS = ARG.tasks || 'all';
const DEBUG = ARG.debug === '1';

const TASK_LIST = TASKS === 'all' ? [] : TASKS.split(',').map(t => t.trim());
const KEY = 'kuwo_upgrade';
const SEP = '&';
const API = 'https://integralapi.kuwo.cn';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage';
const H = {
  'Origin': 'https://h5app.kuwo.cn',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': UA,
  'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
};

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

!(async () => {
  if (typeof $request !== 'undefined') {
    if (ENABLE_COOKIE) {
      handleCookie();
    } else {
      $.done();
    }
    return;
  }

  const raw = $.getdata(KEY);
  if (!raw) {
    $.msg($.name, `${((Date.now() - $.startTime) / 1000).toFixed(2)}s`,
      `────────────────\n⚠️ 未获取到 Cookie\n────────────────\n请先登录酷我音乐触发采集\n────────────────\n🎯 失败`);
    $.done();
    return;
  }

  const accounts = raw.split(SEP).map(a => a.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  const allBodies = [];
  let validAccounts = 0;
  let expiredAccounts = 0;

  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;

    const ubRes = await httpGet(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
    const ubData = tryParse(ubRes.body);
    const nickname = ubData?.data?.nickname || '';

    // Cookie 过期
    if (!nickname) {
      $.log(`[${uid}] Cookie 已失效，跳过`);
      expiredAccounts++;
      allBodies.push(`👤 ${uid}\n${ts()}  ❌ Cookie 已过期`);
      continue;
    }

    validAccounts++;
    $.log(`\n[${nickname}]`);

    const res = {};
    const logTime = [];

    // 获取 taskList
    const tlRes = await httpGet(`${API}/openapi/v1/usersystem/taskList?loginUid=${uid}&loginSid=${sid}&appUid=2782700304&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
    const tlData = tryParse(tlRes.body);
    const tasks = tlData?.data || [];

    function shouldRun(name) {
      return TASK_LIST.length === 0 || TASK_LIST.includes(name);
    }

    // 1. 签到
    if (shouldRun('sign')) {
      const st = tasks.find(x => x.taskType === 'sign');
      if (st && st.status === 1) {
        res.签到 = '✓';
        $.log('每日签到: ✅ 已签到');
      } else {
        await doListen(uid, sid, 'sign', 0, 110);
        const ok = await finishTask(uid, sid, 'sign', 10);
        res.签到 = ok ? '✓' : '✗';
      }
      logTime.push(ts());
    }
    await rwait(1000, 3000);

    // 2. 听歌10分钟
    if (shouldRun('music')) {
      const mt = tasks.find(x => x.taskType === 'music');
      if (mt && mt.status === 1) {
        res.听歌 = '✓';
        $.log('听歌10分钟: ✅ 已完成');
      } else {
        await doListen(uid, sid, 'mobile', 18);
        const ok = await finishTask(uid, sid, 'music', 18);
        res.听歌 = ok ? '✓' : '✗';
      }
      logTime.push(ts());
    }
    await rwait(1000, 3000);

    // 3. 听小说10分钟
    if (shouldRun('novel')) {
      const nt = tasks.find(x => x.taskType === 'novel');
      if (nt && nt.status === 1) {
        res.小说 = '✓';
        $.log('听小说10分钟: ✅ 已完成');
      } else {
        await doListen(uid, sid, 'novel', 18);
        const ok = await finishTask(uid, sid, 'novel', 18);
        res.小说 = ok ? '✓' : '✗';
      }
      logTime.push(ts());
    }
    await rwait(1000, 3000);

    // 4. 发布评论
    if (shouldRun('comment')) {
      const ct = tasks.find(x => x.taskType === 'comment');
      if (ct && ct.status === 1) {
        res.评论 = '✓';
        $.log('发布评论: ✅ 已完成');
      } else {
        await doListen(uid, sid, 'comment', 10);
        await finishTask(uid, sid, 'comment', 10);
        res.评论 = '✓';
      }
      logTime.push(ts());
    }
    await rwait(1000, 3000);

    // 5. 创意视频（最多5次）
    if (shouldRun('video') || shouldRun('advert')) {
      const at = tasks.find(x => x.taskType === 'advert');
      const advTotal = at?.total || 5;
      if (at && at.status === 1) {
        res[`视频 ${advTotal}/${advTotal}`] = '✓';
        $.log(`看创意视频: ✅ 已完成 ${advTotal}/${advTotal}`);
      } else {
        let okCnt = 0;
        for (let i = 0; i < advTotal; i++) {
          await doListen(uid, sid, 'videoadver', 58);
          okCnt++;
          await rwait(2000, 5000);
        }
        const advOk = await finishTask(uid, sid, 'advert', 10);
        res[`视频 ${okCnt}/${advTotal}`] = advOk ? '✓' : '✗';
      }
      logTime.push(ts());
    }

    // 等级成长值
    let rankStr = '';
    const rankRes = await httpGet(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
    const rankData = tryParse(rankRes.body);
    if (rankData?.code === 200) {
      rankStr = `Lv.${rankData.data.rank} 成长值:${rankData.data.score}`;
      $.log(rankStr);
    }

    // 组装每个账号通知块
    const hasFail = Object.values(res).some(v => v === '✗');
    const taskLines = Object.entries(res).map(([k, v], i) => {
      const t = logTime[i] || ts();
      return `${t}  ${v === '✓' ? '✅' : '❌'} ${k}`;
    });
    allBodies.push(`👤 ${nickname}\n${taskLines.join('\n')}\n────────────────\n🏆 ${rankStr}`);
  }

  // 最终通知拼装
  let notifyBody;
  if (allBodies.length === 0) {
    notifyBody = `────────────────\n⚠️ 没有可用账号\n────────────────\n🎯 失败`;
  } else if (validAccounts === 0 && expiredAccounts > 0) {
    notifyBody = `────────────────\n${allBodies.join('\n\n')}\n\n────────────────\n🎯 Cookie 全部过期  ${expiredAccounts}/${accounts.length}`;
  } else {
    notifyBody = `────────────────\n${allBodies.join('\n\n')}\n\n────────────────\n🎯 全部完成  ${validAccounts}/${accounts.length}`;
  }

  $.msg($.name, `${((Date.now() - $.startTime) / 1000).toFixed(2)}s`, notifyBody);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

async function doListen(uid, sid, from, goldNum, extraGoldNum) {
  const names = { sign: '签到', mobile: '听歌10分钟', novel: '听小说10分钟', comment: '发布评论', videoadver: '看创意视频' };
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

function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }
function rwait(min, max) { return $.wait(min + Math.floor(Math.random() * (max - min))); }

function httpGet(url) {
  if (DEBUG) $.log(`[HTTP→] GET ${url}`);
  return new Promise((resolve, reject) => {
    const opts = { url, headers: H };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => { if (DEBUG) $.log(`[HTTP←] ${r.statusCode} ${r.body.substring(0,300)}`); resolve({ status: r.statusCode, body: r.body }); }).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, (err, resp, body) => { if (err) reject(err); else { if (DEBUG) $.log(`[HTTP←] ${resp.status||resp.statusCode} ${body.substring(0,300)}`); resolve({ status: resp.status || resp.statusCode, body }); } });
    else reject(new Error('不支持的平台'));
  });
}

function Env(name, opts) {
  class _env {
    constructor(n, o) { this.name = n; this.data = null; this.logs = []; this.startTime = Date.now(); this.log(`🔔 ${this.name}, 开始!`); }
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
    log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
    logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    msg(t, s, c) {
      switch (this.getEnv()) {
        case 'Quantumult X': $notify(t, s||'', c||''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $notification.post(t, s||'', c||''); break;
        case 'Node.js': console.log(`${t}: ${s} - ${c}`); break;
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
