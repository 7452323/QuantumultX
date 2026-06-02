/*
懒饭 会员解锁
[rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1 url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

[mitm]
hostname = lanfanapp.com
*/

var body = $response.body;
if (!body) { $done({}); }

body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"expires_time":"[^"]+"/g, '"expires_time":"2099-12-31 23:59:59"');
body = body.replace(/"watermark":\w+/g, '"watermark":false');
body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
$done({body: body});
