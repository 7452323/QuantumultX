/*
 * @name 试试双拼 PRO
 * @description 试试双拼 Shuangpin PRO解锁（RevenueCat 4.x）
 * @compatible QuantumultX, Loon, Surge

 [rewrite_local]
# QX - 拦截subscribers和offerings双端点
^https?:\/\/api\.rc-backup\.com\/v1\/subscribers\/[^?#]+ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Shuangpin.js

 [mitm]
 hostname = api.rc-backup.com

*/

const url = $request.url;
const body = $response.body;
if (!body) { $done({}); }

try {
  let obj = JSON.parse(body);

  // 构造PRO权益
  var now = new Date();
  var expire = new Date(now.getTime() + 365 * 50 * 86400000); // 50年后
  var pro = {
    expires_date: expire.toISOString(),
    product_identifier: "ulpb_lifetime_personal",
    purchase_date: now.toISOString()
  };

  // ===== 1. 订阅状态端点 =====
  // GET /v1/subscribers/{app_user_id}
  if (url.includes('/subscribers/') && !url.includes('/attributes') && !url.includes('/offerings')) {
    if (obj.subscriber) {
      obj.subscriber.entitlements = { pro: pro };
      obj.subscriber.subscriptions = {
        ulpb_lifetime_personal: {
          expires_date: expire.toISOString(),
          period_type: "normal",
          purchase_date: now.toISOString(),
          store: "app_store",
          is_sandbox: false,
          unsubscribe_detected_at: null
        }
      };
      obj.subscriber.non_subscriptions = {};
      obj.subscriber.entitlements_by_product_ids = {};
      obj.subscriber.original_purchase_date = now.toISOString();
      obj.subscriber.first_seen = now.toISOString();
      obj.subscriber.management_url = null;
    }
    $done({body: JSON.stringify(obj)});
  }

  // ===== 2. 付费墙端点 =====
  // GET /v1/subscribers/{app_user_id}/offerings
  else if (url.includes('/offerings')) {
    // 注入subscriber信息（部分SDK版本从offerings读权益）
    obj.subscriber = {
      entitlements: { pro: pro },
      subscriptions: {
        ulpb_lifetime_personal: {
          expires_date: expire.toISOString(),
          period_type: "normal",
          purchase_date: now.toISOString(),
          store: "app_store"
        }
      },
      non_subscriptions: {},
      entitlements_by_product_ids: {}
    };
    $done({body: JSON.stringify(obj)});
  }

  // ===== 3. 其他（attributes等）- 不改 =====
  else {
    $done({});
  }
} catch(e) {
  $done({});
}
