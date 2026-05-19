/*
[rewrite_local]
^https:\/\/api\.budingscan\.com\/user\/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Bdsm.js

[mitm]
hostname = api.budingscan.com
*/
var data = JSON.parse($response.body);

data.result = {
  ...data.result,
  "user_type": 3,
  "subscribe_pay_type": 3,
  "renewal_status": 1,
  "subscribe_plan_validity": 3,
  "end_time": 4092643200,
  "total_storage": 999999999,
  "vip_storage": 999999999,
  "used_storage": 0
};

$done({ body: JSON.stringify(data) });
