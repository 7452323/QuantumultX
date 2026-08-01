/*
录风者 Viidure v3.6.1 会员解锁
VIP破解 + 去广告 + AI配额破解
作者: 7452323
日期: 2026-08-02

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/infos$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/func/activate$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/func/find$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/store/order/check$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/ai/api/v1/usage/quota$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/ai/api/v1/task/checkAmount$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/banner$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/splash$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/commdata$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/store/sale/packet$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/iot/api/v1/version/check$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

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
    }

    // VIP 功能激活
    else if (url.includes("/store/api/v1/vip/func/activate")) {
        json.data = {
            success: true,
            vip_func_id: 1,
            activated_at: Math.floor(Date.now() / 1000),
            expire_at: 9999999999
        };
    }

    // VIP 功能查询 - 全部已激活
    else if (url.includes("/store/api/v1/vip/func/find")) {
        json.data = {
            list: Array.from({length: 20}, (_, i) => ({
                id: i + 1,
                activated: true,
                expire_at: 9999999999
            }))
        };
    }

    // 订单检查 - 已购买
    else if (url.includes("/store/api/v1/store/order/check")) {
        json.data = {
            order_status: "completed",
            purchased: true,
            product_id: "vip_lifetime",
            purchase_time: Math.floor(Date.now() / 1000),
            expire_time: 9999999999
        };
    }

    // AI 使用配额 - 无限
    else if (url.includes("/ai/api/v1/usage/quota")) {
        json.data = {
            total: 999999,
            used: 0,
            remaining: 999999,
            unlimited: true
        };
    }

    // AI 任务额度 - 无限
    else if (url.includes("/ai/api/v1/task/checkAmount")) {
        json.data = {
            available: 999999,
            unlimited: true
        };
    }

    // Banner 广告 - 清空
    else if (url.includes("/res/api/v1/appres/banner")) {
        json.data = { list: [] };
    }

    // 启动页广告 - 清空
    else if (url.includes("/res/api/v1/appres/splash")) {
        json.data = { splash: null };
    }

    // 通用数据 - 清除广告
    else if (url.includes("/res/api/v1/appres/commdata")) {
        if (json.data) {
            delete json.data.ads;
            delete json.data.banners;
            delete json.data.ad_config;
        }
    }

    // 销售包 - 全部已购买
    else if (url.includes("/store/api/v1/store/sale/packet")) {
        if (json.data && json.data.list) {
            json.data.list.forEach(function(item) {
                item.purchased = true;
                item.price = 0;
            });
        }
    }

    // 版本检查 - 不提示更新
    else if (url.includes("/iot/api/v1/version/check")) {
        json.data = {
            need_update: false,
            latest_version: "3.6.1",
            force_update: false
        };
    }

    body = JSON.stringify(json);
} catch(e) {}

$done({body: body});
