/*
书香门第(txtnovel.vip)自动签到 — Surge 自包含版
由 surge/script/txtnovel_checkin.sgmodule 引用

Cookie 采集: 打开网页 http://www.txtnovel.vip 登录后触发
多账号用换行或 & 分隔
*/

(function() {
  const APP_CONFIG = {
    name: '书香门第签到',
    storageKey: 'txtnovel_checkin_data',
    accountSeparator: '&',
    notifyTitle: '书香门第签到',
  };

  const $ = new Env(APP_CONFIG.name);

  !(async () => {
    if (typeof $request !== 'undefined') {
      await collectCookie();
      return;
    }

    if ($.isNode()) {
      const envCookies = process.env.TXTNOVEL_COOKIE || '';
      if (envCookies) {
        $.log('从环境变量 TXTNOVEL_COOKIE 读取');
        await batchCheckin(envCookies.split(/[&\n]/).filter(Boolean));
        return;
      }
    }

    const raw = $.getdata(APP_CONFIG.storageKey);
    if (!raw) {
      $.msg(APP_CONFIG.name, '签到失败', 'Cookie 不存在，请先打开网页采集');
      return;
    }
    await batchCheckin(raw.split(APP_CONFIG.accountSeparator).filter(Boolean));
  })().catch(e => $.logErr(e)).finally(() => $.done());

  async function collectCookie() {
    if ($request.method === 'OPTIONS') return;
    const value = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (!value) return;
    $.setdata(value, APP_CONFIG.storageKey);
    $.msg(APP_CONFIG.name, `✅ Cookie 已保存`, value.slice(0, 50) + '...');
  }

  async function doSign(cookie) {
    const signPageUrl = 'http://www.txtnovel.vip/plugin.php?id=dsu_paulsign:sign&mobile=yes';
    const signPostUrl = 'http://www.txtnovel.vip/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=0&inajax=0&mobile=yes';
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2.1 Mobile/15E148 Safari/604.1';

    const pageResp = await $.http({
      url: signPageUrl,
      headers: { 'Host': 'www.txtnovel.vip', 'Cookie': cookie, 'User-Agent': ua, 'Accept': 'text/html,*/*', 'Referer': 'http://www.txtnovel.vip/' }
    });

    const html = pageResp.body;
    const match = html.match(/name="formhash"\s+value="([^"]+)"/);
    if (!match) return /请先登录|需要登录/.test(html) ? '❌ Cookie失效' : '❌ 未获取formhash';

    const formhash = match[1];
    const postData = `formhash=${formhash}&qdxq=kx&qdmode=1&todaysay=`;

    const signResp = await $.http({
      url: signPostUrl,
      headers: {
        'Host': 'www.txtnovel.vip', 'Cookie': cookie, 'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded', 'Origin': 'http://www.txtnovel.vip',
        'Referer': signPageUrl, 'Accept': 'text/html,*/*'
      },
      method: 'POST',
      body: postData
    });

    const text = signResp.body;
    if (/签到成功|恭喜你/.test(text)) return '✅ 签到成功';
    if (/已经签到|今日已签/.test(text)) return '✅ 今日已签到';
    if (/请先登录|需要登录/.test(text)) return '❌ Cookie失效';
    if (/验证码/.test(text)) return '❌ 需要验证码';
    return '⚠️ 未知返回';
  }

  async function batchCheckin(accounts) {
    let success = 0, failed = 0;
    const results = [];

    for (let i = 0; i < accounts.length; i++) {
      try {
        const msg = await doSign(accounts[i]);
        $.log(`账号${i + 1}: ${msg}`);
        results.push(`账号${i + 1}: ${msg}`);
        msg.startsWith('✅') ? success++ : failed++;
      } catch (e) {
        $.log(`账号${i + 1} 失败: ${e.message || e}`);
        results.push(`账号${i + 1} ❌ ${e.message}`);
        failed++;
      }
      if (i < accounts.length - 1) await $.wait(2000);
    }

    $.msg(APP_CONFIG.notifyTitle, `成功 ${success} / 失败 ${failed}`, results.slice(0, 5).join('\n'));
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
