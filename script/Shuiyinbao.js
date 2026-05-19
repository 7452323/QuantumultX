/*

1.3.6

https://apps.apple.com/cn/app/%E6%B0%B4%E5%8D%B0%E5%AE%9D-%E5%85%A8%E8%83%BD%E8%A7%86%E9%A2%91%E5%9B%BE%E7%89%87%E6%B0%B4%E5%8D%B0%E7%BC%96%E8%BE%91%E5%99%A8/id1631521607

[rewrite_local]
^https:\/\/newappapi\.fntmob\.com\/api\/v1\/qsy\/user-info url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Shuiyinbao.js

[mitm]
hostname = newappapi.fntmob.com

*/

let body = $response.body;
let obj = JSON.parse(body);

if (obj && obj.data) {
  obj.data.is_vip = 1;
  obj.data.is_buy = 1;
  obj.data.grade = 1;
  obj.data.level_expire = 4102415999;
  obj.data.mobile = "One more time";
  obj.data.nickname = "One more time";
}

$done({ body: JSON.stringify(obj) });