/*
 * @name 落格输入法 PRO
 * @description 落格输入法 X 解锁 - 收据验证拦截 v2
 * @compatible QuantumultX Surge Loon

 [rewrite_local]
^https?:\/\/api\.logcg\.com\/app\/tf\/v1 url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/LogInput.js

 [mitm]
 hostname = api.logcg.com

*/

var body = $response.body;
if (!body) { $done({}); }

try {
    var obj = JSON.parse(body);
    
    if (obj.Receipt) {
        // Parse the receipt JSON string
        var receipt = JSON.parse(obj.Receipt);
        
        // Ensure in_app exists
        if (!receipt.receipt.in_app) {
            receipt.receipt.in_app = [];
        }
        
        // Add fake purchase with date in 2099
        var fakeEntry = {
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
        };
        
        receipt.receipt.in_app.push(fakeEntry);
        receipt.status = 0;
        
        obj.Receipt = JSON.stringify(receipt);
        
        // Remove Sign to avoid integrity verification
        delete obj.Sign;
        
        body = JSON.stringify(obj);
    }
} catch(e) {
    // Fallback for non-JSON responses
}

$done({body: body});
