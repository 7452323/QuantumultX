/*
Yomu 漫画阅读器 - Adapty 会员解锁
https://apps.apple.com/app/id6760745234

[rewrite_local]
^https:\/\/api\.adapty\.io\/api\/v1\/sdk\/analytics\/profiles\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yomu.js
^https:\/\/api\.adapty\.io\/api\/v1\/sdk\/in-apps\/profile\/cross-placement-info\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yomu.js

[mitm]
hostname = api.adapty.io
*/

let url = $request.url;

if (url.match(/\/api\/v1\/sdk\/analytics\/profiles\//)) {
  // Profile 接口 - 注入 premium 会员信息
  let obj = JSON.parse($response.body);
  
  obj.data = {
    "type": "adapty_analytics_profile",
    "id": "3b59ff29-3ca4-40e3-8518-e2598fdef60a",
    "attributes": {
      "app_id": "public_live_jXeB1bKS",
      "profile_id": "3b59ff29-3ca4-40e3-8518-e2598fdef60a",
      "customer_user_id": null,
      "total_revenue_usd": 0,
      "subscriptions": {
        "yearly.yomu.app": {
          "vendor_transaction_id": "2077000000000001",
          "vendor_original_transaction_id": "2077000000000001",
          "is_lifetime": false,
          "store": "app_store",
          "activated_at": "2026-07-07T00:00:00.000000+0000",
          "renewed_at": "2026-07-07T00:00:00.000000+0000",
          "expires_at": "2099-12-31T00:00:00.000000+0000",
          "is_active": true,
          "is_in_grace_period": false,
          "is_refund": false,
          "is_sandbox": false,
          "vendor_product_id": "yearly.yomu.app",
          "offer_id": null,
          "access_levels": {
            "premium": {
              "vendor_product_id": "yearly.yomu.app",
              "store": "app_store",
              "activated_at": "2026-07-07T00:00:00.000000+0000",
              "renewed_at": "2026-07-07T00:00:00.000000+0000",
              "expires_at": "2099-12-31T00:00:00.000000+0000",
              "is_active": true,
              "is_in_grace_period": false,
              "is_refund": false,
              "is_sandbox": false,
              "offer_id": null,
              "vendor_transaction_id": "2077000000000001",
              "vendor_original_transaction_id": "2077000000000001",
              "activated_in_app_id": null
            }
          },
          "subscription_group_identifier": null,
          "reason": null
        }
      },
      "access_levels": {
        "premium": {
          "vendor_product_id": "yearly.yomu.app",
          "store": "app_store",
          "activated_at": "2026-07-07T00:00:00.000000+0000",
          "renewed_at": "2026-07-07T00:00:00.000000+0000",
          "expires_at": "2099-12-31T00:00:00.000000+0000",
          "is_active": true,
          "is_in_grace_period": false,
          "is_refund": false,
          "is_sandbox": false,
          "offer_id": null,
          "vendor_transaction_id": "2077000000000001",
          "vendor_original_transaction_id": "2077000000000001",
          "activated_in_app_id": null
        }
      },
      "custom_attributes": {}
    }
  };

  $done({body: JSON.stringify(obj)});

} else if (url.includes('/cross-placement-info/')) {
  // Cross Placement - 确保 premium 关联
  let obj = JSON.parse($response.body);

  obj.data = {
    "placement_with_variation_map": {
      "main_paywall": {
        "placement_id": "main_paywall",
        "variation_id": "8c7f0b3d-f5e4-437f-874a-24afbf0d3027",
        "paywall_id": "4c6058c1-d339-4a0e-aeb1-316b4ee8b1aa"
      }
    },
    "version": Date.now()
  };

  $done({body: JSON.stringify(obj)});

} else {
  $done({});
}