/*

[rewrite_local]
# 拦截 product_entitlement_mapping 接口
^https:\/\/api\.rc-backup\.com\/v1\/product_entitlement_mapping$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/PicSeed.js
# 拦截 receipts 接口
^https:\/\/api\.rc-backup\.com\/v1\/receipts$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/PicSeed.js

[mitm]
hostname = api.rc-backup.com

*/

(function () {
  const DEBUG = true; // 打开后会发送 iOS 本地通知，确认脚本是否被触发
  const FAR_EXPIRES = "2099-12-31T23:59:59Z";

  // 你提供的 product_entitlement_mapping（原样）
  const mappingObj = {
    "com.picseed.sub.pro.event.monthly": {
      "product_identifier": "com.picseed.sub.pro.event.monthly",
      "entitlements": ["Pro"]
    },
    "com.picseed.sub.pro.monthly": {
      "product_identifier": "com.picseed.sub.pro.monthly",
      "entitlements": ["Pro"]
    },
    "com.picseed.sub.pro.annual": {
      "product_identifier": "com.picseed.sub.pro.annual",
      "entitlements": ["Pro"]
    },
    "com.picseed.sub.pro.event.annual": {
      "product_identifier": "com.picseed.sub.pro.event.annual",
      "entitlements": ["Pro"]
    }
  };

  // receipts 要返回的 subscriber（基于你最开始发的 request 数据，合并后用于调试）
  function makeSubscriber() {
    return {
      "non_subscriptions": {},
      "first_seen": "2025-10-13T03:21:53Z",
      "original_application_version": "57",
      "other_purchases": {},
      "management_url": null,
      "subscriptions": {
        "com.picseed.sub.pro.annual": {
          "billing_issues_detected_at": null,
          "expires_date": FAR_EXPIRES,
          "grace_period_expires_date": null,
          "is_sandbox": true,
          "original_purchase_date": "2025-10-13T03:22:21Z",
          "period_type": "normal",
          "purchase_date": "2025-10-13T03:22:21Z",
          "store": "app_store",
          "unsubscribe_detected_at": null
        },
        "com.picseed.sub.pro.monthly": {
          "billing_issues_detected_at": null,
          "expires_date": FAR_EXPIRES,
          "grace_period_expires_date": null,
          "is_sandbox": true,
          "original_purchase_date": "2025-10-13T03:22:21Z",
          "period_type": "normal",
          "purchase_date": "2025-10-13T03:22:21Z",
          "store": "app_store",
          "unsubscribe_detected_at": null
        }
      },
      "entitlements": {
        "Pro": {
          "product_identifier": "com.picseed.sub.pro.annual",
          "expires_date": FAR_EXPIRES,
          "purchase_date": "2025-10-13T03:22:21Z"
        }
      },
      "original_purchase_date": "2024-07-04T21:31:10Z",
      "original_app_user_id": "$RCAnonymousID:937e50881e8147be8746bb20bc8a9027",
      "last_seen": "2025-10-13T03:21:53Z"
    };
  }

  // Helper：安全解析 JSON
  function safeParse(body) {
    try {
      return JSON.parse(body || '{}');
    } catch (e) {
      return {};
    }
  }

  // 开始分支处理：根据请求 URL 决定返回哪份数据
  const url = typeof $request !== 'undefined' && $request.url ? $request.url : '';
  const orig = safeParse($response && $response.body ? $response.body : '{}');

  if (url.includes('/v1/product_entitlement_mapping')) {
    // 合并 mapping：保留原响应其他字段，仅覆盖或添加 product_entitlement_mapping
    const final = Object.assign({}, orig, { product_entitlement_mapping: mappingObj });
    if (DEBUG && typeof $notify === 'function') {
      $notify("PicSeed Mock", "product_entitlement_mapping returned", "mapping injected");
    }
    $done({ body: JSON.stringify(final) });
    return;
  }

  if (url.includes('/v1/receipts')) {
    // 构造 receipts 响应：保留原字段并覆盖 subscriber / request_date
    const final = Object.assign({}, orig);

    // 使用接近当前时间的 request_date 与 request_date_ms，保留你最初的时间也可按需修改
    final.request_date_ms = Date.now();
    final.request_date = new Date().toISOString();

    final.subscriber = makeSubscriber();

    if (DEBUG && typeof $notify === 'function') {
      $notify("PicSeed Mock", "receipts returned", `subscriber.Pro expires=${FAR_EXPIRES}`);
    }

    $done({ body: JSON.stringify(final) });
    return;
  }

  // 未匹配：不修改响应
  if (DEBUG && typeof $notify === 'function') {
    $notify("PicSeed Mock", "No match — response unchanged", url);
  }
  $done({ body: $response.body });
})();