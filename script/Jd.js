/*
句读 解锁会员

[rewrite_local]
^https:\/\/judouapp\.com\/api\/v2\/(users\/wechat|t\/i) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jd.js

[mitm]
hostname = judouapp.com
*/

const url = $request.url;
let body = JSON.parse($response.body);

if (url.includes('/t/i')) {
  body.r = true;
} else {
  body.is_member = true;
  body.is_year_member = true;
  body.member_expired_at = "2099-12-31T00:00:00Z";
  body.is_splash_ad_free = true;
  body.member_type = "lifetime";
}

$done({ body: JSON.stringify(body) });
