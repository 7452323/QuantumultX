/*
 * @name Retouch
 * @description TouchRetouch - RC 解锁
 * @author 7452323

[rewrite_local]
# ===== QX =====
^https?:\/\/([a-z0-9-]+\.)*revenuecat\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js
^https?:\/\/([a-z0-9-]+\.)*rc-backup\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js
# 清理 ETag
^https?:\/\/([a-z0-9-]+\.)*(revenuecat|rc-backup)\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Retouch.js

[mitm]
hostname = *.revenuecat.com, *.rc-backup.com
*/
(function() {
  var futureMs = "2099-12-31T23:59:59.000000Z";
  var futureDate = "2099-12-31T23:59:59Z";

  // ----- request-header: 删 ETag -----
  if (typeof $response == "undefined") {
    delete $request.headers["x-revenuecat-etag"];
    delete $request.headers["X-RevenueCat-ETag"];
    delete $request.headers["if-none-match"];
    delete $request.headers["If-None-Match"];
    $done({ headers: $request.headers });
    return;
  }

  // ----- response-body: 改订阅数据 -----
  try {
    var body = JSON.parse($response.body);
    if (!body || !body.subscriber) { $done({}); return; }
    var sub = body.subscriber;

    // 模式 A: 有原始数据 → 只改时间
    function patchData(obj) {
      if (!obj || typeof obj !== "object") return;
      for (var k in obj) {
        var v = obj[k];
        if (v && typeof v === "object" && v.expires_date) {
          v.expires_date = futureMs;
          v.is_sandbox = false;
          v.unsubscribe_detected_at = null;
          v.billing_issues_detected_at = null;
          v.refunded_at = null;
          if (v.grace_period_expires_date) v.grace_period_expires_date = null;
        }
      }
    }

    var hasRealData = false;
    if (sub.subscriptions) {
      for (var k in sub.subscriptions) {
        if (sub.subscriptions[k] && sub.subscriptions[k].expires_date) hasRealData = true;
      }
    }
    if (sub.entitlements) {
      for (var k in sub.entitlements) {
        if (sub.entitlements[k] && sub.entitlements[k].expires_date) hasRealData = true;
      }
    }

    if (hasRealData) {
      patchData(sub.subscriptions);
      patchData(sub.entitlements);
      $done({ body: JSON.stringify(body) });
      return;
    }

    // 模式 B: 没数据 → 注入
    var productId = "tr5_yearlysubsc_20dlrs_1";
    sub.subscriptions = {};
    sub.subscriptions[productId] = {
      expires_date: futureMs,
      original_purchase_date: "2023-01-01T00:00:00Z",
      purchase_date: "2024-01-01T00:00:00Z",
      ownership_type: "PURCHASED",
      store: "app_store",
      is_sandbox: false,
      unsubscribe_detected_at: null,
      billing_issues_detected_at: null
    };
    sub.entitlements = {};
    sub.entitlements["premium"] = {
      expires_date: futureMs,
      grace_period_expires_date: null,
      purchase_date: "2024-01-01T00:00:00Z",
      product_identifier: productId,
      product_plan_identifier: null
    };

    body.subscriber = sub;
    $done({ body: JSON.stringify(body) });

  } catch (e) {
    $done({});
  }
})();
