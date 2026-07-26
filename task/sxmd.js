/*
书香门第论坛签到 — www.txtnovel.vip

Cookie 变量名：sxmd_data
单账号

[rewrite_local]
^http:\/\/www\.txtnovel\.vip\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sxmd.js

[task_local]
30 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sxmd.js, tag=书香门第签到, enabled=true

[MITM]
hostname = www.txtnovel.vip
*/

const $ = new Env('书香门第签到');

const ARG = {};
if (typeof $argument === 'string') {
  $argument.split('&').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) ARG[p.slice(0, idx)] = p.slice(idx + 1);
  });
}
const ENABLE_COOKIE = ARG.enable_cookie !== '0';
const DEBUG = ARG.debug === '1';

const COOKIE_KEY = 'sxmd_data';
const BASE_URL = 'http://www.txtnovel.vip';

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

!(async () => {
  // rewrite 模式：采集 Cookie
  if (typeof $request !== 'undefined') {
    if (!ENABLE_COOKIE) { $.done(); return; }
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) {
      $.setdata(cookie, COOKIE_KEY);
      $.msg($.name, '✅ Cookie 已保存', '');
    } else {
      $.msg($.name, '❌ 采集失败', '未获取到 Cookie');
    }
    $.done();
    return;
  }

  // task 模式：签到
  const cookie = $.getdata(COOKIE_KEY);
  if (!cookie) {
    $.msg($.name, '',
      `⚠️ 未获取到 Cookie\n\n请先访问 txtnovel.vip 触发采集\n\n🎯 失败`);
    $.done();
    return;
  }

  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';
  const commonHeaders = {
    'User-Agent': ua,
    'Cookie': cookie,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9'
  };

  // 1. 访问签到页获取 formhash 和 uid
  $.log('步骤1: 访问签到页');
  const pageRes = await httpGet(`${BASE_URL}/plugin.php?id=dsu_paulsign:sign`, commonHeaders);
  const pageBody = pageRes.body || '';
  const formhashMatch = pageBody.match(/name="formhash" value="([^"]+)"/);
  const formhash = formhashMatch ? formhashMatch[1] : '';

  // 从页面链接提取 uid（如 space&amp;uid=6149）
  const uidMatch = pageBody.match(/uid=(\d+)/);
  const uid = uidMatch ? uidMatch[1] : '';

  // 获取用户名（从个人资料页）
  let nickname = '';
  if (uid) {
    const profileRes = await httpGet(`${BASE_URL}/home.php?mod=space&uid=${uid}`, commonHeaders);
    const profileBody = profileRes.body || '';
    // 标题格式: "flyker的个人资料 - 书香门第 - 手机版"
    const titleMatch = profileBody.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const title = titleMatch[1];
      const atIdx = title.indexOf('的');
      if (atIdx > 0) nickname = title.substring(0, atIdx);
    }
  }
  if (!nickname) nickname = uid ? `UID ${uid}` : 'txtnovel';
  $.log(`用户: ${nickname} (uid: ${uid})`);

  if (!formhash) {
    $.log('❌ 未获取到 formhash');
    $.msg($.name, '',
      `「${nickname}」签到失败\nCookie 已过期，请重新采集\n\n🎯 失败`);
    $.done();
    return;
  }
  $.log(`formhash: ${formhash}`);

  // 2. POST 签到
  $.log('步骤2: 执行签到');
  const signRes = await httpPost(
    `${BASE_URL}/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=0&inajax=0&mobile=yes`,
    {
      ...commonHeaders,
      'Origin': BASE_URL,
      'Referer': `${BASE_URL}/plugin.php?id=dsu_paulsign:sign`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    `formhash=${formhash}&qdxq=kx`
  );
  const signBody = signRes.body || '';
  if (DEBUG) $.log(`签到响应(长度: ${signBody.length}): ${signBody.substring(0, 800)}`);

  // 3. 解析结果
  let notifyBody;
  let isRepeat = false;

  if (signBody.includes('已经签到') || signBody.includes('今日已经签到')) {
    // 已经签到过：重复签到
    isRepeat = true;
    $.log('ℹ️ 今日已签到（重复签到）');
  }

  // 提取金币信息
  let totalCoin = '?', gainedCoin = '?';

  // 总奖励
  const totalMatch = signBody.match(/总奖励.{0,10}金币\s*(\d+)\s*枚/);
  if (totalMatch) totalCoin = totalMatch[1];

  // 随机奖励（本次获得）
  const gainedMatch = signBody.match(/获得随机奖励\s*金币\s*(\d+)\s*枚/) || signBody.match(/随机奖励\s*金币\s*(\d+)\s*枚/);
  if (gainedMatch) gainedCoin = gainedMatch[1];

  // 尝试从页面查找当前积分（用于重复签到场景）
  if (isRepeat && totalCoin === '?') {
    // 在签到页查找当前积分
    const creditMatch = pageBody.match(/金币.?(\d+)/) || signBody.match(/金币.?(\d+)/);
    if (creditMatch) totalCoin = creditMatch[1];
  }

  if (isRepeat) {
    $.log(`✅ 重复签到，总金币: ${totalCoin}`);
    notifyBody = `「${nickname}」重复签到 ${totalCoin}`;
  } else if (signBody.includes('签到成功')) {
    $.log(`✅ 签到成功，总金币: ${totalCoin}，本次: ${gainedCoin}`);
    notifyBody = `「${nickname}」签到成功 ${totalCoin}+${gainedCoin}`;
  } else {
    const err = signBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 200);
    $.log(`❌ 签到失败: ${err}`);
    notifyBody = `「${nickname}」签到失败\n💬 ${err}\n\n🎯 失败`;
  }

  $.msg($.name, '', notifyBody);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

function httpGet(url, headers) {
  if (DEBUG) $.log(`[HTTP→] GET ${url}`);
  return new Promise((resolve, reject) => {
    const opts = { url, headers };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => { if (DEBUG) $.log(`[HTTP←] ${r.statusCode} ${r.body.substring(0,300)}`); resolve({ status: r.statusCode, body: r.body }); }).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, (err, resp, body) => { if (err) reject(err); else { if (DEBUG) $.log(`[HTTP←] ${resp.status||resp.statusCode} ${body.substring(0,300)}`); resolve({ status: resp.status || resp.statusCode, body }); } });
    else reject(new Error('不支持的平台'));
  });
}

function httpPost(url, headers, body) {
  if (DEBUG) $.log(`[HTTP→] POST ${url}`);
  return new Promise((resolve, reject) => {
    const opts = { url, headers, body, method: 'POST' };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => { if (DEBUG) $.log(`[HTTP←] ${r.statusCode} ${r.body.substring(0,300)}`); resolve({ status: r.statusCode, body: r.body }); }).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.post(opts, (err, resp, data) => { if (err) reject(err); else { if (DEBUG) $.log(`[HTTP←] ${resp.status||resp.statusCode} ${data.substring(0,300)}`); resolve({ status: resp.status || resp.statusCode, body: data }); } });
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
