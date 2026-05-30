/*
 * @name Forward PRO
 * @description Forward Twitter客户端PRO解锁
 * @compatible QuantumultX, Loon, Surge

 [rewrite_local]
# QX - 覆盖fluxapi和forward-h5双域名
^https?:\/\/fluxapi\.vvebo\.vip\/v1\/(purchase|vip|user|membership)\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Forward.js
^https?:\/\/forward-h5\.inch\.red\/api\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Forward.js

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

  // 通用PRO注入
  var fields = {
    isSubscribed: true,
    isPurchaseSuccess: true,
    canPurchaseLifeTime: true,
    expiresAt: futureStr,
    expiresDate: futureStr,
    expires_in: 999999999,
    bindingType: "lifetime",
    originalTransactionId: "570001185968888",
    isVIP: true,
    vip: true,
    vipLevel: "pro",
    vipType: "lifetime",
    lifetime: true,
    status: "active",
    plan: "lifetime"
  };

  // 遍历所有响应，注入缺失的字段
  for (var key in fields) {
    if (obj[key] !== undefined) obj[key] = fields[key];
    if (obj.data && obj.data[key] !== undefined) obj.data[key] = fields[key];
  }

  // subscriptions嵌套结构
  if (obj.data) {
    obj.data.isSubscribed = true;
    obj.data.isPurchaseSuccess = true;
  }

  // Feature列表 - 全部解锁
  if (obj.data && Array.isArray(obj.data)) {
    obj.data.forEach(function(item) {
      item.unlocked = true;
      item.locked = false;
    });
  }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
