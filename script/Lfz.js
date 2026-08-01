/*
录风者 Viidure v3.6.1 会员解锁
模拟 IAP 订单验证 + VIP 信息
作者: 7452323

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/store/order/check$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/infos$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

[mitm]
hostname = app-api.lufengzhe.com:9091
*/

var body = $response.body;
if (!body) { $done({}); }

try {
    var json = JSON.parse(body);
    var url = $request.url;

    // 订单检查 - 模拟已支付（永久会员）
    if (url.includes("/store/api/v1/store/order/check")) {
        var orderid = "";
        // 从 URL 参数获取 orderid
        var match = url.match(/orderid=([^&]+)/);
        if (match) orderid = match[1];
        if (!orderid) orderid = "SIMULATED_" + Date.now();

        json.result = {
            orderid: orderid,
            userPayment: {
                amount: 34.90,
                orderid: orderid,
                channel: "apple",
                userid: 6536281,
                dotime: Date.now(),
                appmodel: "6zhentan",
                signtime: Date.now(),
                receipt: 1,
                id: 999999,
                time: Date.now(),
                prepayid: "simulated_" + Date.now(),
                status: 1,
                refund: 0
            },
            remark: "Simulated payment for testing",
            ultime: Date.now(),
            userid: 6536281,
            extend: {
                country: "CN",
                product: 2,
                app_version: "v3.6.1",
                appmodel: "6zhentan",
                channel: "apple",
                clitype: "iOS",
                language: "zh",
                userid: 6536281,
                tenant: "00000000",
                vipver: 6,
                username: "simulated"
            },
            spinfo: JSON.stringify({
                product: 2,
                cost: 34.90,
                code: "VIP_VER2_30Y",
                kind: 0,
                discount: 0,
                wares: "VIP_AR_30Y/VIP_BD_30Y/VIP_FAQ_30Y/VIP_VZOOM_30Y/VIP_VSEEP_30Y/VIP_EMARK_30Y/VIP_EVFX_30Y/VIP_EPIP_30Y/VIP_ARCP_30Y/VIP_EDUP_30Y/VIP_TIMER_30Y/VIP_GPSHELPER_30Y/VIP_3DMAP_30Y/VIP_CLOUDAI_30Y",
                priority: 1,
                extend: {
                    apple: {code: "com.vidure.6zhentan.forever.membership"},
                    google: {code: "com.vidure.app.forever.membership"}
                },
                warn: "开通会员，享专属权益",
                price: 34.90,
                name: "永久",
                id: 4,
                status: 1,
                info: "AR功能/百度网盘等全部会员功能"
            }),
            appmodel: "6zhentan",
            id: 999999,
            time: Date.now(),
            spcode: "VIP_VER2_30Y",
            status: 1,
            username: "simulated"
        };
        json.code = 0;
        json.des = "success";
    }

    // VIP 信息 - 终身会员
    else if (url.includes("/store/api/v1/vip/infos")) {
        json.code = 0;
        json.des = "success";
        json.data = {
            is_vip: true,
            vip_level: 3,
            vip_name: "终身会员",
            expire_time: 9999999999,
            vip_type: "lifetime",
            ai_quota: 999999,
            cloud_storage: 1099511627776,
            functions: [
                {id: 1, name: "AR特效", enabled: true},
                {id: 2, name: "车牌识别", enabled: true},
                {id: 3, name: "GPS轨迹", enabled: true},
                {id: 4, name: "AI编辑", enabled: true},
                {id: 5, name: "云端存储", enabled: true},
                {id: 6, name: "去水印", enabled: true},
                {id: 7, name: "高清导出", enabled: true},
                {id: 8, name: "延时摄影", enabled: true},
                {id: 9, name: "慢动作", enabled: true},
                {id: 10, name: "视频防抖", enabled: true}
            ]
        };
    }

    body = JSON.stringify(json);
} catch(e) {}

$done({body: body});
