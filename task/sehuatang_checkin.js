/*
色花堂(98堂) 签到 — sehuatang.org
版本：2.0.0（2026-09-06 重构）

背景（2026-09 实测）：
- 站点 Discuz!，签到插件 dd_sign。真实协议：
    sign_v2 服务端强制要求先通过图形验证码（短时效）：
    misc.php?mod=captcha 取挑战(GoCaptcha, type=drag/click/rotate…)
    → misc.php?mod=captcha&action=check POST "x,y"
    → ok 后 plugin.php?id=dd_sign&ac=sign_v2 才发奖励。
- 纯脚本环境（QX/Surge/Loon/Node）受两道硬限制：
    1) 站点在 Cloudflare 后，机场/数据中心 IP 会被 JS 挑战拦截（需实测你的节点）；
    2) 验证码为图形/滑块，脚本内无法稳定自动解。
  因此本脚本：Cookie 复用 + 每日自动尝试；若提示需要验证码，请用配套 Safari 用户脚本
  （task/sehuatang_auto_sign.user.js，在你的真实浏览器里可全自动过滑块并签到）或手动点一次。

Cookie 变量名：SEHUATANG_COOKIE

[rewrite_local]
^https?:\/\/sehuatang\.org url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sehuatang_checkin.js

[task_local]
30 7 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sehuatang_checkin.js, tag=色花堂签到, enabled=true

[MITM]
hostname = %APPEND% sehuatang.org
*/

const $ = new Env('色花堂签到');
const COOKIE_KEY = 'SEHUATANG_COOKIE';
const BASE = 'https://sehuatang.org';
const SIGN_PAGE = `${BASE}/plugin.php?id=dd_sign`;
const SIGN_V2 = `${BASE}/plugin.php?id=dd_sign&ac=sign_v2`;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

function parseCookiesToMap(str){const m={};(str||'').split(';').forEach(p=>{const i=p.indexOf('=');if(i>0)m[p.slice(0,i).trim()]=p.slice(i+1).trim()});return m}
function cookieString(map){return Object.entries(map).map(([k,v])=>`${k}=${v}`).join('; ')}

// rewrite 模式：保存 sehuatang 完整 Cookie（含 HttpOnly auth）
if (typeof $request !== 'undefined') {
  const h = ($request && ($request.headers || {})) || {};
  const ck = h['Cookie'] || h['cookie'] || '';
  if (ck && /sehuatang\.org/i.test(String($request.url || ''))) {
    const m = parseCookiesToMap(ck);
    if (m['cPNj_2132_auth'] || m['auth']) {   // Discuz 登录态 auth cookie
      if ($.getdata(COOKIE_KEY) !== ck) {
        $.setdata(ck, COOKIE_KEY);
        $.log('[Cookie] 色花堂登录 Cookie 已保存');
      }
    }
  }
  $.done();
} else {
  (async () => {
    $.log(`🔔 ${$.name}, 开始!`);
    const cookie = $.getdata(COOKIE_KEY);
    if (!cookie) {
      $.msg($.name, '未发现登录 Cookie', '请先在 Safari 打开并登录 sehuatang.org，Cookie 会自动保存');
      $.done(); return;
    }
    const jar = parseCookiesToMap(cookie);
    const head = { 'User-Agent': UA, 'Cookie': cookieString(jar), 'Referer': SIGN_PAGE, 'Accept': 'application/json, text/javascript, */*; q=0.01', 'X-Requested-With': 'XMLHttpRequest' };

    try {
      // 1) 页面状态
      const page = await httpGet(SIGN_PAGE, head);
      const html = page.body || '';
      const signed = /已签到/.test(html) && !/未签到/.test(html);

      // 2) 尝试直接签
      const res = await httpGet(SIGN_V2, head);
      let data = null; try { data = JSON.parse(res.body); } catch (e) {}
      const msg = data && data.message ? data.message : String(res.body || '').slice(0, 200);
      const code = data ? data.code : res.status;

      if (data && data.code === 200 && !/验证|重试|超时|请先/.test(msg)) {
        $.msg($.name, '✅ 签到成功', `${msg}\n${new Date().toLocaleString()}`);
      } else if (data && data.code === 1 && /验证超时|重新验证/.test(msg)) {
        // 需要人工（或 Safari 用户脚本自动）完成验证
        $.msg($.name, '⚠️ 需手动/浏览器验证', '今日未签到，请在 Safari 打开签到页：\n' + SIGN_PAGE + '\n（已配 sehuatang_auto_sign.user.js 可全自动过滑块）');
      } else if (signed || /已签到|签到过了|重复/.test(msg)) {
        $.msg($.name, '⏭️ 今日已签到', msg || '无需重复签到');
      } else if (data && data.code === 1) {
        $.msg($.name, '签到未完成', `${msg}\n签到页：${SIGN_PAGE}`);
      } else {
        $.msg($.name, `接口返回 ${code}`, msg || '未知');
      }
    } catch (e) {
      $.msg($.name, '请求失败', (e && e.message) || String(e));
    }
    $.done();
  })().catch(e => { $.log('错误:', e && e.message || e); try { $.done(); } catch (_) {} });
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers, method: 'GET', timeout: 30000 };
    if (typeof $task !== 'undefined') {
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body || '' })).catch(reject);
    } else if (typeof $httpClient !== 'undefined') {
      $httpClient.get(opts, (err, resp, body) => {
        if (err) reject(new Error(err));
        else resolve({ status: (resp && (resp.status || resp.statusCode)) || 0, body: body || '' });
      });
    } else reject(new Error('不支持的平台'));
  });
}

function Env(name) {
  return new (class {
    constructor() { this.name = name; this.data = null; this.startTime = Date.now(); }
    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $rocket !== 'undefined') return 'Shadowrocket';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      return 'Unknown';
    }
    isNode() { return this.getEnv() === 'Node.js'; }
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
    log(...t) { console.log(t.join(' ')); }
    msg(s, t, c) {
      switch (this.getEnv()) {
        case 'Node.js': console.log(`${s}: ${t || ''} - ${c || ''}`); break;
        case 'Quantumult X': $notify(s, t || '', c || ''); break;
        default: $notification.post(s, t || '', c || ''); break;
      }
    }
    done() {
      const el = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`结束! ${el}s`);
      switch (this.getEnv()) {
        case 'Node.js': process.exit(0); break;
        default: $done(); break;
      }
    }
  })();
}
