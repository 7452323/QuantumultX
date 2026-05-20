/*
Soul App - 全解锁 v7
https://apps.apple.com/cn/app/id1032287195

[rewrite_local]
^https?://api-pay\.soulapp\.cn/privilege/supervip/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/show/superVIP/detail/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total-detail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/show/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/meet/userInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/rights/avatar/qryMyAvatarRights url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/super-vip-day/ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limitInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/user/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/privilege/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/session/protect/status/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/html/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/soulmate/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn
*/

var obj = JSON.parse($response.body);
var url = $request.url;
var expire = Date.now() + 3153600000000;

if (url.indexOf('/privilege/supervip/status') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
  obj.data.remainDay = 99999; obj.data.hasCancelVIPSubscription = false;
  obj.data.hasAiSocialVip = true;
}
if (url.indexOf('/vip/show/info') >= 0 && obj.data) {
  obj.data.experiment = true; obj.data.vipShowModel = "superVip";
}
if (url.indexOf('/show/superVIP/detail/v2') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.wasVip = true;
  obj.data.lastVipExpireTime = expire;
}
if (url.indexOf('/vip/meet/userInfo') >= 0 && obj.data) {
  if (!obj.data.superStarDTO) obj.data.superStarDTO = {};
  obj.data.superStarDTO.superVIP = true; obj.data.superStarDTO.wasVip = true;
}
if (url.indexOf('/super-vip-day/') >= 0) {
  if (url.indexOf('/my/role') >= 0) obj.data = "SUPER_USER";
  else if (url.indexOf('/isDuring') >= 0) obj.data = true;
}
if (url.indexOf('/soul-coin/total') >= 0) obj.data = 99999999;
if (url.indexOf('/soul-coin/total-detail') >= 0 && obj.data) {
  obj.data.availableBalance = 999999; obj.data.giftBalance = 999999;
}
if (url.indexOf('/chat/limitInfo') >= 0 && obj.data) {
  obj.data.limit = false; obj.data.packageRemainCount = 999;
  delete obj.data.subMsg; delete obj.data.extMsg;
  delete obj.data.freeEquityStatus; delete obj.data.remainFreeCount;
}
if (url.indexOf('/chat/user/info') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.userLimitType = 0;
}
if (url.indexOf('/user/userDetail') >= 0 && obj.data) obj.data.superVIP = true;
if (url.indexOf('/user/soulmate/status') >= 0 && obj.data) obj.data.superUser = true;
if (url.indexOf('/chat/aigc/privilege/info') >= 0 && obj.data) obj.data.remainTimes = 9999;
if (url.indexOf('/chat/session/protect/status/get') >= 0 && obj.data) obj.data.remainMsgCount = 9999;

$done({ body: JSON.stringify(obj) });
