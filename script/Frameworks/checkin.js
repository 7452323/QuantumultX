/*
╔══════════════════════════════════════════════════════════════╗
║               签到脚本通用框架 (Checkin Framework)           ║
║ 适用于: Quantumult X / Surge / Loon                        ║
║ 版本: v2.0.0                                                ║
║                                                              ║
║ 【使用方法】                                                  ║
║ 1. 复制本文件，重命名为 你的App名称.js                        ║
║ 2. 修改 SEARCH_URL / CHECKIN_URL 等配置项                    ║
║ 3. 修改 Cookie 采集的正则匹配                                 ║
║ 4. 部署并测试                                                 ║
║                                                              ║
║ 【配置参考】                                                  ║
║ Quantumult X:                                                ║
║ [rewrite_local]                                              ║
║ ^https?:\/\/api\.app\.com\/user url script-request-header    ║
║   https://raw.githubusercontent.com/Reviewa/QuantumultX/main/║
║   script/checkin.js                                          ║
║                                                              ║
║ [task_local]                                                 ║
║ 30 9 * * * https://raw.githubusercontent.com/Reviewa/        ║
║   QuantumultX/main/script/checkin.js                         ║
║                                                              ║
║ [mitm]                                                       ║
║ hostname = api.app.com                                       ║
╚══════════════════════════════════════════════════════════════╝
*/

// ============================================================
// 第一步：配置区（修改这里）
// ============================================================

const CONFIG = {
    // App 名称
    name: '签到',
    
    // 存储键名（持久化用）
    storageKey: 'app_checkin_data',
    
    // Cookie 提取正则（从请求头中匹配关键字段）
    // 例: /(session=[^;]+|token=[^;]+)/
    cookiePattern: /(sessionid=[^;]+|token=[^;]+|sid=[^;]+)/,
    
    // Cookie 去重字段正则（用于多账号去重）
    // 例: /user_id=([^;]+)/
    dedupPattern: /uid=([^;]+)/,
    
    // 签到接口
    checkin: {
        url: 'https://api.example.com/user/checkin',
        method: 'POST',
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Content-Type': 'application/json'
        },
        body: null, // null = GET 请求不需要 body
    },
    
    // Cookie 采集触发接口（设置后只有匹配此URL才采Cookie）
    cookieTrigger: '/user/info',
    
    // 通知标题
    notifyTitle: '签到完成',
};


// ============================================================
// 第二步：框架代码（通常不需要修改）
// ============================================================

// ---- 平台检测 ----
const isQX     = typeof $task !== 'undefined';
const isSurge  = typeof $httpClient !== 'undefined';
const isLoon   = typeof $loon !== 'undefined';

// ---- 日志 ----
function log(msg) {
    console.log(`[${CONFIG.name}] ${msg}`);
}

// ---- 跨平台 HTTP 请求 ----
async function httpRequest(method, url, headers = {}, body = null) {
    const options = { url, headers };
    if (body) options.body = typeof body === 'string' ? body : JSON.stringify(body);

    if (isQX) {
        const resp = await $task.fetch({ ...options, method });
        return { status: resp.statusCode, body: resp.body, headers: resp.headers };
    }
    if (isSurge || isLoon) {
        return new Promise((resolve) => {
            const cb = (err, resp, data) => resolve({
                status: resp.status || resp.statusCode,
                body: data,
                headers: resp.headers || {}
            });
            if (method === 'GET')  $httpClient.get(options, cb);
            else                    $httpClient.post(options, cb);
        });
    }
    return { status: 0, body: '' };
}

// ---- 跨平台持久化存储 ----
function storeRead(key) {
    if (isQX && $prefs.valueForKey)       return $prefs.valueForKey(key) || '';
    if (isSurge && $persistentStore.read)  return $persistentStore.read(key) || '';
    return '';
}
function storeWrite(key, val) {
    if (isQX && $prefs.setValueForKey)       $prefs.setValueForKey(val, key);
    if (isSurge && $persistentStore.write)   $persistentStore.write(val, key);
}

