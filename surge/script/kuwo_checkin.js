/*
酷我音乐 升级签到 — Surge 自包含版
由 surge/script/kuwo_upgrade.sgmodule 引用

功能：每日签到 + 听歌10分钟 + 听小说10分钟 + 发布评论 + 看创意视频x5

Cookie 采集: Surge 点击模块启用后，打开 https://h5app.kuwo.cn 登录触发
Cookie 格式: userid@websid（多账号用 & 分隔）
*/

const KW_NAME = '酷我音乐(升级)';
const KW_STORAGE_KEY = 'kuwo_upgrade';
const KW_COOKIE_SEP = '&';
const KW_API = 'https://integralapi.kuwo.cn';
const KW_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage';
const KW_HEADERS = {
  'Origin': 'https://h5app.kuwo.cn',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': KW_UA,
  'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
};

const $ = new Env(KW_NAME);

!(async () => {
  // Cookie 采集模式
  if (typeof $request !== 'undefined') {
    if ($request.url.includes('userBase')) {
      const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
      if (cookie) {
        const uid = cookie.match(/userid=(\d+)/);
        const sid = cookie.match(/websid=(\d+)/);
        if (uid && sid) {
          const val = uid[1] + '@' + sid[1];
          let list = ($.getdata(KW_STORAGE_KEY) || '').split(KW_COOKIE_SEP).filter(Boolean);
          if (!list.includes(val)) {
            list.push(val);
            $.setdata(list.join(KW_COOKIE_SEP), KW_STORAGE_KEY);
          }
          $.msg(KW_NAME, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
        }
      }
    }
    $.done();
    return;
  }

  // 定时任务：执行签到
  const raw = $.getdata(KW_STORAGE_KEY);
  if (!raw) {
    $.msg(KW_NAME, '⚠️ 未获取到 Cookie', '请先登录酷我音乐触发采集');
    $.done();
    return;
  }

  const accounts = raw.split(KW_COOKIE_SEP).map(a => a.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;

    // 获取用户信息验证 Cookie
    const ubRes = await httpGet(`${KW_API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
    let ubData;
    try { ubData = JSON.parse(ubRes.body); } catch { ubData = null; }
    const nickname = ubData?.data?.nickname || '';
    if (!nickname) {
      $.log(`[${uid}] Cookie 已失效`);
      continue;
    }
    const name = nickname || uid;
    $.log(`\n[${name}]`);

    // 任务列表
    const tlRes = await httpGet(`${KW_API}/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
    let tasks;
    try { tasks = JSON.parse(tlRes.body)?.data; } catch { tasks = null; }
    if (!tasks) { $.log(`${name}: 获取任务列表失败`); continue; }

    // 签到
    const signTask = tasks.find(x => x.taskType === 'sign');
    if (signTask && signTask.status !== 1) {
      const sRes = await httpGet(`${KW_API}/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`);
      let sData;
      try { sData = JSON.parse(sRes.body); } catch { sData = null; }
      $.log(`签到: ${sData?.code === 200 ? '✅ 成功' : sData?.msg || '❌ 失败'}`);
    } else { $.log('签到: 今日已签到'); }

    // 听歌、小说、评论
    const taskTypes = ['mobile', 'novel', 'comment'];
    const golds = { mobile: 18, novel: 18, comment: 10 };
    const taskNames = { mobile: '听歌10分钟', novel: '听小说10分钟', comment: '发布评论' };
    for (const tt of taskTypes) {
      const r = await httpGet(`${KW_API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=${tt}&goldNum=${golds[tt]}`);
      let j;
      try { j = JSON.parse(r.body); } catch { j = null; }
      $.log(`${taskNames[tt]}: ${j?.code === 200 ? '✅ 成功' : j?.data?.description || j?.msg || '❌ 失败'}`);
      if (tt !== taskTypes[taskTypes.length - 1]) {
        const d = 2000 + Math.floor(Math.random() * 4000);
        await $.wait(d);
      }
    }

    // 看创意视频
    const advTask = tasks.find(x => x.taskType === 'advert');
    const remain = (advTask?.total || 5) - (advTask?.finishCount || 0);
    if (remain > 0) {
      let ok = 0;
      for (let i = 0; i < remain; i++) {
        const r = await httpGet(`${KW_API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`);
        let j;
        try { j = JSON.parse(r.body); } catch { j = null; }
        if (j?.code === 200) ok++;
        if (i < remain - 1) {
          const delay = 3000 + Math.floor(Math.random() * 5000);
          $.log(`  等待 ${(delay/1000).toFixed(1)}s 后看下一个...`);
          await $.wait(delay);
        }
      }
      $.log(`看创意视频: ${ok}/${remain}`);
    } else { $.log('看创意视频: 今日已完成'); }

    // 等级
    const rankRes = await httpGet(`${KW_API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
    try {
      const rData = JSON.parse(rankRes.body);
      if (rData.code === 200) $.log(`Lv.${rData.data.rank} 成长值:${rData.data.score}`);
    } catch {}
  }

  $.done();
})().catch(e => { $.logErr(e); $.done(); });

// ── HTTP helper ──
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: KW_HEADERS };
    if (typeof $task !== 'undefined') {
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers })).catch(e => reject(e));
    } else if (typeof $httpClient !== 'undefined') {
      $httpClient.get(opts, (err, resp, body) => {
        if (err) reject(err);
        else resolve({ status: resp.status || resp.statusCode, body, headers: resp.headers || {} });
      });
    } else {
      reject(new Error('不支持的平台'));
    }
  });
}

// ── Env ──
function Env(name, opts) {
  return new (class {
    constructor(name, opts) {
      this.name = name;
      this.data = null;
      this.logs = [];
      this.startTime = Date.now();
      this.log(`🔔 ${this.name}, 开始!`);
    }
    getEnv() {
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $rocket !== 'undefined') return 'Shadowrocket';
      return 'Unknown';
    }
    isNode() { return this.getEnv() === 'Node.js'; }
    isQuanX() { return this.getEnv() === 'Quantumult X'; }
    isSurge() { return this.getEnv() === 'Surge'; }
    isLoon() { return this.getEnv() === 'Loon'; }
    getdata(key) {
      switch (this.getEnv()) {
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.read(key) || '';
        case 'Quantumult X': return $prefs.valueForKey(key) || '';
        case 'Node.js': return this.data && this.data[key] || process.env[key] || '';
        default: return '';
      }
    }
    setdata(val, key) {
      switch (this.getEnv()) {
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.write(val, key);
        case 'Quantumult X': return $prefs.setValueForKey(val, key);
        case 'Node.js': this.data = this.data || {}; this.data[key] = val; return true;
        default: return false;
      }
    }
    log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
    logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    msg(title, subtitle, content) {
      switch (this.getEnv()) {
        case 'Quantumult X': $notify(title, subtitle || '', content || ''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
          $notification.post(title, subtitle || '', content || ''); break;
        case 'Node.js': console.log(`${title}: ${subtitle} - ${content}`); break;
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
  })(name, opts);
}
