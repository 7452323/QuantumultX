
/*
一言 - 记录字句，发现共鸣
https://apps.apple.com/cn/app/id1010174792

[rewrite_local]
^https:\/\/app\.yiyan\.art\/yiyan\/(getuserinfoandbooklist|checkpro|getvipproduct) url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/yiyan.js

[mitm]
hostname = app.yiyan.art
*/

var obj = JSON.parse($response.body);

if (obj.viptype) {
  obj.viptype = "4";
  obj.device = "0";
}

if (obj.user) {
  obj.user.viptype = "4";
  obj.user.device = "0";
}

if (obj.product) {
  obj.u.viptype = "4";
  obj.u.device = "0";
  obj.product.permanenttitle = "终身会员";
  obj.product.permanentdesc = "已解锁永久会员";
  obj.product.permanentprice = "0";
  obj.product.yearprice = "0";
  obj.product.yeartitle = "";
  obj.product.yeardesc = "";
  obj.product.yearprice_origin = "0";
  obj.product.permanentprice_origin = "0";
}

if (obj.banner) {
  obj.banner = [];
}

$done({ body: JSON.stringify(obj) });