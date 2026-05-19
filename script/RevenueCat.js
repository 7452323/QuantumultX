/*
 * @name RevenueCat
 * @description 伪造 RevenueCat 响应，实现通杀
 * @compatible QuantumultX, Loon
 * @author Qiq
 * @github https://github.com/Reviewa/QuantumultX

 [rewrite_local]
^https?:\/\/.+\.revenuecat\.com\/(v\d\/)?receipts$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/RevenueCat.js
^https?:\/\/.+\.revenuecat\.com\/(v\d\/)?subscribers\/[^\/]+$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/RevenueCat.js

[mitm]
hostname = *.revenuecat.com

*/

const now = Date.now();
const nowISOString = new Date(now).toISOString();
const expireDate = "2099-12-31T23:59:59Z";

const productIds = [
  "com.revenuecat.pro",
  "com.revenuecat.premium",
  "com.revenuecat.vip",
  "com.revenuecat.lifetime",
  "com.app.yearly",
  "com.app.monthly",
  "com.app.lifetime",
  "com.yourapp.pro",
  "pro_yearly",
  "sub_1y",
  "sub_1m",
  "vip_year",
  "vip_lifetime",
  "yearly",
  "monthly",
  "lifetime",
  "unlock_all_features",
  "full_access",
  "com.xiaohongshu.vip",
  "com.shopee.vip"
];

const entitlementKeys = [
  "pro",
  "premium",
  "vip",
  "default",
  "membership",
  "access",
  "lifetime",
  "full",
  "unlock",
  "all_access"
];

let entitlements = {};
let subscriptions = {};

for (let ent of entitlementKeys) {
  entitlements[ent] = {
    expires_date: expireDate,
    product_identifier: productIds[0],
    purchase_date: nowISOString
  };
}

for (let pid of productIds) {
  subscriptions[pid] = {
    billing_issues_detected_at: null,
    expires_date: expireDate,
    is_sandbox: false,
    original_purchase_date: nowISOString,
    period_type: "active",
    purchase_date: nowISOString,
    store: "app_store",
    unsubscribe_detected_at: null
  };
}

$done({
  body: JSON.stringify({
    request_date: nowISOString,
    request_date_ms: now,
    subscriber: {
      entitlements,
      first_seen: "2020-01-01T00:00:00Z",
      last_seen: nowISOString,
      management_url: null,
      original_app_user_id: "$RCAnonymousID:00000000000000000000000000",
      original_application_version: "1.0",
      original_purchase_date: "2020-01-01T00:00:00Z",
      other_purchases: {},
      subscriptions
    }
  })
});