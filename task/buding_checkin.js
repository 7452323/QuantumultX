/*
 * 布丁扫描自动签到 - 每日+5MB云空间
 * @supported QX / Surge / Loon / Node.js
 * 
 * [rewrite_local]
 * ^https?:\/\/www\.budingscan\.com\/server\/coupon\/create url script-request-header buding_checkin.js
 * 
 * [task_local]
 * 30 9 * * * buding_checkin.js, tag=布丁扫描签到, enabled=true
 * 
 * [mitm]
 * hostname = www.budingscan.com
 * 
 * 抓包方式：
 * 1. 启用 rewrite + mitm
 * 2. 打开布丁扫描 App -> "我的" 页面
 * 3. 脚本会自动抓取 coupon/create 的请求headers
 * 
 * 环境变量方式（Node.js / GitHub Actions）：
 * BUDING_HEADERS = 完整headers JSON
 * BUDING_PHONE_ID = phone_id（抓包获取）
 * 
 * 免责声明：仅供学习研究，下载后24小时内删除。
 */

const APP_CONFIG = {
    name: '布丁扫描签到',
    storageKey: 'buding_checkin_headers',
    phoneKey: 'buding_phone_id',
    donateRecordKey: 'buding_donate_record',
    cookiePattern: /.*/,
    accountSeparator: '###BUDING###',
    dedupPattern: /X-uid=([^,]+)/,
    checkin: {
        url: 'https://www.budingscan.com/server/coupon/create',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN',
            'User-Agent': 'VScanner/2.5.7 (com.weibai.scanner; build:850039; iOS 26.4.1) Alamofire/5.11.2'
        }
    },
    userInfo: {
        url: 'https://www.budingscan.com/server/get_user_config',
        method: 'POST',
        body: 'nationCode=86&phone='
    },
    donateRecord: {
        url: 'https://www.budingscan.com/cloud_storage/get_donate_record',
        method: 'GET'
    },
    dynamicConfig: {
        url: 'https://www.budingscan.com/server/get_dynamic_config',
        method: 'POST',
        body: ''
    },
    cookieTrigger: '/coupon/create',
    notifyTitle: '布丁扫描签到',
    dailySize: 5242880 // 5MB
};

const $ = new Env(APP_CONFIG.name);

!(async () => {
    if (typeof $request !== 'undefined') {
        await captureHeaders();
        return;
    }
    await doCheckin();
})().catch(e => $.logErr(e)).finally(() => $.done());

/**
 * 拦截 coupon/create 请求，保存完整headers
 */
async function captureHeaders() {
    if ($request.method === 'OPTIONS') return;

    // 提取所有关键headers
    const headers = { ...$request.headers };
    
    // 只保留需要的关键headers
    const keyHeaders = [
        'X-AI-GATEWAY-SIGNATURE',
        'X-AI-GATEWAY-APP-ID',
        'X-AI-GATEWAY-TIMESTAMP',
        'X-AI-GATEWAY-SIGNED-HEADERS',
        'X-AI-GATEWAY-NONCE',
        'X-device-id',
        'X-vaid',
        'X-channel',
        'X-nation',
        'X-package-name',
        'X-uid',
        'X-phone-name',
        'X-phone-id',
        'X-phone-os',
        'X-ver',
        'X-brand',
        'Host',
        'User-Agent',
        'Accept-Language',
        'Accept',
        'Content-Type',
        'Accept-Encoding',
        'Connection'
    ];

    const cleanedHeaders = {};
    for (const k of keyHeaders) {
        const lk = k.toLowerCase();
        // headers from QX are lowercase
        const found = Object.keys(headers).find(h => h.toLowerCase() === lk);
        if (found) {
            cleanedHeaders[k] = headers[found];
        }
    }

    // 提取 phone_id 和 uid 作为账号标识
    const uid = cleanedHeaders['X-uid'] || '';
    const phoneId = cleanedHeaders['X-phone-id'] || '';
    const body = $request.body || '';
    const phoneIdFromBody = body.match(/phone_id=([^&]+)/);
    const phone_id = phoneIdFromBody ? phoneIdFromBody[1] : phoneId.replace(/-/g, '').toLowerCase();

    if (!uid && !phoneId) {
        $.log('未找到关键标识，跳过');
        return;
    }

    // 存储完整的headers JSON
    const raw = $.getdata(APP_CONFIG.storageKey) || '';
    let list = raw ? raw.split(APP_CONFIG.accountSeparator).filter(Boolean) : [];
    
    // 去重：用 X-uid 或 phone_id 做去重key
    const dedupKey = uid || phone_id;
    list = list.filter(item => {
        try {
            const h = JSON.parse(item);
            return h['X-uid'] !== dedupKey && h['X-phone-id'] !== dedupKey;
        } catch { return false; }
    });
    
    // 保存headers + phone_id
    const entry = JSON.stringify({ headers: cleanedHeaders, phone_id, uid });
    list.push(entry);
    
    $.setdata(list.join(APP_CONFIG.accountSeparator), APP_CONFIG.storageKey);
    $.msg(APP_CONFIG.name, `✅ 抓取成功 (${list.length} 个账号)`, `${uid.slice(0,16)}... | phone_id: ${phone_id.slice(0,10)}...`);
}

