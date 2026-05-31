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

// ── 通用收据验证字段 ──
body = body.replace(/"status":\d+/g, '"status":0');
body = body.replace(/"code":\d+/g, '"code":0');
body = body.replace(/"success":\w+/g, '"success":true');
body = body.replace(/"is_valid":\w+/g, '"is_valid":true');
body = body.replace(/"error_code":\d+/g, '"error_code":0');
body = body.replace(/"error":\w+/g, '"error":null');
body = body.replace(/"errno":\d+/g, '"errno":0');
body = body.replace(/"errmsg":"[^"]*"/g, '"errmsg":""');
body = body.replace(/"result":"[^"]*"/g, '"result":"ok"');
body = body.replace(/"message":"[^"]*"/g, '"message":"ok"');
body = body.replace(/"expires_date":"[^"]*"/g, '"expires_date":"2099-12-31 23:59:59"');
body = body.replace(/"expires_time":"[^"]*"/g, '"expires_time":"2099-12-31 23:59:59"');
body = body.replace(/"is_subscribed":\w+/g, '"is_subscribed":true');

// ── 会员相关字段 ──
body = body.replace(/"vip":\d+/g, '"vip":1');
body = body.replace(/"vip":\w+/g, '"vip":true');
body = body.replace(/"is_vip":\d+/g, '"is_vip":1');
body = body.replace(/"is_vip":\w+/g, '"is_vip":true');
body = body.replace(/"level":\d+/g, '"level":99');
body = body.replace(/"is_pro":\w+/g, '"is_pro":true');
body = body.replace(/"pro":\w+/g, '"pro":true');
body = body.replace(/"is_purchased":\w+/g, '"is_purchased":true');
body = body.replace(/"purchased":\w+/g, '"purchased":true');
body = body.replace(/"unlocked":\w+/g, '"unlocked":true');

$done({body: body});
