/*

简讯 解锁VIP

[rewrite_local]
^https:\/\/api\.tipsoon\.com\/api\/v1 url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Jx.js

[mitm]
hostname = api.tipsoon.com
*/

re('"is_vip":\\w+@"vip_expire_time":"[^"]+"@"show_home_tips":\\d+@"ad_scale":\\d+@"open_ad_time":\\d+@"offline_vip_num":\\d+@"offline_normal_num":\\d+@"is_unlock":\\w+@"vip":\\w+@"user_stauts":\\w+', '"is_vip":true@"vip_expire_time":"2099-12-31 23:59:59"@"show_home_tips":0@"ad_scale":0@"open_ad_time":0@"offline_vip_num":999@"offline_normal_num":999@"is_unlock":true@"vip":true@"user_stauts":true')

function re() {
  var e = $response.body;
  if (arguments[0].includes("@")) {
    var n = arguments[0].split("@"),
        r = arguments[1].split("@");
    for (i = 0; i < n.length; i++) {
      var l = new RegExp(n[i], "g");
      e = e.replace(l, r[i]);
    }
  } else {
    l = new RegExp(arguments[0], "g");
    e = e.replace(l, arguments[1]);
  }
  $done({ body: e });
}
