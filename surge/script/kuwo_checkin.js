/*
酷我音乐 升级签到 — Surge 自包含版
由 surge/script/kuwo_upgrade.sgmodule 引用

流程：doListen 完成任务 → finishTask 领取奖励（两步走）

Cookie 采集：需同时采集 integralapi 和 www.kuwo.cn
  integralapi: userid@websid（多账号 & 分隔）
  www.kuwo.cn: 含 Hm_Iuvt token（用于发真实评论）
*/

const KW_NAME = '酷我音乐(升级)';
const KW_COOKIE_KEY = 'kuwo_upgrade';
const KW_WEB_KEY = 'kuwo_upgrade_web';
const KW_SEP = '&';
const KW_API = 'https://integralapi.kuwo.cn';
const KW_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage';
const KW_H = {
  'Origin': 'https://h5app.kuwo.cn',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': KW_UA,
  'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
};
const COMMENT_API = 'https://comment.kuwo.cn/com.s';

const CHECKIN_TEXTS = [
  '打卡', '签到打卡', '每日打卡', '我来打卡了', '打卡第N天',
  '滴~打卡', '日常打卡', '今天也打卡', '坚持打卡', '打卡一下',
  '打个卡', '到这打卡', '听歌打卡', '顺便打卡', '走一个',
  '来了', '今日打卡', '滴滴打卡', '照常打卡', '习惯性打卡'
];

const $ = new Env(KW_NAME);

