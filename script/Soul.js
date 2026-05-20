/*
Soul App - AI 聊天完全解锁 v8

[rewrite_local]
# AI 聊天特权
^https?://api-chat\.soulapp\.cn/chat/aigc/privilege/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/charge/page/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/preCheckConfig url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 聊天限制
^https?://api-chat\.soulapp\.cn/chat/limitInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/user/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/session/protect/status/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limit/friendly/check url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limit/socialGraceScore url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limit/gift/give url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limit/gift/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/session/quickButtonCheck url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/config/rounds url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/check/privilegeExpireRemind url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/robot/call/remainTimesAndSpeedCards url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 谁看过我
^https?://api-a\.soulapp\.cn/meet/see/me/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-a\.soulapp\.cn/html/settlement/meet/see/me url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 支付/会员
^https?://api-pay\.soulapp\.cn/privilege/supervip/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/show/superVIP/detail/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total-detail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/show/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/meet/userInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/rights/avatar/qryMyAvatarRights url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/super-vip-day/ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 用户
^https?://api-user\.soulapp\.cn/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/html/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/soulmate/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-chat.soulapp.cn, api-pay.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn
*/

var obj = JSON.parse($response.body);
var url = $request.url;
var expire = Date.now() + 3153600000000;

// === AI 聊天 ===
if (url.indexOf('/chat/aigc/privilege/info') >= 0 && obj.data) {
  obj.data.plusMonthCard = true;
  obj.data.monthCard = true;
  obj.data.experienceCard = true;
  obj.data.remainTimes = 99999;
  obj.data.characterTotalTimes = 99999;
  obj.data.soulBalance = 99999;
  obj.data.newUser = 0;
  obj.data.title = "无限电量";
  obj.data.prologueTitle = "";
  if (obj.data.characterList) {
    for (var i = 0; i < obj.data.characterList.length; i++) {
      obj.data.characterList[i].remainTimes = 99999;
      obj.data.characterList[i].enable = true;
    }
  }
}
if (url.indexOf('/chat/aigc/charge/page/v2') >= 0 && obj.data) {
  obj.data.remainTimes = 99999;
  obj.data.hasMonthCard = true;
  obj.data.hasPlusMonthCard = true;
  obj.data.hasPackageCoupon = true;
  obj.data.packageCouponRemainDays = 36500;
  obj.data.hasCharacterFreeTimes = true;
  obj.data.limit = false;
}
if (url.indexOf('/chat/aigc/preCheckConfig') >= 0 && obj.data) {
  obj.data.sessionLimit = 99999;
  obj.data.mainSwitch = true;
  obj.data.notInputSwitch = false;
  obj.data.shortContentSwitch = false;
  obj.data.mineFieldSwitch = false;
  obj.data.unfriendlySwitch = false;
}

// === 聊天限制 ===
if (url.indexOf('/chat/limitInfo') >= 0 && obj.data) {
  obj.data.limit = false;
  obj.data.packageRemainCount = 999;
  obj.data.limitPopupStyleCode = 0;
  obj.data.remainFreeCount = 999;
  obj.data.freeEquityStatus = true;
  obj.data.subMsg = '';
  obj.data.extMsg = '';
  obj.data.msg = '';
  delete obj.data.title;
  delete obj.data.bottomText;
  delete obj.data.abValue;
  delete obj.data.blockReason;
}
if (url.indexOf('/chat/user/info') >= 0 && obj.data) {
  // 不改 superVIP（会影响别人主页渲染）
  obj.data.userLimitType = 0;
}
if (url.indexOf('/chat/session/protect/status/get') >= 0 && obj.data) obj.data.remainMsgCount = 99999;
if (url.indexOf('/chat/limit/friendly/check') >= 0 && obj.data) obj.data.limit = false;
if (url.indexOf('/chat/limit/socialGraceScore') >= 0 && obj.data) { obj.data.graceScore = 999; obj.data.limit = false; }
if (url.indexOf('/chat/limit/gift/give') >= 0 && obj.data) obj.data.limit = false;
if (url.indexOf('/chat/limit/gift/info') >= 0 && obj.data) { obj.data.giftCount = 999; obj.data.limit = false; }
if (url.indexOf('/chat/session/quickButtonCheck') >= 0 && obj.data) obj.data.blocked = false;
if (url.indexOf('/chat/config/rounds') >= 0 && obj.data) {
  for (var key in obj.data) { if (typeof obj.data[key] === 'number') obj.data[key] = 99999; }
}
if (url.indexOf('/chat/check/privilegeExpireRemind') >= 0 && obj.data) obj.data.needRemind = false;
if (url.indexOf('/robot/call/remainTimesAndSpeedCards') >= 0 && obj.data) obj.data.remainTimes = 99999;

// === 支付/会员 ===
if (url.indexOf('/privilege/supervip/status') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
  obj.data.remainDay = 99999; obj.data.hasCancelVIPSubscription = false;
  obj.data.hasAiSocialVip = true; obj.data.permanentVip = true;
}

// === 谁看过我 ===
if (url.indexOf('/meet/see/me/v2') >= 0 && obj.data) {
  obj.data.superUser = true;
  obj.data.uncoverSecretCount = 999;
}
if (url.indexOf('/html/settlement/meet/see/me') >= 0 && obj.data) {
  obj.data.superUser = true;
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
// === 用户 ===
if (url.indexOf('/user/userDetail') >= 0 && obj.data) obj.data.superVIP = true;
if (url.indexOf('/user/soulmate/status') >= 0 && obj.data) obj.data.superUser = true;

$done({ body: JSON.stringify(obj) });
