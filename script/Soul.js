/*
Soul App - 超级VIP + 聊天送礼限制全解锁 v2
https://apps.apple.com/cn/app/id1032287195

来源: 抓包数据分析 + 参考旧版脚本优化

[rewrite_local]
# SuperVIP 状态 + 详情
^https?:\/\/api-pay\.soulapp\.cn\/privilege\/supervip\/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-pay\.soulapp\.cn\/show\/superVIP\/detail\/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-pay\.soulapp\.cn\/soul-coin\/total url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-pay\.soulapp\.cn\/soul-coin\/total-detail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-pay\.soulapp\.cn\/vip\/meet\/userInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-pay\.soulapp\.cn\/vip\/rights\/avatar\/qryMyAvatarRights url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 用户信息
^https?:\/\/api-chat\.soulapp\.cn\/chat\/user\/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limitInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/session\/protect\/status\/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/aigc\/privilege\/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/aigc\/charge\/page\/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/aigc\/preCheckConfig url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limit\/friendly\/check url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limit\/socialGraceScore url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limit\/gift\/give url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limit\/gift\/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/privilege\/bubble\/status\/simple url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/robot\/call\/remainTimesAndSpeedCards url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/mp\/(getUserInfo|pool) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 用户中心
^https?:\/\/api-user\.soulapp\.cn\/(html\/user\/userDetail|user\/userDetail|user\/soulmate\/status|user\/queryInvisibleSetting|user\/intimacyinfo) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 其他
^https?:\/\/api-a\.soulapp\.cn\/(loveBell\/queryMatchSpeedupConf|videoMatch\/getConfig|probability\/match\/entrance|meet\/my\/count|MeasureResult\/New) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/post\.soulapp\.cn\/(v1\/post\/highLight\/recommend\/quota|soulreal\/post\/highlight\/quota) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn, post.soulapp.cn
*/

var url = $request.url;
var obj = JSON.parse($response.body);
var expire = Date.now() + 3153600000000;

