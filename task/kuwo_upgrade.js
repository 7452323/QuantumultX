/*
酷我音乐 升级签到 — for Quantumult X
Quantumult X 专用版（不依赖 checkin 框架）

[rewrite_local]
^https?:\/\/integralapi\.kuwo\.cn\/api\/v1\/online\/sign\/v1\/music\/userBase url script-request-header kuwo_upgrade.js

[task_local]
30 8 * * * kuwo_upgrade.js, tag=酷我音乐(升级), enabled=true

[mitm]
hostname = integralapi.kuwo.cn

流程：
1. 取 taskList 检测各任务状态（已完成的跳过）
2. 只对未完成的任务调 doListen 完成 + finishTask 领奖
3. 创意视频调 doListen 3 次 + finishTask

Cookie 采集：需采集 integralapi（userid@websid）
多账号用 & 分隔
*/

const $ = new Env('酷我音乐(升级)');

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

!(async () => {
  if (typeof $request !== 'undefined') {
    handleCookie();
    return;
  }

  const raw = $.getdata(KEY);
  if (!raw) {
    $.msg($.name, '⚠️ 未获取到 Cookie', '请先登录酷我音乐触发采集');
    $.done();
    return;
  }

  const accounts = raw.split(SEP).map(a => a.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;

    const ubRes = await httpGet(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
    const ubData = tryParse(ubRes.body);
    const nickname = ubData?.data?.nickname || '';
    if (!nickname) { $.log(`[${uid}] Cookie 已失效，跳过`); continue; }
    $.log(`\n[${nickname}]`);

    // 获取 taskList
    const tlRes = await httpGet(`${API}/openapi/v1/usersystem/taskList?loginUid=${uid}&loginSid=${sid}&appUid=2782700304&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
    const tlData = tryParse(tlRes.body);
    const tasks = tlData?.data || [];

    // 1. 签到
    const st = tasks.find(x => x.taskType === 'sign');
    if (st && st.status === 1) {
      $.log(`每日签到: ✅ 已签到 (+${st.developValue} 成长值)`);
    } else {
      await doListen(uid, sid, 'sign', 0, 110);
      await finishTask(uid, sid, 'sign', 10);
    }
    await rwait(1000, 3000);

    // 2. 听歌10分钟
    const mt = tasks.find(x => x.taskType === 'music');
    if (mt && mt.status === 1) {
      $.log('听歌10分钟: ✅ 已完成');
    } else {
      await doListen(uid, sid, 'mobile', 18);
      await finishTask(uid, sid, 'music', 18);
    }
    await rwait(1000, 3000);

    // 3. 听小说10分钟
    const nt = tasks.find(x => x.taskType === 'novel');
    if (nt && nt.status === 1) {
      $.log('听小说10分钟: ✅ 已完成');
    } else {
      await doListen(uid, sid, 'novel', 18);
      await finishTask(uid, sid, 'novel', 18);
    }
    await rwait(1000, 3000);

    // 4. 发布评论
    const ct = tasks.find(x => x.taskType === 'comment');
    if (ct && ct.status === 1) {
      $.log('发布评论: ✅ 已完成');
    } else {
      await doListen(uid, sid, 'comment', 10);
      await finishTask(uid, sid, 'comment', 10);
    }
    await rwait(1000, 3000);

    // 5. 创意视频
    const at = tasks.find(x => x.taskType === 'advert');
    if (at && at.status === 1) {
      $.log('看创意视频: ✅ 已完成');
    } else {
      for (let i = 0; i < 3; i++) {
        await doListen(uid, sid, 'videoadver', 58);
        await rwait(2000, 5000);
      }
      await finishTask(uid, sid, 'advert', 10);
    }

    // 等级
    const rankRes = await httpGet(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
    const rankData = tryParse(rankRes.body);
    if (rankData?.code === 200) $.log(`Lv.${rankData.data.rank} 成长值:${rankData.data.score}`);
  }

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
  return new Promise((resolve, reject) => {
    const opts = { url, headers: H };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, (err, resp, body) => { if (err) reject(err); else resolve({ status: resp.status || resp.statusCode, body }); });
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
      this.msg(this.name, this.logs.filter(l => l.includes('❌')).length > 0 ? '⚠️ 部分任务失败' : '✅ 全部成功', '');
      switch (this.getEnv()) {
        case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $done(); break;
        case 'Node.js': process.exit(0); break;
      }
    }
  }
  return new _env(name, opts);
}