// ---- 通知 ----
function notify(title, subtitle, content) {
    if (typeof $notification !== 'undefined') {
        $notification.post(title, subtitle || '', content || '');
    }
    log(`${title}: ${subtitle} - ${content}`);
}

// ---- 延迟 ----
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


// ============================================================
// 第三步：Cookie 采集（拦截请求时触发）
// ============================================================

async function collectCookie() {
    // 非请求上下文，跳过
    if (typeof $request === 'undefined') return false;
    
    // 跳过 OPTIONS 预检请求
    if ($request.method === 'OPTIONS') { $done({}); return true; }
    
    // 如果设置了触发URL，检查是否匹配
    if (CONFIG.cookieTrigger && !$request.url.includes(CONFIG.cookieTrigger)) {
        return false;
    }

    // 从请求头中提取 Cookie
    const cookieHeader = $request.headers['Cookie']
                       || $request.headers['cookie']
                       || $request.headers['Authorization']
                       || $request.headers['authorization'];

    if (!cookieHeader) return false;

    // 用正则提取关键部分
    const match = cookieHeader.match(CONFIG.cookiePattern);
    const cookieValue = match ? match[0] : cookieHeader;

    // 多账号去重存储
    let cookies = storeRead(CONFIG.storageKey).split('#').filter(Boolean);
    
    // 去重
    const dedupMatch = cookieValue.match(CONFIG.dedupPattern);
    const dedupKey = dedupMatch ? dedupMatch[1] : cookieValue.slice(0, 20);
    
    cookies = cookies.filter(c => {
        const m = c.match(CONFIG.dedupPattern);
        const k = m ? m[1] : c.slice(0, 20);
        return k !== dedupKey;
    });
    
    cookies.push(cookieValue);
    storeWrite(CONFIG.storageKey, cookies.join('#'));
    
    log(`✅ Cookie 已采集 (共 ${cookies.length} 个账号)`);
    notify(CONFIG.name, `Cookie 已保存 (${cookies.length} 个账号)`, '');
    
    $done({});
    return true;
}


// ============================================================
// 第四步：签到执行（定时任务触发）
// ============================================================

async function doCheckin() {
    const raw = storeRead(CONFIG.storageKey);
    if (!raw) {
        log('❌ 无 Cookie，请先打开 App 采集');
        notify(CONFIG.name, '签到失败', '无 Cookie，请先打开 App');
        return;
    }

    const cookies = raw.split('#').filter(Boolean);
    log(`📋 共 ${cookies.length} 个账号`);

    let success = 0, failed = 0, results = [];

    for (let i = 0; i < cookies.length; i++) {
        try {
            const headers = {
                ...CONFIG.checkin.headers,
                'Cookie': cookies[i],
            };

            const resp = await httpRequest(
                CONFIG.checkin.method,
                CONFIG.checkin.url,
                headers,
                CONFIG.checkin.body
            );

            let data;
            try { data = JSON.parse(resp.body); } catch { data = {}; }
            
            const msg = data.message || data.msg || data.info
                      || `HTTP ${resp.status}`;
            
            log(`  账号 ${i+1}: ${msg}`);
            results.push(`账号${i+1}: ${msg}`);
            success++;
        } catch (e) {
            log(`  ❌ 账号 ${i+1}: ${e.message || e}`);
            results.push(`账号${i+1}: ❌ ${e.message || e}`);
            failed++;
        }
        
        if (i < cookies.length - 1) await sleep(2000);
    }

    const summary = `成功 ${success} / 失败 ${failed}`;
    log(`📊 ${summary}`);
    notify(CONFIG.notifyTitle, summary, results.slice(0, 5).join('\n'));
}


// ============================================================
// 第五步：入口
// ============================================================

!(async () => {
    // 优先判断是否为 Cookie 采集
    if (await collectCookie()) return;
    
    // 执行签到
    await doCheckin();
})().catch((e) => {
    log(`❌ 运行时错误: ${e.message || e}`);
    notify(CONFIG.name, '运行错误', e.message || e);
}).finally(() => {
    $done();
});
