/*
[rewrite_local]
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/UniversalReceipt.js

[mitm]
hostname = buy.itunes.apple.com
*/

const now = Date.now()
const toUTC = t => new Date(t).toUTCString()
const toPST = t => new Date(t).toLocaleString("en-US", { timeZone: "America/Los_Angeles" })

const apps = {
  "me.imgbase.intolive": {
    product_id: "me.imgbase.intolive.proSubYearly2024",
    transaction_id: "666000666000666",
    expire_time: 4102415999000
  },
  "me.imgbase.imgplay": {
    product_id: "me.imgbase.imgplay.subscriptionYearly",
    transaction_id: "777000777000777",
    expire_time: 4102415999000
  },
  "com.liangpin.hireader": {
    product_id: "HiReader_Lifetime",
    transaction_id: "888000888000888",
    expire_time: 32503651199000
  },
  "com.zerone.hidesktop": {
    product_id: "com.zerone.hidesktop.forever",
    transaction_id: "999000999000999",
    expire_time: 32503626054000
  }
}

let body = JSON.parse($response.body)
let bundle_id = body?.receipt?.bundle_id

if (bundle_id && apps[bundle_id]) {
  const app = apps[bundle_id]
  const receiptItem = {
    quantity: "1",
    product_id: app.product_id,
    transaction_id: app.transaction_id,
    original_transaction_id: app.transaction_id,
    purchase_date: toUTC(now),
    purchase_date_ms: `${now}`,
    purchase_date_pst: toPST(now),
    original_purchase_date: toUTC(now),
    original_purchase_date_ms: `${now}`,
    original_purchase_date_pst: toPST(now),
    expires_date: toUTC(app.expire_time),
    expires_date_ms: `${app.expire_time}`,
    expires_date_pst: toPST(app.expire_time),
    is_trial_period: "false",
    in_app_ownership_type: "PURCHASED"
  }
  body = {
    status: 0,
    environment: "Production",
    receipt: {
      receipt_type: "Production",
      bundle_id: bundle_id,
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
      auto_renew_product_id: app.product_id,
      product_id: app.product_id,
      original_transaction_id: app.transaction_id,
      auto_renew_status: "1"
    }],
    latest_receipt: "MIIFakeBase64=="
  }
}

$done({ body: JSON.stringify(body) })