/*
 * @name 落格输入法 PRO
 * @description 落格输入法 X 解锁 - 收据验证拦截
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
        // Decode the nested receipt JSON string
        var receipt = JSON.parse(obj.Receipt);
        
        // Add a fake in-app purchase
        var now = new Date();
        var nowMs = now.getTime();
        var futureMs = nowMs + 31536000000; // +1 year
        
        var fakePurchase = {
            "quantity": "1",
            "product_id": "com.logcg.loginput.pro",
            "transaction_id": "1000000" + Math.floor(Math.random() * 9000000),
            "original_transaction_id": "1000000" + Math.floor(Math.random() * 9000000),
            "purchase_date": now.toISOString().replace('Z', '').replace('T', ' ') + ' Etc/GMT',
            "purchase_date_ms": nowMs + "",
            "purchase_date_pst": now.toLocaleString('en-US', {timeZone:'America/Los_Angeles'}) + ' America/Los_Angeles',
            "original_purchase_date": now.toISOString().replace('Z', '').replace('T', ' ') + ' Etc/GMT',
            "original_purchase_date_ms": nowMs + "",
            "original_purchase_date_pst": now.toLocaleString('en-US', {timeZone:'America/Los_Angeles'}) + ' America/Los_Angeles',
            "expires_date": new Date(futureMs).toISOString().replace('Z', '').replace('T', ' ') + ' Etc/GMT',
            "expires_date_ms": futureMs + "",
            "expires_date_pst": new Date(futureMs).toLocaleString('en-US', {timeZone:'America/Los_Angeles'}) + ' America/Los_Angeles',
            "is_trial_period": "false",
            "is_in_intro_offer_period": "false",
            "in_app_ownership_type": "PURCHASED"
        };
        
        // Ensure in_app array exists and add the fake purchase
        if (!receipt.receipt.in_app) {
            receipt.receipt.in_app = [];
        }
        receipt.receipt.in_app.push(fakePurchase);
        
        // Also try additional product IDs just in case
        var additionalProductIds = [
            "com.logcg.loginput.pro",
            "com.logcg.loginput.pro.yearly",
            "com.logcg.loginput.pro.monthly",
            "com.logcg.loginput.unlock",
            "com.logcg.loginput.premium",
            "com.logcg.loginput.full_version",
            "com.logcg.loginput.vip",
            "com.logcg.loginput.remove_ads"
        ];
        
        for (var i = 0; i < additionalProductIds.length; i++) {
            var extraPurchase = JSON.parse(JSON.stringify(fakePurchase));
            extraPurchase.product_id = additionalProductIds[i];
            extraPurchase.transaction_id = "1000000" + Math.floor(Math.random() * 9000000);
            receipt.receipt.in_app.push(extraPurchase);
        }
        
        // Set receipt status to 0 (valid)
        receipt.status = 0;
        
        // Re-serialize
        obj.Receipt = JSON.stringify(receipt);
        
        body = JSON.stringify(obj);
    }
} catch(e) {
    // Fallback: simple text replacements
    body = body.replace(/"in_app":\[([^\]]*)\]/g, '"in_app":[{"product_id":"com.logcg.loginput.pro","quantity":"1","transaction_id":"100000000001","original_transaction_id":"100000000001","purchase_date":"2099-01-01 00:00:00 Etc/GMT","purchase_date_ms":"4070908800000","original_purchase_date":"2099-01-01 00:00:00 Etc/GMT","original_purchase_date_ms":"4070908800000","expires_date":"2099-12-31 23:59:59 Etc/GMT","expires_date_ms":"4102444799000","is_trial_period":"false","is_in_intro_offer_period":"false","in_app_ownership_type":"PURCHASED"}]');
}

$done({body: body});
