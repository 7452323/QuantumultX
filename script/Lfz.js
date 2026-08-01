/*
录风者 Viidure - 空脚本测试版
不做任何修改，仅测试 MITM 本身是否导致闪退

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

[mitm]
hostname = app-api.lufengzhe.com:9091
*/

// 不做任何修改，直接返回原始响应
$done({});
