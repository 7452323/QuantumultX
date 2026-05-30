/*
 * @name 懒饭 PRO
 * @description 懒饭会员解锁 v2.1 - 全端点覆盖
 * @compatible QuantumultX Surge Loon

 [rewrite_local]
^https?:\/\/lanfanapp\.com\/api\/v1\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

 [mitm]
 hostname = lanfanapp.com

*/

var body = $response.body;
if (!body) { $done({}); }

// ── 核心会员字段 ──
body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
body = body.replace(/"is_prime":\w+/g, '"is_prime":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');
body = body.replace(/"watch_type":\d+/g, '"watch_type":1');
body = body.replace(/"is_enjoy_discount":\w+/g, '"is_enjoy_discount":true');

// ── 过期时间 → 2099 ──
body = body.replace(/"expires_time":"[^"]+"/g, '"expires_time":"2099-12-31 23:59:59"');

// ── 视频URL：v.0_10000. → v.（10秒预览→完整版）──
body = body.replace(/v\.0_10000\./g, 'v.');

// ── 去掉tips（服务器用了Unicode转义，中文正则匹配不到）──
// App可能根据tips非空来判断是否非会员
body = body.replace(/"tips":"[^"]+"/g, '"tips":""');

// ── 猜测的时间限制字段（兜底无副作用）──
body = body.replace(/"watch_time_limit":\d+/g, '"watch_time_limit":99999999');
body = body.replace(/"duration_limit":\d+/g, '"duration_limit":99999999');
body = body.replace(/"max_preview":\d+/g, '"max_preview":99999999');
body = body.replace(/"preview_duration":\d+/g, '"preview_duration":99999999');
body = body.replace(/"free_duration":\d+/g, '"free_duration":99999999');
body = body.replace(/"trial_duration":\d+/g, '"trial_duration":99999999');
body = body.replace(/"max_watch_time":\d+/g, '"max_watch_time":99999999');
body = body.replace(/"limit_seconds":\d+/g, '"limit_seconds":99999999');
body = body.replace(/"preview_seconds":\d+/g, '"preview_seconds":99999999');

// ── 去水印 ──
body = body.replace(/"watermark":.+?[,\\}]/g, '"watermark":false,');

// ── 去掉 user_homepage_prime_banner（会员不应有购买横幅）──
body = body.replace(/,"user_homepage_prime_banner":\{[^}]+\}/g, '');
body = body.replace(/"user_homepage_prime_banner":\{[^}]+\},/g, '');

// ── prime_contract 改为完整会员合同对象 ──
body = body.replace(/"prime_contract":null/g, '"prime_contract":{"is_prime":true,"expires_time":"2099-12-31 23:59:59"}');

// ── 去掉加入计划/会员相关的错误码 ──
body = body.replace(/"errcode":1132/g, '"errcode":0');
body = body.replace(/"errcode":1[0-9]{3}/g, '"errcode":0');
body = body.replace(/"errmsg":"[^"]*"/g, '"errmsg":""');
body = body.replace(/"error":"[^"]*"/g, '"error":""');

$done({body: body});
