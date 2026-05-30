/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁 - 全文替换模式
 * @compatible QuantumultX

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = lanfanapp.com

*/

var body = $response.body;
if (!body) { $done({}); }

// 全文正则替换 - 和Surge的Body Rewrite等效
body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"watch_type":\d+/g, '"watch_type":1');

$done({body: body});
