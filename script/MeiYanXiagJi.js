/*
 * @name 美颜相机
 * @description 美颜相机 - 解锁会员(紫钻VIP)
 * @author 7452323
 *
[rewrite_local]
^https?:\/\/api\.account\.meitu\.com\/ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/MeiYanXiagJi.js
^https?:\/\/vesdk\.meitu\.com\/subscribe\/(func_limit_batch_query|func_list) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/MeiYanXiagJi.js
^https?:\/\/(api\.meiyan\.com|api-tool-meiyan\.meituyun\.com)\/vip\/(user_info|user_center|user_subscription_info|center_module) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/MeiYanXiagJi.js

[mitm]
hostname = api.account.meitu.com, account.meitu.com, vesdk.meitu.com, api.meiyan.com, api-tool-meiyan.meituyun.com
*/

const url = $request.url;
if (!$response.body) $done({});

let body = JSON.parse($response.body);

/* 账号会员枚举: 0未知 1会员 2已过期 3非会员 */
const VIP = 1;

/* 递归改所有应用级会员位: meiyan_vip / xiuxiu_vip / ..._vip */
function fix(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) {
    o.forEach(fix);
    return;
  }
  Object.keys(o).forEach(function (k) {
    let v = o[k];
    if (/^[a-z0-9_]+_vip$/i.test(k) && typeof v === "number") {
      o[k] = VIP;
      return;
    }
    if (k === "vip" && v && typeof v === "object" && !Array.isArray(v)) {
      Object.keys(v).forEach(function (k2) {
        if (/^[a-z0-9_]+_vip$/i.test(k2) && typeof v[k2] === "number") v[k2] = VIP;
      });
      if (Array.isArray(v.list)) {
        v.list.forEach(function (it) {
          if (it && it.status !== undefined) it.status = 1;
        });
      }
      fix(v);
      return;
    }
    fix(v);
  });
}

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

/* 账号接口: 登录/初始化/用户信息 全量改会员位 */
if (url.indexOf("account.meitu.com") != -1) {
  fix(body);
}

/* vesdk 功能限额: 全放开 */
if (url.indexOf("func_limit_batch_query") != -1) {
  (body.response.items || []).forEach(function (i) {
    i.limit_flag = 0;
    i.limit_type = 0;
    i.preview_flag = 0;
    i.total_num = -1;
    i.free_num = -1;
    i.use_num = 0;
    i.total_limit_num = 0;
    i.total_use_num = 0;
    i.motivate_num = 999999;
    i.motivate_total_num = 999999;
    i.motivate_use_num = 0;
    i.can_share = 1;
    i.share_limit_left_num = 999999;
    i.media_limit_left_num = 999999;
    i.media_limit_used_num = 0;
    delete i.subscribe_banner;
  });
}

/* vesdk 功能列表: 全按会员功能标记 */
if (url.indexOf("func_list") != -1) {
  (body.response || []).forEach(function (i) {
    i.function_mode = 1;
  });
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
