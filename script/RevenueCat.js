/*
 * @name RevenueCat 通杀（终极版）
 * @description 通杀 api.revenuecat.com，覆盖 v1/v2 全部端点
 * @compatible QuantumultX, Loon, Surge, Stash, Shadowrocket
 * @author Qiq
 * @github https://github.com/Reviewa/QuantumultX

 [rewrite_local]
# QX — 通配子域名 + v1/v2 全部端点 + 带尾部斜杠/query参数
^https?:\/\/[a-z0-9-]+\.revenuecat\.com\/(v[12]\/)?(receipts|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/RevenueCat.js

[mitm]
hostname = *.revenuecat.com

*/

// ==========================================
//  🎯 RevenueCat 通杀脚本 v3
//  覆盖: api.revenuecat.com / purchase.revenuecat.com / etc.
//  端点: /v1/receipts / /v1/subscribers/* / /v2/receipts / /v2/subscribers/*
//  返回: 完整伪造 Response，所有 entitlements + subscriptions 全部激活
// ==========================================

const now = Date.now();
const nowISO = new Date(now).toISOString();
const expireDate = "2999-12-31T23:59:59Z";
const expireDateMs = "2999-12-31T23:59:59.000000Z";
const expireTs = 32503679999000;

// ====== 🌍 通用产品ID（100+ 覆盖所有常见 App）======
const productIds = [
  // --- RevenueCat 标准 ---
  "com.revenuecat.pro", "com.revenuecat.premium", "com.revenuecat.vip",
  "com.revenuecat.lifetime", "com.revenuecat.annual", "com.revenuecat.monthly",
  "com.revenuecat.weekly", "com.revenuecat.yearly",

  // --- iOS App Store 通用 ---
  "com.app.yearly", "com.app.monthly", "com.app.lifetime", "com.app.weekly",
  "com.app.pro", "com.app.premium", "com.app.vip", "com.app.plus",
  "com.yourapp.pro", "com.yourapp.premium",

  // --- 中文 App 常见 ---
  "com.xiaohongshu.vip", "com.shopee.vip", "com.zhihu.vip",
  "com.bilibili.vip", "com.tencent.vip", "com.netease.vip",
  "com.youku.vip", "com.iqiyi.vip", "com.meituan.vip",
  "com.douyin.vip", "com.kuaishou.vip",

  // --- 订阅式命名 ---
  "pro_yearly", "sub_1y", "sub_1m", "sub_1w", "vip_year",
  "vip_lifetime", "yearly", "monthly", "lifetime", "weekly",
  "annual", "half_yearly", "quarterly",

  // --- 功能解锁 ---
  "unlock_all_features", "full_access", "premium_access",
  "pro_access", "vip_access", "plus_access", "all_access",
  "unlock_premium", "unlock_pro", "unlock_vip",

  // --- 通用前缀 ---
  "io.monthly", "io.yearly", "io.lifetime", "io.weekly",
  "com.monthly", "com.yearly", "com.lifetime", "com.weekly",
  "net.monthly", "net.yearly", "org.monthly",

  // --- 一次性 / 消耗品 ---
  "onetime", "one_time_purchase", "consumable",
  "tip_1", "tip_2", "tip_3", "tip_5", "tip_10",
  "coin_100", "coin_500", "coin_1000",

  // --- 额外常见 ---
  "starter", "basic", "standard", "deluxe", "ultimate",
  "pro_monthly", "pro_yearly", "pro_lifetime",
  "premium_monthly", "premium_yearly",
  "vip_monthly", "vip_yearly", "vip_lifetime"
];

// ====== 🔑 Entitlement Key 库 ======
const entitlementKeys = [
  "pro", "premium", "vip", "default", "membership", "access",
  "lifetime", "full", "unlock", "all_access", "plus",
  "gold", "silver", "bronze", "active", "deluxe",
  "standard", "ultimate", "enterprise", "basic",
  "starter", "advanced", "professional"
];

// ====== 🏪 发行渠道 ======
const stores = ["app_store", "play_store", "promotional", "stripe", "rc_billing", "amazon", "mac_app_store"];

// ====== 🆔 生成假交易ID ======
function genTxId() {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

// ====== 📦 构建 Entitlements ======
let entitlements = {};
for (let ent of entitlementKeys) {
  entitlements[ent] = {
    expires_date: expireDateMs,
    grace_period_expires_date: null,
    purchase_date: nowISO,
    product_identifier: productIds[Math.floor(Math.random() * productIds.length)],
    product_plan_identifier: null
  };
}

// ====== 📦 构建 Subscriptions ======
let subscriptions = {};
for (let pid of productIds) {
  subscriptions[pid] = {
    auto_resume_date: null,
    billing_issues_detected_at: null,
    expires_date: expireDateMs,
    grace_period_expires_date: null,
    is_sandbox: false,
    original_purchase_date: nowISO,
    ownership_type: "PURCHASED",
    period_type: "active",
    purchase_date: nowISO,
    refunded_at: null,
    store: stores[Math.floor(Math.random() * stores.length)],
    store_transaction_id: genTxId(),
    unsubscribe_detected_at: null
  };
}

// ====== 🚀 返回伪造的完整 Response ======
$done({
  body: JSON.stringify({
    request_date: nowISO,
    request_date_ms: now,
    subscriber: {
      entitlements: entitlements,
      first_seen: "2020-01-01T00:00:00Z",
      last_seen: nowISO,
      management_url: "https://apps.apple.com/account/subscriptions",
      non_subscriptions: {},
      original_app_user_id: "$RCAnonymousID:" + genTxId(),
      original_application_version: "2999.1.0",
      original_purchase_date: "2020-01-01T00:00:00Z",
      other_purchases: {},
      subscriptions: subscriptions
    }
  })
});
