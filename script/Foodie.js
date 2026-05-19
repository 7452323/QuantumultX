/*
[rewrite_local]
^https:\/\/purchase-foodie-api\.snow\.me\/v1\/purchase\/subscription\/subscriber\/status url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Foodie.js

[mitm]
hostname = purchase-foodie-api.snow.me
*/
const path = "/v1/purchase/subscription/subscriber/status";

if ($request.url.includes(path)) {
    try {
        JSON.parse($response.body);
        const now = Date.now();
        const expire = now + 2331168000000;
        const body = {
            result: {
                products: [{
                    managed: false,
                    status: "ACTIVE",
                    startDate: now,
                    productId: "com.linecorp.Foodie.subscribe.oneyear",
                    isTrialPeriod: true,
                    expireDate: expire
                }],
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
