/*
布丁扫描 解锁VIP + 去广告 + 无限次数 + 去续费 + 永久会员

[rewrite_local]
^https:\/\/www\.budingscan\.com\/server\/get_user_config url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_modules url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_module_usage url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/plans url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/questions url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/backend\/dashboardBanner\/online_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/art\.budingscan\.com\/backend\/dashboardBanner\/online_ai_photo_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/bd-aiart\.vivo\.com\.cn\/backend\/dashboardBanner\/online_painting_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/bd-aiart\.vivo\.com\.cn\/ai_painting\/get_remain_paint_count url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/bd-aiart\.vivo\.com\.cn\/ai_painting\/self_homepage url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/art\.budingscan\.com\/ai_painting\/get_remain_photo_shoot_count url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js

[mitm]
hostname = www.budingscan.com, art.budingscan.com, bd-aiart.vivo.com.cn
*/

const url = $request.url;

// banner广告——直接返回404，尝试消容器
if (url.includes('/dashboardBanner/')) {
  $done({
    status: "HTTP/1.1 404 Not Found",
    headers: { "Content-Type": "text/plain" },
    body: ""
  });
}

let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (url.includes('/get_user_config')) {
    // 永久会员 - end_time设为空让APP显示计划名
    obj.result = {
      ...obj.result,
      "user_type": 3,
      "subscribe_pay_type": 0,
      "renewal_status": 0,
      "subscribe_plan_validity": 36500,
      "subscribe_plan_name": "终身会员",
      "end_time": "",
      "total_storage": 999999999,
      "vip_storage": 999999999,
      "used_storage": 0,
      "oral": 1
    };
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/paid_modules')) {
    // 全部模块无限使用
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
    // 返回未使用的加密数据
    obj.result = {
      "encrypt_text": "UKbYMD/VGPnmM59QTWNWjmEAScQt5gcYQgf7jBjBW5YttGqvabvEyIpd35CRhN4Aeq1pNDki8Sp0K++5S20GbZqyGFZCqyZIuMfDanWWLWY="
    };
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/plans')) {
    // 只保留终身会员，删掉续费订阅计划
    if (obj.result && Array.isArray(obj.result)) {
      obj.result = obj.result.filter(plan => 
        plan.plan_renewal_status !== 1
      );
    }
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/questions')) {
    // 去掉续费相关的FAQ
    if (obj.result && Array.isArray(obj.result)) {
      obj.result = obj.result.filter(q => 
        q.plan_renewal_status !== 1
      );
    }
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
