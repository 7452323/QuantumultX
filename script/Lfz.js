/*
录风者 Viidure v3.6.1 会员解锁
修改 userinfo subscribe 字段 + vip/infos code
作者: 7452323

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/account/api/v1/user/userinfo/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/infos$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

[mitm]
hostname = app-api.lufengzhe.com:9091
*/

var body = $response.body;
if (!body) { $done({}); }

try {
    var json = JSON.parse(body);
    var url = $request.url;

    // 修改 userinfo - subscribe 字段
    if (url.includes("/account/api/v1/user/userinfo/")) {
        if (json.result) {
            json.result.subscribe = 1;
            json.result.is_vip = true;
            json.result.vip_level = 3;
            json.result.vip_name = "终身会员";
            json.result.vip_expire_time = 9999999999;
        }
    }

    // 修改 vip/infos - code 和 data
    else if (url.includes("/store/api/v1/vip/infos")) {
        json.code = 0;
        json.des = "success";
        if (!json.data) {
            json.data = {};
        }
        json.data.is_vip = true;
        json.data.vip_level = 3;
        json.data.vip_name = "终身会员";
        json.data.expire_time = 9999999999;
        json.data.vip_type = "lifetime";
        json.data.ai_quota = 999999;
        json.data.cloud_storage = 1099511627776;
        if (!json.data.functions || json.data.functions.length === 0) {
            json.data.functions = [
                {"id": 1, "name": "AR特效", "enabled": true},
                {"id": 2, "name": "车牌识别", "enabled": true},
                {"id": 3, "name": "GPS轨迹", "enabled": true},
                {"id": 4, "name": "AI编辑", "enabled": true},
                {"id": 5, "name": "云端存储", "enabled": true},
                {"id": 6, "name": "去水印", "enabled": true},
                {"id": 7, "name": "高清导出", "enabled": true}
            ];
        }
    }

    body = JSON.stringify(json);
} catch(e) {}

$done({body: body});
