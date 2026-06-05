/*
有诗 解锁终身会员

[rewrite_local]
^https:\/\/youshiapp\.com\/api\/v1\/(users\/me|account\/oauth\/wechat|apple\/restore) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Ys.js
^https:\/\/youshiapp\.com\/api\/v1\/apple\/r url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Ys.js

[mitm]
hostname = youshiapp.com
*/

const url = $request.url;
let body = JSON.parse($response.body);

if (url.includes('/apple/r')) {
  body.r = true;
} else {
  body.is_member = true;
  body.is_lifetime_member = true;
  body.has_paid = true;
  body.member_expired_at = "2099-12-31T00:00:00Z";
}

$done({ body: JSON.stringify(body) });
