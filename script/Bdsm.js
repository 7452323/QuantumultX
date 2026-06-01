/*
布丁扫描 解锁VIP

[rewrite_local]
^https:\/\/www\.budingscan\.com\/server\/get_user_config url script-response-body Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_modules url script-response-body Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_module_usage url script-response-body Bdsm.js

[mitm]
hostname = www.budingscan.com
*/

const url = $request.url;
let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (url.includes('/get_user_config')) {
    // 伪装VIP
    obj.result = {
      ...obj.result,
      "user_type": 3,
      "subscribe_pay_type": 3,
      "renewal_status": 1,
      "subscribe_plan_validity": 3,
      "subscribe_plan_name": "终身会员",
      "end_time": 4092643200,
      "next_pay_price": null,
      "next_pay_time": null,
      "total_storage": 999999999,
      "vip_storage": 999999999,
      "used_storage": 0,
      "oral": 1
    };
    obj.code = 0;
    obj.msg = "ok";
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/paid_modules')) {
    // 全部模块无限制
    const unlimitedModules = (obj.result || []).map(mod => ({
      ...mod,
      "usage_limit": -1,
      "vip_usage_limit": -1,
      "storage_limit": 999999,
      "vip_storage_limit": 999999
    }));
    obj.result = unlimitedModules;
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/paid_module_usage')) {
    // 替换为"0使用"的加密数据
    // encrypt_text 来自抓包：3个未使用模块返回相同的80字节加密数据
    const zeroUsage = "UKbYMD/VGPnmM59QTWNWjmEAScQt5gcYQgf7jBjBW5YttGqvabvEyIpd35CRhN4Aeq1pNDki8Sp0K++5S20GbZqyGFZCqyZIuMfDanWWLWY=";
    obj.result = {
      "encrypt_text": zeroUsage
    };
    body = JSON.stringify(obj);
  }

} catch (e) {
  console.log("Bdsm.js error: " + e);
}

$done({ body });
