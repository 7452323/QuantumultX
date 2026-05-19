/*
═══════════════════════════════════════════════════════════════
                    解锁脚本框架 (Unlock Framework)
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
1. 复制本文件，重命名为 你的解锁名称.js
2. 在 UNLOCK_CONFIG 中配置要拦截的接口和要修改的字段
3. 部署并测试

【快速配置示例 — QX】
[rewrite_local]
^https?:\/\/api\.app\.com\/(vip|user|subscription) url script-response-body unlock.js
[mitm]
hostname = api.app.com
*/

// ═══════════════════════════════════════════════════════════
//                     配 置 区
// ═══════════════════════════════════════════════════════════

const UNLOCK_CONFIG = [
    // ── 示例1: 修改会员信息接口 ──
    {
        url: '/user/vip',
        handler: function(obj) {
            if (obj.data) {
                obj.data.vip = 1;
                obj.data.vip_type = 'svip';
                obj.data.expireTime = '4092599349000';
                obj.data.is_year = true;
            }
            obj.vip = 1;
            return obj;
        }
    },

    // ── 示例2: 替换整个订阅数据（适用于 GraphQL） ──
    {
        url: '/subscription/status',
        handler: function() {
            return {
                data: {
                    processAppleReceipt: {
                        __typename: 'SubscriptionResult',
                        error: 0,
                        subscription: {
                            __typename: 'AppStoreSubscription',
                            status: 'active',
                            expirationDate: '9999-12-31T23:59:59.000Z',
                            productId: 'com.example.premium',
                            tier: 'premium',
                            refundedDate: null,
                        }
                    }
                }
            };
        }
    },

    // ── 示例3: 修改使用次数 ──
    {
        url: '/usage/remaining',
        handler: function(obj) {
            if (obj.data) {
                obj.data.remaining = 99999;
                obj.data.quota = 99999;
                obj.data.export_times = 99999;
            }
            return obj;
        }
    },

    // ── 示例4: 解锁功能列表 ──
    {
        url: '/feature/list',
        handler: function(obj) {
            if (Array.isArray(obj.data)) {
                obj.data.forEach(function(item) {
                    item.unlocked = true;
                    item.locked = false;
                });
            }
            return obj;
        }
    },
];

// ── 常用 App 快速模板 ──
// 扫描全能王: /purchase/cs/query_property → vip_type=svip, auto_renewal=true, in_trial=1
// Notability: /global → 整个替换为 GraphQL 订阅响应
// Foodie: /v1/user/privilege → vip=1, svip=1, isYear=true
// Lightroom: /v1/profile → status=active, plan=premium
// PDF Expert: /api/2.0/subscription → isPro=true, expireDate=2099-12-31

// ═══════════════════════════════════════════════════════════
//                   框架代码（无需修改）
// ═══════════════════════════════════════════════════════════

(function() {
    const url = $request ? $request.url : '';
    console.log(`[Unlock] 📥 ${url}`);

    const config = UNLOCK_CONFIG.find(c => url.indexOf(c.url) !== -1);
    if (!config) {
        console.log('[Unlock] ⏭️ 无匹配配置');
        $done({});
        return;
    }

    console.log(`[Unlock] 🔓 匹配: ${config.url}`);

    try {
        let obj = JSON.parse($response.body);
        const originalKeys = Object.keys(obj);
        console.log(`[Unlock] 📊 原始字段: ${originalKeys.join(', ')}`);

        const result = config.handler(obj);
        const finalBody = JSON.stringify(result || obj);

        console.log('[Unlock] ✅ 解锁成功');
        $done({ body: finalBody });
    } catch (e) {
        console.log(`[Unlock] ❌ 错误: ${e.message}`);
        $done({});
    }
})();
