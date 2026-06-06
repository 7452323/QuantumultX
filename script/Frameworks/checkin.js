/*
 * Checkin Framework v4
 * 整合 chavyleung 5.5k⭐ 经验 + BoxJS 订阅体系 + 多账号持久化 + 青龙兼容
 * 支持: QX / Surge / Loon / Stash / Shadowrocket / Node.js / 青龙
 * 
 * ===== 使用方法 =====
 * const framework = require('./Frameworks/checkin.js');
 * const app = new framework('app_name');
 * 
 * ===== BoxJS 订阅 =====
 * 可选: 在 BoxJS 中添加配置面板
 * BoxJS 订阅格式: https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Frameworks/boxjs/<app>.boxjs.json
 * 
 * ===== 免责声明 =====
 * 仅供学习研究，请于下载后24小时内删除。
 */

class CheckinFramework {
  constructor(name) {
    this.name = name || '签到';
    this.storageKey = name || 'app_checkin';
    this.cookiePattern = /([^@]+)/;
    this.accountSeparator = '&';
    this.dedupPattern = null;
    this.cookieTrigger = '';
    this.notifyTitle = '签到完成';
    this.$ = new Env(this.name);
    this._config = {};
    this._accounts = [];
  }

  // 判断是否在Cookie采集模式
  get isRequest() {
    return typeof $request !== 'undefined';
  }

  // 判断平台
  isNode() { return this.$.isNode(); }
  isQuanX() { return this.$.isQuanX(); }
  isSurge() { return this.$.isSurge(); }
  isLoon() { return this.$.isLoon(); }
  isShadowrocket() { return this.$.isShadowrocket(); }
  isStash() { return this.$.isStash(); }

  // 设置配置
  setConfig(cfg) {
    if (cfg) {
      this.name = cfg.name || this.name;
      this.storageKey = cfg.storageKey || this.storageKey;
      this.cookiePattern = cfg.cookiePattern || this.cookiePattern;
      this.accountSeparator = cfg.accountSeparator || this.accountSeparator;
      this.dedupPattern = cfg.dedupPattern || this.dedupPattern;
      this.cookieTrigger = cfg.cookieTrigger || this.cookieTrigger;
      this.notifyTitle = cfg.notifyTitle || this.notifyTitle;
      this._config = cfg;
    }
  }

  // Cookie 采集
  collectCookie(cookieValue) {
    if (!cookieValue) return false;
    let list = (this.$.getdata(this.storageKey) || '').split(this.accountSeparator).filter(Boolean);
    if (list.includes(cookieValue)) return false;
    list.push(cookieValue);
    this.$.setdata(list.join(this.accountSeparator), this.storageKey);
    this.$.msg(this.name, `Cookie 已保存 (${list.length} 个账号)`, '');
    return true;
  }

  // 读取账号列表
  getAccounts() {
    let raw = this.$.getdata(this.storageKey) || '';
    if (this.isNode()) {
      const envKey = this.storageKey.toUpperCase();
      raw = process.env[envKey] || process.env[this.storageKey] || raw;
    }
    return raw.split(this.accountSeparator).map(a => a.trim()).filter(Boolean);
  }

  // HTTP 请求
  async http(options) {
    const method = (options.method || 'GET').toUpperCase();
    const url = options.url;
    const headers = options.headers || {};

    return new Promise((resolve, reject) => {
      switch (this.$.getEnv()) {
        case 'Quantumult X':
          $task.fetch({ url, headers, method, body: options.body || undefined })
            .then(r => resolve({ status: r.statusCode, body: r.body, headers: r.headers }))
            .catch(e => reject(e));
          break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
          const cb = (err, resp, body) => {
            if (err) reject(err);
            else resolve({ status: resp.status || resp.statusCode, body, headers: resp.headers || {} });
          };
          const opts = { url, headers };
          if (options.body) opts.body = options.body;
          if (method === 'GET') $httpClient.get(opts, cb);
          else if (method === 'POST') $httpClient.post(opts, cb);
          else $httpClient[method.toLowerCase()](opts, cb);
          break;
        case 'Node.js':
          try {
            const mod = require(url.startsWith('https') ? 'https' : 'http');
            const u = new URL(url);
            const req = mod.request({
              hostname: u.hostname, path: u.pathname + u.search, method,
              headers
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

  log(msg) { this.$.log(msg); }
  logErr(e) { this.$.logErr(e); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  msg(title, subtitle, content) { this.$.msg(title, subtitle, content); }
  notify(title, content) { this.$.msg(this.notifyTitle, title, content); }
  done() { this.$.done(); }
}

module.exports = CheckinFramework;

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
    isShadowrocket() { return this.getEnv() === 'Shadowrocket'; }
    isStash() { return this.getEnv() === 'Stash'; }
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
    log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
    logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    msg(title, subtitle, content) {
      switch (this.getEnv()) {
        case 'Quantumult X': $notify(title, subtitle || '', content || ''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
          $notification.post(title, subtitle || '', content || ''); break;
        case 'Node.js': console.log(`${title}: ${subtitle} - ${content}`); break;
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
  })(name, opts);
}
