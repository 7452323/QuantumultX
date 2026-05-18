/*

[rewrite_local]
^https?:\/\/app\.yiyan\.art\/yiyan url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Yiyan.js

[mitm]
hostname = app.yiyan.art

*/
var obj = JSON.parse($response.body);

if (obj.data) {
  obj.data.is_vip = 1;
  obj.data.isVip = true;
  obj.data.vipLevel = 1;
  obj.data.vipType = "终身会员";
  obj.data.isPremium = true;
  obj.data.auto_renew = 1;

  obj.data.vipEndTime = "2099-12-31 23:59:59";
  obj.data.vip_end = 4092599349;
  obj.data.vipDay = "9999";
  obj.data.vipExpireDate = "2099-12-31";

  obj.data.coin = "99999";
  obj.data.coins = 99999;
  obj.data.freeCount = "9999";
}

if (obj.is_vip != null) {
  obj.is_vip = 1;
}
if (obj.isVip != null) {
  obj.isVip = true;
}

$done({ body: JSON.stringify(obj) });