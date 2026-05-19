/*
Unlock Framework v3
QX / Surge / Loon

使用方法:
1. 复制本文件，重命名
2. 修改 UNLOCK_CONFIG
3. 部署测试

配置参考:
[rewrite_local]
^https?:\/\/api\.app\.com\/(vip|user|subscription) url script-response-body unlock.js
[mitm]
hostname = api.app.com

免责声明:
本脚本仅供学习研究，请于下载后24小时内删除。
使用本脚本所造成的一切后果由使用者自行承担。
*/

const UNLOCK_CONFIG = [
    {
        url: '/user/vip',
        handler: function(obj) {
            if (obj.data) {
                obj.data.vip = 1;
                obj.data.vip_type = 'svip';
                obj.data.expireTime = '4092599349000';
            }
            obj.vip = 1;
            return obj;
        }
    },
    {
        url: '/subscription/status',
        handler: function() {
            return {
                data: {
                    processAppleReceipt: {
                        __typename: 'SubscriptionResult', error: 0,
                        subscription: {
                            __typename: 'AppStoreSubscription', status: 'active',
                            expirationDate: '9999-12-31T23:59:59.000Z',
                            productId: 'com.example.premium', tier: 'premium',
                            refundedDate: null,
                        }
                    }
                }
            };
        }
    },
    {
        url: '/usage/remaining',
        handler: function(obj) {
            if (obj.data) {
                obj.data.remaining = 99999;
                obj.data.quota = 99999;
            }
            return obj;
        }
    },
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

// 常用 App:
// 扫描全能王 /purchase/cs/query_property → vip_type=svip
// Notability /global → 替换 GraphQL 响应
// Foodie /v1/user/privilege → vip=1

(function() {
    const url = $request ? $request.url : '';
    console.log(`[Unlock] ${url}`);

    const config = UNLOCK_CONFIG.find(c => url.indexOf(c.url) !== -1);
    if (!config) {
        console.log('[Unlock] 无匹配');
        $done({});
        return;
    }

    try {
        let obj = JSON.parse($response.body);
        const result = config.handler(obj);
        $done({ body: JSON.stringify(result || obj) });
        console.log(`[Unlock] ✅ ${config.url}`);
    } catch (e) {
        console.log(`[Unlock] ❌ ${e.message}`);
        $done({});
    }
})();
