/*
 * @name 试试双拼 PRO
 * @description 试试双拼 Shuangpin PRO解锁
 * @compatible QuantumultX, Loon, Surge

 [rewrite_local]
# QX
^https?:\/\/api\.rc-backup\.com\/v1\/subscribers\/[^?]+ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js

 [mitm]
 hostname = api.rc-backup.com

*/

const url = $request.url;
const body = $response.body;
if (!body) { $done({}); }

try {
  let obj = JSON.parse(body);
  let pro = {
    expires_date: "2099-12-31T23:59:59Z",
    product_identifier: "ulpb_lifetime_personal",
    purchase_date: "2026-01-01T00:00:00Z"
  };

  // offerings endpoint - inject subscriber with PRO
  if (url.includes('/offerings')) {
    obj.subscriber = {
      entitlements: { pro: pro },
      subscriptions: { ulpb_lifetime_personal: { ...pro, period_type: "normal", store: "app_store" } },
      non_subscriptions: {},
      entitlements_by_product_ids: {}
    };
    $done({body: JSON.stringify(obj)});
  }
  // subscriber endpoint
  else if (url.includes('/subscribers/') && !url.includes('/attributes')) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = { pro: pro };
      obj.subscriber.subscriptions = { ulpb_lifetime_personal: { ...pro, period_type: "normal", store: "app_store" } };
      obj.subscriber.non_subscriptions = {};
      obj.subscriber.entitlements_by_product_ids = {};
    }
    // QX can't modify headers in response-body type, body rewrite only
    $done({body: JSON.stringify(obj)});
  }

  $done({});
} catch(e) {
  $done({});
}
