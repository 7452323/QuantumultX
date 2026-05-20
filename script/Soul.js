/*
Soul App - 全解锁 v5
https://apps.apple.com/cn/app/id1032287195

[rewrite_local]
^https?://api-pay\.soulapp\.cn/privilege/supervip/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/show/superVIP/detail/v2 url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/soul-coin/total-detail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/meet/userInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/show/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/vip/reader/light url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-pay\.soulapp\.cn/super-vip-day/ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/limitInfo url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/user/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/session/protect/status/get url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/privilege/info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-chat\.soulapp\.cn/chat/aigc/preCheckConfig url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/html/user/userDetail url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-user\.soulapp\.cn/user/homepage/metrics url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://api-a\.soulapp\.cn/meet/my/count url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js
^https?://post\.soulapp\.cn/v3/rec/square/header/tabs url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Soul.js

[mitm]
hostname = api-pay.soulapp.cn, api-chat.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn, post.soulapp.cn
*/

var url = $request.url;
var body = $response.body;

try {
  var obj = JSON.parse(body);
} catch(e) {
  console.log('Soul: JSON解析失败 ' + url);
  $done({});
}

var expire = Date.now() + 3153600000000;
var changed = false;

if (url.indexOf('/privilege/supervip/status') >= 0) {
  if (obj.data) {
    obj.data.superVIP = true; obj.data.showSuperVIP = true;
    obj.data.remainDay = 99999; obj.data.hasCancelVIPSubscription = false;
    obj.data.hasCancelVIPSubOfIAP = false; obj.data.hasAiSocialVip = true;
    changed = true;
  }
}
if (url.indexOf('/vip/show/info') >= 0) {
  if (obj.data) {
    obj.data.experiment = true; obj.data.vipShowModel = "superVip";
    changed = true;
  }
}
if (url.indexOf('/super-vip-day/') >= 0) {
  if (url.indexOf('/my/role') >= 0) { obj.data = "SUPER_USER"; changed = true; }
  else if (url.indexOf('/isDuring') >= 0) { obj.data = true; changed = true; }
  else if (url.indexOf('/lottery-count') >= 0) { obj.data = 999; changed = true; }
}
if (url.indexOf('/chat/limitInfo') >= 0) {
  if (obj.data) {
    obj.data.limit = false; obj.data.packageRemainCount = 999;
    obj.data.limitPopupStyleCode = 0;
    delete obj.data.subMsg; delete obj.data.extMsg;
    delete obj.data.freeEquityStatus; delete obj.data.remainFreeCount;
    changed = true;
  }
}
if (url.indexOf('/soul-coin/total') >= 0) {
  obj.data = 99999999; changed = true;
}
if (url.indexOf('/chat/user/info') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true;
  obj.data.userLimitType = 0; changed = true;
}
if (url.indexOf('/chat/aigc/privilege/info') >= 0 && obj.data) {
  obj.data.plusMonthCard = true; obj.data.monthCard = true;
  obj.data.remainTimes = 9999; obj.data.soulBalance = 999999; changed = true;
}
if (url.indexOf('/chat/aigc/preCheckConfig') >= 0 && obj.data) {
  obj.data.sessionLimit = 9999; changed = true;
}
if (url.indexOf('/chat/session/protect/status/get') >= 0 && obj.data) {
  obj.data.remainMsgCount = 9999; changed = true;
}
if (url.indexOf('/user/userDetail') >= 0 && obj.data) {
  obj.data.superVIP = true; obj.data.showSuperVIP = true; changed = true;
}
if (url.indexOf('/user/homepage/metrics') >= 0 && obj.data) {
  obj.data.recentViewNum = 0; obj.data.showMetric = false; changed = true;
}
if (url.indexOf('/square/header/tabs') >= 0 && Array.isArray(obj.data)) {
  obj.data = obj.data.filter(function(t) { return t.pageId === "PostSquare_Recommend"; });
  changed = true;
}

if (changed) {
  $done({ body: JSON.stringify(obj) });
} else {
  $done({});
}
