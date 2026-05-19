/*
[rewrite_local]
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Hireader.js

[mitm]
hostname = buy.itunes.apple.com
*/

const product_id = "HiReader_Lifetime"; // 你可以改成 HiReader_Annual / HiReader_Monthly
const transaction_id = "1000000999999999";
const expire_time = 6707091199000; // 2999年
const now = Date.now();

const toUTC = t => new Date(t).toUTCString();
const toPST = t => new Date(t).toLocaleString("en-US", { timeZone: "America/Los_Angeles" });

const receiptItem = {
  quantity: "1",
  product_id,
  transaction_id,
  original_transaction_id: transaction_id,
  purchase_date: toUTC(now),
  purchase_date_ms: `${now}`,
  purchase_date_pst: toPST(now),
  original_purchase_date: toUTC(now),
  original_purchase_date_ms: `${now}`,
  original_purchase_date_pst: toPST(now),
  expires_date: toUTC(expire_time),
  expires_date_ms: `${expire_time}`,
  expires_date_pst: toPST(expire_time),
  is_trial_period: "false",
  in_app_ownership_type: "PURCHASED"
};

const body = {
  status: 0,
  environment: "Production",
  receipt: {
    receipt_type: "Production",
    bundle_id: "com.liangpin.hireader",
    application_version: "9999",
    original_application_version: "1.0",
    receipt_creation_date: toUTC(now),
    receipt_creation_date_ms: `${now}`,
    receipt_creation_date_pst: toPST(now),
    request_date: toUTC(now),
    request_date_ms: `${now}`,
    request_date_pst: toPST(now),
    original_purchase_date: toUTC(now),
    original_purchase_date_ms: `${now}`,
    original_purchase_date_pst: toPST(now),
    in_app: [receiptItem]
  },
  latest_receipt_info: [receiptItem],
  pending_renewal_info: [{
    auto_renew_product_id: product_id,
    product_id: product_id,
    original_transaction_id: transaction_id,
    auto_renew_status: "1"
  }],
  latest_receipt: "MIIFakeBase64=="
};

$done({ body: JSON.stringify(body) });