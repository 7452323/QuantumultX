/*
Fotoz - 图片一键下载，批量下载网页图片
https://apps.apple.com/app/id1090640183

[rewrite_local]
^https?:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://cdn.jsdelivr.net/gh/7452323/QuantumultX@main/script/Fotoz.js
# 备用（raw 被墙时用）:
# ^https?:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Fotoz.js

[mitm]
hostname = buy.itunes.apple.com
*/

// ==========================================
//  📷 Fotoz Pro 会员解锁
//  bundleId: com.kiddy.fotoz
//  产品: com.kiddy.fotoz.ipa.pro（永久有效）
//  注意: 若同时启用 UniversalReceipt 通杀脚本，
//        请把本规则放在其前面，或停用通杀脚本。
//  部署: 确认 QX 已开启 MitM、信任证书，且规则确实加载（日志可见）。
// ==========================================

var PRODUCT = "com.kiddy.fotoz.ipa.pro";
var EXPIRE_FAR = 4070908800000;  // 2099-01-01 永久

function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function appleDate(ts) {
  var d = new Date(ts);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()) +
         " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + ":" + pad2(d.getUTCSeconds()) + " Etc/GMT";
}

function appleDatePST(ts) {
  // America/Los_Angeles 含夏令时，用固定 -8 近似即可（App 主要看 ms 字段）
  var d = new Date(ts - 8 * 3600 * 1000);
  return d.getUTCFullYear() + "-" + pad2(d.getUTCMonth() + 1) + "-" + pad2(d.getUTCDate()) +
         " " + pad2(d.getUTCHours()) + ":" + pad2(d.getUTCMinutes()) + ":" + pad2(d.getUTCSeconds()) + " America/Los_Angeles";
}

function txId() {
  return "1" + String(Math.floor(Math.random() * 1000000000000000) + 100000000000000);
}

function b64() {
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var s = "MIIV";
  for (var i = 0; i < 600; i++) s += chars.charAt(Math.floor(Math.random() * 64));
  return s + "=";
}

var body = null;
try {
  body = JSON.parse($response.body);
} catch (e) {
  body = null;
}

// 只处理 Fotoz 收据，避免误伤其他 App
var bid = body && body.receipt ? body.receipt.bundle_id : null;
if (bid !== "com.kiddy.fotoz") {
  $done({});
} else {
  var now = Date.now();
  var tid = txId();

  var item = {
    "quantity": "1",
    "product_id": PRODUCT,
    "transaction_id": tid,
    "original_transaction_id": tid,
    "purchase_date": appleDate(now - 86400000 * 365),
    "purchase_date_ms": String(now - 86400000 * 365),
    "purchase_date_pst": appleDatePST(now - 86400000 * 365),
    "original_purchase_date": appleDate(now - 86400000 * 365),
    "original_purchase_date_ms": String(now - 86400000 * 365),
    "original_purchase_date_pst": appleDatePST(now - 86400000 * 365),
    "expires_date": appleDate(EXPIRE_FAR),
    "expires_date_ms": String(EXPIRE_FAR),
    "expires_date_pst": appleDatePST(EXPIRE_FAR),
    "is_trial_period": "false",
    "is_in_intro_offer_period": "false",
    "in_app_ownership_type": "PURCHASED",
    "subscription_group_identifier": "20877951",
    "web_order_line_item_id": txId()
  };

  // 覆盖式修正：无论 in_app 里已有啥（可能来自 UniversalReceipt 的错误 product_id），
  // 都替换成 Fotoz 正确产品条目
  body.receipt.in_app = [item];
  body.latest_receipt_info = [item];
  body.latest_receipt = b64();
  body.pending_renewal_info = [{
    "auto_renew_product_id": PRODUCT,
    "auto_renew_status": "1",
    "original_transaction_id": tid,
    "product_id": PRODUCT,
    "is_in_billing_retry_period": "0",
    "expiration_intent": "1"
  }];
  body.status = 0;

  $done({ body: JSON.stringify(body) });
}
