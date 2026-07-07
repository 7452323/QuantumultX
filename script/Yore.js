/*

 * @name Yore
 * @description Yore - Your Second Brain for Self-Growth
 * @author 7452323
 *
[rewrite_local]
^https:\/\/api\.yore\.code-abc\.com\/v\d+\/user\/profile url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yore.js
^https:\/\/api\.yore\.code-abc\.com\/v\d+\/subscription\/status url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yore.js

[mitm]
hostname = api.yore.code-abc.com, c.team, assets.5a8.org
*/

// ==========================================
//  🧠 Yore VIP 一键解锁脚本
//  解锁 Yore 全部付费功能 (Pro+Lifetime)
// ==========================================

const now = Date.now();

// ====== 基础数据结构 ======
function appleDate(ts) {
    const d = new Date(ts);
    const pad = n => String(n).padStart(2, "0");
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} Etc/GMT`;
}

function generateTransactionId() {
    return "1" + String(Math.floor(Math.random() * 1000000000000000)).padStart(15, "0");
}

// ====== 永久过期时间 ======
const EXPIRE_FAR = 32503679999000;

// ====== 路由分发 ======
const url = $request.url;

if (url.includes("/user/profile")) {
    // 用户 Profile：解锁 VIP 标识
    let body;
    try { body = JSON.parse($response.body); } catch(e) { body = {}; }
    
    body.data = body.data || {};
    body.data.vip = true;
    body.data.isPremium = true;
    body.data.subscription = body.data.subscription || {};
    body.data.subscription.status = "active";
    body.data.subscription.plan = "lifetime";
    body.data.subscription.expireTime = EXPIRE_FAR;
    body.data.subscription.isExpired = false;
    body.data.subscription.autoRenew = true;
    
    $done({ body: JSON.stringify(body) });

} else if (url.includes("/subscription/status")) {
    // 订阅状态：永久生效
    let body;
    try { body = JSON.parse($response.body); } catch(e) { body = {}; }
    
    body.data = body.data || {};
    body.data.isActive = true;
    body.data.isPremium = true;
    body.data.plan = "lifetime";
    body.data.status = "active";
    body.data.expireTime = EXPIRE_FAR;
    body.data.isExpired = false;
    body.data.autoRenew = true;
    body.data.features = ["ai_analysis", "unlimited_storage", "custom_theme", "export_pdf", "priority_support"];
    
    $done({ body: JSON.stringify(body) });

} else {
    $done({});
}