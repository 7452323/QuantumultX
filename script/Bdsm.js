/*
布丁扫描 解锁VIP + 去广告

[rewrite_local]
^https:\/\/www\.budingscan\.com\/server\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/bd-aiart\.vivo\.com\.cn\/ai_painting\/(get_remain_paint_count|self_homepage) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/art\.budingscan\.com\/ai_painting\/get_remain_photo_shoot_count url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js

[mitm]
hostname = www.budingscan.com, bd-aiart.vivo.com.cn, art.budingscan.com
*/

const url = $request.url;
let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (url.includes('/get_user_config')) {
    obj.result = {
      ...obj.result,
      "user_type": 3,
      "subscribe_pay_type": 0,
      "renewal_status": 0,
      "subscribe_plan_validity": 36500,
      "subscribe_plan_name": "终身会员",
      "end_time": "2099-12-31",
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
        "vip_usage_limit": -1
      }));
    }
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/plans')) {
    if (obj.result && Array.isArray(obj.result)) {
      obj.result = obj.result.filter(p => p.plan_renewal_status !== 1);
    }
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/questions')) {
    if (obj.result && Array.isArray(obj.result)) {
      obj.result = obj.result.filter(q => q.plan_renewal_status !== 1);
    }
    body = JSON.stringify(obj);

  } else if (url.includes('/dashboardBanner/')) {
    obj.result = { "banners": [] };
    body = JSON.stringify(obj);

  } else if (url.includes('/get_remain_paint_count')) {
    obj.data = { "count": 99999 };
    body = JSON.stringify(obj);

  } else if (url.includes('/self_homepage')) {
    obj.data.count_remain = 99999;
    obj.data.count_used = 0;
    body = JSON.stringify(obj);

  } else if (url.includes('/get_remain_photo_shoot_count')) {
    obj.data = { "count": 99999, "history_count": 0 };
    body = JSON.stringify(obj);
  }

} catch (e) {
  console.log("Bdsm.js error: " + e);
}

$done({ body });
