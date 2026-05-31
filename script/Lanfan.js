/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁
 * @compatible QuantumultX Surge Loon

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [URL-rewrite]
v\.0_10000\. v.

 [mitm]
 hostname = lanfanapp.com, video5.chuimg.com

*/

var body = $response.body;
if (!body) { $done({}); }

body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"expires_time":"[^"]+"/g, '"expires_time":"2099-12-31 23:59:59"');
body = body.replace(/v\.0_10000\./g, 'v.');
body = body.replace(/"watermark":\w+/g, '"watermark":false');

$done({body: body});
