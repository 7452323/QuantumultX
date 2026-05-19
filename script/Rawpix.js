/*
^https?:\/\/api\.rawpixlive\.com\/api\/sign\/profile url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Rawpix.js
[mitm]
hostname = api.rawpixlive.com
*/
var Qiq = JSON.parse($response.body);

Qiq.data.isCreator = 1;
Qiq.data.is_vip = true;
Qiq.data.expireTime = 4092599349;
Qiq.data.level = 6;
Qiq.data.level_name = "年卡会员";
Qiq.data.can_trail = false;

$done({ body: JSON.stringify(Qiq) });