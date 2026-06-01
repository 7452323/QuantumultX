/*
布丁扫描 解锁VIP + 去广告

[rewrite_local]
^https:\/\/www\.budingscan\.com\/server\/get_user_config url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_modules url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_module_usage url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/backend\/dashboardBanner\/online_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/art\.budingscan\.com\/backend\/dashboardBanner\/online_ai_photo_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/bd-aiart\.vivo\.com\.cn\/backend\/dashboardBanner\/online_painting_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js

[mitm]
hostname = www.budingscan.com, art.budingscan.com, bd-aiart.vivo.com.cn
*/

const url = $request.url;
let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (url.includes('/get_user_config')) {
    obj.result = {
      ...obj.result,
      "user_type": 3,
      "subscribe_pay_type": 3,
      "renewal_status": 1,
      "subscribe_plan_validity": 3,
      "subscribe_plan_name": "终身会员",
      "end_time": null,
      "total_storage": 999999999,
      "vip_storage": 999999999,
      "used_storage": 0,
      "oral": 1
    };
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/paid_modules')) {
    if (obj.result && Array.isArray(obj.result)) {
      obj.result = obj.result.map(mod => ({
        ...mod,
        "usage_limit": -1,
        "vip_usage_limit": -1,
        "storage_limit": 999999,
        "vip_storage_limit": 999999
      }));
    }
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/paid_module_usage')) {
    obj.result = {
      "encrypt_text": "UKbYMD/VGPnmM59QTWNWjmEAScQt5gcYQgf7jBjBW5YttGqvabvEyIpd35CRhN4Aeq1pNDki8Sp0K++5S20GbZqyGFZCqyZIuMfDanWWLWY="
    };
    body = JSON.stringify(obj);

  } else if (url.includes('/dashboardBanner/')) {
    // 去广告 - 不让容器出现
    delete obj.result;
    body = JSON.stringify(obj);
  }

} catch (e) {
  console.log("Bdsm.js error: " + e);
}

$done({ body });
