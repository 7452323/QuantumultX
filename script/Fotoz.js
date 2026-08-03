/*
Fotoz - 图片一键下载，批量下载网页图片
https://apps.apple.com/app/id1090640183

[rewrite_local]
^https?:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Fotoz.js

[mitm]
hostname = buy.itunes.apple.com
*/

// ==========================================
//  📷 Fotoz Pro 会员解锁
//  bundleId: com.kiddy.fotoz
//  产品: com.kiddy.fotoz.ipa.pro（永久有效）
// ==========================================

const PRODUCT = "com.kiddy.fotoz.ipa.pro";
const EXPIRE_FAR = 4070908800000;  // 2099-01-01 永久

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

function txId() {
  return "1" + String(Math.floor(Math.random() * 1000000000000000)).padStart(15, "0");
}

let body;
try {
  body = JSON.parse($response.body);
} catch(e) {
  $done({});
}

// 只处理 Fotoz 收据，避免误伤其他 App
if (body?.receipt?.bundle_id === "com.kiddy.fotoz") {
  const now = Date.now();
  const tid = txId();

  const item = {
    quantity: "1",
    product_id: PRODUCT,
    transaction_id: tid,
    original_transaction_id: tid,
    purchase_date: appleDate(now - 86400000 * 365),
    purchase_date_ms: String(now - 86400000 * 365),
    purchase_date_pst: appleDatePST(now - 86400000 * 365),
    original_purchase_date: appleDate(now - 86400000 * 365),
    original_purchase_date_ms: String(now - 86400000 * 365),
    original_purchase_date_pst: appleDatePST(now - 86400000 * 365),
    expires_date: appleDate(EXPIRE_FAR),
    expires_date_ms: String(EXPIRE_FAR),
    expires_date_pst: appleDatePST(EXPIRE_FAR),
    is_trial_period: "false",
    is_in_intro_offer_period: "false",
    in_app_ownership_type: "PURCHASED",
    subscription_group_identifier: "20877951",
    web_order_line_item_id: txId()
  };

  body.receipt.in_app = [item];
  body.latest_receipt_info = [item];
  body.pending_renewal_info = [{
    auto_renew_product_id: PRODUCT,
    auto_renew_status: "1",
    original_transaction_id: tid,
    product_id: PRODUCT,
    is_in_billing_retry_period: "0",
    expiration_intent: "1"
  }];
  body.status = 0;

  $done({ body: JSON.stringify(body) });
} else {
  $done({});
}
