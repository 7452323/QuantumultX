/*
 * @name Forward PRO
 * @description Forward 全面解锁 - 覆盖所有可能路径
 * @compatible QuantumultX, Loon, Surge

 [rewrite_local]
^https?:\/\/fluxapi\.vvebo\.vip\/(v1\/)?(purchase|vip|user|membership|subscribe)\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Forward.js
^https?:\/\/forward-h5\.inch\.red\/(api\/)?(membership|user|purchase) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Forward.js

 [mitm]
 hostname = fluxapi.vvebo.vip, forward-h5.inch.red

*/

var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var now = new Date();
  var future = new Date(now.getTime() + 365 * 50 * 86400000);
  var futureStr = future.toISOString();

  // 所有可能的VIP/订阅字段
  var vip = {
    isSubscribed: true, isPurchaseSuccess: true, canPurchaseLifeTime: true,
    expiresAt: futureStr, expiresDate: futureStr, expires_in: 999999999,
    bindingType: "lifetime", originalTransactionId: "1234567890",
    isVIP: true, vip: true, vipLevel: "pro", vipType: "lifetime",
    lifetime: true, status: "active", plan: "lifetime",
    subscribed: true, pro: true, premium: true, unlocked: true
  };

  // 遍历注入
  for (var k in vip) {
    if (obj[k] !== undefined) obj[k] = vip[k];
    if (obj.data && obj.data[k] !== undefined) obj.data[k] = vip[k];
  }
  if (obj.data) { obj.data.isSubscribed = true; obj.data.isPurchaseSuccess = true; }
  if (Array.isArray(obj.data)) {
    obj.data.forEach(function(i) { i.unlocked = true; i.locked = false; });
  }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
