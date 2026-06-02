/*
 * Checkin Framework v4
 * 整合 chavyleung 5.5k⭐ 经验 + BoxJS 订阅体系 + 多账号持久化 + 青龙兼容
 * 支持: QX / Surge / Loon / Stash / Shadowrocket / Node.js / 青龙
 * 
 * ===== 使用方法 =====
 * 1. 复制本文件，重命名为 <app>.js
 * 2. 修改 APP_CONFIG
 * 3. 部署测试
 * 
 * ===== BoxJS 订阅 =====
 * 可选: 在 BoxJS 中添加配置面板，用户可开关/调整
 * BoxJS 订阅格式: https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Frameworks/boxjs/<app>.boxjs.json
 *
 * ===== 配置示例 =====
 * [rewrite_local]
 * ^https?:\/\/api\.app\.com\/user\/info url script-request-header <app>.js
 * [task_local]
 * 30 9 * * * <app>.js, tag=<App>签到, enabled=true
 * [mitm]
 * hostname = api.app.com
 *
 * ===== 免责声明 =====
 * 仅供学习研究，请于下载后24小时内删除。
 */
(function() {
  // ===================== 用户配置区 =====================
  const APP_CONFIG = {
    name: '签到',
    storageKey: 'app_checkin_data',
    // Cookie 采集
    cookiePattern: /(sessionid=[^;]+|token=[^;]+)/,
    accountSeparator: '#',
    dedupPattern: /uid=([^;]+)/,
    cookieTrigger: '',
    // 签到接口
    checkin: {
      url: 'https://api.example.com/user/checkin',
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Content-Type': 'application/json'
      },
      body: ''
    },
    // 可选: Cookie 采集后用 GET 验证是否有效
    verifyUrl: '',
    // 通知
    notifyTitle: '签到完成',
    // BoxJS key 前缀 (可选)
    boxjsPrefix: '',
  };

  // ===================== 框架核心 =====================
  const $ = new Env(APP_CONFIG.name);

  !(async () => {
    if (typeof $request !== 'undefined') {
      // ---- Cookie 采集模式 ----
      await collectCookie();
      return;
    }

    // ---- 签到模式 ----
    if ($.isNode()) {
      // Node.js / 青龙: 优先读环境变量 ENV_NAME
      const envCookies = process.env[APP_CONFIG.storageKey.toUpperCase()] || 
                         process.env[APP_CONFIG.storageKey] || '';
      if (envCookies) {
        $.log('从环境变量读取 Cookie');
        await batchCheckin(envCookies.split(APP_CONFIG.accountSeparator).filter(Boolean));
        return;
      }
    }
    
    const raw = $.getdata(APP_CONFIG.storageKey);
    if (!raw) {
      $.log('Cookie 不存在，请先打开 App 采集');
      $.msg(APP_CONFIG.name, '签到失败', 'Cookie 不存在');
      return;
    }
    
    await batchCheckin(raw.split(APP_CONFIG.accountSeparator).filter(Boolean));
  })().catch(e => $.logErr(e)).finally(() => $.done());

  // ===================== Cookie 采集 =====================
  async function collectCookie() {
    if ($request.method === 'OPTIONS') return;
    if (APP_CONFIG.cookieTrigger && !$request.url.includes(APP_CONFIG.cookieTrigger)) return;

    // 从请求头提取 cookie/token
    const value = $request.headers['Cookie']
               || $request.headers['cookie']
               || $request.headers['Authorization']
               || $request.headers['authorization']
               || $request.headers['X-Token']
               || $request.headers['x-token'];
    if (!value) return;

    const cookieValue = value.match(APP_CONFIG.cookiePattern)
        ? value.match(APP_CONFIG.cookiePattern)[0]
        : value;

    // 去重 + 追加
    let list = ($.getdata(APP_CONFIG.storageKey) || '').split(APP_CONFIG.accountSeparator).filter(Boolean);
    const key = cookieValue.match(APP_CONFIG.dedupPattern);
    const dedupKey = key ? key[1] : cookieValue.slice(0, 20);
    list = list.filter(c => {
      const m = c.match(APP_CONFIG.dedupPattern);
      return m ? m[1] !== dedupKey : c.slice(0, 20) !== dedupKey;
    });
    list.push(cookieValue);

    $.setdata(list.join(APP_CONFIG.accountSeparator), APP_CONFIG.storageKey);
    
    let msg = `Cookie 已保存 (${list.length} 个账号)`;
    
    // 可选: 验证 Cookie 有效性
    if (APP_CONFIG.verifyUrl) {
      try {
        const verifyResp = await $.http({
          url: APP_CONFIG.verifyUrl,
          headers: { 'Cookie': cookieValue }
        });
        if (verifyResp.status === 200) msg += ' ✅ 有效';
        else msg += ` ⚠️ 状态码 ${verifyResp.status}`;
      } catch (e) {
        msg += ' ⚠️ 验证失败';
      }
    }
    
    $.msg(APP_CONFIG.name, msg, '');
  }

  // ===================== 批量签到 =====================
  async function batchCheckin(accounts) {
    let success = 0, failed = 0;
    const results = [];

    for (let i = 0; i < accounts.length; i++) {
      try {
        const headers = { 
          ...APP_CONFIG.checkin.headers, 
          'Cookie': accounts[i] 
        };
        
        const opts = {
          url: APP_CONFIG.checkin.url,
          headers,
          method: APP_CONFIG.checkin.method,
        };
        if (APP_CONFIG.checkin.body) opts.body = APP_CONFIG.checkin.body;
        
        const resp = await $.http(opts);
        let data = {};
        try { data = JSON.parse(resp.body); } catch {}
        
        const msg = data.message || data.msg || data.info || `HTTP ${resp.status}`;
        $.log(`账号${i + 1}: ${msg}`);
        results.push(`账号${i + 1}: ${msg}`);
        success++;
      } catch (e) {
        $.log(`账号${i + 1} 失败: ${e.message || e}`);
        results.push(`账号${i + 1} 失败`);
        failed++;
      }
      if (i < accounts.length - 1) await $.wait(2000);
    }

    const summary = `成功 ${success} / 总数 ${accounts.length}`;
    $.log(summary);
    $.msg(APP_CONFIG.notifyTitle, summary, results.slice(0, 5).join('\n'));
  }

  // ===================== Env.js (from chavyleung 5.5k⭐) =====================
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
          case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
            return $persistentStore.read(key) || '';
          case 'Quantumult X':
            return $prefs.valueForKey(key) || '';
          case 'Node.js':
            return this.data && this.data[key] || process.env[key] || '';
          default: return '';
        }
      }

      setdata(val, key) {
        switch (this.getEnv()) {
          case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
            return $persistentStore.write(val, key);
          case 'Quantumult X':
            return $prefs.setValueForKey(val, key);
          case 'Node.js':
            this.data = this.data || {};
            this.data[key] = val;
            return true;
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
