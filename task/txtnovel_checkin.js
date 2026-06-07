/*
书香门第论坛签到 — www.txtnovel.vip
Discuz dsu_paulsign 插件，采集 Cookie + POST 签到
Surge/QX 通用版

支持环境变量（通过 $argument 传入）：
  enable_cookie: 1=启用Cookie采集(默认) 0=关闭

[rewrite_local]
^http:\/\/www\.txtnovel\.vip\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/txtnovel_checkin.js

[task_local]
30 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/txtnovel_checkin.js, tag=书香门第签到, enabled=true

[MITM]
hostname = www.txtnovel.vip
*/

const $ = new Env('书香门第签到');

// 解析 $argument
const ARG = {};
if (typeof $argument === 'string') {
  $argument.split('&').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) ARG[p.slice(0, idx)] = p.slice(idx + 1);
  });
}
const ENABLE_COOKIE = ARG.enable_cookie !== '0';
const DEBUG = ARG.debug === '1';

const COOKIE_KEY = 'txtnovel_cookie';
const BASE_URL = 'http://www.txtnovel.vip';

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

!(async () => {
  // rewrite 模式：采集 Cookie
  if (typeof $request !== 'undefined') {
    if (!ENABLE_COOKIE) {
      $.done();
      return;
    }
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

  // 1. 访问签到页获取 formhash
  $.log('步骤1: 访问签到页获取 formhash');
  const pageRes = await httpGet(`${BASE_URL}/plugin.php?id=dsu_paulsign:sign`, commonHeaders);
  const pageBody = pageRes.body || '';
  const formhashMatch = pageBody.match(/name="formhash" value="([^"]+)"/);
  const formhash = formhashMatch ? formhashMatch[1] : '';
  if (!formhash) {
    $.log('❌ 未获取到 formhash');
    $.msg($.name, '',
      `👤 txtnovel.vip\n${ts()}  ❌ Cookie 已过期\n无法获取 formhash，请重新访问采集\n\n🎯 失败`);
    $.done();
    return;
  }
  $.log(`formhash: ${formhash}`);

  // 2. POST 签到（qdxq=kx 表示心情=开心）
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
  $.log(`签到响应(前500): ${signBody.substring(0, 500)}`);

  // 3. 解析结果
  let notifyBody;
  const t = ts();

  if (signBody.includes('签到成功') || signBody.includes('已经签到') || signBody.includes('今日已经签到')) {
    let detail = '';
    const msgMatch = signBody.match(/<div class="c">([^<]+)/);
    if (msgMatch) detail = msgMatch[1].trim();

    // 提取总金币和本次奖励
    let totalCoin = '', gainedCoin = '';
    const totalMatch = signBody.match(/您目前获得的总奖励为:金币\s*(\d+)\s*枚/);
    const gainedMatch = signBody.match(/获得随机奖励\s*金币\s*(\d+)\s*枚/);
    if (totalMatch) totalCoin = totalMatch[1];
    if (gainedMatch) gainedCoin = gainedMatch[1];

    $.log(`✅ 签到成功${detail ? ': ' + detail : ''}`);
    let line2 = '';
    if (gainedCoin && totalCoin) line2 = `\n💰 +${gainedCoin} 金币  |  总计 ${totalCoin} 金币`;
    else if (detail) line2 = `\n💬 ${detail}`;
    notifyBody = `👤 txtnovel.vip\n${t}  ✅ 签到成功${line2}\n\n🎯 已完成`;
  } else {
    const err = signBody.substring(0, 200).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    $.log(`❌ 签到失败: ${err}`);
    notifyBody = `👤 txtnovel.vip\n${t}  ❌ 签到失败\n💬 ${err}\n\n🎯 失败`;
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
