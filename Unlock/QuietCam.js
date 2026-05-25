/*
QuietCam Pro 解锁
https://apps.apple.com/cn/app/%E9%9A%90%E5%BD%A2%E7%9B%B8%E6%9C%BA-%E9%BB%91%E5%B1%8F%E5%BD%95%E5%83%8F-quietcam/id6761479258

[rewrite_local]
^https:\/\/api\.revenuecat\.com\/v1\/subscribers\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/Unlock/QuietCam.js

[mitm]
hostname = api.revenuecat.com
*/

var obj = JSON.parse($response.body);

if (obj && obj.subscriber) {
  obj.subscriber.entitlements = {
    "QuietCam Pro": {
      "expires_date": "2099-12-31T23:59:59Z",
      "grace_period_expires_date": "2099-12-31T23:59:59Z",
      "product_identifier": "pawelchmiel.quietcam.yearly",
      "purchase_date": "2026-05-25T00:00:00Z"
    }
  };

  obj.subscriber.subscriptions = {
    "pawelchmiel.quietcam.yearly": {
      "expires_date": "2099-12-31T23:59:59Z",
      "original_purchase_date": "2026-05-25T00:00:00Z",
      "purchase_date": "2026-05-25T00:00:00Z",
      "store": "app_store",
      "is_sandbox": false,
      "unsubscribe_detected_at": null,
      "period_type": "normal",
      "auto_resume_date": null
    }
  };

  obj.subscriber.management_url = "https://apps.apple.com/account/subscriptions";
}

$done({body: JSON.stringify(obj)});
