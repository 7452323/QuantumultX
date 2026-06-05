/*
有诗 解锁终身会员

[rewrite_local]
^https:\/\/youshiapp\.com\/api\/v1\/(users\/me|account\/oauth\/wechat|apple\/restore|poems) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Ys.js
^https:\/\/youshiapp\.com\/api\/v1\/apple\/r url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Ys.js

[mitm]
hostname = youshiapp.com
*/

const url = $request.url;
let body = JSON.parse($response.body);

const memberFix = (obj) => {
  if (!obj) return;
  obj.is_member = true;
  obj.is_lifetime_member = true;
  obj.has_paid = true;
  obj.member_expired_at = "2099-12-31T00:00:00Z";
};

if (url.includes('/apple/r')) {
  body.r = true;
} else if (url.includes('/misc/configure')) {
  body.ilvc = 1;
  body.ifu = true;
  body.irbn = 0;
} else if (url.includes('/poems') && Array.isArray(body)) {
  // /api/v1/poems list: each poem has a user field
  body.forEach(p => {
    if (p && p.user) memberFix(p.user);
  });
} else if (url.includes('/poems') && body && !Array.isArray(body)) {
  // /api/v1/poems/{id} detail: has user
  if (body.user) memberFix(body.user);
} else {
  // users/me, account/oauth/wechat, apple/restore
  memberFix(body);
}

$done({ body: JSON.stringify(body) });
