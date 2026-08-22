/*
色花堂签到辅助 — sehuatang.org

说明：该站点签到由点击/滑动验证码保护，验证码必须人工完成。
本脚本不会绕过验证码，只负责：
1. 通过 rewrite 自动保存登录 Cookie；
2. 定时调用签到接口并提示结果；
3. 检测到验证码要求时通知手动打开签到页完成验证。

Cookie 变量名：SEHUATANG_COOKIE

[rewrite_local]
^https:\/\/sehuatang\.org\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sehuatang_checkin.js

[task_local]
0 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sehuatang_checkin.js, tag=色花堂签到检查, enabled=true

[MITM]
hostname = sehuatang.org
*/

const $ = new Env('色花堂签到');
const COOKIE_KEY = 'SEHUATANG_COOKIE';
const BASE = 'https://sehuatang.org';
const SIGN_URL = `${BASE}/plugin.php?id=dd_sign&ac=sign_v2`;

!(async () => {
  if (typeof $request !== 'undefined') {
    const url = String($request.url || '');
    const headers = $request.headers || {};
    const cookie = headers.Cookie || headers.cookie || '';

    // Discuz 使用随机前缀，例如 xxxx_auth / xxxx_saltkey。
    // 只采集本站请求中的登录认证 Cookie。
    const isSite = /^https:\/\/sehuatang\.org\//i.test(url);
    const isDiscuzAuth = /(?:^|;\s*)[^=;\s]+_(?:auth|saltkey)=/i.test(cookie);
    if (isSite && cookie && isDiscuzAuth) {
      const old = $.getdata(COOKIE_KEY);
      if (old !== cookie) {
        $.setdata(cookie, COOKIE_KEY);
        $.log('登录 Cookie 已自动保存');
      }
    }
    $.done();
    return;
  }

  const cookie = $.getdata(COOKIE_KEY);
  if (!cookie) {
    $.msg($.name, '未发现登录 Cookie', '请先打开 sehuatang.org 并登录');
    $.done();
    return;
  }

  try {
    const res = await httpGet(SIGN_URL, {
      Cookie: cookie,
      Referer: `${BASE}/plugin.php?id=dd_sign`,
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const data = parseJSON(res.body);
    const message = data && data.message ? data.message : res.body.slice(0, 200);

    if (data && data.code === 200) {
      $.msg($.name, '签到成功', message);
    } else if (/验证码|验证超时|captcha/i.test(message)) {
      $.msg($.name, '需要人工验证', '请打开签到页完成点击/滑动验证码后再试');
    } else if (/已签到|重复/i.test(message)) {
      $.msg($.name, '今日已签到', message);
    } else {
      $.msg($.name, `签到接口返回 ${data?.code ?? res.status}`, message);
    }
  } catch (e) {
    $.msg($.name, '请求失败', e.message || String(e));
  }
  $.done();
})().catch(e => { $.logErr(e); $.done(); });

function parseJSON(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers, method: 'GET' };
    if (typeof $task !== 'undefined') {
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(reject);
    } else if (typeof $httpClient !== 'undefined') {
      $httpClient.get(opts, (err, resp, body) => {
        if (err) reject(err);
        else resolve({ status: resp.status || resp.statusCode, body });
      });
    } else reject(new Error('不支持的平台'));
  });
}

function Env(name) {
  class E {
    constructor(n) { this.name = n; this.start = Date.now(); }
    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof $loon !== 'undefined') return 'Loon';
      return 'Unknown';
    }
    getdata(k) {
      const env = this.getEnv();
      if (env === 'Quantumult X') return $prefs.valueForKey(k) || '';
      if (env === 'Surge' || env === 'Stash' || env === 'Loon') return $persistentStore.read(k) || '';
      return '';
    }
    setdata(v, k) {
      const env = this.getEnv();
      if (env === 'Quantumult X') return $prefs.setValueForKey(v, k);
      if (env === 'Surge' || env === 'Stash' || env === 'Loon') return $persistentStore.write(v, k);
      return false;
    }
    log(...args) { console.log(args.join(' ')); }
    logErr(e) { this.log(`错误: ${e?.message || e}`); }
    msg(title, subtitle, body) {
      if (typeof $notify !== 'undefined') $notify(title, subtitle || '', body || '');
      else if (typeof $notification !== 'undefined') $notification.post(title, subtitle || '', body || '');
    }
    done() { if (typeof $done === 'function') $done(); }
  }
  return new E(name);
}
