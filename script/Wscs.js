/*

[rewrite_local]

^https?://iap\.etm\.tech/v1/products.*atlasv\.speedtestlite url script-response-body https://raw.githubusercontent.com/Reviewa/QuantumultX/main/script/Wscs.js

[mitm]
hostname = iap.etm.tech
*/

(async () => {
  const body = {
    "products": [
      {
        "product_id": "Premium_1_month_20200821",
        "app_package_name": "com.atlasv.SpeedTestLite",
        "app_platform": "AppStore",
        "iss": "atlasv.speedtestlite",
        "entitlement_id": "premium",
        "offering_id": "monthly"
      },
      {
        "product_id": "Premium_1_year_20200821",
        "app_package_name": "com.atlasv.SpeedTestLite",
        "app_platform": "AppStore",
        "iss": "atlasv.speedtestlite",
        "entitlement_id": "premium",
        "offering_id": "annual"
      },
      {
        "product_id": "Premium_lifetime_20200821",
        "app_package_name": "com.atlasv.SpeedTestLite",
        "app_platform": "AppStore",
        "iss": "atlasv.speedtestlite",
        "entitlement_id": "premium",
        "offering_id": "lifetime"
      }
    ]
  };

  $done({
    status: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
})();