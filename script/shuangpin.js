/*
 * @name 试试双拼 PRO
 * @description 试试双拼 Shuangpin PRO解锁（api.rc-backup.com）
 * @compatible QuantumultX, Loon, Surge
 * @author 7452323

 [rewrite_local]
# QX
^https?:\/\/api\.rc-backup\.com\/v1\/subscribers\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/shuangpin.js

 [mitm]
 hostname = api.rc-backup.com

*/

const url = $request.url;
if (!url.includes('/v1/subscribers/')) { $done({}); }

let body = $response.body;
if (!body) { $done({}); }

try {
  let obj = JSON.parse(body);
  if (obj.subscriber) {
    obj.subscriber.entitlements = {
      "pro": {
        "expires_date": "2099-12-31T23:59:59Z",
        "product_identifier": "ulpb_lifetime_personal",
        "purchase_date": "2026-01-01T00:00:00Z"
      }
    };
    obj.subscriber.subscriptions = {
      "ulpb_lifetime_personal": {
        "expires_date": "2099-12-31T23:59:59Z",
        "period_type": "normal",
        "purchase_date": "2026-01-01T00:00:00Z",
        "store": "app_store"
      }
    };
    obj.subscriber.non_subscriptions = {};
    obj.subscriber.entitlements_by_product_ids = {};
  }
  $done({body: JSON.stringify(obj)});
} catch(e) {
  $done({});
}
