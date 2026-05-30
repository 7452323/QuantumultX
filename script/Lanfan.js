/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁
 * @compatible QuantumultX

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = lanfanapp.com

*/

var body = $response.body;
if (!body) { $done({}); }

body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"watch_type":\d+/g, '"watch_type":3');

$done({body: body});
