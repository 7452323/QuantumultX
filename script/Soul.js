/*
Soul App - 全解锁 v4
https://apps.apple.com/cn/app/id1032287195

[rewrite_local]
# SuperVIP
^https?://api-pay\.soulapp\.cn/privilege/supervip/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/show/superVIP/detail/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total-detail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/meet/userInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/rights/avatar/qryMyAvatarRights url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/show/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/super-vip-day/ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/reader/light url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 聊天
^https?://api-chat\.soulapp\.cn/chat/limitInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limit/gift/give url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/user/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/privilege/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/charge/page/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/preCheckConfig url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/session/protect/status/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limit/socialGraceScore url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 用户
^https?://api-user\.soulapp\.cn/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/html/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/soulmate/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/homepage/metrics url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 其他
^https?://api-a\.soulapp\.cn/v6/planet/config url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-a\.soulapp\.cn/meet/my/count url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://post\.soulapp\.cn/v3/rec/square/header/tabs url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn, post.soulapp.cn
*/

var url = $request.url;
var obj = JSON.parse($response.body);
var expire = Date.now() + 3153600000000;

if (url.indexOf('/privilege/supervip/status') >= 0) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
  obj.data.remainDay = 99999; obj.data.hasCancelVIPSubscription = false;
  obj.data.hasCancelVIPSubOfIAP = false; obj.data.hasAiSocialVip = true;
}
if (url.indexOf('/show/superVIP/detail/v2') >= 0) {
  obj.data.superVIP = true; obj.data.superUser = true; obj.data.wasVip = true;
  obj.data.lastVipExpireTime = expire;
}
if (url.indexOf('/vip/meet/userInfo') >= 0) {
  if (!obj.data.superStarDTO) obj.data.superStarDTO = {};
  obj.data.superStarDTO.superVIP = true;
  obj.data.superStarDTO.wasVip = true;
  obj.data.superStarDTO.validTime = expire;
}
if (url.indexOf('/vip/show/info') >= 0) {
  obj.data.experiment = true; obj.data.vipShowModel = "superVip";
}
if (url.indexOf('/vip/reader/light') >= 0) {
  obj.data.has = true; obj.data.hasAiSocialVip = true;
  obj.data.beginTime = Date.now(); obj.data.endTime = expire;
}
if (url.indexOf('/super-vip-day/') >= 0) {
  if (url.indexOf('/my/role') >= 0) obj.data = "SUPER_USER";
  else if (url.indexOf('/isDuring') >= 0) obj.data = true;
  else if (url.indexOf('/lottery-count') >= 0) obj.data = 999;
}
if (url.indexOf('/vip/rights/avatar/qryMyAvatarRights') >= 0) {
  obj.data.avatarFreeTimes = 999;
}
if (url.indexOf('/soul-coin/total') >= 0) {
  obj.data = 99999999;
}
if (url.indexOf('/soul-coin/total-detail') >= 0) {
  obj.data.availableBalance = 999999;
  obj.data.rechargeBalance = 999999;
  obj.data.giftBalance = 999999;
}
// 聊天限制（核心）
if (url.indexOf('/chat/limitInfo') >= 0) {
  obj.data.limit = false;
  obj.data.packageRemainCount = 999;
  obj.data.limitPopupStyleCode = 0;
  delete obj.data.subMsg; delete obj.data.extMsg;
  delete obj.data.freeEquityStatus; delete obj.data.remainFreeCount;
  delete obj.data.title; delete obj.data.bottomText;
}
if (url.indexOf('/chat/limit/gift/give') >= 0) {
  obj.code = 10001; obj.data.resultCode = 10001; obj.data.resultMsg = 'success';
}
if (url.indexOf('/chat/aigc/privilege/info') >= 0) {
  obj.data.plusMonthCard = true; obj.data.monthCard = true;
  obj.data.remainTimes = 9999; obj.data.soulBalance = 999999;
}
if (url.indexOf('/chat/aigc/charge/page/v2') >= 0) {
  obj.data.limit = false; obj.data.remainTimes = 9999;
}
if (url.indexOf('/chat/aigc/preCheckConfig') >= 0) {
  obj.data.sessionLimit = 9999;
}
if (url.indexOf('/chat/session/protect/status/get') >= 0) {
  obj.data.remainMsgCount = 9999;
}
if (url.indexOf('/chat/limit/socialGraceScore') >= 0) {
  obj.data.socialGraceScore = 100;
  obj.data.forbidPic = false; obj.data.forbidCall = false;
  obj.data.createSessionLimit = false;
}
if (url.indexOf('/chat/user/info') >= 0) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
  obj.data.userLimitType = 0; obj.data.openMsgRoam = true;
}
if (url.indexOf('/user/userDetail') >= 0) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
}
if (url.indexOf('/user/soulmate/status') >= 0) {
  obj.data.superUser = true;
}
// 其他
if (url.indexOf('/v6/planet/config') >= 0) {
  obj.data.showLuckyBag = false; obj.data.showRedMind = false;
  if (!obj.data.chatRoomInfo) obj.data.chatRoomInfo = {};
  obj.data.chatRoomInfo.showChatRoom = false;
}
if (url.indexOf('/square/header/tabs') >= 0) {
  if (Array.isArray(obj.data)) {
    obj.data.forEach(function(t) { if (t.unreadFlag) t.unreadFlag = 0; });
    obj.data = obj.data.filter(function(t) { return t.pageId === "PostSquare_Recommend"; });
  }
}
if (url.indexOf('/homepage/metrics') >= 0) {
  obj.data.recentViewNum = 0; obj.data.showMetric = false;
  obj.data.showTipsCard = false; obj.data.hasHomePageLiked = false;
  if (obj.data.homePageLikedMetric) {
    obj.data.homePageLikedMetric.addNum = 0;
    obj.data.homePageLikedMetric.likedTotalNum = 0;
    obj.data.homePageLikedMetric.hasShowHistoryDynamic = false;
  }
}
if (url.indexOf('/meet/my/count') >= 0) {
  obj.data.viewUserCount = 9999;
  obj.data.oneUserViewCount = 999;
  obj.data.viewUserCountConfigLimit = 9999;
}

$done({ body: JSON.stringify(obj) });
