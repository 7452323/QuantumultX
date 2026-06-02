/*
 * @name RevenueCat 纯正通杀（主机名版）
 * @description 拦截 api.revenuecat.com / api.rc-backup.com / api.lianjiu.fun
 *              不依赖 UA 匹配列表，只改 expires_date 和 is_sandbox，其余原样保留
 *              兼容 QuantumultX / Loon / Surge / Stash / Shadowrocket
 * @author Akino (refactored from Yu9191 style)
 *
[rewrite_local]
# QX — 通配子域名 + v1/v2 全部端点
^https?:\/\/([a-z0-9-]+\.)*revenuecat\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js
^https?:\/\/([a-z0-9-]+\.)*rc-backup\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js
# 清理 ETag（强制走完整验证流程）
^https?:\/\/([a-z0-9-]+\.)*revenuecat\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js
^https?:\/\/([a-z0-9-]+\.)*rc-backup\.com\/(v[12]\/)?(receipts$|subscribers\/[^?#]+) url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/RevenueCat.js

[mitm]
hostname = *.revenuecat.com, *.rc-backup.com
*/
(function() {
  if (typeof $response == "undefined") {
    // ----- request-request-header 分支 -----
    // 删掉 ETag 缓存，迫使 RevenueCat 返回完整 subscriber 数据
    delete $request.headers["x-revenuecat-etag"];
    delete $request.headers["X-RevenueCat-ETag"];
    delete $request.headers["if-none-match"];
    $done({ headers: $request.headers });
    return;
  }

  // ----- script-response-body 分支 -----
  try {
    var body = JSON.parse($response.body);
    if (!body || !body.subscriber) {
      $done({});
      return;
    }

    var sub = body.subscriber;
    var futureDate = "2099-12-31T23:59:59Z";
    var futureMs   = "2099-12-31T23:59:59.000000Z";

    // ----- 处理 subscriptions -----
    if (sub.subscriptions) {
      for (var key in sub.subscriptions) {
        var s = sub.subscriptions[key];
        if (s && typeof s === "object") {
          s.expires_date = futureMs;
          s.is_sandbox = false;
          s.unsubscribe_detected_at = null;
          s.billing_issues_detected_at = null;
          s.refunded_at = null;
          s.auto_resume_date = null;
        }
      }
    }

    // ----- 处理 entitlements -----
    if (sub.entitlements) {
      for (var key in sub.entitlements) {
        var e = sub.entitlements[key];
        if (e && typeof e === "object") {
          e.expires_date = futureMs;
          e.grace_period_expires_date = null;
        }
      }
    }

    // ----- 可选：没有 entitlements 时从 subscriptions 反向生成 -----
    // 有些 App 只有 subscriptions 没有 entitlements，补一个默认的
    if (!sub.entitlements || Object.keys(sub.entitlements).length === 0) {
      sub.entitlements = {};
      if (sub.subscriptions) {
        for (var key in sub.subscriptions) {
          sub.entitlements[key] = {
            expires_date: futureMs,
            grace_period_expires_date: null,
            purchase_date: sub.subscriptions[key].purchase_date || "2023-01-01T00:00:00Z",
            product_identifier: key,
            product_plan_identifier: null
          };
        }
      }
    }

    body.subscriber = sub;
    $done({ body: JSON.stringify(body) });

  } catch (e) {
    // 解析失败就原样放过
    $done({});
  }
})();
