/* ═══════════════════════════════════════════════════════
   懒饭 PRO — 会员解锁 + 去广告
   v2.0

   [rewrite_local]
   ^https?:\/\/lanfanapp\.com\/api\/v1 url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

   [mitm]
   hostname = lanfanapp.com
   ═══════════════════════════════════════════════════════ */

let body = $response.body;
if (!body) { $done({}); }

body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"watch_type":\d+/g, '"watch_type":1');
body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
body = body.replace(/"watermark":\w+/g, '"watermark":false');
body = body.replace(/"expires_time":"[^"]+"/g, '"expires_time":"2099-12-31 23:59:59"');

$done({ body });
