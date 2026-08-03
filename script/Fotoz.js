/*
Fotoz - 图片一键下载，批量下载网页图片
https://apps.apple.com/app/id1090640183

[rewrite_local]
^https?:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Fotoz.js

[mitm]
hostname = buy.itunes.apple.com
*/

var PRODUCT_ID = "com.kiddy.fotoz.ipa.pro";
var BUNDLE_ID = "com.kiddy.fotoz";
var body;

try {
  body = JSON.parse($response.body || "{}");
} catch (e) {
  $done({});
}

if (body) {
  var headers = typeof $request !== "undefined" && $request.headers ? $request.headers : {};
  var ua = headers["User-Agent"] || headers["user-agent"] || "";
  var bid = body.receipt && body.receipt.bundle_id ? body.receipt.bundle_id : "";

  if (bid !== BUNDLE_ID && ua.indexOf("Fotoz/") === -1) {
    $done({});
  } else {
    var purchase = {
      "quantity": "1",
      "purchase_date_ms": "1686002766000",
      "expires_date": "6666-06-06 06:06:06 Etc/GMT",
      "expires_date_pst": "6666-06-06 06:06:06 America/Los_Angeles",
      "is_in_intro_offer_period": "false",
      "transaction_id": "666666666666666",
      "is_trial_period": "false",
      "original_transaction_id": "666666666666666",
      "purchase_date": "2023-06-06 06:06:06 Etc/GMT",
      "product_id": PRODUCT_ID,
      "original_purchase_date_pst": "2023-06-06 06:06:06 America/Los_Angeles",
      "in_app_ownership_type": "PURCHASED",
      "subscription_group_identifier": "20877951",
      "original_purchase_date_ms": "1686002766000",
      "web_order_line_item_id": "666666666666666",
      "expires_date_ms": "148204937166000",
      "purchase_date_pst": "2023-06-06 06:06:06 America/Los_Angeles",
      "original_purchase_date": "2023-06-06 06:06:06 Etc/GMT"
    };

    if (!body.receipt) body.receipt = {};
    body.receipt.bundle_id = BUNDLE_ID;
    body.receipt.in_app = [purchase];
    body.latest_receipt_info = [purchase];
    body.status = 0;
    body.environment = body.environment || "Production";

    // 严格保持 Guding88 脚本的实际最终输出：不添加续期数据，也不伪造 latest_receipt。
    delete body.pending_renewal_info;
    delete body.latest_receipt;

    $done({ body: JSON.stringify(body) });
  }
}
