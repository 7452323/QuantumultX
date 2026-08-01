/*
录风者 Viidure v3.6.1 会员解锁
基于第一版（不闪退）只修改 VIP code
作者: 7452323

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/infos$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

[mitm]
hostname = app-api.lufengzhe.com:9091
*/

var body = $response.body;
if (!body) { $done({}); }

try {
    var json = JSON.parse(body);
    var url = $request.url;

    // VIP 信息 - 只修改 code 让应用认为 VIP 有效
    if (url.includes("/store/api/v1/vip/infos")) {
        json.code = 0;
        json.des = "success";
    }

    body = JSON.stringify(json);
} catch(e) {}

$done({body: body});
