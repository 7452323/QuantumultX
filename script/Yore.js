/*

 * @name Yore
 * @description Yore - Your Second Memory / AI效率工具 VIP解锁
 * @author 7452323
 * @bundleId c.team.Yore
 * @version 1.0.17
 * @update 2026-07-07
 *
[rewrite_local]
# API 域名
^https?:\/\/api\.yore\.code-abc\.com\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yore.js
# 隐私政策/帮助页面（含 VIP 信息）
^https?:\/\/c\.team\/(vip\.html|PrivacyPolicy\.html)?$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yore.js
# 版本检查
^https?:\/\/assets\.5a8\.org\/yore\/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yore.js

[mitm]
hostname = api.yore.code-abc.com, c.team, assets.5a8.org
 */

const VIP_PRODUCTS = {
  "c.team.Yore.MonthlyVip": {
    adamId: "6785919350",
    type: "Monthly",
    displayPrice: "$5.99",
    durationDays: 30
  },
  "c.team.Yore.YearVip": {
    adamId: "6785919476",
    type: "Yearly",
    displayPrice: "$29.99",
    durationDays: 365
  },
  "c.team.Yore.PermanentVip": {
    adamId: "6785927323",
    type: "Permanent",
    displayPrice: "$69.99",
    durationDays: -1
  }
};

const TX_ID = "9000000000000001";
const ORIG_TX_ID = "9000000000000001";
const WEB_ORDER_ID = "9000000000000002";

// ====== 工具函数 ======
function futureDate(days) {
  const d = new Date();
  if (days === -1) {
    d.setFullYear(2099, 11, 31);
  } else {
    d.setDate(d.getDate() + days);
  }
  return d.toISOString();
}

function nowDate() {
  return new Date().toISOString();
}

function injectVip(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  obj.isVip = true;
  obj.isPremium = true;
  obj.hasVip = true;
  obj.membershipStatus = 'active';
  obj.isActive = true;
  obj.subscription = true;
  obj.isMember = true;
  obj.premium = true;
  obj.subscriptionProductId = 'c.team.Yore.PermanentVip';
  obj.subscriptionPlan = 'Permanent';
  obj.subscriptionType = 'vip';
  obj.subscriptionEndTime = futureDate(-1);
  obj.subscriptionEndTimeMs = Date.parse(futureDate(-1));
  obj.expiresDate = futureDate(-1);
  obj.expiresDateMs = Date.parse(futureDate(-1));
  obj.originalTransactionId = ORIG_TX_ID;
  obj.webOrderLineItemId = WEB_ORDER_ID;
  obj.bundleId = 'c.team.Yore';
  obj.isTrialPeriod = false;
  obj.isIntroOfferPeriod = false;
  obj.autoRenewStatus = true;
  return obj;
}

// ====== 主逻辑 ======
let url = $request.url || '';
let body;
try {
  body = JSON.parse($response.body);
} catch(e) {
  body = {};
}

// 1. 所有 API 响应注入 VIP
if (body.data) {
  if (typeof body.data === 'object') {
    body.data = injectVip(body.data);
  }
}

// 2. 顶层注入
injectVip(body);

// 3. 特殊端点处理
if (url.indexOf('/membership') !== -1 || url.indexOf('/vip') !== -1 || url.indexOf('/subscription') !== -1) {
  body.status = 'success';
  body.data = body.data || {};
  body.data.subscriptionProductId = 'c.team.Yore.PermanentVip';
  body.data.subscriptionPlan = 'Permanent';
  body.data.subscriptionEndTime = futureDate(-1);
}

$done({ body: JSON.stringify(body) });