// ===== VIP 系列 =====
if (url.indexOf('/privilege/supervip/status') >= 0) {
  obj.data.superVIP = true;
  obj.data.showSuperVIP = true;
  obj.data.remainDay = 99999;
  obj.data.hasCancelVIPSubscription = false;
  obj.data.hasCancelVIPSubOfIAP = false;
  obj.data.hasAiSocialVip = true;
  obj.data.hasMyMeet = true;
  obj.data.hasFlyPackage = true;

} else if (url.indexOf('/show/superVIP/detail/v2') >= 0) {
  obj.data.superVIP = true;
  obj.data.superUser = true;
  obj.data.hasCancelVIPSubscription = false;
  obj.data.wasVip = true;
  obj.data.lastVipExpireTime = expire;

} else if (url.indexOf('/vip/meet/userInfo') >= 0) {
  obj.data.superStarDTO = obj.data.superStarDTO || {};
  obj.data.superStarDTO.superVIP = true;
  obj.data.superStarDTO.wasVip = true;
  obj.data.superStarDTO.validTime = expire;

} else if (url.indexOf('/vip/rights/avatar/qryMyAvatarRights') >= 0) {
  obj.data.avatarFreeTimes = 999;

// ===== 聊天限制（核心）=====
} else if (url.indexOf('/chat/limitInfo') >= 0) {
  // 参照旧版脚本：delete 比赋值更彻底
  delete obj.data.subMsg;
  delete obj.data.extMsg;
  delete obj.data.abValue;
  delete obj.data.freeEquityStatus;
  delete obj.data.remainFreeCount;
  delete obj.data.blockReason;
  delete obj.data.msg;
  delete obj.data.title;
  delete obj.data.bottomText;
  obj.data.limit = false;
  obj.data.packageRemainCount = 999;
  obj.data.limitPopupStyleCode = 0;

} else if (url.indexOf('/chat/limit/gift/give') >= 0) {
  // 送礼接口 — 伪造成功
  obj.code = 10001;
  obj.success = true;
  obj.data = obj.data || {};
  obj.data.resultCode = 10001;
  obj.data.resultMsg = '送礼成功';

} else if (url.indexOf('/chat/limit/gift/info') >= 0) {
  // 礼物信息 — 不阻断

} else if (url.indexOf('/chat/session/protect/status/get') >= 0) {
  obj.data.remainMsgCount = 9999;

} else if (url.indexOf('/chat/aigc/privilege/info') >= 0) {
  obj.data.plusMonthCard = true;
  obj.data.monthCard = true;
  obj.data.experienceCard = true;
  obj.data.remainTimes = 9999;
  obj.data.characterTotalTimes = 999;
  obj.data.soulBalance = 999999;
  obj.data.chatRecordAuth = true;

} else if (url.indexOf('/chat/aigc/charge/page/v2') >= 0) {
  obj.data.remainTimes = 9999;
  obj.data.packageCouponRemainDays = 9999;
  obj.data.limit = false;

} else if (url.indexOf('/chat/aigc/preCheckConfig') >= 0) {
  obj.data.sessionLimit = 9999;

} else if (url.indexOf('/chat/limit/friendly/check') >= 0) {
  obj.data.status = true;
  obj.data.unbanTime = 0;

} else if (url.indexOf('/chat/limit/socialGraceScore') >= 0) {
  obj.data.socialGraceScore = 100;
  obj.data.forbidPic = false;
  obj.data.forbidCall = false;
  obj.data.createSessionLimit = false;

} else if (url.indexOf('/robot/call/remainTimes') >= 0) {
  obj.data.freeRemains = 999;
  obj.data.remainTimes = 999;
  obj.data.remainSpeedCards = 999;

} else if (url.indexOf('/privilege/bubble/status/simple') >= 0) {
  obj.data.has = true;
  obj.data.aggPictureCount = 999;
  obj.data.pictureIntervalTime = 0;

} else if (url.indexOf('/chat/mp/getUserInfo') >= 0) {
  obj.data.accountType = 2;

} else if (url.indexOf('/chat/mp/pool') >= 0) {
  obj.data.remainGetFreeTimes = 999;

// ===== 用户信息 =====
} else if (url.indexOf('/chat/user/info') >= 0) {
  obj.data.superVIP = true;
  obj.data.showSuperVIP = true;
  obj.data.userLimitType = 0;
  obj.data.openMsgRoam = true;

} else if (url.indexOf('/user/userDetail') >= 0 || url.indexOf('/html/user/userDetail') >= 0) {
  obj.data.superVIP = true;
  obj.data.showSuperVIP = true;

} else if (url.indexOf('/user/soulmate/status') >= 0) {
  obj.data.superUser = true;

} else if (url.indexOf('/queryInvisibleSetting') >= 0) {
  obj.data.superVip = true;

} else if (url.indexOf('/user/intimacyinfo') >= 0) {
  obj.data.roundCount = 999;
  obj.data.heartCount = 999;
  obj.data.heartTotalCount = 999;

// ===== Soul币 =====
} else if (url.indexOf('/soul-coin/total') >= 0) {
  obj.data = 99999999;

} else if (url.indexOf('/soul-coin/total-detail') >= 0) {
  obj.data.availableBalance = 999999;
  obj.data.rechargeBalance = 999999;
  obj.data.giftBalance = 999999;

// ===== 匹配 =====
} else if (url.indexOf('/loveBell/queryMatchSpeedupConf') >= 0) {
  obj.data.limitType = 0;

} else if (url.indexOf('/videoMatch/getConfig') >= 0) {
  obj.data.limitStatus = 0;
  if (obj.data.availableSituation) {
    obj.data.availableSituation.freeTimesRemain = 999;
    obj.data.availableSituation.soulMatchLimit = false;
  }

} else if (url.indexOf('/probability/match/entrance') >= 0) {
  obj.data.remainTime = 999;

} else if (url.indexOf('/meet/my/count') >= 0) {
  obj.data.viewUserCount = 9999;
  obj.data.oneUserViewCount = 999;
  obj.data.viewUserCountConfigLimit = 9999;

} else if (url.indexOf('/MeasureResult/New') >= 0) {
  obj.data.measureTxtCountsHasDo = 999;

// ===== 发帖 =====
} else if (url.indexOf('/v1/post/highLight/recommend/quota') >= 0 || url.indexOf('/soulreal/post/highlight/quota') >= 0) {
  obj.data.remainedQuota = 999;
  obj.data.remained = 999;
}

$done({ body: JSON.stringify(obj) });
