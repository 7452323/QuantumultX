/*
 * @name RevenueCat
 * @description 伪造 RevenueCat 响应，实现通杀
 * @compatible QuantumultX, Loon, Surge, Stash
 * @author Qiq
 * @github https://github.com/Reviewa/QuantumultX

 [rewrite_local]
^https?:\/\/[^/]+\.revenuecat\.com\/(v\d\/)?receipts$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/RevenueCat.js
^https?:\/\/[^/]+\.revenuecat\.com\/(v\d\/)?subscribers\/[^/]+$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/RevenueCat.js

[mitm]
hostname = *.revenuecat.com

*/

const now = Date.now();
const nowISOString = new Date(now).toISOString();
const expireDate = "2099-12-31T23:59:59Z";
const expireDateMs = "2099-12-31T23:59:59.000000Z";

// ====== 通用产品ID库（覆盖绝大多数app）======
const productIds = [
  // RevenueCat 标准命名
  "com.revenuecat.pro", "com.revenuecat.premium", "com.revenuecat.vip",
  "com.revenuecat.lifetime", "com.revenuecat.annual", "com.revenuecat.monthly",
  "com.revenuecat.weekly", "com.revenuecat.yearly",

  // iOS App Store 通用
  "com.app.yearly", "com.app.monthly", "com.app.lifetime", "com.app.weekly",
  "com.app.pro", "com.app.premium", "com.app.vip",
  "com.yourapp.pro", "com.yourapp.premium",
  
  // 中文App常见
  "com.xiaohongshu.vip", "com.shopee.vip", "com.zhihu.vip",
  "com.bilibili.vip", "com.tencent.vip", "com.netease.vip",
  "com.youku.vip", "com.iqiyi.vip",
  
  // 订阅式命名
  "pro_yearly", "sub_1y", "sub_1m", "vip_year", "vip_lifetime",
  "yearly", "monthly", "lifetime", "weekly",
  
  // 功能解锁
  "unlock_all_features", "full_access", "premium_access",
  "pro_access", "vip_access",
  
  // 通用前缀
  "io.monthly", "io.yearly", "io.lifetime", "io.weekly",
  "com.monthly", "com.yearly", "com.lifetime", "com.weekly",
  
  // 其他
  "onetime", "one_time_purchase", "consumable",
  "tip_1", "tip_2", "tip_3"
];

// ====== 通用Entitlement Key库 ======
const entitlementKeys = [
  "pro", "premium", "vip", "default", "membership", "access",
  "lifetime", "full", "unlock", "all_access", "plus",
  "gold", "silver", "bronze", "active", "deluxe",
  "standard", "ultimate", "enterprise"
];

// ====== Store类型（覆盖所有发行渠道）======
const stores = ["app_store", "play_store", "promotional", "stripe", "rc_billing", "amazon"];

// ====== 构建响应 ======
let entitlements = {};
let subscriptions = {};

// 构建entitlements
for (let ent of entitlementKeys) {
  entitlements[ent] = {
    expires_date: expireDateMs,
    product_identifier: productIds[Math.floor(Math.random() * 5)],
    purchase_date: nowISOString
  };
}

// 构建subscriptions
for (let pid of productIds) {
  subscriptions[pid] = {
    auto_resume_date: null,
    billing_issues_detected_at: null,
    expires_date: expireDateMs,
    grace_period_expires_date: null,
    is_sandbox: false,
    original_purchase_date: nowISOString,
    ownership_type: "PURCHASED",
    period_type: "active",
    purchase_date: nowISOString,
    refunded_at: null,
    store: stores[Math.floor(Math.random() * stores.length)],
    store_transaction_id: "RC" + now.toString(36).toUpperCase() + Math.random().toString(36).substring(2, 8).toUpperCase(),
    unsubscribe_detected_at: null
  };
}

// ====== 返回伪造的完整响应 ======
$done({
  body: JSON.stringify({
    request_date: nowISOString,
    request_date_ms: now,
    subscriber: {
      entitlements: entitlements,
      first_seen: "2020-01-01T00:00:00Z",
      last_seen: nowISOString,
      management_url: "https://apps.apple.com/account/subscriptions",
      non_subscriptions: {},
      original_app_user_id: "$RCAnonymousID:" + now.toString(36) + Math.random().toString(36).substring(2, 15),
      original_application_version: "2026.5.19",
      original_purchase_date: "2020-01-01T00:00:00Z",
      other_purchases: {},
      subscriptions: subscriptions
    }
  })
});
