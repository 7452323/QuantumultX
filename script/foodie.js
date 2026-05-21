/*

#!name=Foodie Pro 解锁
#!desc=解锁 Foodie 美食相机永久 Pro
#!author=bgcode🅥

[rewrite_local]
^https:\/\/purchase-foodiecn-api\.yiruikecorp\.com\/v1\/purchase\/subscription\/subscriber\/status url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/foodie.js

[mitm]
hostname = purchase-foodiecn-api.yiruikecorp.com

*/

const path = "/v1/purchase/subscription/subscriber/status";

if ($request.url.includes(path)) {
  try {
    const now = Date.now();
    const expire = now + 2331168000000; // 2099年到期
    const body = {
      result: {
        products: [
          {
            managed: false,
            status: "ACTIVE",
            startDate: now,
            productId: "com.linecorp.Foodie.subscribe.oneyear",
            isTrialPeriod: true,
            expireDate: expire
          }
        ],
        vipSegments: ["SUBSCRIPTION_FREE_ACTIVE"],
        activated: true
      }
    };
    $done({ body: JSON.stringify(body) });
  } catch {
    $done({});
  }
} else {
  $done({});
}