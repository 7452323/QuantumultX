/*

电子书格式转换

https://apps.apple.com/cn/app/%E7%94%B5%E5%AD%90%E4%B9%A6-%E6%A0%BC%E5%BC%8F%E8%BD%AC%E6%8D%A2/id6443983103

[rewrite_local]
^https://buy\.itunes\.apple\.com/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Epub.js

[mitm]
hostname = buy.itunes.apple.com

*/

if ($request.url.indexOf('/verifyReceipt') != -1) {
    let obj = JSON.parse($response.body);
    obj = {
        "receipt": {
            "receipt_type": "Production",
            "app_item_id": 6443983103,
            "receipt_creation_date": "2100-01-01 00:00:00 Etc/GMT",
            "bundle_id": "art.yueyin.ebook-convert",
            "original_purchase_date": "2026-04-02 12:31:07 Etc/GMT",
            "in_app": [],
            "adam_id": 6443983103,
            "request_date": "2100-01-01 00:00:00 Etc/GMT",
            "original_purchase_date_ms": "1775133067000",
            "receipt_creation_date_ms": "4102444800000",
            "original_application_version": "2",
            "application_version": "2"
        },
        "status": 0,
        "environment": "Production"
    };
    $done({body: JSON.stringify(obj)});
}