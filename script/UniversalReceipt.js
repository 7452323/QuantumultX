/*
[rewrite_local]
^https:\/\/(sandbox\.)?buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/UniversalReceipt.js
^https:\/\/(sandbox\.)?buy\.itunes\.apple\.com\/verifyReceipt\/?$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/UniversalReceipt.js

[mitm]
hostname = buy.itunes.apple.com
*/

// ==========================================
//  🍎 Apple verifyReceipt 通杀脚本
//  通用返回伪造收据，覆盖所有 bundle_id
//  无需维护白名单，自动适配
// ==========================================

const now = Date.now();

// ====== 苹果日期格式 ======
// Apple 用的是 "2024-01-01 00:00:00 Etc/GMT" 而非 UTC String
function appleDate(ts) {
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} Etc/GMT`;
}

function appleDatePST(ts) {
  const d = new Date(ts);
  const opts = { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
  const parts = new Intl.DateTimeFormat("en-US", opts).formatToParts(d);
  const map = {};
  for (const p of parts) map[p.type] = p.value;
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second} America/Los_Angeles`;
}

// ====== 过期时间 ======
// 2999-12-31T23:59:59Z — 对所有App都返回这个，永久有效
const EXPIRE_FAR = 32503679999000;

// ====== 生成随机交易ID ======
function txId() {
  return "1" + String(Math.floor(Math.random() * 1000000000000000)).padStart(15, "0");
}

// ====== 获取 bundle_id 和原始响应 ======
let body;
try {
  body = JSON.parse($response.body);
} catch(e) {
  body = {};
}
const isSandbox = typeof $request !== 'undefined' && $request.url && $request.url.includes('sandbox');
const bundleId = body?.receipt?.bundle_id || "com.unknown.app";

// ====== 收据项（统一使用2999过期，通杀终身+订阅）======
const receiptItem = {
  quantity: "1",
  product_id: bundleId + ".subscription",
  transaction_id: txId(),
  original_transaction_id: txId(),
  purchase_date: appleDate(now),
  purchase_date_ms: String(now),
  purchase_date_pst: appleDatePST(now),
  original_purchase_date: appleDate(now - 86400000 * 365),
  original_purchase_date_ms: String(now - 86400000 * 365),
  original_purchase_date_pst: appleDatePST(now - 86400000 * 365),
  expires_date: appleDate(EXPIRE_FAR),
  expires_date_ms: String(EXPIRE_FAR),
  expires_date_pst: appleDatePST(EXPIRE_FAR),
  is_trial_period: "false",
  in_app_ownership_type: "PURCHASED",
  web_order_line_item_id: txId()
};

// ====== 伪造完整收据响应 ======
const fakeReceipt = {
  receipt_type: "Production",
  adam_id: 0,
  app_item_id: 0,
  bundle_id: bundleId,
  application_version: "9999",
  download_id: 0,
  version_external_identifier: 0,
  receipt_creation_date: appleDate(now),
  receipt_creation_date_ms: String(now),
  receipt_creation_date_pst: appleDatePST(now),
  request_date: appleDate(now),
  request_date_ms: String(now),
  request_date_pst: appleDatePST(now),
  original_purchase_date: appleDate(now - 86400000 * 1000),
  original_purchase_date_ms: String(now - 86400000 * 1000),
  original_purchase_date_pst: appleDatePST(now - 86400000 * 1000),
  original_application_version: "1.0",
  in_app: [receiptItem]
};

// ====== latest_receipt ======
// 用更长更真实的base64字符串（Apple的实际收据很长）
const rcptBase64 = "MIIV" + Array(200).fill(0).map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=".charAt(Math.floor(Math.random() * 65))).join("");

// ====== 返回 ======
$done({
  body: JSON.stringify({
    status: 0,
    environment: isSandbox ? "Sandbox" : "Production",
    receipt: fakeReceipt,
    latest_receipt_info: [receiptItem],
    latest_receipt: rcptBase64,
    pending_renewal_info: [{
      auto_renew_product_id: bundleId + ".subscription",
      auto_renew_status: "1",
      original_transaction_id: receiptItem.original_transaction_id,
      product_id: bundleId + ".subscription",
      expiration_intent: null,
      is_in_billing_retry_period: "0",
      price_consent_status: null
    }]
  })
});
