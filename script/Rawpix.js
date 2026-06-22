/*

https://apps.apple.com/app/id6744239296

[rewrite_local]
^https?:\/\/api\.rawpixlive\.com\/api\/sign\/profile url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Rawpix.js

[mitm]
hostname = api.rawpixlive.com
*/

$done({
  body: JSON.stringify((o => (
    o.data.isCreator = 1,
    o.data.is_vip = true,
    o.data.expireTime = 4092599349,
    o.data.level = 6,
    o.data.level_name = "年卡会员",
    o.data.can_trail = false,
    o
  ))(JSON.parse($response.body)))
});
