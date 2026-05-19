/*
╔══════════════════════════════════════════════════════════════╗
║              解锁脚本通用框架 (Unlock Framework)             ║
║ 适用于: Quantumult X / Surge / Loon                        ║
║ 版本: v2.0.0                                                ║
║                                                              ║
║ 【使用方法】                                                  ║
║ 1. 复制本文件，重命名为 你的App名称.js                        ║
║ 2. 在 UNLOCK_CONFIG 中配置要拦截的接口和要改的字段            ║
║ 3. 部署到 QX/Surge/Loon 并测试                                ║
║                                                              ║
║ 【配置参考】                                                  ║
║ [rewrite_local]                                              ║
║ ^https?:\/\/api\.app\.com\/(vip|user|subscription)           ║
║   url script-response-body                                   ║
║   https://raw.githubusercontent.com/Reviewa/QuantumultX/main/║
║   script/unlock.js                                           ║
║                                                              ║
║ [mitm]                                                       ║
║ hostname = api.app.com                                       ║
╚══════════════════════════════════════════════════════════════╝
*/

// ============================================================
// 第一步：配置区（修改这里）
// ============================================================

const UNLOCK_CONFIG = [
    // ---- 配置示例1：修改响应体字段 ----
    // URL 包含此字符串时触发
    {
        url: '/user/vip',
        handler: function(obj) {
            // 修改 obj 中的字段
            if (obj.data) {
                obj.data.vip = 1;
                obj.data.vip_type = 'svip';
                obj.data.expireTime = '4092599349000';
                obj.data.is_year = true;
            }
            obj.vip = 1;
            obj.isvip = 1;
            return obj;
        }
    },
    
    // ---- 配置示例2：替换整个响应体 ----
    {
        url: '/subscription/status',
        handler: function(obj) {
            // 完全替换
            return {
                "data": {
                    "processAppleReceipt": {
                        "__typename": "SubscriptionResult",
                        "error": 0,
                        "subscription": {
                            "__typename": "AppStoreSubscription",
                            "status": "active",
                            "originalPurchaseDate": "2024-01-01T00:00:00.000Z",
                            "originalTransactionId": "570001185968888",
                            "expirationDate": "9999-12-31T23:59:59.000Z",
                            "productId": "com.example.premium",
                            "tier": "premium",
                            "refundedDate": null,
                            "isInBillingRetryPeriod": false
                        }
                    }
                }
            };
        }
    },
    
    // ---- 配置示例3：修改使用次数 ----
    {
        url: '/usage/remaining',
        handler: function(obj) {
            if (obj.data) {
                obj.data.remaining = 99999;
                obj.data.pdf_quota = 99999;
                obj.data.export_times = 99999;
            }
            return obj;
        }
    },

    // ---- 配置示例4：修改功能开关列表 ----
    {
        url: '/feature/list',
        handler: function(obj) {
            if (obj.data && Array.isArray(obj.data)) {
                obj.data.forEach(function(item) {
                    item.unlocked = true;
                    item.locked = false;
                });
            }
            return obj;
        }
    }
];


// ============================================================
// 第二步：常见 App 快速配置（取消注释即可使用）
// ============================================================

// ---- 扫描全能王 ----
// 接口: /purchase/cs/query_property
// const UNLOCK_CONFIG = [{
//     url: '/queryProperty',
//     handler: function(obj) {
//         obj.group1_paid = 1;
//         obj.ms_first_pay = 0;
//         obj.vip_type = 'svip';
//         obj.auto_renewal = true;
//         obj.in_trial = 1;
//         obj.members_page = 0;
//         obj.pc_vip = 1;
//         obj.renew_type = 'year';
//         return obj;
//     }
// }];

// ---- Notability ----
// 接口: notability.com/global
// const UNLOCK_CONFIG = [{ url: '/global', handler: function() {
//     return { "data": { "processAppleReceipt": {
//         "__typename": "SubscriptionResult", "error": 0,
//         "subscription": {
//             "__typename": "AppStoreSubscription",
//             "status": "active",
//             "originalPurchaseDate": "2024-01-01T00:00:00.000Z",
//             "originalTransactionId": "570001185968888",
//             "expirationDate": "9999-12-31T23:59:59.000Z",
//             "productId": "com.gingerlabs.Notability.premium_subscription",
//             "tier": "premium", "refundedDate": null,
//             "isInBillingRetryPeriod": false
//         }
//     }}};
// }}];

// ---- Adobe Lightroom ----
// 接口: /v1/profile
// const UNLOCK_CONFIG = [{ url: '/v1/profile', handler: function(obj) {
//     obj.status = 'active';
//     obj.plan = 'premium';
//     return obj;
// }}];

// ---- Foodie ----
// 接口: /v1/user/privilege
// const UNLOCK_CONFIG = [{ url: '/user/privilege', handler: function(obj) {
//     obj.vip = 1; obj.svip = 1; obj.isYear = true;
//     return obj;
// }}];


// ============================================================
// 第三步：框架代码（不需要修改）
// ============================================================

// ---- 日志 ----
function log(msg) {
    console.log(`[Unlock] ${msg}`);
}

// ---- 获取当前请求的 URL ----
function getRequestUrl() {
    return $request ? $request.url : '';
}

// ---- 查找匹配的配置 ----
function findMatch(url) {
    for (var i = 0; i < UNLOCK_CONFIG.length; i++) {
        if (url.indexOf(UNLOCK_CONFIG[i].url) !== -1) {
            return UNLOCK_CONFIG[i];
        }
    }
    return null;
}

// ---- 通用解锁流程 ----
function doUnlock(body, config) {
    // 解析 JSON
    var obj;
    try {
        obj = JSON.parse(body);
    } catch (e) {
        log(`❌ JSON 解析失败: ${e.message}`);
        return body;
    }
    
    // 记录原始字段（便于调试）
    var keys = Object.keys(obj);
    log(`🔍 原始字段: ${keys.join(', ')}`);
    
    // 执行自定义处理
    var result = config.handler(obj);
    
    // 如果 handler 返回了完整对象，使用它
    // 否则使用修改后的 obj
    var finalObj = result || obj;
    
    log('✅ 解锁成功');
    return JSON.stringify(finalObj);
}


// ============================================================
// 第四步：入口
// ============================================================

(function() {
    var url = getRequestUrl();
    log(`📥 拦截: ${url}`);
    
    // 查找匹配的配置
    var config = findMatch(url);
    
    if (!config) {
        log('⏭️ 无匹配配置，透传');
        $done({});
        return;
    }
    
    log(`🔓 匹配: ${config.url}`);
    
    // 执行解锁
    var modifiedBody = doUnlock($response.body, config);
    
    $done({
        body: modifiedBody
    });
})();
