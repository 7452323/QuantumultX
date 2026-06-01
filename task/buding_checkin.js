new Env("布丁扫描签到");
cron 30 9 * * * buding_checkin.js

脚本兼容: Surge, Quantumult X, Loon, Shadowrocket, Node.js

布丁扫描每日签到，可获 5MB 云空间

[rewrite_local]
^https?:\/\/www\.budingscan\.com\/server\/(get_user_config|get_dynamic_config|invitation_code|coupon\/create) url script-request-body buding_checkin.js

[MITM]
hostname = www.budingscan.com

⚠️ 免责声明:
1、此脚本仅用于学习研究...
*/

const $ = new Env("布丁扫描");
// 存储key
const STORAGE_KEY = 'buding_checkin';
const SEP = '###BUDING###';

// 主入口
!(async () => {
    if (typeof $request != "undefined") {
        await captureHeaders();
    } else {
        await doCheckin();
    }
})()
.catch(e => $.logErr(e))
.finally(() => $.done());

/**
 * 抓取完整请求 headers（Rewrite 模式）
 * 触发条件：布丁扫描 App 发起任何 server 域请求时
 */
async function captureHeaders() {
    if ($request.method === 'OPTIONS') return;

    const raw = $request.headers || {};
    const needHeaders = [
        'x-ai-gateway-signature', 'x-ai-gateway-app-id',
        'x-ai-gateway-timestamp', 'x-ai-gateway-signed-headers',
        'x-ai-gateway-nonce', 'x-device-id', 'x-vaid',
        'x-channel', 'x-nation', 'x-package-name', 'x-uid',
        'x-phone-name', 'x-phone-id', 'x-phone-os', 'x-ver',
        'x-brand', 'host', 'user-agent', 'accept',
        'accept-language', 'content-type', 'connection',
    ];

    const headers = {};
    for (const k of needHeaders) {
        if (raw[k]) headers[k] = raw[k];
    }

    const uid = raw['x-uid'] || '';
    const phoneId = raw['x-phone-id'] || '';

    // 从body提取phone_id（用于签到接口）
    let phone_id = '';
    if ($request.body) {
        const m = $request.body.match(/request_id=([a-f0-9]+)/);
        if (m) phone_id = m[1];
    }
    if (!phone_id && phoneId) {
        phone_id = phoneId.replace(/-/g, '').toLowerCase();
    }

    if (!uid && !phoneId) {
        $.log('⛔️ 未找到关键标识，跳过抓取');
        return;
    }

    // 去重存储
    let list = ($.getdata(STORAGE_KEY) || '').split(SEP).filter(Boolean);
    const dedupKey = uid || phone_id;
    list = list.filter(item => {
        try {
            const h = JSON.parse(item);
            return h.uid !== dedupKey && h.phoneId !== dedupKey;
        } catch { return false; }
    });

    list.push(JSON.stringify({ headers, uid: dedupKey, phone_id }));
    $.setdata(list.join(SEP), STORAGE_KEY);
    $.msg($.name, `✅ 抓取成功 (${list.length})`,
        `UID: ${uid.slice(0, 16)}...`);
}

/**
 * 执行签到（Task 模式）
 */
async function doCheckin() {
    const raw = $.getdata(STORAGE_KEY);
    if (!raw) {
        $.msg($.name, '⛔️ 未抓到数据', '请先打开布丁扫描 App 获取 headers');
        return;
    }

    const list = raw.split(SEP).filter(Boolean);
    let succ = 0, fail = 0;
    const msgs = [];

    for (let i = 0; i < list.length; i++) {
        try {
            const { headers, phone_id } = JSON.parse(list[i]);
            if (!headers || !phone_id) {
                msgs.push(`账号${i + 1}: ⛔️ 数据不完整`);
                fail++;
                continue;
            }

            $.log(`📱 账号${i + 1} 开始签到...`);

            // 1. 检查今日是否已签
            const ts = Math.floor(Date.now() / 1000);
            const donateUrl =
                `https://www.budingscan.com/cloud_storage/get_donate_record` +
                `?phone_id=${phone_id}&request_id=${phone_id}-${ts}&request_time=${ts}&rtype=0`;

            const donateBody = await http(donateUrl, 'GET', headers);
            const donateData = safeJSON(donateBody);

            if (donateData?.data?.daily_status === 1) {
                msgs.push(`账号${i + 1}: ✅ 今日已签`);
                succ++;
                continue;
            }

            // 2. 签到
            const ts2 = Math.floor(Date.now() / 1000);
            const postBody = `request_id=${phone_id}-${ts2}&request_time=${ts2}`;
            const respBody = await http(
                'https://www.budingscan.com/server/coupon/create',
                'POST', headers, postBody
            );
            const data = safeJSON(respBody);

            if (data && data.code === 0) {
                msgs.push(`账号${i + 1}: ✅ 签到成功 +5MB`);
                succ++;
            } else {
                const msg = data?.msg || `HTTP ${respBody?.status}`;
                msgs.push(`账号${i + 1}: ❌ ${msg}`);
                fail++;
            }
        } catch (e) {
            $.logErr(e);
            msgs.push(`账号${i + 1}: ❌ ${e.message}`);
            fail++;
        }
        if (i < list.length - 1) await $.wait(2000);
    }

    $.msg($.name, `成功 ${succ} / 失败 ${fail}`,
        msgs.slice(0, 5).join('\n'));
}

// ═══════════════════════════════════
//  工具函数
// ═══════════════════════════════════

function safeJSON(str) {
    try { return JSON.parse(str); } catch { return null; }
}

function http(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const opts = { url, headers, method };
        if (body) opts.body = body;

        // QX 优先
        if (typeof $task !== 'undefined') {
            $task.fetch(opts)
                .then(r => resolve(r.body), e => reject(e));
        }
        // Surge/Loon
        else if (typeof $httpClient !== 'undefined') {
            const cb = (err, resp, data) => {
                if (err) reject(err);
                else resolve(data);
            };
            if (method === 'GET') $httpClient.get(opts, cb);
            else $httpClient.post(opts, cb);
        }
        // Node.js
        else {
            const mod = url.startsWith('https') ? require('https') : require('http');
            const parsed = require('url').parse(url);
            const req = mod.request({
                hostname: parsed.hostname,
                path: parsed.path,
                method,
                headers
            }, resp => {
                let d = '';
                resp.on('data', c => d += c);
                resp.on('end', () => resolve(d));
            });
            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        }
    });
}

// ═══════════════════════════════════
//  chavyleung's Env
// ═══════════════════════════════════
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

        log(msg) { console.log(msg); this.logs.push(msg); }
        logErr(e) { this.log(`❌ ${e.message || e}`); if (e.stack) this.log(e.stack); }
        wait(ms) { return new Promise(r => setTimeout(r, ms)); }

        msg(title, subtitle, content) {
            switch (this.getEnv()) {
                case 'Quantumult X':
                    $notify(title, subtitle || '', content || '');
                    break;
                case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    $notification.post(title, subtitle || '', content || '');
                    break;
                case 'Node.js':
                    console.log(`${title}: ${subtitle} - ${content}`);
                    break;
            }
        }

        done() {
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
            this.log(`结束! ${elapsed}s`);
            switch (this.getEnv()) {
                case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    $done({});
                    break;
                case 'Node.js':
                    process.exit(0);
                    break;
            }
        }
    }(t, e);
}
