/*
Lyrebird Emby 签到 — Surge/QX 通用版

[rewrite_local]
^https:\/\/console\.lyrebirdemby\.com\/api\/account\/me url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/lyrebird_checkin.js

[task_local]
0 10 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/lyrebird_checkin.js, tag=Lyrebird签到, enabled=true

[MITM]
hostname = console.lyrebirdemby.com

支持环境变量（通过 $argument 传入）：
  enable_cookie: 1=启用Cookie采集(默认) 0=关闭
*/

const $ = new Env('Lyrebird签到');

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

const TOKEN_KEY = 'lyrebird_token';
const COOKIE_KEY = 'lyrebird_cookie';
const BASE = 'https://console.lyrebirdemby.com';

const MONTHS = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function ts() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

!(async () => {
  // rewrite 模式：采集 Cookie + Token
  if (typeof $request !== 'undefined') {
    if (!ENABLE_COOKIE) {
      $.log('Cookie采集已关闭');
      $.done();
      return;
    }
    const auth = $request.headers['Authorization'] || $request.headers['authorization'] || '';
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (auth) $.setdata(auth, TOKEN_KEY);
    if (cookie) $.setdata(cookie, COOKIE_KEY);
    if (auth) $.msg($.name, '✅ Token+Cookie 已保存', '');
    $.done();
    return;
  }

  // task 模式：签到
  const token = $.getdata(TOKEN_KEY);
  if (!token) {
    $.msg($.name, '⚠️ 未获取到 Token', '请先打开 lyrebirdemby.com 控制台');
    $.done();
    return;
  }

  const headers = {
    'Authorization': token,
    'Cookie': $.getdata(COOKIE_KEY) || '',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    'Origin': BASE,
    'Referer': BASE + '/'
  };

  // 先查当前积分和签到记录
  $.log('📊 查询积分状态...');
  const ptRes = await httpGet(`${BASE}/api/account/points`, headers);
  const ptData = tryParse(ptRes.body);
  const balance = ptData?.balance ?? '?';
  const txList = ptData?.transactions || [];
  const lastTx = txList.find(t => t.type === 'DAILY_CHECK_IN');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  // 判断今天是否已签到
  const alreadyChecked = lastTx?.metadata?.checkInDate === todayStr;

  let notifyBody = '';
  let amount = 0;
  let newBalance = balance;

  if (alreadyChecked) {
    // 已签到
    const streak = countStreak(txList);
    notifyBody = `────────────────\n👤 Lyrebird\n${ts()}  ✅ 今日已签到\n────────────────\n🏆 连续 ${streak} 天  |  💰 ${balance} 积分\n\n────────────────\n🎯 已完成`;
    $.log('今日已签到');
  } else {
    // 未签到 — 执行签到
    $.log('🔄 执行签到...');
    const res = await httpPost(`${BASE}/api/account/points/check-in`, headers, '{}');
    const data = tryParse(res.body);

    if (data && data.balance !== undefined) {
      amount = data.amount;
      newBalance = data.balance;
      const streak = countStreak(txList) + 1;
      $.log(`签到成功! +${amount} 积分，余额: ${newBalance}`);

      notifyBody = `────────────────\n👤 Lyrebird\n${ts()}  ✅ 签到成功  +${amount}\n────────────────\n🏆 连续 ${streak} 天  |  💰 ${newBalance} 积分\n\n────────────────\n🎯 已完成`;
    } else {
      const errMsg = data?.message || res.body || '未知错误';
      $.logErr(`签到失败: ${errMsg}`);
      notifyBody = `────────────────\n👤 Lyrebird\n${ts()}  ❌ 签到失败\n────────────────\n💬 ${errMsg}\n💰 余额 ${balance}\n\n────────────────\n🎯 失败`;
    }
  }

  $.msg($.name, `${((Date.now() - $.startTime) / 1000).toFixed(2)}s`, notifyBody);
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

function countStreak(txList) {
  const ins = txList.filter(t => t.type === 'DAILY_CHECK_IN');
  if (!ins.length) return 0;
  let cnt = 1;
  const dates = ins.map(t => t.metadata?.checkInDate).filter(Boolean).sort().reverse();
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i-1]);
    const cur = new Date(dates[i]);
    const diff = (prev - cur) / 86400000;
    if (Math.round(diff) === 1) cnt++;
    else break;
  }
  return cnt;
}

function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }

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
