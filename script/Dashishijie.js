/*
大师视界 - 大师水印相机边框水印照片参数exif
https://apps.apple.com/cn/app/id6476436343

[rewrite_local]
^https:\/\/buy\.itunes\.apple\.com\/verifyReceipt url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Dashishijie.js
^https:\/\/3318805\.ma3you\.cn\/api\/article_show\/.+ url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Dashishijie.js

[mitm]
hostname = buy.itunes.apple.com, 3318805.ma3you.cn
*/

var obj = JSON.parse($response.body);

if (obj.content) {
  obj.is_vip = true;
  obj.hidden_ad = false;
  obj.pay_for_knowledge = false;
  obj.code = 0;
  obj.msg = "success";
}

$done({ body: JSON.stringify(obj) });