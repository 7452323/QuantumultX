/*
录风者 Viidure v3.6.1 会员解锁
VIP破解 + 去广告 (精简版，避免闪退)
作者: 7452323

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/infos$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/banner$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/splash$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

[mitm]
hostname = app-api.lufengzhe.com:9091
*/

var body = $response.body;
if (!body) { $done({}); }

try {
    var json = JSON.parse(body);
    var url = $request.url;

    // VIP 信息 - 终身会员
    if (url.includes("/store/api/v1/vip/infos")) {
        json.data = {
            is_vip: true,
            vip_level: 3,
            vip_name: "终身会员",
            expire_time: 9999999999,
            vip_type: "lifetime",
            ai_quota: 999999,
            cloud_storage: 1099511627776,
            functions: [
                { id: 1, name: "AR特效", enabled: true },
                { id: 2, name: "车牌识别", enabled: true },
                { id: 3, name: "GPS轨迹", enabled: true },
                { id: 4, name: "AI编辑", enabled: true },
                { id: 5, name: "云端存储", enabled: true },
                { id: 6, name: "去水印", enabled: true },
                { id: 7, name: "高清导出", enabled: true },
                { id: 8, name: "延时摄影", enabled: true },
                { id: 9, name: "慢动作", enabled: true },
                { id: 10, name: "视频防抖", enabled: true }
            ]
        };
        json.code = 0;
        json.des = "success";
    }

    // Banner 广告 - 清空
    else if (url.includes("/res/api/v1/appres/banner")) {
        if (json.data) {
            json.data = { list: [] };
        } else if (json.result) {
            json.result.data = { list: [] };
        }
        json.code = 0;
        json.des = "success";
    }

    // 启动页广告 - 清空
    else if (url.includes("/res/api/v1/appres/splash")) {
        if (json.data) {
            json.data = { splash: null };
        } else if (json.result) {
            json.result.data = { splash: null };
        }
        json.code = 0;
        json.des = "success";
    }

    body = JSON.stringify(json);
} catch(e) {}

$done({body: body});