/**
 * 执行签到
 */
async function doCheckin() {
    const raw = $.getdata(APP_CONFIG.storageKey);
    if (!raw) {
        $.log('❌ 未抓取到请求数据，请先打开布丁扫描App');
        $.msg(APP_CONFIG.name, '❌ 签到失败', '未抓取到请求数据，请先打开布丁扫描App');
        return;
    }

    const list = raw.split(APP_CONFIG.accountSeparator).filter(Boolean);
    let success = 0, failed = 0;
    const results = [];

    for (let i = 0; i < list.length; i++) {
        try {
            const entry = JSON.parse(list[i]);
            const headers = entry.headers || {};
            const phone_id = entry.phone_id || '';
            
            $.log(`账号${i + 1}: 开始签到...`);
            
            // Step 1: 先检查签到状态
            const donateUrl = `https://www.budingscan.com/cloud_storage/get_donate_record?phone_id=${phone_id}&request_id=${phone_id}-${Date.now()}&request_time=${Math.floor(Date.now() / 1000)}&rtype=0`;
            const donateResp = await $.http({
                url: donateUrl,
                headers: headers,
                method: 'GET'
            });
            
            let donateData = {};
            try { donateData = JSON.parse(donateResp.body); } catch {}
            
            if (donateData.data && donateData.data.daily_status === 1) {
                $.log(`账号${i + 1}: 今日已签到`);
                results.push(`账号${i + 1}: ✅ 今日已签到`);
                success++;
                continue;
            }

            // Step 2: 获取应用配置（确认签到奖励）
            const configResp = await $.http({
                url: 'https://www.budingscan.com/server/get_dynamic_config',
                headers: headers,
                method: 'POST',
                body: ''
            });
            
            let configData = {};
            try { configData = JSON.parse(configResp.body); } catch {}
            const dailySize = configData.result && configData.result.everyday_login_donate_size
                ? parseInt(configData.result.everyday_login_donate_size) / 1024 / 1024
                : 5;
            
            // Step 3: 执行签到
            const timestamp = Math.floor(Date.now() / 1000);
            const body = `request_id=${phone_id}-${timestamp}&request_time=${timestamp}`;
            
            const resp = await $.http({
                url: 'https://www.budingscan.com/server/coupon/create',
                headers: headers,
                method: 'POST',
                body: body
            });
            
            let data = {};
            try { data = JSON.parse(resp.body); } catch {}
            
            if (data.code === 0) {
                const msg = `✅ 签到成功 +${dailySize}MB`;
                $.log(`账号${i + 1}: ${msg}`);
                results.push(`账号${i + 1}: ${msg}`);
                success++;
            } else {
                const msg = data.msg || `HTTP ${resp.status}`;
                $.log(`账号${i + 1}: ❌ ${msg}`);
                results.push(`账号${i + 1}: ❌ ${msg}`);
                failed++;
            }
        } catch (e) {
            $.log(`账号${i + 1} 失败: ${e.message || e}`);
            results.push(`账号${i + 1}: ❌ ${e.message || '请求异常'}`);
            failed++;
        }
        if (i < list.length - 1) await $.wait(2000);
    }

    const summary = `成功 ${success} / 失败 ${failed}`;
    $.log(summary);
    $.msg(APP_CONFIG.notifyTitle, summary, results.slice(0, 5).join('\n'));
    $.log(results.join('\n'));
}


