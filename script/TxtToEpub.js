/*
TXT to EPUB - eBook Converter

https://apps.apple.com/app/id6751633451

[rewrite_local]
^https://buy\.itunes\.apple\.com/verifyReceipt$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/TxtToEpub.js

[mitm]
hostname = buy.itunes.apple.com
*/

if ($request.url.indexOf('/verifyReceipt') != -1) {
    let obj = JSON.parse($response.body);
    obj = {
        "receipt": {
            "receipt_type": "Production",
            "app_item_id": 6751633451,
            "receipt_creation_date": "2100-01-01 00:00:00 Etc/GMT",
            "bundle_id": "com.corotata.TxtToEpub",
            "original_purchase_date": "2026-04-02 12:31:07 Etc/GMT",
            "in_app": [],
            "adam_id": 6751633451,
            "request_date": "2100-01-01 00:00:00 Etc/GMT",
            "original_purchase_date_ms": "1775133067000",
            "receipt_creation_date_ms": "4102444800000",
            "original_application_version": "1",
            "application_version": "1"
        },
        "status": 0,
        "environment": "Production"
    };
    $done({body: JSON.stringify(obj)});
}
