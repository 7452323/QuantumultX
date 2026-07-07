/* 
布丁扫描 解锁VIP + 去广告 + 无限次数

[rewrite_local]
^https:\/\/www\.budingscan\.com\/server\/(get_user_config|payment\/(paid_modules|paid_module_used|paid_module_usage|plans|questions)|get_dynamic_config) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js
^https:\/\/www\.budingscan\.com\/server\/backend\/dashboardBanner\/ online_banners url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Bdsm.js

[mitm]
hostname = www.budingscan.com
*/

const url = $request.url;
let body = $response.body;

try {
  const obj = JSON.parse(body);

  if (url.includes('/get_user_config')) {
    obj.result = {
      ...obj.result,
      user_type: 3,
      subscribe_pay_type: 0,
      renewal_status: 0,
      subscribe_plan_validity: 36500,
      subscribe_plan_name: '终身会员',
      end_time: '2099-12-31',
      total_storage: 999999999,
      vip_storage: 999999999,
      used_storage: 0,
      oral: 1
    };

  } else if (url.includes('/payment/paid_modules')) {
    if (Array.isArray(obj.result)) {
      obj.result = obj.result.map(m => ({
        ...m,
        usage_limit: -1,
        vip_usage_limit: -1
      }));
    }

  } else if (url.includes('/payment/paid_module_used')) {
    obj.code = 0;
    obj.msg = 'ok';
    delete obj.result;

  } else if (url.includes('/payment/paid_module_usage')) {
    // pass

  } else if (url.includes('/payment/plans')) {
    if (Array.isArray(obj.result)) {
      obj.result = obj.result.filter(p => p.plan_renewal_status !== 1);
    }

  } else if (url.includes('/payment/questions')) {
    if (Array.isArray(obj.result)) {
      obj.result = obj.result.filter(q => q.plan_renewal_status !== 1);
    }

  } else if (url.includes('/dashboardBanner/')) {
    obj.result = { banners: [] };

  } else if (url.includes('/get_dynamic_config')) {
    // pass
  }

  body = JSON.stringify(obj);

} catch (e) {
  console.log('Bdsm.js error: ' + e);
}

$done({ body });
