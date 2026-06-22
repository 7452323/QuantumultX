/*
简讯 解锁VIP

[rewrite_local]
^https:\/\/api\.tipsoon\.com\/api\/v1 url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jx.js

[mitm]
hostname = api.tipsoon.com
*/

let body = $response.body;

body = body.replace(/"is_vip":\w+/g, '"is_vip":true');
body = body.replace(/"vip_expire_time":"[^"]+"/g, '"vip_expire_time":"2099-12-31 23:59:59"');
body = body.replace(/"show_home_tips":\d+/g, '"show_home_tips":0');
body = body.replace(/"ad_scale":\d+/g, '"ad_scale":0');
body = body.replace(/"open_ad_time":\d+/g, '"open_ad_time":0');
body = body.replace(/"offline_vip_num":\d+/g, '"offline_vip_num":999');
body = body.replace(/"offline_normal_num":\d+/g, '"offline_normal_num":999');
body = body.replace(/"is_unlock":\w+/g, '"is_unlock":true');
body = body.replace(/"vip":\w+/g, '"vip":true');
body = body.replace(/"user_stauts":\w+/g, '"user_stauts":true');

$done({ body });
