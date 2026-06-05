/*
句读 解锁会员

[rewrite_local]
^https:\/\/judouapp\.com\/api\/v2\/users\/wechat url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jd.js
^https:\/\/judouapp\.com\/api\/v2\/t\/i url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jd.js
^https:\/\/judouapp\.com\/api\/v2\/common\/global_config url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jd.js

[mitm]
hostname = judouapp.com
*/

let body = $response.body;
let url = $request.url;

if (url.indexOf('/users/wechat') !== -1) {
  body = body.replace(/"is_member":false/g, '"is_member":true');
  body = body.replace(/"is_year_member":false/g, '"is_year_member":true');
  body = body.replace(/"member_type":null/g, '"member_type":"lifetime"');
  body = body.replace(/"member_expired_at":null/g, '"member_expired_at":"2099-12-31T23:59:59.000Z"');
  body = body.replace(/"role":"normal"/g, '"role":"vip"');
  body = body.replace(/"is_splash_ad_free":false/g, '"is_splash_ad_free":true');
  body = body.replace(/"can_access_featured_issues":false/g, '"can_access_featured_issues":true');
} else if (url.indexOf('/t/i') !== -1) {
  body = body.replace(/"r":false/g, '"r":true');
} else if (url.indexOf('/global_config') !== -1) {
  body = body.replace(/"T6":"unlock"/g, '"T6":"free"');
  body = body.replace(/"T7":"member"/g, '"T7":"free"');
  body = body.replace(/"T10":"member"/g, '"T10":"free"');
  body = body.replace(/"rbn":110/g, '"rbn":0');
  body = body.replace(/"hwrbn":1075/g, '"hwrbn":0');
}

$done({ body });
