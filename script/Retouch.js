/*
 * @name Retouch
 * @description TouchRetouch - RC 解锁
 * @author 7452323
 *
[rewrite_local]
^https?:\/\/([a-z0-9-]+\.)*(revenuecat|rc-backup)\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js
^https?:\/\/([a-z0-9-]+\.)*(revenuecat|rc-backup)\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js

[mitm]
hostname = *.revenuecat.com, *.rc-backup.com
*/
var body = JSON.parse($response.body);
if ($response && body && body.subscriber) {
  var sub = body.subscriber;
  sub.subscriptions = {
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
  sub.entitlements = {
    premium: {
      expires_date: "2099-12-31T23:59:59Z",
      product_identifier: "tr5_yearlysubsc_20dlrs_1",
      purchase_date: "2024-01-01T00:00:00Z"
    }
  };
  body.subscriber = sub;
  $done({ body: JSON.stringify(body) });
} else {
  delete $request.headers["if-none-match"];
  delete $request.headers["If-None-Match"];
  delete $request.headers["x-revenuecat-etag"];
  delete $request.headers["X-RevenueCat-ETag"];
  $done({ headers: $request.headers });
}
