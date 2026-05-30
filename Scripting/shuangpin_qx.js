// 试试双拼 Shuangpin PRO解锁 - RevenueCat版
// MITM域名: api.rc-backup.com, api.revenuecat.com

const url = $request.url;
const method = $request.method;

// 订阅用户信息 - 修改为PRO
if (url.includes('/v1/subscribers/')) {
  let body = $response.body;
  if (body) {
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
      body = JSON.stringify(obj);
    } catch(e) {}
    $done({body});
  } else {
    $done({});
  }
} else {
  $done({});
}
