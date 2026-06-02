/* 
布丁扫描 解锁VIP

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

  // ── 1. VIP 身份注入 ────────────────────────────
  //   user_type=3=终身, renewal_status=0=不续费
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

  // ── 2. 付费模块全无限 ──────────────────────────
  //    module=1 文档扫描, 2 文字提取, 7 照片翻译,
  //    5 口算, 6 试卷, 8 修复, 14 擦除, 17 AI面试等
  } else if (url.includes('/payment/paid_modules')) {
    if (Array.isArray(obj.result)) {
      obj.result = obj.result.map(m => ({
        ...m,
        usage_limit: -1,
        vip_usage_limit: -1
      }));
    }

  // ── 3. 次数扣减 → 直接返回成功 ─────────────────
  //    服务器校验: POST {encrypt_text:"..."}
  //    返回 加密结果 = 已扣减 → 只返回成功无副作用
  } else if (url.includes('/payment/paid_module_used')) {
    obj.code = 0;
    obj.msg = 'ok';
    delete obj.result;

  // ── 4. 次数查询原样保留 ────────────────────────
  //    加密响应，不改动
  } else if (url.includes('/payment/paid_module_usage')) {
    // pass through

  // ── 5. 只保留终身会员计划 ──────────────────────
  } else if (url.includes('/payment/plans')) {
    if (Array.isArray(obj.result)) {
      obj.result = obj.result.filter(p => p.plan_renewal_status !== 1);
    }

  // ── 6. 去 Banner 广告 ─────────────────────────
  } else if (url.includes('/dashboardBanner/')) {
    obj.result = { banners: [] };

  // ── 7. 动态配置 ───────────────────────────────
  //    默认全返回，不做改动
  } else if (url.includes('/get_dynamic_config')) {
    // pass through
  }

  body = JSON.stringify(obj);

} catch (e) {
  console.log('Bdsm.js error: ' + e);
}

$done({ body });
