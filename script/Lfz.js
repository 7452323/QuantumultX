/*
录风者 Viidure v3.6.1 会员解锁
VIP破解 + 去广告 + AI配额破解
作者: 7452323
日期: 2026-08-02
更新: 2026-08-02 (基于 HAR 抓包修正响应格式)

[rewrite_local]
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/vip/infos$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/store/order/check$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/store/api/v1/store/sale/packet$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/ai/api/v1/usage/quota$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/ai/api/v1/task/checkAmount$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/ai/api/v1/task/list$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/ai/api/v1/template/group$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/banner$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/splash$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/res/api/v1/appres/commdata$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/iot/api/v1/version/check$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js
^https?://app-api\.lufengzhe\.com:9091/account/api/v1/user/userinfo/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lfz.js

[mitm]
hostname = app-api.lufengzhe.com:9091
*/

var body = $response.body;
if (!body) { $done({}); }

try {
    var json = JSON.parse(body);
    var url = $request.url;

    // VIP 信息 - 终身会员
    // 实际格式: {"result": {}, "code": 200001, "des": "vip info notfound", "data": {...}}
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

    // 订单检查 - 已支付
    // 实际格式: {"result": {"orderid": "...", "status": 0, ...}, "code": 0, "des": "success"}
    else if (url.includes("/store/api/v1/store/order/check")) {
        if (json.result) {
            json.result.status = 1;
            json.result.userPayment.status = 1;
            json.result.paid = true;
            json.result.order_status = "completed";
        }
        json.code = 0;
        json.des = "success";
    }

    // 销售包 - 全部已购买，价格清零
    // 实际格式: {"result": {"data": [...]}, "code": 0, "des": "success"}
    else if (url.includes("/store/api/v1/store/sale/packet")) {
        if (json.result && json.result.data) {
            json.result.data.forEach(function(item) {
                item.purchased = true;
                item.price = 0;
                item.cost = 0;
                item.status = 2;
            });
        }
        json.code = 0;
        json.des = "success";
    }

    // AI 使用配额 - 无限
    else if (url.includes("/ai/api/v1/usage/quota")) {
        if (json.data) {
            json.data.total = 999999;
            json.data.used = 0;
            json.data.remaining = 999999;
            json.data.unlimited = true;
        }
        json.code = 0;
        json.des = "success";
    }

    // AI 任务额度 - 无限
    else if (url.includes("/ai/api/v1/task/checkAmount")) {
        if (json.data) {
            json.data.available = 999999;
            json.data.unlimited = true;
        }
        json.code = 0;
        json.des = "success";
    }

    // AI 任务列表 - 清除限制
    else if (url.includes("/ai/api/v1/task/list")) {
        if (json.result && json.result.data) {
            json.result.data.forEach(function(task) {
                if (task.tpl) {
                    task.tpl.limitUse = false;
                }
            });
        }
    }

    // AI 模板组 - 移除使用限制
    else if (url.includes("/ai/api/v1/template/group")) {
        if (json.result && json.result.data) {
            json.result.data.forEach(function(group) {
                if (group.childList) {
                    group.childList.forEach(function(child) {
                        if (child.tpl) {
                            child.tpl.limitUse = false;
                        }
                    });
                }
            });
        }
    }

    // Banner 广告 - 清空
    else if (url.includes("/res/api/v1/appres/banner")) {
        if (json.result) {
            json.result.data = { list: [] };
        }
        json.code = 0;
        json.des = "success";
    }

    // 启动页广告 - 清空
    else if (url.includes("/res/api/v1/appres/splash")) {
        if (json.result) {
            json.result.data = { splash: null };
        }
        json.code = 0;
        json.des = "success";
    }

    // 通用数据 - 清除广告
    else if (url.includes("/res/api/v1/appres/commdata")) {
        if (json.result && json.result.data) {
            delete json.result.data.ads;
            delete json.result.data.banners;
            delete json.result.data.ad_config;
        }
    }

    // 版本检查 - 不提示更新
    else if (url.includes("/iot/api/v1/version/check")) {
        json.data = {
            need_update: false,
            latest_version: "3.6.1",
            force_update: false
        };
        json.error_code = -1;
    }

    // 用户信息 - 添加 VIP 标识
    else if (url.includes("/account/api/v1/user/userinfo/")) {
        if (json.result) {
            json.result.is_vip = true;
            json.result.vip_level = 3;
            json.result.vip_expire = 9999999999;
        }
    }

    body = JSON.stringify(json);
} catch(e) {}

$done({body: body});
