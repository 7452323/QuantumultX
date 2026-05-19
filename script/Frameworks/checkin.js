/*
Checkin Framework v3
QX / Surge / Loon / Node

使用方法:
1. 复制本文件，重命名
2. 修改 APP_CONFIG 配置
3. 部署测试

配置参考:
[rewrite_local]
^https?:\/\/api\.app\.com\/user url script-request-header checkin.js
[task_local]
30 9 * * * checkin.js, tag=签到, enabled=true
[mitm]
hostname = api.app.com

免责声明:
本脚本仅供学习研究，请于下载后24小时内删除。
使用本脚本所造成的一切后果由使用者自行承担。
*/

const APP_CONFIG = {
    name: '签到',
    storageKey: 'app_checkin_data',
    cookiePattern: /(sessionid=[^;]+|token=[^;]+)/,
    accountSeparator: '#',
    dedupPattern: /uid=([^;]+)/,
    checkin: {
        url: 'https://api.example.com/user/checkin',
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
        },
    },
    cookieTrigger: '',
    notifyTitle: '签到完成',
};

const $ = new Env(APP_CONFIG.name);

!(async () => {
    if (typeof $request !== 'undefined') {
        await collectCookie();
        return;
    }
    await doCheckin();
})().catch(e => $.logErr(e)).finally(() => $.done());

async function collectCookie() {
    if ($request.method === 'OPTIONS') return;
    if (APP_CONFIG.cookieTrigger && !$request.url.includes(APP_CONFIG.cookieTrigger)) return;

    const value = $request.headers['Cookie']
               || $request.headers['cookie']
               || $request.headers['Authorization']
               || $request.headers['authorization'];
    if (!value) return;

    const cookieValue = value.match(APP_CONFIG.cookiePattern)
        ? value.match(APP_CONFIG.cookiePattern)[0]
        : value;

    let list = ($.getdata(APP_CONFIG.storageKey) || '').split(APP_CONFIG.accountSeparator).filter(Boolean);
    const key = cookieValue.match(APP_CONFIG.dedupPattern);
    const dedupKey = key ? key[1] : cookieValue.slice(0, 20);
    list = list.filter(c => {
        const m = c.match(APP_CONFIG.dedupPattern);
        return m ? m[1] !== dedupKey : c.slice(0, 20) !== dedupKey;
    });
    list.push(cookieValue);

    $.setdata(list.join(APP_CONFIG.accountSeparator), APP_CONFIG.storageKey);
    $.msg(APP_CONFIG.name, `Cookie 已保存 (${list.length} 个账号)`, '');
}

async function doCheckin() {
    const raw = $.getdata(APP_CONFIG.storageKey);
    if (!raw) {
        $.log('Cookie 不存在，请先打开 App 采集');
        $.msg(APP_CONFIG.name, '签到失败', 'Cookie 不存在');
        return;
    }

    const list = raw.split(APP_CONFIG.accountSeparator).filter(Boolean);
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
            $.log(`账号${i + 1}: ${msg}`);
            results.push(`账号${i + 1}: ${msg}`);
            success++;
        } catch (e) {
            $.log(`账号${i + 1} 失败: ${e.message || e}`);
            results.push(`账号${i + 1} 失败`);
            failed++;
        }
        if (i < list.length - 1) await $.wait(2000);
    }

    const summary = `成功 ${success} / 失败 ${failed}`;
    $.log(summary);
    $.msg(APP_CONFIG.notifyTitle, summary, results.slice(0, 5).join('\n'));
}

// From chavyleung's Env.js
function Env(t, e) {
    return new class {
        constructor(t, e) {
            this.name = t;
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
                        const opts = { url: options.url, headers: options.headers };
                        if (options.body) opts.body = options.body;
                        if (method === 'GET') $httpClient.get(opts, cb);
                        else if (method === 'POST') $httpClient.post(opts, cb);
                        else $httpClient[method.toLowerCase()](opts, cb);
                        break;
                    }
                    case 'Node.js': {
                        try {
                            const [protocol, u] = options.url.startsWith('https') ? ['https', require('url').parse(options.url)] : ['http', require('url').parse(options.url)];
                            const mod = require(protocol);
                            const req = mod.request({
                                hostname: u.hostname, path: u.path, method,
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
    }(t, e);
}
