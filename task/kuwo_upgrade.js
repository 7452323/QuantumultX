/* 酷我音乐 升级签到
cron 30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwo_upgrade.js

脚本兼容: Surge, Quantumult X, Loon, Shadowrocket, Node.js

功能：每日签到 + 听歌10分钟 + 听小说10分钟 + 发布评论 + 看创意视频x5

Cookie 采集: 登录酷我音乐后抓 integralapi.kuwo.cn 请求，取 Cookie 中的 userid 和 websid
Cookie 格式: userid@websid（多账号用 & 分隔）
环境变量: KUWO_COOKIE

[rewrite_local]
^https?:\/\/integralapi\.kuwo\.cn\/api\/v1\/online\/sign\/v1\/music\/userBase url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwo_upgrade.js

[task_local]
30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwo_upgrade.js, tag=酷我音乐(升级), enabled=true

[MITM]
hostname = integralapi.kuwo.cn

⚠️ 免责声明:
1、此脚本仅用于学习研究，请于下载后24小时内删除。
2、使用本脚本所造成的一切后果由使用者自行承担。
*/

const $ = new Env('酷我音乐(升级)');
const logs = 0;
let notifyMsg = [];

// Cookie 采集
if (typeof $request !== 'undefined') {
  if ($request.url.includes('userBase')) {
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) {
      const uid = cookie.match(/userid=(\d+)/);
      const sid = cookie.match(/websid=(\d+)/);
      if (uid && sid) {
        const val = uid[1] + '@' + sid[1];
        let list = ($.getdata('kuwo_upgrade') || '').split('&').filter(Boolean);
        if (!list.includes(val)) {
          list.push(val);
          $.setdata(list.join('&'), 'kuwo_upgrade');
        }
        $.msg($.name, `Cookie 已保存 (${list.length} 个账号)`, '');
      }
    }
  }
  $done();
}

// Cookie 读取
const isNode = typeof process !== 'undefined' && process.env;
let accounts = $.getdata('kuwo_upgrade') || (isNode ? process.env.KUWO_COOKIE : '') || '';
let accountArr = accounts.split(/[&]/).map(a => a.trim()).filter(Boolean);
if (!accountArr.length) {
  $.msg($.name, '⚠️ 未获取到Cookie', '请先登录酷我音乐');
  $done();
}

const kw_headers = {
  'Origin': 'https://h5app.kuwo.cn',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
  'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
};

const API = 'https://integralapi.kuwo.cn';

!(async () => {
  $.log(`检测到 ${accountArr.length} 个账户`);
  for (let i = 0; i < accountArr.length; i++) {
    const ID = accountArr[i];
    if (!ID.includes('@')) continue;
    const [uid, sid] = ID.split('@');
    const nickname = await getNickname(uid);
    const name = nickname || `用户${i + 1}`;
    if (!nickname) {
      $.msg($.name, `⚠️ ${name}`, 'Cookie 已失效');
      continue;
    }
    notifyMsg = [`【${name}】`];
    $.log(`执行 - ${name}`);

    const tasks = await getTasks(uid, sid);
    if (!tasks) { notifyMsg.push('❌ 获取任务列表失败'); sendMsg(); continue; }

    await doSign(uid, sid, tasks);
    await doMusic(uid, sid);
    await doNovel(uid, sid);
    await doComment(uid, sid);
    await doAdvert(uid, sid, tasks);
    await checkRank(uid, sid);
    sendMsg();
  }
})().catch(e => $.logErr(e)).finally(() => $done());

function sendMsg() {
  const msg = notifyMsg.join('\n');
  if ($.isNode()) {
    try { require('./sendNotify').sendNotify($.name, msg); } catch {}
  } else { $.msg($.name, '', msg); }
}

// API
async function httpGet(url) {
  return new Promise(r => {
    $.get({ url, headers: kw_headers }, (err, resp, data) => {
      try { r(JSON.parse(data)); } catch { r(null); }
    });
  });
}

async function getNickname(uid) {
  const res = await httpGet(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
  return res?.data?.nickname || '';
}

async function getTasks(uid, sid) {
  const res = await httpGet(`${API}/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
  return res?.data || null;
}

async function doSign(uid, sid, tasks) {
  const t = tasks.find(x => x.taskType === 'sign');
  if (!t) { notifyMsg.push('⚠️ 未找到签到任务'); return; }
  if (t.status === 1) { notifyMsg.push('🟢 每日签到: 今日已签到'); return; }
  const res = await httpGet(`${API}/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`);
  if (res?.code === 200) notifyMsg.push('🎉 每日签到: 成功');
  else notifyMsg.push(`⚠️ 每日签到: ${res?.msg || '失败'}`);
}

async function doMusic(uid, sid) {
  const res = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=mobile&goldNum=18`);
  if (res?.code === 200) notifyMsg.push('🎉 听歌10分钟: 成功');
  else notifyMsg.push(res?.data?.description === '今天已完成任务' ? '🟢 听歌10分钟: 今日已完成' : `⚠️ 听歌10分钟: ${res?.msg || '失败'}`);
}

async function doNovel(uid, sid) {
  const res = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=novel&goldNum=18`);
  if (res?.code === 200) notifyMsg.push('🎉 听小说10分钟: 成功');
  else notifyMsg.push(res?.data?.description === '今天已完成任务' ? '🟢 听小说10分钟: 今日已完成' : `⚠️ 听小说10分钟: ${res?.msg || '失败'}`);
}

async function doComment(uid, sid) {
  const res = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=comment&goldNum=10`);
  if (res?.code === 200) notifyMsg.push('🎉 发布评论: 成功');
  else notifyMsg.push(res?.data?.description === '今天已完成任务' ? '🟢 发布评论: 今日已完成' : `⚠️ 发布评论: ${res?.msg || '失败'}`);
}

async function doAdvert(uid, sid, tasks) {
  const t = tasks.find(x => x.taskType === 'advert');
  const total = t?.total || 5;
  const done = t?.finishCount || 0;
  const remain = total - done;
  if (remain <= 0) { notifyMsg.push('🟢 看创意视频: 今日已完成'); return; }
  let ok = 0;
  for (let i = 0; i < remain; i++) {
    const res = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`);
    if (res?.code === 200) ok++;
    await $.wait(2000);
  }
  notifyMsg.push(ok > 0 ? `🎉 看创意视频: 成功 ${ok}/${remain} 次` : '❌ 看创意视频: 失败');
}

async function checkRank(uid, sid) {
  const res = await httpGet(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
  if (res?.code === 200) notifyMsg.push(`📊 Lv.${res.data.rank} | 成长值: ${res.data.score}`);
}

// Env
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
    get(t, s) {
      if (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()) {
        $httpClient.get(t, (e, r, i) => { if (!e && r) { r.body = i; r.statusCode = r.status || r.statusCode; r.status = r.statusCode; } s(e, r, i); });
      } else if (this.isQuanX()) {
        $task.fetch(t).then(r => { const { statusCode: e, statusCode: i, headers: r2, body: o } = r; s(null, { status: e, statusCode: i, headers: r2, body: o }, o); }, e => s(e?.error || 'UndefinedError'));
      } else if (this.isNode()) {
        if (!this.got) { this.got = require('got'); }
        this.got(t).then(r => s(null, { status: r.statusCode, headers: r.headers, body: r.body }, r.body)).catch(e => s(e.message || 'Error'));
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