/**
 * ============ Env 框架 (精简版) ============
 * 支持: QX / Surge / Loon / Stash / Shadowrocket / Node.js
 */
function Env(t, e) {
    const isSurge = typeof $environment !== 'undefined' && $environment['surge-version'];
    const isStash = typeof $environment !== 'undefined' && $environment['stash-version'];
    const isLoon = typeof $loon !== 'undefined';
    const isQX = typeof $task !== 'undefined';
    const isNode = typeof module !== 'undefined' && module.exports;
    const isShadowrocket = typeof $rocket !== 'undefined';

    function getEnv() {
        if (isSurge) return 'Surge';
        if (isStash) return 'Stash';
        if (isLoon) return 'Loon';
        if (isQX) return 'Quantumult X';
        if (isShadowrocket) return 'Shadowrocket';
        if (isNode) return 'Node.js';
        return 'unknown';
    }

    return new class {
        constructor(t, e) {
            this.name = t;
            this.data = null;
            this.logs = [];
            this.startTime = Date.now();
            this.log(`🔔 ${this.name}, 开始!`);
        }

        getEnv() { return getEnv(); }
        isNode() { return isNode; }
        isQuanX() { return isQX; }
        isSurge() { return isSurge; }
        isLoon() { return isLoon; }

        getdata(key) {
            if (isSurge || isLoon || isStash || isShadowrocket)
                return $persistentStore.read(key) || '';
            if (isQX)
                return $prefs.valueForKey(key) || '';
            if (isNode)
                return this.data && this.data[key] || '';
            return '';
        }

        setdata(val, key) {
            if (isSurge || isLoon || isStash || isShadowrocket)
                return $persistentStore.write(val, key);
            if (isQX)
                return $prefs.setValueForKey(val, key);
            if (isNode) {
                this.data = this.data || {};
                this.data[key] = val;
                return true;
            }
            return false;
        }

        async http(options) {
            return new Promise((resolve, reject) => {
                const method = (options.method || 'GET').toUpperCase();
                if (isQX) {
                    const opts = { url: options.url, headers: options.headers, method };
                    if (options.body) opts.body = options.body;
                    $task.fetch(opts).then(
                        r => resolve({ status: r.statusCode, body: r.body, headers: r.headers }),
                        e => reject(e)
                    );
                } else if (isSurge || isLoon || isStash || isShadowrocket) {
                    const cb = (err, resp, body) => {
                        if (err) reject(err);
                        else resolve({ status: resp.status || resp.statusCode, body, headers: resp.headers || {} });
                    };
                    const opts = { url: options.url, headers: options.headers };
                    if (options.body) opts.body = options.body;
                    if (method === 'GET') $httpClient.get(opts, cb);
                    else if (method === 'POST') $httpClient.post(opts, cb);
                    else $httpClient[method.toLowerCase()](opts, cb);
                } else if (isNode) {
                    try {
                        const http = require(method === 'GET' && options.url.startsWith('https') ? 'https' : options.url.startsWith('https') ? 'https' : 'http');
                        const parsed = require('url').parse(options.url);
                        const req = http.request({
                            hostname: parsed.hostname,
                            path: parsed.path,
                            method,
                            headers: options.headers || {}
                        }, resp => {
                            let data = '';
                            resp.on('data', c => data += c);
                            resp.on('end', () => resolve({ status: resp.statusCode, body: data, headers: resp.headers }));
                        });
                        req.on('error', reject);
                        if (options.body) req.write(options.body);
                        req.end();
                    } catch (e) { reject(e); }
                } else {
                    reject(new Error('unsupported env'));
                }
            });
        }

        msg(title, subtitle, content) {
            if (isQX) $notify(title, subtitle || '', content || '');
            else if (isSurge || isLoon || isStash || isShadowrocket)
                $notification.post(title, subtitle || '', content || '');
            else if (isNode) console.log(`${title}: ${subtitle} - ${content}`);
        }

        log(msg) { console.log(msg); this.logs.push(msg); }
        logErr(e) { this.log(`❌ ${e.message || e}`); if (e.stack) this.log(e.stack); }
        wait(ms) { return new Promise(r => setTimeout(r, ms)); }

        done() {
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
            this.log(`结束! ${elapsed}s`);
            if (isQX || isSurge || isLoon || isStash || isShadowrocket) $done();
            else if (isNode) process.exit(0);
        }
    }(t, e);
}
