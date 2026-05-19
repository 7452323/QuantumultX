/*
═══════════════════════════════════════════════════════════════
                    签到脚本框架 (Checkin Framework)
                          版本 3.0.0
                   适用于 QX / Surge / Loon / Node
═══════════════════════════════════════════════════════════════

【免责声明】
------------------------------------------
1. 本框架仅供学习研究，不保证其合法性、准确性、有效性。
2. 您必须在下载后 24 小时内将本框架从您的设备中完全删除。
3. 请勿将本框架用于任何商业或非法目的。
4. 使用本框架所造成的一切后果，由使用者自行承担。
5. 本框架不存储任何用户数据，所有数据由使用者自行管理。
------------------------------------------

【使用方法】
1. 复制本文件，重命名为 你的签到名称.js
2. 在 APP_CONFIG 中配置签到接口信息
3. 部署并测试

【快速配置示例 — Quantumult X】
[rewrite_local]
^https?:\/\/api\.app\.com\/user url script-request-header checkin.js

[task_local]
30 9 * * * checkin.js, tag=签到, enabled=true

[mitm]
hostname = api.app.com
*/

// ═══════════════════════════════════════════════════════════
//                     配 置 区 
// ═══════════════════════════════════════════════════════════

const APP_CONFIG = {
    // 脚本名称（用于日志和通知）
    name: '签到',
    
    // 持久化存储键名
    storageKey: 'app_checkin_data',
    
    // Cookie 提取正则（从请求头匹配关键字段）
    cookiePattern: /(sessionid=[^;]+|token=[^;]+|sid=[^;]+)/,
    
    // 多账号分隔符（用于 Cookie 去重）
    accountSeparator: '#',
    
    // 去重标识提取正则
    dedupPattern: /uid=([^;]+)/,
    
    // 签到接口
    checkin: {
        url: 'https://api.example.com/user/checkin',
        method: 'POST',
        headers: { 'User-Agent': 'Mozilla/5.0', 'Content-Type': 'application/json' },
    },
    
    // Cookie 采集触发路径（仅匹配此路径时才采集）
    cookieTrigger: '',
    
    // 通知标题
    notifyTitle: '签到完成',
};

// ═══════════════════════════════════════════════════════════
//                   Env 框架（无需修改）
// ═══════════════════════════════════════════════════════════

const $ = new Env(APP_CONFIG.name);

!(async () => {
    if (typeof $request !== 'undefined') {
        await collectCookie();
        return;
    }
    await doCheckin();
})().catch(e => $.logErr(e)).finally(() => $.done());

// ═══════════════════════════════════════════════════════════
//                   Cookie 采集逻辑
// ═══════════════════════════════════════════════════════════

async function collectCookie() {
    if ($request.method === 'OPTIONS') return;
    if (APP_CONFIG.cookieTrigger && !$request.url.includes(APP_CONFIG.cookieTrigger)) return;

    const value = $request.headers['Cookie']
               || $request.headers['cookie']
               || $request.headers['Authorization']
               || $request.headers['authorization'];

    if (!value) {
        $.log('未找到 Cookie，跳过采集');
        return;
    }

    const cookieValue = value.match(APP_CONFIG.cookiePattern)
        ? value.match(APP_CONFIG.cookiePattern)[0]
        : value;

    let cookies = $.getdata(APP_CONFIG.storageKey) || '';
    let list = cookies ? cookies.split(APP_CONFIG.accountSeparator) : [];

    // 去重
    const key = cookieValue.match(APP_CONFIG.dedupPattern);
    const dedupKey = key ? key[1] : cookieValue.slice(0, 20);
    list = list.filter(c => {
        const m = c.match(APP_CONFIG.dedupPattern);
        return m ? m[1] !== dedupKey : c.slice(0, 20) !== dedupKey;
    });
    list.push(cookieValue);

    $.setdata(list.join(APP_CONFIG.accountSeparator), APP_CONFIG.storageKey);
    $.msg(APP_CONFIG.name, `✅ Cookie 已采集 (共 ${list.length} 个账号)`, '');
    $.log(`Cookie 采集成功，当前 ${list.length} 个账号`);
}

// ═══════════════════════════════════════════════════════════
//                   签到执行逻辑
// ═══════════════════════════════════════════════════════════

