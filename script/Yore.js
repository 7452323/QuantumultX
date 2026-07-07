/*
https://apps.apple.com/app/id6757142701

[rewrite_local]
^https?:\/\/api\.yore\.code-abc\.com url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Yore.js

[mitm]
hostname = api.yore.code-abc.com
*/

var obj = JSON.parse($response.body);

if (obj) {
  obj.data = obj.data || {};
  obj.data.isVip = true;
  obj.data.isPremium = true;
  obj.data.hasVip = true;
  obj.data.membershipStatus = "active";
  obj.data.isActive = true;
  obj.data.subscription = true;
  obj.data.subscriptionProductId = "c.team.Yore.PermanentVip";
  obj.data.subscriptionPlan = "Permanent";
  obj.data.subscriptionType = "vip";
  obj.data.subscriptionEndTime = "2099-12-31T23:59:59Z";
  obj.data.originalTransactionId = "9000000000000001";
  obj.data.bundleId = "c.team.Yore";
  obj.data.isTrialPeriod = false;
  obj.data.isIntroOfferPeriod = false;
  obj.data.autoRenewStatus = true;
}

$done({body: JSON.stringify(obj)});
