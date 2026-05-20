/*
Soul App - 超级VIP + 聊天限制全解锁
https://apps.apple.com/cn/app/id1032287195

[rewrite_local]
# SuperVIP 状态
^https?:\/\/api-pay\.soulapp\.cn\/privilege\/supervip\/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# SuperVIP 详情
^https?:\/\/api-pay\.soulapp\.cn\/show\/superVIP\/detail\/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 用户信息（含VIP）
^https?:\/\/api-chat\.soulapp\.cn\/chat\/user\/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-user\.soulapp\.cn\/html\/user\/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-user\.soulapp\.cn\/user\/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 聊天限制
^https?:\/\/api-chat\.soulapp\.cn\/chat\/session\/protect\/status\/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/aigc\/privilege\/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/aigc\/charge\/page\/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limit\/friendly\/check url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limit\/socialGraceScore url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-chat\.soulapp\.cn\/chat\/limitInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# Soul币余额
^https?:\/\/api-pay\.soulapp\.cn\/soul-coin\/total url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?:\/\/api-pay\.soulapp\.cn\/soul-coin\/total-detail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 匹配加速
^https?:\/\/api-a\.soulapp\.cn\/loveBell\/queryMatchSpeedupConf url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 视频匹配
^https?:\/\/api-a\.soulapp\.cn\/videoMatch\/getConfig url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 灵魂伴侣
^https?:\/\/api-user\.soulapp\.cn\/user\/soulmate\/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 隐身设置
^https?:\/\/api-user\.soulapp\.cn\/user\/queryInvisibleSetting url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# VIP meet
^https?:\/\/api-pay\.soulapp\.cn\/vip\/meet\/userInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
# 匹配剩余次数
^https?:\/\/api-a\.soulapp\.cn\/probability\/match\/entrance url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn
*/

var body = JSON.parse($response.body);
var url = $request.url;
var now = Date.now();
var expire = now + 3153600000000; // 2099年

// === 通用修改 ===
function setVIP(obj) {
  if (typeof obj === 'object' && obj !== null) {
    // 超级VIP
    if ('superVIP' in obj) obj.superVIP = true;
    if ('showSuperVIP' in obj) obj.showSuperVIP = true;
    if ('superUser' in obj) obj.superUser = true;
    if ('remainDay' in obj) obj.remainDay = 99999;
    if ('hasCancelVIPSubscription' in obj) obj.hasCancelVIPSubscription = false;
    if ('hasCancelVIPSubOfIAP' in obj) obj.hasCancelVIPSubOfIAP = false;
    if ('hasAiSocialVip' in obj) obj.hasAiSocialVip = true;
    if ('wasVip' in obj) obj.wasVip = true;
    if ('superVip' in obj) obj.superVip = true;
    if ('lastVipExpireTime' in obj) obj.lastVipExpireTime = expire;
    if ('validTime' in obj) obj.validTime = expire;
    if ('coidPresent' in obj) obj.coinPresent = 999999;
  }
}

// === VIP 相关接口 ===
if (url.indexOf('/privilege/supervip/status') > 0) {
  setVIP(body);
  if (body.data) setVIP(body.data);
  if (body.data && body.data.superStarDTO) setVIP(body.data.superStarDTO);
  body.data.superVIP = true;
  body.data.showSuperVIP = true;
  body.data.remainDay = 99999;
  body.data.hasCancelVIPSubscription = false;
  body.data.hasAiSocialVip = true;

} else if (url.indexOf('/show/superVIP/detail/v2') > 0) {
  setVIP(body.data);
  body.data.superVIP = true;
  body.data.superUser = true;
  body.data.hasCancelVIPSubscription = false;
  body.data.wasVip = true;
  body.data.lastVipExpireTime = expire;

} else if (url.indexOf('/html/user/userDetail') > 0 || url.indexOf('/user/userDetail') > 0) {
  setVIP(body.data);
  body.data.superVIP = true;
  body.data.showSuperVIP = true;

} else if (url.indexOf('/chat/user/info') > 0) {
  setVIP(body.data);
  body.data.superVIP = true;
  body.data.showSuperVIP = true;
  body.data.userLimitType = 0;
  body.data.openMsgRoam = true;

} else if (url.indexOf('/user/soulmate/status') > 0) {
  body.data.superUser = true;

} else if (url.indexOf('/queryInvisibleSetting') > 0) {
  body.data.superVip = true;

} else if (url.indexOf('/vip/meet/userInfo') > 0) {
  setVIP(body.data);
  if (body.data.superStarDTO) {
    body.data.superStarDTO.superVIP = true;
    body.data.superStarDTO.wasVip = true;
    body.data.superStarDTO.validTime = expire;
  }

// === 聊天限制 ===
} else if (url.indexOf('/chat/session/protect/status/get') > 0) {
  body.data.remainMsgCount = 9999;
  body.data.type = 6;

} else if (url.indexOf('/chat/aigc/privilege/info') > 0) {
  body.data.remainTimes = 9999;
  body.data.chatRecordAuth = true;

} else if (url.indexOf('/chat/aigc/charge/page/v2') > 0) {
  body.data.limit = false;
  body.data.remainTimes = 9999;
  body.data.packageCouponRemainDays = 9999;

} else if (url.indexOf('/chat/limit/friendly/check') > 0) {
  body.data.unbanTime = 0;
  body.data.banTime = 0;

} else if (url.indexOf('/chat/limit/socialGraceScore') > 0) {
  body.data.socialGraceScore = 100;
  body.data.forbidPic = false;
  body.data.forbidCall = false;
  body.data.remainCreateChatSessionNum = -1;
  body.data.createSessionLimit = false;

} else if (url.indexOf('/chat/limitInfo') > 0) {
  body.data.limit = false;

// === Soul币 ===
} else if (url.indexOf('/soul-coin/total') > 0) {
  body.data = 99999999;

} else if (url.indexOf('/soul-coin/total-detail') > 0) {
  body.data.giftBalance = 999999;
  body.data.totalSoulCoin = 999999;
  body.data.balance = 999999;

// === 匹配相关 ===
} else if (url.indexOf('/loveBell/queryMatchSpeedupConf') > 0) {
  body.data.limitType = 0;

} else if (url.indexOf('/videoMatch/getConfig') > 0) {
  if (body.data.availableSituation) {
    body.data.availableSituation.freeTimesRemain = 999;
    body.data.availableSituation.soulMatchLimit = false;
    body.data.availableSituation.remainNoTimesSecond = null;
  }
  body.data.limitStatus = 0;

} else if (url.indexOf('/probability/match/entrance') > 0) {
  body.data.remainTime = 999;
}

$done({ body: JSON.stringify(body) });
