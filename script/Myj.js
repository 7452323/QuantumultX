/*
EveryTrace 解锁会员

[rewrite_local]
^https:\/\/ink\.timerecord\.cn\/apis\/app\/trace\/(getUserInfo|getVisitorUserInfo) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Myj.js

[mitm]
hostname = ink.timerecord.cn
*/

const url = $request.url;
let body = JSON.parse($response.body);

if (body.data) {
  body.data.longMemberType = 1;
  body.data.memberType = 3;
}

$done({ body: JSON.stringify(body) });