!(async () => {
  if (typeof $request !== 'undefined') {
    handleCookieCapture();
    return;
  }

  const raw = $.getdata(KW_COOKIE_KEY);
  if (!raw) {
    $.msg(KW_NAME, '⚠️ 未获取到 Cookie', '请先登录酷我音乐触发采集');
    $.done();
    return;
  }

  let webCookie = $.getdata(KW_WEB_KEY);
  const accounts = raw.split(KW_SEP).map(a => a.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;

    const ubRes = await httpGet(`${KW_API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
    const nickname = tryParse(ubRes.body)?.data?.nickname || '';
    if (!nickname) { $.log(`[${uid}] Cookie 已失效`); continue; }
    $.log(`\n[${nickname}]`);

    // 1. 签到
    await doDoListen(uid, sid, 'sign', 0, 110);
    await finishTask(uid, sid, 'sign', 10);
    await rwait(2000, 4000);

    // 2. 听歌10分钟
    await doDoListen(uid, sid, 'mobile', 18);
    await finishTask(uid, sid, 'mobile', 18);
    await rwait(2000, 4000);

    // 3. 听小说10分钟
    await doDoListen(uid, sid, 'novel', 18);
    await finishTask(uid, sid, 'novel', 18);
    await rwait(2000, 4000);

    // 4. 发布评论（真实打卡 + finishTask）
    if (webCookie && webCookie.includes('Hm_Iuvt')) {
      await doRealComment(uid, sid, webCookie);
    } else {
      // 没有 web cookie 也硬调
      await doDoListen(uid, sid, 'comment', 10);
      await finishTask(uid, sid, 'comment', 10);
      $.log('发布评论: 无 Hm_Iuvt，仅 doListen+finishTask');
    }
    await rwait(2000, 4000);

    // 5. 创意视频（调多次确保完成）
    for (let i = 0; i < 3; i++) {
      await doDoListen(uid, sid, 'videoadver', 58);
      await rwait(2000, 5000);
    }
    await finishTask(uid, sid, 'advert', 10);

    // 等级查询
    const rankRes = await httpGet(`${KW_API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
    const rankData = tryParse(rankRes.body);
    if (rankData?.code === 200) $.log(`Lv.${rankData.data.rank} 成长值:${rankData.data.score}`);
  }

  $.done();
})().catch(e => { $.logErr(e); $.done(); });

// ─── 核心函数 ───

// doListen：完成任务
async function doDoListen(uid, sid, from, goldNum, extraGoldNum) {
  const names = { sign: '签到', mobile: '听歌10分钟', novel: '听小说10分钟', comment: '发布评论', videoadver: '看创意视频' };
  const taskName = names[from] || from;

  let url = `${KW_API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=${from}`;
  if (goldNum > 0) url += `&goldNum=${goldNum}`;
  if (extraGoldNum > 0) url += `&extraGoldNum=${extraGoldNum}`;

  const res = await httpGet(url);
  const data = tryParse(res.body);
  if (data?.code === 200) {
    const desc = data.data?.description || '成功';
    $.log(`${taskName}: ✅ ${desc}`);
  } else {
    $.log(`${taskName}: ❌ ${data?.msg || '失败'}`);
  }
}

// finishTask：领取奖励
async function finishTask(uid, sid, from, goldNum) {
  const url = `${KW_API}/openapi/v1/usersystem/finishTask?loginUid=${uid}&loginSid=${sid}&appUid=${uid}&from=${from}&goldNum=${goldNum}&mobile=&terminal=ip`;
  const res = await httpGet(url);
  const data = tryParse(res.body);
  return data?.code === 200;
}

// 真实评论打卡
async function doRealComment(uid, sid, webCookie) {
  const hmMatch = webCookie.match(/Hm_Iuvt_cdb524f42f0ce19b169b8072123a4727=([^;]+)/);
  if (!hmMatch) {
    await doDoListen(uid, sid, 'comment', 10);
    await finishTask(uid, sid, 'comment', 10);
    $.log('发布评论: ⛔ 无 Hm_Iuvt');
    return;
  }

  // 先发真实评论
  const hotSongRid = '3548250545';
  const text = CHECKIN_TEXTS[Math.floor(Math.random() * CHECKIN_TEXTS.length)];
  const secret = calcKuwoSecret(hmMatch[1], hmMatch[1]);

  try {
    const res = await httpPost(`${COMMENT_API}?type=add_comment&f=web&sid=${hotSongRid}&digest=15&content=${encodeURIComponent(text)}`, {
      'Cookie': webCookie,
      'Secret': secret,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
      'Referer': 'https://kuwo.cn/',
      'Origin': 'https://kuwo.cn'
    });
    const data = tryParse(res.body);
    if (data && String(data.code) === '200') {
      $.log(`发布评论: ✅ 打卡成功「${text}」`);
    } else {
      $.log(`发布评论: ❌ ${data?.msg || '评论失败'}`);
    }
  } catch (e) {
    $.log(`发布评论: ❌ ${e.message}`);
  }

  // 再 doListen + finishTask 确保领到经验
  await rwait(1000, 2000);
  await doDoListen(uid, sid, 'comment', 10);
  await finishTask(uid, sid, 'comment', 10);
}

// Cookie 采集
function handleCookieCapture() {
  const url = $request.url || '';
  if (url.includes('integralapi.kuwo.cn') && url.includes('userBase')) {
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) {
      const uid = cookie.match(/userid=(\d+)/);
      const sid = cookie.match(/websid=(\d+)/);
      if (uid && sid) {
        const val = uid[1] + '@' + sid[1];
        let list = ($.getdata(KW_COOKIE_KEY) || '').split(KW_SEP).filter(Boolean);
        if (!list.includes(val)) {
          list.push(val);
          $.setdata(list.join(KW_SEP), KW_COOKIE_KEY);
        }
        $.msg(KW_NAME, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
      }
    }
  }
  if (url.includes('www.kuwo.cn')) {
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie && cookie.includes('Hm_Iuvt')) {
      $.setdata(cookie, KW_WEB_KEY);
      $.msg(KW_NAME, '✅ kuwo.cn Cookie 已保存', '可发真实评论');
    }
  }
  $.done();
}

// Secret 算法
function calcKuwoSecret(t, e) {
  if (!e) return '';
  let n = '';
  for (let i = 0; i < e.length; i++) n += e.charCodeAt(i).toString();
  const r = Math.floor(n.length / 5);
  const o = parseInt(n.charAt(r) + n.charAt(2*r) + n.charAt(3*r) + n.charAt(4*r) + n.charAt(5*r));
  const l = Math.ceil(e.length / 2);
  const c = Math.pow(2, 31) - 1;
  if (o < 2) return '';
  let d = Math.round(1e9 * Math.random()) % 1e8;
  n += d;
  while (n.length > 10) n = (parseInt(n.substring(0,10)) + parseInt(n.substring(10))).toString();
  n = (o * parseInt(n) + l) % c;
  let f = '';
  for (let i = 0; i < t.length; i++) {
    const h = t.charCodeAt(i) ^ Math.floor(n / c * 255);
    f += (h < 16 ? '0' : '') + h.toString(16);
    n = (o * n + l) % c;
  }
  let dHex = d.toString(16);
  while (dHex.length < 8) dHex = '0' + dHex;
  return f + dHex;
}

// 工具
function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }
function rwait(min, max) { return $.wait(min + Math.floor(Math.random() * (max - min))); }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: KW_H };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, (err, resp, body) => { if (err) reject(err); else resolve({ status: resp.status || resp.statusCode, body }); });
    else reject(new Error('不支持的平台'));
  });
}

function httpPost(url, headers) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers };
    if (typeof $task !== 'undefined')
      $task.fetch({ ...opts, method: 'POST' }).then(r => resolve({ status: r.statusCode, body: r.body })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.post(opts, (err, resp, body) => { if (err) reject(err); else resolve({ status: resp.status || resp.statusCode, body }); });
    else reject(new Error('不支持的平台'));
  });
}

// Env
function Env(name, opts) {
  return new (class {
    constructor(n, o) { this.name = n; this.data = null; this.logs = []; this.startTime = Date.now(); this.log(`🔔 ${this.name}, 开始!`); }
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
    getdata(k) {
      switch (this.getEnv()) {
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.read(k) || '';
        case 'Quantumult X': return $prefs.valueForKey(k) || '';
        case 'Node.js': return this.data && this.data[k] || process.env[k] || '';
        default: return '';
      }
    }
    setdata(v, k) {
      switch (this.getEnv()) {
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.write(v, k);
        case 'Quantumult X': return $prefs.setValueForKey(v, k);
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
  })(name, opts);
}
