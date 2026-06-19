/*
TXT to EPUB - eBook Converter
https://apps.apple.com/app/id6751633451

[rewrite_local]
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/TxtToEpub.js
^https:\/\/api\.storekit-sandbox\.itunes\.apple\.com\/inApps\/v1\/verifyReceipt url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/TxtToEpub.js
^https:\/\/api\.storekit\.itunes\.apple\.com\/inApps\/v1\/verifyReceipt url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/TxtToEpub.js
^https:\/\/api\.rc-backup\.com\/v1\/subscribers\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/TxtToEpub.js
^https:\/\/api\.revenuecat\.com\/v1\/subscribers\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/TxtToEpub.js

[mitm]
hostname = buy.itunes.apple.com, api.storekit.itunes.apple.com, api.storekit-sandbox.itunes.apple.com, api.rc-backup.com, api.revenuecat.com
*/

// Product IDs (guessed based on bundle pattern and App Store IAP listing)
const PRODUCTS = [
  "com.corotata.TxtToEpub.monthly",
  "com.corotata.TxtToEpub.yearly",
  "com.corotata.TxtToEpub.lifetime",
];

// Unix timestamp far in the future
const FAR_FUTURE_MS = "4102444800000"; // 2100-01-01
const FAR_FUTURE_DATE = "2100-01-01 00:00:00 Etc/GMT";
const NOW_MS = Date.now().toString();
const NOW_DATE = new Date().toISOString().replace(/\.\d+Z/, " Etc/GMT");

// ——— Apple verifyReceipt handler ———
if ($response.body && ($request.url.indexOf("verifyReceipt") !== -1 || $request.url.indexOf("inApps/v1/verifyReceipt") !== -1)) {

  function makeReceipt() {
    const in_app = PRODUCTS.map((pid, i) => ({
      quantity: "1",
      product_id: pid,
      transaction_id: `1000000${i + 1}`,
      original_transaction_id: `1000000${i + 1}`,
      purchase_date: "2026-01-01 00:00:00 Etc/GMT",
      purchase_date_ms: "1767312000000",
      purchase_date_pst: "2025-12-31 16:00:00 America/Los_Angeles",
      original_purchase_date: "2026-01-01 00:00:00 Etc/GMT",
      original_purchase_date_ms: "1767312000000",
      original_purchase_date_pst: "2025-12-31 16:00:00 America/Los_Angeles",
      expires_date: "2100-01-01 00:00:00 Etc/GMT",
      expires_date_ms: "4102444800000",
      expires_date_pst: "2099-12-31 16:00:00 America/Los_Angeles",
      web_order_line_item_id: `10000000${i + 1}`,
      is_trial_period: "false",
      is_in_intro_offer_period: "false",
      in_app_ownership_type: "PURCHASED"
    }));

    return {
      receipt: {
        receipt_type: "Production",
        adam_id: 6751633451,
        app_item_id: 6751633451,
        bundle_id: "com.corotata.TxtToEpub",
        application_version: "100",
        original_application_version: "1.0",
        download_id: [0xC0, 0xFF, 0xEE, 0x00, 0xC0, 0xFF, 0xEE, 0x00, 0xC0, 0xFF, 0xEE, 0x00, 0xC0, 0xFF, 0xEE, 0x00].map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join(""),
        request_date: NOW_DATE,
        request_date_ms: NOW_MS,
        receipt_creation_date: FAR_FUTURE_DATE,
        receipt_creation_date_ms: FAR_FUTURE_MS,
        receipt_in_app: in_app,
        in_app: in_app,
        original_purchase_date: "2026-01-01 00:00:00 Etc/GMT",
        original_purchase_date_ms: "1767312000000",
        original_purchase_date_pst: "2025-12-31 16:00:00 America/Los_Angeles",
        receipt_creation_date_pst: "2099-12-31 16:00:00 America/Los_Angeles",
        request_date_pst: new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }),
        expiration_date: FAR_FUTURE_DATE,
        expiration_date_ms: FAR_FUTURE_MS
      },
      latest_receipt_info: PRODUCTS.map((pid, i) => ({
        quantity: "1",
        product_id: pid,
        transaction_id: `1000000${i + 1}`,
        original_transaction_id: `1000000${i + 1}`,
        purchase_date: "2026-01-01 00:00:00 Etc/GMT",
        purchase_date_ms: "1767312000000",
        purchase_date_pst: "2025-12-31 16:00:00 America/Los_Angeles",
        original_purchase_date: "2026-01-01 00:00:00 Etc/GMT",
        original_purchase_date_ms: "1767312000000",
        original_purchase_date_pst: "2025-12-31 16:00:00 America/Los_Angeles",
        expires_date: FAR_FUTURE_DATE,
        expires_date_ms: FAR_FUTURE_MS,
        expires_date_pst: "2099-12-31 16:00:00 America/Los_Angeles",
        web_order_line_item_id: `10000000${i + 1}`,
        is_trial_period: "false",
        is_in_intro_offer_period: "false",
        in_app_ownership_type: "PURCHASED",
        subscription_group_identifier: "21000000"
      })),
      latest_receipt: [0xC0, 0xFF, 0xEE, 0x00].map(b => ("0" + (b & 0xFF).toString(16)).slice(-2)).join(""),
      pending_renewal_info: PRODUCTS.map((pid) => ({
        auto_renew_product_id: pid,
        original_transaction_id: `1000000${PRODUCTS.indexOf(pid) + 1}`,
        product_id: pid,
        auto_renew_status: "1",
        is_in_billing_retry_period: "0",
        expiration_intent: "0",
        grace_period_expires_date: FAR_FUTURE_DATE,
        grace_period_expires_date_ms: FAR_FUTURE_MS
      })),
      status: 0,
      environment: "Production"
    };
  }

  const response = makeReceipt();
  $done({ body: JSON.stringify(response) });

// ——— RevenueCat subscriber handler ———
} else if ($response.body && $request.url.indexOf("v1/subscribers/") !== -1) {
  
  let body = JSON.parse($response.body);
  
  const entitlements = {};
  PRODUCTS.forEach(pid => {
    const name = pid.split(".").pop(); // monthly, yearly, lifetime
    entitlements[name] = {
      expires_date: "2100-01-01T00:00:00Z",
      purchase_date: "2026-01-01T00:00:00Z",
      product_identifier: pid,
      is_sandbox: false
    };
  });

  const subscriptions = {};
  PRODUCTS.forEach(pid => {
    const name = pid.split(".").pop();
    subscriptions[pid] = {
      expires_date: "2100-01-01T00:00:00Z",
      purchase_date: "2026-01-01T00:00:00Z",
      original_purchase_date: "2026-01-01T00:00:00Z",
      store: "app_store",
      is_sandbox: false,
      unsubscribe_detected_at: null,
      period_type: name === "lifetime" ? "lifetime" : "active",
      auto_resume_date: null
    };
  });

  body.data = body.data || {};
  body.data.subscriber = {
    entitlements: entitlements,
    subscriptions: subscriptions,
    first_seen: "2026-01-01T00:00:00Z",
    original_app_user_id: body.data?.subscriber?.original_app_user_id || "anonymous",
    management_url: null
  };

  $done({ body: JSON.stringify(body) });

} else {
  $done({});
}
