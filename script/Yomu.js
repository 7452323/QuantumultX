/**
 * Yomu - Adapty 会员破解脚本
 * 
 * 功能: 拦截 Adapty SDK 的 profile 和 cross-placement-info 接口，
 *       注入 premium 授权，解锁所有付费功能。
 * 
 * 原理: Adapty SDK v3.x 通过 profile 接口的 access_levels 中
 *       是否有活跃订阅来判断会员状态。修改此响应即可解锁。
 * 
 * 匹配: api.adapty.io
 * 应用: Yomu - 漫画阅读器 (MOBILE ALCHEMY LTD)
 * 
 * 兼容: Quantumult X / Loon / Surge / Stash
 * 日期: 2026-07-07
 */

// ========== 配置区域 ==========
const CONFIG = {
    // 使用的会员产品 (yearly / monthly / lifetime)
    product: 'yearly',
    
    // 过期时间 (2099年基本等于永久)
    expires: '2099-12-31T00:00:00.000000+0000',
    
    // 激活时间
    activated: '2026-07-07T00:00:00.000000+0000',
    
    // 产品名称映射
    products: {
        monthly: 'monthly.yomu.app',
        yearly: 'yearly.yomu.app',
        lifetime: 'lifetime.yomu.app'
    }
};

// ========== 主逻辑 ==========
const url = $request.url;
const method = $request.method;

if (method === 'GET' && url.match(/\/api\/v1\/sdk\/analytics\/profiles\/([^/?]+)/)) {
    // Profile GET - 注入会员信息
    const profileId = url.match(/\/profiles\/([^/?]+)/)[1];
    const vendorProductId = CONFIG.products[CONFIG.product];
    const now = CONFIG.activated;
    const expiry = CONFIG.expires;
    
    const premiumProfile = {
        "data": {
            "type": "adapty_analytics_profile",
            "id": profileId,
            "attributes": {
                "app_id": "public_live_jXeB1bKS",
                "profile_id": profileId,
                "customer_user_id": null,
                "total_revenue_usd": 0,
                "subscriptions": {
                    [vendorProductId]: {
                        "vendor_transaction_id": "2077" + randomDigits(12),
                        "vendor_original_transaction_id": "2077" + randomDigits(12),
                        "is_lifetime": CONFIG.product === 'lifetime',
                        "store": "app_store",
                        "activated_at": now,
                        "renewed_at": now,
                        "expires_at": expiry,
                        "is_active": true,
                        "is_in_grace_period": false,
                        "is_refund": false,
                        "is_sandbox": false,
                        "vendor_product_id": vendorProductId,
                        "offer_id": null,
                        "access_levels": {
                            "premium": {
                                "vendor_product_id": vendorProductId,
                                "store": "app_store",
                                "activated_at": now,
                                "renewed_at": now,
                                "expires_at": expiry,
                                "is_active": true,
                                "is_in_grace_period": false,
                                "is_refund": false,
                                "is_sandbox": false,
                                "offer_id": null,
                                "vendor_transaction_id": "2077" + randomDigits(12),
                                "vendor_original_transaction_id": "2077" + randomDigits(12),
                                "activated_in_app_id": null
                            }
                        },
                        "subscription_group_identifier": null,
                        "reason": null
                    }
                },
                "access_levels": {
                    "premium": {
                        "vendor_product_id": vendorProductId,
                        "store": "app_store",
                        "activated_at": now,
                        "renewed_at": now,
                        "expires_at": expiry,
                        "is_active": true,
                        "is_in_grace_period": false,
                        "is_refund": false,
                        "is_sandbox": false,
                        "offer_id": null,
                        "vendor_transaction_id": "2077" + randomDigits(12),
                        "vendor_original_transaction_id": "2077" + randomDigits(12),
                        "activated_in_app_id": null
                    }
                },
                "custom_attributes": {}
            }
        }
    };
    
    $done({
        status: 'HTTP/1.1 200 OK',
        headers: {
            'Content-Type': 'application/vnd.api+json',
            'Date': new Date().toUTCString(),
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify(premiumProfile)
    });
} else if (method === 'GET' && url.includes('/cross-placement-info/')) {
    // Cross Placement Info - 确保 placement 关联到 premium variation
    const crossPlacement = {
        "data": {
            "placement_with_variation_map": {
                "main_paywall": {
                    "placement_id": "main_paywall",
                    "variation_id": "8c7f0b3d-f5e4-437f-874a-24afbf0d3027",
                    "paywall_id": "4c6058c1-d339-4a0e-aeb1-316b4ee8b1aa"
                }
            },
            "version": Date.now()
        }
    };
    
    $done({
        status: 'HTTP/1.1 200 OK',
        headers: {
            'Content-Type': 'application/json',
            'Date': new Date().toUTCString(),
            'Cache-Control': 'no-store'
        },
        body: JSON.stringify(crossPlacement)
    });
} else {
    // 其他请求正常放行
    $done({});
}

// ========== 工具函数 ==========
function randomDigits(n) {
    let result = '';
    for (let i = 0; i < n; i++) {
        result += Math.floor(Math.random() * 10);
    }
    return result;
}
