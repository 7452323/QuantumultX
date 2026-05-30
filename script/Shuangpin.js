/*
 * @name 试试双拼 PRO
 * @description 试试双拼 永久买断解锁
 * @compatible QuantumultX, Loon, Surge

 [rewrite_local]
# QX - 覆盖revenuecat.com + rc-backup.com 双域名
^https?:\/\/api\.(revenuecat|rc-backup)\.com\/v1\/(subscribers\/[^?#]+|receipts) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js

 [mitm]
 hostname = api.revenuecat.com, api.rc-backup.com

*/

var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var now = new Date();

  // 永久买断：expires_date = null
  var pro = {
    expires_date: null,
    product_identifier: "ulpb_lifetime_personal",
    purchase_date: now.toISOString()
  };

  var lifetime_sub = {
    expires_date: null,
    period_type: "normal",
    purchase_date: now.toISOString(),
    store: "app_store",
    is_sandbox: false
  };

  // 1. 订阅状态 /v1/subscribers/{id}
  if (url.indexOf('/subscribers/') !== -1 && url.indexOf('/attributes') === -1 && url.indexOf('/offerings') === -1) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = { pro: pro };
      obj.subscriber.subscriptions = { ulpb_lifetime_personal: lifetime_sub };
      obj.subscriber.non_subscriptions = {};
      obj.subscriber.entitlements_by_product_ids = {};
    }
    $done({body: JSON.stringify(obj)});
  }

  // 2. 付费墙 /v1/subscribers/{id}/offerings
  else if (url.indexOf('/offerings') !== -1) {
    obj.subscriber = {
      entitlements: { pro: pro },
      subscriptions: { ulpb_lifetime_personal: lifetime_sub },
      non_subscriptions: {},
      entitlements_by_product_ids: {}
    };
    $done({body: JSON.stringify(obj)});
  }

  // 3. 收据验证 /v1/receipts
  else if (url.indexOf('/receipts') !== -1) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = { pro: pro };
      obj.subscriber.subscriptions = { ulpb_lifetime_personal: lifetime_sub };
    }
    $done({body: JSON.stringify(obj)});
  }

  else {
    $done({});
  }
} catch(e) {
  $done({});
}
