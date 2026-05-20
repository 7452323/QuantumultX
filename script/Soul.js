/*
Soul App - 全解锁 v3
https://apps.apple.com/cn/app/id1032287195

[rewrite_local]
^https?://api-pay\.soulapp\.cn/(privilege/supervip/status|show/superVIP/detail/v2|soul-coin/total|soul-coin/total-detail|vip/meet/userInfo|vip/rights/avatar/qryMyAvatarRights) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/(chat/user/info|chat/limitInfo|chat/session/protect/status/get|chat/aigc/privilege/info|chat/aigc/charge/page/v2|chat/aigc/preCheckConfig|chat/limit/friendly/check|chat/limit/socialGraceScore|chat/limit/gift/give|chat/limit/gift/info|privilege/bubble/status/simple|robot/call/remainTimesAndSpeedCards|chat/mp/getUserInfo|chat/mp/pool) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/(html/user/userDetail|user/userDetail|user/soulmate/status|user/queryInvisibleSetting|user/intimacyinfo|user/homepage/metrics) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-a\.soulapp\.cn/(loveBell/queryMatchSpeedupConf|videoMatch/getConfig|probability/match/entrance|meet/my/count|MeasureResult/New|v6/planet/config) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://post\.soulapp\.cn/(v1/post/highLight/recommend/quota|soulreal/post/highlight/quota|v3/rec/square/header/tabs) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn, post.soulapp.cn
*/

var url = $request.url;
var obj = JSON.parse($response.body);
var expire = Date.now() + 3153600000000;

// === VIP ===
if (url.indexOf('/privilege/supervip/status') >= 0) {
  obj.data.superVIP = true;
  obj.data.showSuperVIP = true;
  obj.data.remainDay = 99999;
  obj.data.hasCancelVIPSubscription = false;
  obj.data.hasCancelVIPSubOfIAP = false;
  obj.data.hasAiSocialVip = true;
  obj.data.hasMyMeet = true;
}

if (url.indexOf('/show/superVIP/detail/v2') >= 0) {
  obj.data.superVIP = true;
  obj.data.superUser = true;
  obj.data.wasVip = true;
  obj.data.lastVipExpireTime = expire;
}

if (url.indexOf('/vip/meet/userInfo') >= 0) {
  if (!obj.data.superStarDTO) obj.data.superStarDTO = {};
  obj.data.superStarDTO.superVIP = true;
  obj.data.superStarDTO.wasVip = true;
  obj.data.superStarDTO.validTime = expire;
}

if (url.indexOf('/vip/rights/avatar/qryMyAvatarRights') >= 0) {
  obj.data.avatarFreeTimes = 999;
}

// === 聊天 ===
if (url.indexOf('/chat/limitInfo') >= 0) {
  obj.data.limit = false;
  obj.data.packageRemainCount = 999;
  obj.data.limitPopupStyleCode = 0;
  delete obj.data.subMsg;
  delete obj.data.extMsg;
  delete obj.data.freeEquityStatus;
  delete obj.data.remainFreeCount;
  delete obj.data.title;
  delete obj.data.bottomText;
}

if (url.indexOf('/chat/limit/gift/give') >= 0) {
  obj.code = 10001;
  obj.data.resultCode = 10001;
  obj.data.resultMsg = 'success';
}

if (url.indexOf('/chat/session/protect/status/get') >= 0) {
  obj.data.remainMsgCount = 9999;
}

if (url.indexOf('/chat/aigc/privilege/info') >= 0) {
  obj.data.plusMonthCard = true;
  obj.data.monthCard = true;
  obj.data.remainTimes = 9999;
  obj.data.characterTotalTimes = 999;
  obj.data.soulBalance = 999999;
  obj.data.chatRecordAuth = true;
}

if (url.indexOf('/chat/aigc/charge/page/v2') >= 0) {
  obj.data.limit = false;
  obj.data.remainTimes = 9999;
  obj.data.packageCouponRemainDays = 9999;
}

if (url.indexOf('/chat/aigc/preCheckConfig') >= 0) {
  obj.data.sessionLimit = 9999;
}

if (url.indexOf('/chat/limit/friendly/check') >= 0) {
  obj.data.status = true;
  obj.data.unbanTime = 0;
}

if (url.indexOf('/chat/limit/socialGraceScore') >= 0) {
  obj.data.socialGraceScore = 100;
  obj.data.forbidPic = false;
  obj.data.forbidCall = false;
  obj.data.createSessionLimit = false;
}