async function doCheckin() {
    const raw = $.getdata(APP_CONFIG.storageKey);
    if (!raw) {
        $.log('❌ 未找到 Cookie，请先打开 App 采集');
        $.msg(APP_CONFIG.name, '签到失败', '未找到 Cookie');
        return;
    }

    const list = raw.split(APP_CONFIG.accountSeparator).filter(Boolean);
    $.log(`共 ${list.length} 个账号，开始签到`);

    let success = 0, failed = 0;
    const results = [];

    for (let i = 0; i < list.length; i++) {
        try {
            const headers = { ...APP_CONFIG.checkin.headers, 'Cookie': list[i] };
            const resp = await $.http({
                url: APP_CONFIG.checkin.url,
                headers,
                method: APP_CONFIG.checkin.method,
                body: APP_CONFIG.checkin.body || undefined,
            });

            let data = {};
            try { data = JSON.parse(resp.body); } catch {}
            const msg = data.message || data.msg || data.info || `HTTP ${resp.status}`;
            
            $.log(`账号 ${i + 1}: ${msg}`);
            results.push(`账号${i + 1}: ${msg}`);
            success++;
        } catch (e) {
            $.log(`账号 ${i + 1} 失败: ${e.message || e}`);
            results.push(`账号${i + 1}: ❌ ${e.message || e}`);
            failed++;
        }
        if (i < list.length - 1) await $.wait(2000);
    }

    const summary = `成功 ${success} / 失败 ${failed}`;
    $.log(`签到完成: ${summary}`);
    $.msg(APP_CONFIG.notifyTitle, summary, results.slice(0, 5).join('\n'));
}

// ═══════════════════════════════════════════════════════════
//                  Env 框架核心代码
//          from chavyleung's Env.js / Sliverkiss
// ═══════════════════════════════════════════════════════════

function Env(t, e) {
    return new class {
        constructor(t, e) {
            this.name = t;
            this.data = null;
            this.logs = [];
            this.startTime = Date.now();
            Object.assign(this, e);
            this.log(`🔔 ${this.name}, 开始!`);
        }

        getEnv() {
            if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
            if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
            if (typeof module !== 'undefined' && module.exports) return 'Node.js';
            if (typeof $task !== 'undefined') return 'Quantumult X';
            if (typeof $loon !== 'undefined') return 'Loon';
            if (typeof $rocket !== 'undefined') return 'Shadowrocket';
        }

        isNode()   { return this.getEnv() === 'Node.js'; }
        isQuanX()  { return this.getEnv() === 'Quantumult X'; }
        isSurge()  { return this.getEnv() === 'Surge'; }
        isLoon()   { return this.getEnv() === 'Loon'; }

        getjson(key, fallback) {
            let val = this.getdata(key);
            try { return val ? JSON.parse(val) : fallback; } catch { return fallback; }
        }

        setjson(val, key) {
            try { return this.setdata(JSON.stringify(val), key); } catch { return false; }
        }

        getdata(key) {
            switch (this.getEnv()) {
                case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    return $persistentStore.read(key) || '';
                case 'Quantumult X':
                    return $prefs.valueForKey(key) || '';
                case 'Node.js':
                    return this.data && this.data[key] || '';
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
                    case 'Quantumult X': {
                        const opts = { url: options.url, headers: options.headers, method };
                        if (options.body) opts.body = options.body;
                        $task.fetch(opts).then(
                            r => resolve({ status: r.statusCode, body: r.body, headers: r.headers }),
                            e => reject(e)
                        );
                        break;
                    }
                    case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: {
                        const cb = (err, resp, body) => {
                            if (err) reject(err);
                            else resolve({ status: resp.status || resp.statusCode, body, headers: resp.headers || {} });
                        };
                        const httpOpts = { url: options.url, headers: options.headers };
                        if (options.body) httpOpts.body = options.body;
                        if (method === 'GET') $httpClient.get(httpOpts, cb);
                        else if (method === 'POST') $httpClient.post(httpOpts, cb);
                        else $httpClient[method.toLowerCase()](httpOpts, cb);
                        break;
                    }
                    case 'Node.js': {
                        try {
                            const url = require('url');
                            const http = options.url.startsWith('https') ? require('https') : require('http');
                            const parsed = url.parse(options.url);
                            const req = http.request({
                                hostname: parsed.hostname, path: parsed.path, method,
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
                }
            });
        }

        msg(title, subtitle, content) {
            switch (this.getEnv()) {
                case 'Quantumult X':
                    $notify(title, subtitle || '', content || '');
                    break;
                case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
                    $notification.post(title, subtitle || '', content || '');
                    break;
                case 'Node.js':
                    console.log(`${title}: ${subtitle} - ${content}`);
                    break;
            }
        }

        log(msg) {
            console.log(msg);
            this.logs.push(msg);
        }

        logErr(e) {
            this.log(`❌ 错误: ${e.message || e}`);
            if (e.stack) this.log(e.stack);
        }

        wait(ms) {
            return new Promise(r => setTimeout(r, ms));
        }

        done() {
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
            this.log(`🔔 ${this.name}, 结束! 🕛 ${elapsed} 秒`);
            
            switch (this.getEnv()) {
                case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
                    $done();
                    break;
                case 'Node.js':
                    process.exit(0);
                    break;
            }
        }
    }(t, e);
}
