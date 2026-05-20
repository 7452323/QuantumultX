/*
Soul - 极简测试
只改 /vip/show/info 这一个接口
如果 VIP 显示了 → 说明是其他接口的问题
如果 VIP 还是不显示 → 说明脚本机制或 MITM 有问题

[rewrite_local]
^https?://api-pay\.soulapp\.cn/vip/show/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn
*/

var obj = JSON.parse($response.body);
console.log('=== Soul 脚本触发 ===');
console.log('URL: ' + $request.url);
console.log('响应原文: ' + $response.body);
obj.data.experiment = true;
obj.data.vipShowModel = "superVip";
console.log('修改后: experiment=' + obj.data.experiment + ', vipShowModel=' + obj.data.vipShowModel);
$done({ body: JSON.stringify(obj) });