if (url.indexOf('/robot/call/remainTimes') >= 0) {
  obj.data.freeRemains = 999;
  obj.data.remainTimes = 999;
  obj.data.remainSpeedCards = 999;
}

if (url.indexOf('/privilege/bubble/status/simple') >= 0) {
  obj.data.has = true;
  obj.data.aggPictureCount = 999;
  obj.data.pictureIntervalTime = 0;
}

if (url.indexOf('/mp/getUserInfo') >= 0) {
  obj.data.accountType = 2;
}

if (url.indexOf('/mp/pool') >= 0) {
  obj.data.remainGetFreeTimes = 999;
}

// === 用户信息 ===
if (url.indexOf('/chat/user/info') >= 0) {
  obj.data.superVIP = true;
  obj.data.showSuperVIP = true;
  obj.data.userLimitType = 0;
  obj.data.openMsgRoam = true;
}

if (url.indexOf('/user/userDetail') >= 0 || url.indexOf('/html/user/userDetail') >= 0) {
  obj.data.superVIP = true;
  obj.data.showSuperVIP = true;
}

if (url.indexOf('/user/soulmate/status') >= 0) {
  obj.data.superUser = true;
}

if (url.indexOf('/queryInvisibleSetting') >= 0) {
  obj.data.superVip = true;
}

if (url.indexOf('/user/intimacyinfo') >= 0) {
  obj.data.roundCount = 999;
  obj.data.heartCount = 999;
  obj.data.heartTotalCount = 999;
}

// === Soul币 ===
if (url.indexOf('/soul-coin/total') >= 0) {
  obj.data = 99999999;
}

if (url.indexOf('/soul-coin/total-detail') >= 0) {
  obj.data.availableBalance = 999999;
  obj.data.rechargeBalance = 999999;
  obj.data.giftBalance = 999999;
}

// === 匹配 ===
if (url.indexOf('/loveBell/queryMatchSpeedupConf') >= 0) {
  obj.data.limitType = 0;
}

if (url.indexOf('/videoMatch/getConfig') >= 0) {
  obj.data.limitStatus = 0;
  if (obj.data.availableSituation) {
    obj.data.availableSituation.freeTimesRemain = 999;
    obj.data.availableSituation.soulMatchLimit = false;
  }
}

if (url.indexOf('/probability/match/entrance') >= 0) {
  obj.data.remainTime = 999;
}

if (url.indexOf('/meet/my/count') >= 0) {
  obj.data.viewUserCount = 9999;
  obj.data.oneUserViewCount = 999;
  obj.data.viewUserCountConfigLimit = 9999;
}

if (url.indexOf('/MeasureResult/New') >= 0) {
  obj.data.measureTxtCountsHasDo = 999;
}

// === 发帖 ===
if (url.indexOf('/highLight/recommend/quota') >= 0 || url.indexOf('/highlight/quota') >= 0) {
  obj.data.remainedQuota = 999;
  obj.data.remained = 999;
}

// === UI ===
if (url.indexOf('/v6/planet/config') >= 0) {
  obj.data.showLuckyBag = false;
  obj.data.showRedMind = false;
  if (!obj.data.chatRoomInfo) obj.data.chatRoomInfo = {};
  obj.data.chatRoomInfo.showChatRoom = false;
  if (obj.data.luckBagEntryConfig) obj.data.luckBagEntryConfig.show = false;
}

if (url.indexOf('/square/header/tabs') >= 0) {
  if (Array.isArray(obj.data)) {
    obj.data.forEach(function(t) { if (t.unreadFlag) t.unreadFlag = 0; });
    obj.data = obj.data.filter(function(t) { return t.pageId === "PostSquare_Recommend"; });
  }
}

if (url.indexOf('/homepage/metrics') >= 0) {
  obj.data.recentViewNum = 0;
  obj.data.showMetric = false;
  obj.data.showTipsCard = false;
  obj.data.hasHomePageLiked = false;
  if (obj.data.homePageLikedMetric) {
    obj.data.homePageLikedMetric.addNum = 0;
    obj.data.homePageLikedMetric.likedTotalNum = 0;
    obj.data.homePageLikedMetric.hasShowHistoryDynamic = false;
  }
}

$done({ body: JSON.stringify(obj) });
