/*
 * @name Shuangpin PRO
 * @description RevenueCat 4.x 永久解锁

 [rewrite_local]
^https?:\/\/api\.(revenuecat|rc-backup)\.com\/v1\/(subscribers\/[^?#]+|receipts) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js
^https?:\/\/api\.(revenuecat|rc-backup)\.com\/v1\/ url script-response-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js

 [mitm]
 hostname = api.revenuecat.com, api.rc-backup.com

*/

// Header mode
if (!$response.body) {
  var h = $response.headers;
  if (h && h['x-signature']) { delete h['x-signature']; }
  $done({headers: h});
  return;
}

// Body mode
var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var now = new Date().toISOString();
  var pro = { expires_date: null, product_identifier: "ulpb_lifetime_personal", purchase_date: now };
  var sub = { expires_date: null, period_type: "normal", purchase_date: now, store: "app_store" };

  if (url.indexOf('/subscribers/') > -1 && url.indexOf('/attributes') < 0 && url.indexOf('/offerings') < 0) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = { pro: pro };
      obj.subscriber.subscriptions = { ulpb_lifetime_personal: sub };
    }
    $done({body: JSON.stringify(obj)});
  }
  else if (url.indexOf('/offerings') > -1) {
    obj.subscriber = { entitlements: { pro: pro }, subscriptions: { ulpb_lifetime_personal: sub } };
    $done({body: JSON.stringify(obj)});
  }
  else if (url.indexOf('/receipts') > -1) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = { pro: pro };
      obj.subscriber.subscriptions = { ulpb_lifetime_personal: sub };
    }
    $done({body: JSON.stringify(obj)});
  }
  else { $done({}); }
} catch(e) { $done({}); }
