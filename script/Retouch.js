/*
 * @name Retouch
 * @description TouchRetouch - RC 解锁
 * @author 7452323
 *
[rewrite_local]
^https:\/\/api\.revenuecat\.com\/v1\/(subscribers\/[^\/]+(\/offerings)?\/?$) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js
^https:\/\/api\.revenuecat\.com\/v1\/subscribers\/[^\/]+(\/offerings)?\/?$ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js

[mitm]
hostname = api.revenuecat.com, api.superwall.me, collector.superwall.me, subscriptions-api.superwall.com, enrichment-api.superwall.com
*/
if (typeof $response == "undefined") {
  delete $request.headers["if-none-match"];
  delete $request.headers["If-None-Match"];
  delete $request.headers["x-revenuecat-etag"];
  delete $request.headers["X-RevenueCat-ETag"];
  $done({ headers: $request.headers });
} else {
  var url = $request.url;
  // 子订阅端点 - 注入 premium
  if (url.indexOf("/offerings") === -1) {
    var body = JSON.parse($response.body);
    body.subscriber.subscriptions = {
      tr5_yearlysubsc_15dlrs_1: {
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
        product_identifier: "tr5_yearlysubsc_15dlrs_1",
        purchase_date: "2024-01-01T00:00:00Z"
      }
    };
    $done({ body: JSON.stringify(body) });
  } else {
    // offerings 端点 - 移除免费试用包
    var body = JSON.parse($response.body);
    if (body.offerings) {
      for (var i = 0; i < body.offerings.length; i++) {
        var offering = body.offerings[i];
        if (offering.packages) {
          var filtered = [];
          for (var j = 0; j < offering.packages.length; j++) {
            var pkg = offering.packages[j];
            if (pkg.identifier !== "Annual_Introductory_Offer") {
              filtered.push(pkg);
            }
          }
          offering.packages = filtered;
        }
      }
    }
    $done({ body: JSON.stringify(body) });
  }
}
