/*
 * @name RevenueCat 通杀（终极版）
 * @description 通杀 api.revenuecat.com + api.rc-backup.com
 * @compatible QuantumultX, Loon, Surge, Stash, Shadowrocket
 * @author Qiq
 * @github https://github.com/7452323/QuantumultX

 [rewrite_local]
# QX — 通配子域名 + v1/v2 全部端点 + 带尾部斜杠/query参数
^https?:\/\/([a-z0-9-]+\.)*(revenuecat|rc-backup)\.com\/(v[12]\/)?(receipts|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js

[mitm]
hostname = *.revenuecat.com, *.rc-backup.com

*/

const now = Date.now();
const nowISO = new Date(now).toISOString();
const expireDate = "2999-12-31T23:59:59Z";
const expireDateMs = "2999-12-31T23:59:59.000000Z";
const expireTs = 32503679999000;

// ====== 终身产品ID（这些设置为 null 永久解锁）======
const lifetimeIds = [
  "com.revenuecat.lifetime", "com.revenuecat.pro", "com.revenuecat.premium",
  "com.app.lifetime", "com.app.pro", "com.app.premium",
  "vip_lifetime", "lifetime", "unlock_all_features", "full_access",
  "premium_access", "pro_access", "vip_access", "all_access",
  "unlock_premium", "unlock_pro", "unlock_vip",
  "io.lifetime", "com.lifetime", "net.lifetime", "org.lifetime",
  "onetime", "one_time_purchase", "consumable",
  "tip_1", "tip_2", "tip_3", "tip_5", "tip_10"
];

// ====== 订阅产品ID（这些设置为 2999-12-31）======
const subscriptionIds = [
  "com.revenuecat.annual", "com.revenuecat.monthly", "com.revenuecat.weekly", "com.revenuecat.yearly",
  "com.app.yearly", "com.app.monthly", "com.app.weekly",
  "com.shopee.vip", "com.zhihu.vip", "com.bilibili.vip", "com.tencent.vip",
  "com.netease.vip", "com.youku.vip", "com.iqiyi.vip", "com.meituan.vip",
  "com.douyin.vip", "com.kuaishou.vip", "com.xiaohongshu.vip",
  "pro_yearly", "sub_1y", "sub_1m", "sub_1w", "vip_year",
  "yearly", "monthly", "weekly", "annual", "half_yearly", "quarterly",
  "io.monthly", "io.yearly", "io.weekly",
  "com.monthly", "com.yearly", "com.weekly",
  "net.monthly", "net.yearly",
  "starter", "basic", "standard", "deluxe", "ultimate",
  "pro_monthly", "pro_yearly",
  "premium_monthly", "premium_yearly",
  "vip_monthly", "vip_yearly",
  "com.yourapp.pro", "com.yourapp.premium",
  "com.app.vip", "com.app.plus"
];

// 合并为全量产品ID
const allProductIds = [...new Set([...lifetimeIds, ...subscriptionIds])];

// ====== 判断产品类型 ======
function isLifetime(pid) {
  return lifetimeIds.includes(pid);
}

// ====== 生成随机过去日期（看起来像真实购买）======
function pastDate(daysAgo) {
  const d = new Date(now - daysAgo * 86400000 - Math.floor(Math.random() * 86400000));
  return d.toISOString();
}

// ====== Entitlement Key 库 ======
const entitlementKeys = [
  "pro", "premium", "vip", "default", "membership", "access",
  "lifetime", "full", "unlock", "all_access", "plus",
  "gold", "silver", "bronze", "active", "deluxe",
  "standard", "ultimate", "enterprise", "basic",
  "starter", "advanced", "professional"
];

// ====== 发行渠道 ======
const stores = ["app_store", "play_store", "promotional", "stripe", "rc_billing", "amazon", "mac_app_store"];

// ====== 交易ID生成 ======
function genTxId() {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let id = "";
  for (let i = 0; i < 16; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

// ====== Entitlements ======
let entitlements = {};
for (let ent of entitlementKeys) {
  // 部分 entitlement 关联终身产品(null)，部分关联订阅产品(2999)
  const useLifetime = Math.random() > 0.3; // 70%概率终身
  entitlements[ent] = {
    expires_date: useLifetime ? null : expireDateMs,
    grace_period_expires_date: null,
    purchase_date: pastDate(Math.floor(Math.random() * 365) + 30),
    product_identifier: useLifetime
      ? lifetimeIds[Math.floor(Math.random() * lifetimeIds.length)]
      : subscriptionIds[Math.floor(Math.random() * subscriptionIds.length)],
    product_plan_identifier: null
  };
}

// ====== Subscriptions ======
let subscriptions = {};
for (let pid of allProductIds) {
  const life = isLifetime(pid);
  subscriptions[pid] = {
    auto_resume_date: null,
    billing_issues_detected_at: null,
    expires_date: life ? null : expireDateMs,
    grace_period_expires_date: null,
    is_sandbox: false,
    original_purchase_date: pastDate(Math.floor(Math.random() * 365) + 30),
    ownership_type: "PURCHASED",
    period_type: "normal",
    purchase_date: pastDate(Math.floor(Math.random() * 30) + 1),
    refunded_at: null,
    store: stores[Math.floor(Math.random() * stores.length)],
    store_transaction_id: Math.random() > 0.5
      ? genTxId()
      : parseInt("1000000" + String(Math.floor(Math.random() * 1000000000)).padStart(9, "0")),
    unsubscribe_detected_at: null
  };
}

// ====== 返回 ======
$done({
  body: JSON.stringify({
    request_date: nowISO,
    request_date_ms: now,
    subscriber: {
      entitlements: entitlements,
      first_seen: "2020-01-01T00:00:00Z",
      last_seen: nowISO,
      management_url: "https://apps.apple.com/account/subscriptions",
      non_subscriptions: {
        "lifetime": [{
          "id": "RC" + genTxId(),
          "is_sandbox": false,
          "purchase_date": nowISO,
          "store": stores[Math.floor(Math.random() * stores.length)]
        }],
        "onetime": [{
          "id": "RC" + genTxId(),
          "is_sandbox": false,
          "purchase_date": nowISO,
          "store": stores[Math.floor(Math.random() * stores.length)]
        }]
      },
      original_app_user_id: "$RCAnonymousID:" + genTxId(),
      original_application_version: String(Math.floor(Math.random() * 100) + 100) + "." + Math.floor(Math.random() * 20) + "." + Math.floor(Math.random() * 10),
      original_purchase_date: pastDate(Math.floor(Math.random() * 1000) + 365),
      other_purchases: {},
      subscriptions: subscriptions
    }
  })
});
