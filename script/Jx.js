/*
简讯 解锁VIP

[rewrite_local]
^https:\/\/api\.tipsoon\.com\/api\/v1\/(user\/info|login\/account) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jx.js
^https:\/\/api\.tipsoon\.com\/api\/v1\/top\/system url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jx.js

[mitm]
hostname = api.tipsoon.com
*/

const url = $request.url;
let body = JSON.parse($response.body);

if (url.includes('/top/system')) {
  body.data.show_home_tips = 0;
  body.data.ad_scale = 0;
  body.data.open_ad_time = 0;
  body.data.offline_normal_num = 999;
} else if (body.data) {
  body.data.is_vip = true;
  body.data.vip_expire_time = "2099-12-31 23:59:59";
}

$done({ body: JSON.stringify(body) });
