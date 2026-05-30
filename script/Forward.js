/*
 * @name Forward PRO
 * @description Forward Twitter客户端PRO解锁
 * @compatible QuantumultX, Loon, Surge

 [rewrite_local]
^https?:\/\/fluxapi\.vvebo\.vip\/v1\/(purchase|vip|user|membership)\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Forward.js

 [mitm]
 hostname = fluxapi.vvebo.vip, assets.vvebo.vip

*/

var url = $request.url;
var body = $response.body;
if (!body) { $done({}); }

try {
  var obj = JSON.parse(body);
  var now = new Date();
  var future = new Date(now.getTime() + 365 * 50 * 86400000);

  // ===== 系统购买信息 /purchase/system/info =====
  if (url.indexOf('/purchase/system/info') !== -1) {
    obj.data = obj.data || {};
    obj.data.isSubscribed = true;
    obj.data.isPurchaseSuccess = true;
    obj.data.canPurchaseLifeTime = true;
    obj.data.expiresAt = future.toISOString();
    obj.data.expiresDate = future.toISOString();
    obj.data.expires_in = 999999999;
    obj.data.bindingType = "lifetime";
    obj.data.originalTransactionId = "570001185968888";
    $done({body: JSON.stringify(obj)});
  }

  // ===== IAP订阅状态 /purchase/iap/subscription =====
  else if (url.indexOf('/purchase/iap/subscription') !== -1) {
    obj.isSubscribed = true;
    obj.isPurchaseSuccess = true;
    obj.expiresDate = future.toISOString();
    obj.expiresAt = future.toISOString();
    obj.originalTransactionId = "570001185968888";
    obj.bindingType = "lifetime";
    $done({body: JSON.stringify(obj)});
  }

  // ===== VIP信息 /vip 或 /user/getVipInfo =====
  else if (url.indexOf('/vip') !== -1 || url.indexOf('/getVipInfo') !== -1) {
    obj.data = obj.data || obj;
    obj.data.isVIP = true;
    obj.data.vip = true;
    obj.data.isSubscribed = true;
    obj.data.subscribeExpire = future.toISOString();
    obj.data.expiresAt = future.toISOString();
    obj.data.expiresDate = future.toISOString();
    obj.data.vipLevel = "pro";
    obj.data.vipType = "lifetime";
    obj.data.lifetime = true;
    obj.data.isPurchaseSuccess = true;
    $done({body: JSON.stringify(obj)});
  }

  // ===== 会员信息 /membership =====
  else if (url.indexOf('/membership') !== -1) {
    obj.isVIP = true;
    obj.status = "active";
    obj.plan = "lifetime";
    obj.expiresAt = future.toISOString();
    $done({body: JSON.stringify(obj)});
  }

  // ===== 购买产品列表 /purchase/products =====
  else if (url.indexOf('/purchase/products') !== -1) {
    // 不修改，让用户可以正常看到价格
    $done({});
  }

  // ===== VIP功能列表 /vip/feature/list =====
  else if (url.indexOf('/vip/feature/list') !== -1) {
    if (obj.data && Array.isArray(obj.data)) {
      obj.data.forEach(function(item) {
        item.unlocked = true;
        item.locked = false;
      });
    }
    $done({body: JSON.stringify(obj)});
  }

  // ===== 其他含isSubscribed/isPurchaseSuccess的响应 =====
  else {
    if (obj.isSubscribed !== undefined) obj.isSubscribed = true;
    if (obj.isPurchaseSuccess !== undefined) obj.isPurchaseSuccess = true;
    if (obj.expiresAt !== undefined) obj.expiresAt = future.toISOString();
    if (obj.expiresDate !== undefined) obj.expiresDate = future.toISOString();
    $done({body: JSON.stringify(obj)});
  }
} catch(e) { $done({}); }
