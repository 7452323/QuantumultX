/*
名称intolive-实况壁纸制作器

下载地址:https://apps.apple.com/cn/app/intolive-%E5%AE%9E%E5%86%B5%E5%A3%81%E7%BA%B8%E5%88%B6%E4%BD%9C%E5%99%A8/id1061859052

[rewrite_local]
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/intolive.js

[mitm]
hostname = buy.itunes.apple.com
*/

let body = JSON.parse($response.body);

if (body.receipt && body.receipt.bundle_id === "me.imgbase.intolive") {
    body.status = 0;
    body.environment = "Production";

    body.receipt.in_app = [
        {
            quantity: "1",
            product_id: "me.imgbase.intolive.proSubYearly2024",
            transaction_id: "666000666000666",
            original_transaction_id: "666000666000666",
            purchase_date: "2025-08-01 00:00:00 Etc/GMT",
            purchase_date_ms: "1754006400000",
            purchase_date_pst: "2025-07-31 17:00:00 America/Los_Angeles",
            original_purchase_date: "2025-08-01 00:00:00 Etc/GMT",
            original_purchase_date_ms: "1754006400000",
            original_purchase_date_pst: "2025-07-31 17:00:00 America/Los_Angeles",
            expires_date: "2099-12-31 23:59:59 Etc/GMT",
            expires_date_ms: "4102415999000",
            expires_date_pst: "2099-12-31 15:59:59 America/Los_Angeles",
            is_in_intro_offer_period: "false",
            is_trial_period: "false",
            ownership_type: "PURCHASED",
            web_order_line_item_id: "666000666000666"
        }
    ];

    body.latest_receipt_info = body.receipt.in_app;
    body.pending_renewal_info = [
        {
            auto_renew_product_id: "me.imgbase.intolive.proSubYearly2024",
            original_transaction_id: "666000666000666",
            product_id: "me.imgbase.intolive.proSubYearly2024",
            auto_renew_status: "1"
        }
    ];
}

$done({ body: JSON.stringify(body) });