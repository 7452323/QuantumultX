/*
EveryTrace 解锁会员

https://apps.apple.com/app/id6736608702

[rewrite_local]
^https:\/\/ink\.timerecord\.cn\/apis\/app\/trace\/(getUserInfo|getVisitorUserInfo) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Myj.js

[mitm]
hostname = ink.timerecord.cn
*/

const url = $request.url;
let body = JSON.parse($response.body);
const now = new Date().toISOString().slice(0, 16).replace('T', ' ');

if (body.data) {
  body.data.longMemberType = 1;
  body.data.longVipCreateTime = now;
  body.data.memberType = 3;
  body.data.vipExpirationTime = "2099-12-31 23:59:59";
  if (body.data.starMemberType !== undefined) {
    body.data.starMemberType = 1;
    body.data.starVipCreateTime = now;
  }
}

$done({ body: JSON.stringify(body) });
