/*
 * @name Retouch
 * @description TouchRetouch - RC 解锁
 * @author 7452323
 *
[rewrite_local]
^https:\/\/api\.revenuecat\.com\/v1\/subscribers\/.+ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js
^https:\/\/api\.revenuecat\.com\/v1\/subscribers\/.+ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js

[mitm]
hostname = api.revenuecat.com
*/
if (typeof $response == "undefined") {
  delete $request.headers["if-none-match"];
  delete $request.headers["If-None-Match"];
  delete $request.headers["x-revenuecat-etag"];
  delete $request.headers["X-RevenueCat-ETag"];
  $done({ headers: $request.headers });
} else {
  var body = JSON.parse($response.body);
  if (body && body.subscriber) {
    body.subscriber.subscriptions = {
      tr5_yearlysubsc_20dlrs_1: {
        expires_date: "2099-12-31T23:59:59Z",
        original_purchase_date: "2023-01-01T00:00:00Z",
        purchase_date: "2024-01-01T00:00:00Z",
        ownership_type: "PURCHASED",
        store: "app_store",
        is_sandbox: false,
        unsubscribe_detected_at: null,
        billing_issues_detected_at: null
      }
    };
    body.subscriber.entitlements = {
      premium: {
        expires_date: "2099-12-31T23:59:59Z",
        product_identifier: "tr5_yearlysubsc_20dlrs_1",
        purchase_date: "2024-01-01T00:00:00Z"
      }
    };
    $done({ body: JSON.stringify(body) });
  } else {
    $done({});
  }
}
