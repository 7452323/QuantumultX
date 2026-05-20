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
^https?://api-chat\.soulapp\.cn/chat/aigc/charge/page/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/preCheckConfig url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/session/protect/status/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/html/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/soulmate/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn
*/

try {
  var obj = JSON.parse($response.body);
  var url = $request.url;
} catch(e) {
  $done({});
}

var expire = Date.now() + 3153600000000;
var modified = false;

if (url.indexOf('/privilege/supervip/status') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
  obj.data.remainDay = 99999; obj.data.hasCancelVIPSubscription = false;
  obj.data.hasAiSocialVip = true; modified = true;
}
if (url.indexOf('/vip/show/info') >= 0 && obj.data) {
  obj.data.experiment = true; obj.data.vipShowModel = "superVip"; modified = true;
}
if (url.indexOf('/show/superVIP/detail/v2') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.wasVip = true;
  obj.data.lastVipExpireTime = expire; modified = true;
}
if (url.indexOf('/vip/meet/userInfo') >= 0 && obj.data) {
  if (!obj.data.superStarDTO) obj.data.superStarDTO = {};
  obj.data.superStarDTO.superVIP = true; obj.data.superStarDTO.wasVip = true; modified = true;
}
if (url.indexOf('/super-vip-day/') >= 0) {
  if (url.indexOf('/my/role') >= 0) { obj.data = "SUPER_USER"; modified = true; }
  else if (url.indexOf('/isDuring') >= 0) { obj.data = true; modified = true; }
}
if (url.indexOf('/soul-coin/total') >= 0) { obj.data = 99999999; modified = true; }
if (url.indexOf('/soul-coin/total-detail') >= 0 && obj.data) {
  obj.data.availableBalance = 999999; obj.data.giftBalance = 999999; modified = true;
}
if (url.indexOf('/chat/limitInfo') >= 0 && obj.data) {
  obj.data.limit = false; obj.data.packageRemainCount = 999;
  obj.data.limitPopupStyleCode = 0; obj.data.remainFreeCount = 999;
  obj.data.freeEquityStatus = true; obj.data.subMsg = '';
  obj.data.extMsg = ''; obj.data.msg = '';
  delete obj.data.title; delete obj.data.bottomText;
  delete obj.data.abValue; delete obj.data.blockReason; modified = true;
}
if (url.indexOf('/chat/user/info') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.userLimitType = 0; modified = true;
}
if (url.indexOf('/user/userDetail') >= 0 && obj.data) { obj.data.superVIP = true; modified = true; }
if (url.indexOf('/user/soulmate/status') >= 0 && obj.data) { obj.data.superUser = true; modified = true; }
if (url.indexOf('/chat/aigc/privilege/info') >= 0 && obj.data) {
  obj.data.remainTimes = 99999; obj.data.soulBalance = 99999;
  obj.data.singlePriceSoul = 0; modified = true;
  if (obj.data.characterList) {
    for (var i = 0; i < obj.data.characterList.length; i++) {
      obj.data.characterList[i].remainTimes = 99999;
      obj.data.characterList[i].enable = true;
    }
  }
}
if (url.indexOf('/chat/aigc/charge/page/v2') >= 0 && obj.data) {
  obj.data.limit = false; modified = true;
}
if (url.indexOf('/chat/aigc/preCheckConfig') >= 0 && obj.data) {
  obj.data.sessionLimit = 99999; modified = true;
}
if (url.indexOf('/chat/session/protect/status/get') >= 0 && obj.data) {
  obj.data.remainMsgCount = 99999; modified = true;
}

$done(modified ? { body: JSON.stringify(obj) } : {});
