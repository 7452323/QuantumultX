/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁 - 含10秒限制解除
 * @compatible QuantumultX

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = lanfanapp.com

*/

var body = $response.body;
if (!body) { $done({}); }

// 会员字段
body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"watch_type":\d+/g, '"watch_type":1');

// 10秒限制解除 - 尝试各种可能的时限字段
body = body.replace(/"watch_time_limit":\d+/g, '"watch_time_limit":99999999');
body = body.replace(/"duration_limit":\d+/g, '"duration_limit":99999999');
body = body.replace(/"max_preview":\d+/g, '"max_preview":99999999');
body = body.replace(/"preview_duration":\d+/g, '"preview_duration":99999999');
body = body.replace(/"free_duration":\d+/g, '"free_duration":99999999');
body = body.replace(/"trial_duration":\d+/g, '"trial_duration":99999999');
body = body.replace(/"max_watch_time":\d+/g, '"max_watch_time":99999999');
body = body.replace(/"limit_seconds":\d+/g, '"limit_seconds":99999999');
body = body.replace(/"preview_seconds":\d+/g, '"preview_seconds":99999999');
body = body.replace(/"watermark":/.+?[,\}]/g, '"watermark":false,');

$done({body: body});
