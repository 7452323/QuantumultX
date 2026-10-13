/*
 * @name 美颜相机
 * @description 美颜相机 - 解锁会员(紫钻VIP)
 * @author 7452323
 *
[rewrite_local]
^https?:\/\/(api\.meiyan\.com|api-tool-meiyan\.meituyun\.com)\/vip\/(user_info|user_center|user_subscription_info|center_module) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/MeiYanXiagJi.js

[mitm]
hostname = api.meiyan.com, api-tool-meiyan.meituyun.com, api-user-meiyan.meituyun.com
*/

const url = $request.url;
if (!$response.body) $done({});

let body = JSON.parse($response.body);

/* 会员字段, 兼容新旧版本 */
function vip(o) {
  o.status = 1;
  o.type = 2;
  o.product_type = 1;
  o.ad_vip_type = 3;
  o.period_type = 11;
  o.discount_status = 0;
  o.agreement_status = 1;
  o.expire_time = "2099-09-09 09:09:09";
  o.expire_date = "2099-09-09";
  o.valid_time = 4092599349;
  o.in_valid_time = 4092599349;
  o.is_vip = true;
  o.is_expire = 0;
  o.vip_type = 101;
  return o;
}

if (url.indexOf("/vip/user_info") != -1) {
  vip(body.response || body);
}

if (url.indexOf("/vip/user_center") != -1) {
  if (!body.response) body.response = {};
  body.response.user_info = vip(body.response.user_info || {});
}

if (url.indexOf("/vip/user_subscription_info") != -1) {
  if (!body.response) body.response = {};
  body.response.is_trial = false;
  body.response.is_expire = 0;
  body.response.period_type = 11;
}

$done({ body: JSON.stringify(body) });
