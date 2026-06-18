/*
[rewrite_local]
^https?:\/\/api\.rc-backup\.com\/v1\/subscribers\/.+ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/读不舍手.js
^https?:\/\/api\.rc-backup\.com\/v1\/subscribers\/.+ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/读不舍手.js

[mitm]
hostname = api.rc-backup.com
*/

(function() {
  const future = "2099-12-31T23:59:59.000000Z";

  // request-header: strip cache
  if (typeof $response === "undefined") {
    delete $request.headers["X-RevenueCat-ETag"];
    delete $request.headers["If-None-Match"];
    $done({ headers: $request.headers });
    return;
  }

  // response-body: extend all dates
  try {
    const body = JSON.parse($response.body);
    const sub = body.subscriber;
    if (!sub) { $done({}); return; }

    ["subscriptions", "entitlements"].forEach(k => {
      for (const id in (sub[k] || {})) {
        const o = sub[k][id];
        if (o && typeof o === "object") {
          if (o.expires_date) o.expires_date = future;
          o.is_sandbox = false;
          o.unsubscribe_detected_at = null;
          o.billing_issues_detected_at = null;
        }
      }
    });

    $done({ body: JSON.stringify(body) });
  } catch (e) {
    $done({});
  }
})();
