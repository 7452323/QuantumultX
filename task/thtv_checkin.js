/*
探花TV论坛签到 — navix.site
Surge/QX 通用版

Cookie 变量名：THTV_COOKIE
多账号用换行分隔

支持环境变量（通过 $argument 传入）：
  enable_cookie: 1=启用Cookie采集(默认) 0=关闭

[rewrite_local]
^https:\/\/navix\.site\/api\/sign-in url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/thtv_checkin.js

[task_local]
0 10 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/thtv_checkin.js, tag=探花TV签到, enabled=true

[MITM]
hostname = navix.site
*/

const $ = new Env('探花TV签到');

// 解析 $argument
const ARG = {};
if (typeof $argument === 'string') {
  $argument.split('&').forEach(p => {
    const idx = p.indexOf('=');
    if (idx > 0) ARG[p.slice(0, idx)] = p.slice(idx + 1);
  });
}
const ENABLE_COOKIE = ARG.enable_cookie !== '0';

const COOKIE_KEY = 'THTV_COOKIE';
const SEP = '\n';
const SIGN_URL = 'https://navix.site/api/sign-in';

!(async () => {
  // rewrite 模式：采集 Cookie
  if (typeof $request !== 'undefined') {
    if (!ENABLE_COOKIE) {
      $.log('Cookie采集已关闭(enable_cookie=0)');
      $.done();
      return;
    }
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) {
      let list = ($.getdata(COOKIE_KEY) || '').split(SEP).filter(Boolean);
      if (!list.includes(cookie)) {
        list.push(cookie);
        $.setdata(list.join(SEP), COOKIE_KEY);
      }
      $.msg($.name, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
    } else {
      $.msg($.name, '❌ Cookie 采集失败', '未获取到 Cookie');
    }
    $.done();
    return;
  }

  // task 模式：签到
  const raw = $.getdata(COOKIE_KEY);
  if (!raw) {
    $.msg($.name, '⚠️ 未获取到 Cookie', '请先打开 navix.site 触发采集');
    $.done();
    return;
  }

  const cookies = raw.split(SEP).filter(Boolean);
  const results = [];

  for (let i = 0; i < cookies.length; i++) {
    const ck = cookies[i];
    $.log(`\n[账号 ${i + 1}/${cookies.length}]`);

    try {
      const res = await httpPost(SIGN_URL, {
        'Cookie': ck,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
      }, '{}');

      const data = tryParse(res.body);

      if (data && data.success) {
        const msg = `✅ 签到成功｜+${data.expGained}经验｜连续${data.consecutiveDays}天｜等级：${data.level?.title || ''}`;
        $.log(msg);
        results.push(`账号${i + 1}: 签到成功`);
      } else {
        const msg = `❌ 签到失败｜${data?.message || res.body}`;
        $.log(msg);
        results.push(`账号${i + 1}: 签到失败`);
      }
    } catch (err) {
      $.logErr(err);
      results.push(`账号${i + 1}: 请求异常`);
    }
  }

  $.msg($.name, `${cookies.length} 个账号`, results.join('\n'));
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
      this.msg(this.name, `${elapsed}s`, '');
      switch (this.getEnv()) {
        case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $done(); break;
        case 'Node.js': process.exit(0); break;
      }
    }
  }
  return new _env(name, opts);
}
