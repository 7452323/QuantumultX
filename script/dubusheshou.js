// 读不舍手 — 完整解锁脚本
// QX 配置用法（示例）:
// [MITM]
// hostname = api.rc-backup.com, api.revenuecat.com, %APPEND% 其他广告域名
//
// [rewrite_remote]
// https://raw.githubusercontent.com/.../dubusheshou.conf, tag=读不舍手, enabled=true

// ============ 阶段1: 请求拦截 — 剥离RC缓存头 ============
// 让 RC 每次返回完整 200（不走 304 缓存）
if (typeof $request !== 'undefined' && $request.headers) {
  const url = $request.url;
  if (/api\.(?:rc-backup|revenuecat)\.com\/v1\/(?:subscribers|offerings)/.test(url)) {
    // 剥离缓存相关头
    delete $request.headers['If-None-Match'];
    delete $request.headers['if-none-match'];
    delete $request.headers['X-RevenueCat-ETag'];
    // 改最后刷新时间为0，强制服务端返回完整数据
    $request.headers['X-RC-Last-Refresh-Time'] = '0';
    $done($request);
    return;
  }
  $done($request);
  return;
}

// ============ 阶段2: 响应修改 ============
if (typeof $response !== 'undefined' && $response.body) {
  const url = $request.url;
  
  // RevenueCat subscriber — 解锁
  if (/api\.(?:rc-backup|revenuecat)\.com\/v1\/subscribers/.test(url)) {
    try {
      let body = JSON.parse($response.body);
      if (body.subscriber) {
        // 开所有 entitlements
        const ents = body.subscriber.entitlements || {};
        for (const key of Object.keys(ents)) {
          ents[key].expires_date = '2099-12-31T23:59:59Z';
          ents[key].purchase_date = '2026-06-18T00:00:00Z';
          ents[key].will_renew = true;
          ents[key].is_sandbox = false;
        }
        body.subscriber.entitlements = ents;
        
        // 开所有 subscriptions
        const subs = body.subscriber.subscriptions || {};
        for (const key of Object.keys(subs)) {
          subs[key].expires_date = '2099-12-31T23:59:59Z';
          subs[key].period_type = 'active';
          subs[key].is_sandbox = false;
          subs[key].unsubscribe_detected_at = null;
        }
        body.subscriber.subscriptions = subs;
        
        // 改 non_subscriptions 也全开
        const nonSubs = body.subscriber.non_subscriptions || {};
        for (const productKey of Object.keys(nonSubs)) {
          const purchases = nonSubs[productKey] || [];
          for (const purchase of purchases) {
            purchase.expires_date = '2099-12-31T23:59:59Z';
            purchase.purchase_date = '2026-06-18T00:00:00Z';
            purchase.is_sandbox = false;
          }
        }
        body.subscriber.non_subscriptions = nonSubs;
        
        // 额外管理字段
        body.subscriber.entitlements_by_product_ids = {};
        body.subscriber.management_url = null;
        
        $done({ body: JSON.stringify(body) });
        return;
      }
    } catch (_) {}
  }
  
  // RevenueCat offerings — 不改，透传
  if (/api\.(?:rc-backup|revenuecat)\.com\/v1\/offerings/.test(url)) {
    $done({ body: $response.body });
    return;
  }
}

// 默认透传
$done({});
