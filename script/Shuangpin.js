/*
 * @name 试试双拼 PRO
 * @description 试试双拼 Shuangpin PRO解锁（需关闭X-Signature验证）
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

  // For offerings endpoint
  if (url.includes('/offerings')) {
    // Inject subscriber with pro into offerings response
    obj.subscriber = {
      entitlements: {
        pro: {
          expires_date: "2099-12-31T23:59:59Z",
          product_identifier: "ulpb_lifetime_personal",
          purchase_date: "2026-01-01T00:00:00Z"
        }
      },
      subscriptions: {
        ulpb_lifetime_personal: {
          expires_date: "2099-12-31T23:59:59Z",
          period_type: "normal",
          purchase_date: "2026-01-01T00:00:00Z",
          store: "app_store"
        }
      },
      non_subscriptions: {},
      entitlements_by_product_ids: {}
    };
    $done({body: JSON.stringify(obj)});
  }

  // For subscriber endpoint
  else if (url.includes('/subscribers/') && !url.includes('/attributes')) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = {
        pro: {
          expires_date: "2099-12-31T23:59:59Z",
          product_identifier: "ulpb_lifetime_personal",
          purchase_date: "2026-01-01T00:00:00Z"
        }
      };
      obj.subscriber.subscriptions = {
        ulpb_lifetime_personal: {
          expires_date: "2099-12-31T23:59:59Z",
          period_type: "normal",
          purchase_date: "2026-01-01T00:00:00Z",
          store: "app_store"
        }
      };
      obj.subscriber.non_subscriptions = {};
      obj.subscriber.entitlements_by_product_ids = {};
    }
    // Remove x-signature so SDK doesn't reject modified body
    var headers = $response.headers;
    if (headers['x-signature']) delete headers['x-signature'];
    if (headers['X-Signature']) delete headers['X-Signature'];
    $done({body: JSON.stringify(obj), headers: headers});
    return;
  }

  $done({});
} catch(e) {
  $done({});
}
