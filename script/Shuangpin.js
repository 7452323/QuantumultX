/*
 * @name Shuangpin PRO
 * @description 永久解锁 - 拦截全API

 [rewrite_local]
^https?:\/\/api\.(revenuecat|rc-backup)\.com\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js
^https?:\/\/api\.(revenuecat|rc-backup)\.com\/v1\/.* url script-response-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js

 [mitm]
 hostname = api.revenuecat.com, api.rc-backup.com

*/

// Header mode
if (!$response.body) {
  var h = $response.headers;
  if (h) {
    delete h['x-signature'];
    delete h['etag'];
    delete h['x-revenuecat-etag'];
    h['Cache-Control'] = 'no-cache';
  }
  $done({headers: h});
  return;
}

// Body mode - 所有RevenueCat API都注入PRO
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var now = new Date().toISOString();
  var pro = { expires_date: null, product_identifier: "ulpb_lifetime_personal", purchase_date: now };
  var sub = { expires_date: null, period_type: "normal", purchase_date: now, store: "app_store" };

  // subscriber端点
  if (obj.subscriber) {
    obj.subscriber.entitlements = { pro: pro };
    obj.subscriber.subscriptions = { ulpb_lifetime_personal: sub };
    obj.subscriber.non_subscriptions = {};
    obj.subscriber.entitlements_by_product_ids = {};
  }
  // offerings端点
  if (obj.offerings) {
    obj.subscriber = { entitlements: { pro: pro }, subscriptions: { ulpb_lifetime_personal: sub } };
  }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
