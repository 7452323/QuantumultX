/*
 * @name 落格输入法 PRO
 * @description 落格输入法 X 解锁 - 双路拦截（请求+响应）
 * @compatible QuantumultX Surge Loon
 * @version 2.0

 [rewrite_local]
^https?:\/\/api\.logcg\.com\/app\/tf\/v1 url script-request-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/LogInput.js
^https?:\/\/api\.logcg\.com\/app\/tf\/v1 url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/LogInput.js

 [mitm]
 hostname = api.logcg.com

*/

// ── 判断当前是请求还是响应 ──
if (typeof $request !== 'undefined' && $request.body) {
    // ====== 请求拦截：替换收据为伪造的Pro版 ======
    try {
        var reqBody = JSON.parse($request.body);
        
        // 构造假收据（含Pro内购记录）
        var fakeReceipt = {
            "receipt": {
                "receipt_type": "Production",
                "adam_id": 1373102819,
                "app_item_id": 1373102819,
                "bundle_id": "com.logcg.loginput",
                "application_version": "10139",
                "download_id": 505582710255251494,
                "version_external_identifier": 885024989,
                "receipt_creation_date": "2099-01-01 00:00:00 Etc/GMT",
                "receipt_creation_date_ms": "4070908800000",
                "receipt_creation_date_pst": "2098-12-31 16:00:00 America/Los_Angeles",
                "request_date": "2099-01-01 00:00:01 Etc/GMT",
                "request_date_ms": "4070908801000",
                "request_date_pst": "2098-12-31 16:00:01 America/Los_Angeles",
                "original_purchase_date": "2099-01-01 00:00:00 Etc/GMT",
                "original_purchase_date_ms": "4070908800000",
                "original_purchase_date_pst": "2098-12-31 16:00:00 America/Los_Angeles",
                "original_application_version": "10139",
                "in_app": [{
                    "quantity": "1",
                    "product_id": "com.logcg.loginput.pro",
                    "transaction_id": "40709088000000001",
                    "original_transaction_id": "40709088000000001",
                    "purchase_date": "2099-01-01 00:00:00 Etc/GMT",
                    "purchase_date_ms": "4070908800000",
                    "purchase_date_pst": "2098-12-31 16:00:00 America/Los_Angeles",
                    "original_purchase_date": "2099-01-01 00:00:00 Etc/GMT",
                    "original_purchase_date_ms": "4070908800000",
                    "original_purchase_date_pst": "2098-12-31 16:00:00 America/Los_Angeles",
                    "expires_date": "2099-12-31 23:59:59 Etc/GMT",
                    "expires_date_ms": "4102444799000",
                    "expires_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
                    "is_trial_period": "false",
                    "is_in_intro_offer_period": "false",
                    "in_app_ownership_type": "PURCHASED"
                }]
            },
            "environment": "Production",
            "status": 0
        };
        
        // 替换收据为base64编码的假收据
        reqBody.Receipt = btoa(JSON.stringify(fakeReceipt));
        reqBody.LogAppRequestType = "LogAppDecodeReceipt";
        
        $done({body: JSON.stringify(reqBody)});
    } catch(e) {
        $done({});
    }
} else {
    // ====== 响应拦截（兜底） ======
    var body = $response.body;
    if (!body) { $done({}); }
    
    try {
        var obj = JSON.parse(body);
        if (obj.Receipt) {
            var receipt = JSON.parse(obj.Receipt);
            if (receipt.receipt && receipt.receipt.in_app && receipt.receipt.in_app.length === 0) {
                // 如果in_app为空，注入假记录
                receipt.receipt.in_app.push({
                    "quantity": "1",
                    "product_id": "com.logcg.loginput.pro",
                    "transaction_id": "40709088000000001",
                    "original_transaction_id": "40709088000000001",
                    "purchase_date": "2099-01-01 00:00:00 Etc/GMT",
                    "purchase_date_ms": "4070908800000",
                    "purchase_date_pst": "2098-12-31 16:00:00 America/Los_Angeles",
                    "original_purchase_date": "2099-01-01 00:00:00 Etc/GMT",
                    "original_purchase_date_ms": "4070908800000",
                    "original_purchase_date_pst": "2098-12-31 16:00:00 America/Los_Angeles",
                    "expires_date": "2099-12-31 23:59:59 Etc/GMT",
                    "expires_date_ms": "4102444799000",
                    "expires_date_pst": "2099-12-31 15:59:59 America/Los_Angeles",
                    "is_trial_period": "false",
                    "is_in_intro_offer_period": "false",
                    "in_app_ownership_type": "PURCHASED"
                });
                obj.Receipt = JSON.stringify(receipt);
            }
            // 保留Sign不变避免校验失败
            body = JSON.stringify(obj);
        }
    } catch(e) {}
    
    $done({body: body});
}

