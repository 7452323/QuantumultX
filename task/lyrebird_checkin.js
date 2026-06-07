/*
Lyrebird Emby 签到 — Surge/QX 通用版

[rewrite_local]
^https:\/\/console\.lyrebirdemby\.com\/api\/account\/me url script-request-header lyrebird_checkin.js

[task_local]
0 10 * * * lyrebird_checkin.js, tag=Lyrebird签到, enabled=true

[MITM]
hostname = console.lyrebirdemby.com
*/

const $ = new Env('Lyrebird签到');

const TOKEN_KEY = 'lyrebird_token';
const COOKIE_KEY = 'lyrebird_cookie';
const CHECKIN_URL = 'https://console.lyrebirdemby.com/api/account/points/check-in';

!(async () => {
  // rewrite 模式：采集 Cookie + Token
  if (typeof $request !== 'undefined') {
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
  const cookie = $.getdata(COOKIE_KEY);
  if (!token) {
    $.msg($.name, '⚠️ 未获取到 Token', '请先打开 lyrebirdemby.com 控制台');
    $.done();
    return;
  }

  const res = await httpPost(CHECKIN_URL, {
    'Authorization': token,
    'Cookie': cookie || '',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    'Origin': 'https://console.lyrebirdemby.com',
    'Referer': 'https://console.lyrebirdemby.com/'
  }, '{}');

  const data = tryParse(res.body);
  if (data && data.balance !== undefined) {
    $.log(`签到成功! +${data.amount} 积分，余额: ${data.balance}`);
    $.msg($.name, `✅ +${data.amount} 分`, `余额 ${data.balance}`);
  } else if (res.body && res.body.includes('already')) {
    $.log('今日已签到');
    $.msg($.name, '✅ 今日已签到', '');
  } else {
    $.log(`签到失败: ${res.body}`);
    $.msg($.name, '❌ 签到失败', res.body);
  }

  $.done();
})().catch(e => { $.logErr(e); $.done(); });

function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers, body, method: 'POST' };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.post(opts, (err, resp, data) => { if (err) reject(err); else resolve({ status: resp.status || resp.statusCode, body: data }); });
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
      this.msg(this.name, `${elapsed}s`, this.logs.filter(l => l.includes('❌')).length > 0 ? '失败' : '成功');
      switch (this.getEnv()) {
        case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $done(); break;
        case 'Node.js': process.exit(0); break;
      }
    }
  }
  return new _env(name, opts);
}
