/*
📌 探花TV论坛签到 — Surge 自包含版
👑 navix.site
由 surge/script/thtv_checkin.sgmodule 引用

Cookie 采集: 打开 App 触发签到请求即可自动保存
多账号用 & 分隔
*/

(function() {
  const NAME = '探花TV签到';
  const STORAGE_KEY = 'THTV_COOKIE';
  const ACCOUNT_SEP = '&';

  const $ = new Env(NAME);

  !(async () => {
    // Cookie 采集模式
    if (typeof $request !== 'undefined') {
      await collectCookie();
      return;
    }

    // Node.js 模式
    if ($.isNode()) {
      const envCookies = process.env.THTV || '';
      if (envCookies) {
        await doBatchSign(envCookies.split(/[&\n]/).filter(Boolean));
        return;
      }
    }

    // 正常模式
    const raw = $.getdata(STORAGE_KEY);
    if (!raw) {
      $.msg(NAME, '⛔️ 无 Cookie', '请先在 Surge 中触发签到页面抓取 Cookie');
      return;
    }

    const cookies = raw.split(ACCOUNT_SEP).filter(Boolean);
    await doBatchSign(cookies);
  })().catch(e => $.logErr(e)).finally(() => $.done());

  async function collectCookie() {
    if ($request.method === 'OPTIONS') return;
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (!cookie) return;
    $.setdata(cookie, STORAGE_KEY);
    $.msg(NAME, '✅ Cookie 已保存', cookie.slice(0, 60) + '...');
  }

  async function doSign(cookie) {
    const { data } = await $.http({
      url: 'https://navix.site/api/sign-in',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      },
      body: '{}'
    });

    const resp = typeof data === 'object' ? data : JSON.parse(data);
    const { success, message, consecutiveDays, expGained, level } = resp || {};

    if (success) {
      return `✅ 签到成功｜+${expGained}经验｜连续${consecutiveDays}天｜等级：${level?.title || 'N/A'}`;
    }
    return `❌ 签到失败｜${message || '未知错误'}`;
  }

  async function doBatchSign(cookies) {
    let success = 0, failed = 0;
    const results = [];

    for (let i = 0; i < cookies.length; i++) {
      try {
        const msg = await doSign(cookies[i]);
        $.log(`账号${i + 1}: ${msg}`);
        results.push(`账号${i + 1}: ${msg}`);
        msg.startsWith('✅') ? success++ : failed++;
      } catch (e) {
        $.log(`账号${i + 1} 失败: ${e.message || e}`);
        results.push(`账号${i + 1}: ❌ ${e.message}`);
        failed++;
      }
      if (i < cookies.length - 1) await $.wait(2000);
    }

    $.msg(NAME, `成功 ${success} / 失败 ${failed}`, results.slice(0, 5).join('\n'));
  }

  // ===================== Env.js =====================
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
      async http(options) {
        const method = (options.method || 'GET').toUpperCase();
        return new Promise((resolve, reject) => {
          switch (this.getEnv()) {
            case 'Quantumult X':
              $task.fetch({ url: options.url, headers: options.headers, method, body: options.body || undefined })
                .then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers }))
                .catch(e => reject(e));
              break;
            case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
              const cb = (err, resp, body) => {
                if (err) reject(err);
                else resolve({ status: resp.status || resp.statusCode, body, headers: resp.headers || {} });
              };
              const opts = { url: options.url, headers: options.headers };
              if (options.body) opts.body = options.body;
              if (method === 'GET') $httpClient.get(opts, cb);
              else if (method === 'POST') $httpClient.post(opts, cb);
              else $httpClient[method.toLowerCase()](opts, cb);
              break;
            case 'Node.js':
              try {
                const mod = require(options.url.startsWith('https') ? 'https' : 'http');
                const u = new URL(options.url);
                const req = mod.request({
                  hostname: u.hostname, path: u.pathname + u.search, method,
                  headers: options.headers || {},
                }, resp => {
                  let data = '';
                  resp.on('data', c => data += c);
                  resp.on('end', () => resolve({ status: resp.statusCode, body: data, headers: resp.headers }));
                });
                req.on('error', reject);
                if (options.body) req.write(options.body);
                req.end();
              } catch (e) { reject(e); }
              break;
          }
        });
      }
      msg(title, subtitle, content) {
        switch (this.getEnv()) {
          case 'Quantumult X': $notify(title, subtitle || '', content || ''); break;
          case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
            $notification.post(title, subtitle || '', content || ''); break;
          case 'Node.js': console.log(`${title}: ${subtitle} - ${content}`); break;
        }
      }
      log(msg) { console.log(msg); this.logs.push(msg); }
      logErr(e) { this.log(`错误: ${e.message || e}`); if (e.stack) this.log(e.stack); }
      wait(ms) { return new Promise(r => setTimeout(r, ms)); }
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
})();
