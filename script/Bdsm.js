/*
布丁扫描 解锁VIP - 真正解锁版

[rewrite_local]
^https:\/\/www\.budingscan\.com\/server\/get_user_config url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_modules url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/payment\/paid_module_usage url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js

[mitm]
hostname = www.budingscan.com
*/

const url = $request.url;
let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (url.includes('/get_user_config')) {
    // 关键：改成VIP会员 + 终身 + 无限
    obj.result = {
      ...obj.result,
      "user_type": 3,              // 会员
      "subscribe_pay_type": 3,     // 支付类型
      "renewal_status": 1,         // 续费中
      "subscribe_plan_validity": 3,// 长期有效
      "subscribe_plan_name": "终身会员",
      "end_time": 4092643200,      // 未来
      "total_storage": 999999999,  // 无限空间
      "vip_storage": 999999999,
      "used_storage": 0,
      "oral": 1
    };
    body = JSON.stringify(obj);

  } else if (url.includes('/payment/paid_modules')) {
    // 所有模块无限使用
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
    // 替换加密响应为"未使用"状态（0次已用）
    // 注意：不同模块需要不同的加密响应，这里用一个通用值
    // 如果显示不准但功能可用，后续再优化
    obj.result = {
      "encrypt_text": "UKbYMD/VGPnmM59QTWNWjmEAScQt5gcYQgf7jBjBW5YttGqvabvEyIpd35CRhN4Aeq1pNDki8Sp0K++5S20GbZqyGFZCqyZIuMfDanWWLWY="
    };
    body = JSON.stringify(obj);
  }

} catch (e) {
  console.log("Bdsm.js error: " + e);
}

$done({ body });
