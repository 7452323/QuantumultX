/*
 * Unlock Framework v4
 * 整合了多段URL匹配 + 聚合响应体修改 + Reven 中转架构支持
 * 支持: QX / Surge / Loon / Stash
 * 
 * ===== 三种工作模式 =====
 * 模式A: 本地 handler — 直接在本脚本内修改响应体
 * 模式B: 中转 Worker — 类似 Yu9191 Reven 架构，把请求转发到 CF Worker
 * 模式C: 复合 — 先尝试本地修改，失败则 fallback 到中转
 *
 * ===== 配置示例 =====
 * [rewrite_local]
 * ^https?:\/\/api\.app\.com\/(vip|user|subscription) url script-response-body unlock.js
 * [mitm]
 * hostname = api.app.com
 *
 * ===== 免责声明 =====
 * 仅供学习研究，请于下载后24小时内删除。
 */
(function() {
  // ===================== 配置区 =====================
  // --- 模式A: 本地 handler ---
  const UNLOCK_CONFIG = [
    {
      url: '/user/vip',
      handler(o) {
        if (o.data) {
          o.data.vip = 1;
          o.data.vip_type = 'svip';
          o.data.expireTime = '4092599349000';
        }
        o.vip = 1;
        return o;
      }
    },
    {
      url: '/subscription',
      handler() {
        return {
          data: {
            processAppleReceipt: {
              __typename: 'SubscriptionResult',
              error: 0,
              subscription: {
                status: 'active',
                expirationDate: '9999-12-31T23:59:59.000Z',
                productId: 'com.example.premium',
                tier: 'premium',
                refundedDate: null,
              }
            }
          }
        };
      }
    },
    {
      url: '/usage',
      handler(o) {
        if (o.data) { o.data.remaining = 99999; o.data.quota = 99999; }
        return o;
      }
    },
    {
      url: '/feature',
      handler(o) {
        if (Array.isArray(o.data)) {
          o.data.forEach(item => { item.unlocked = true; item.locked = false; });
        }
        return o;
      }
    },
    {
      url: '/receipt',
      handler() {
        return {
          environment: 'Production',
          status: 0,
          latest_receipt_info: [{
            expires_date_ms: '4092599349000',
            is_trial_period: false,
            product_id: 'com.example.pro.yearly',
            purchase_date_ms: '1700000000000',
            original_purchase_date_ms: '1700000000000',
          }],
          latest_receipt: '',
          pending_renewal_info: [{
            auto_renew_status: '1',
            product_id: 'com.example.pro.yearly',
          }]
        };
      }
    },
  ];

  // --- 模式B: 中转 Worker 配置 ---
  const WORKER_ENABLED = false;     // 设为 true 启用中转
  const WORKER_URL = '';            // 'https://your-worker.workers.dev/path'
  const WORKER_TIMEOUT = 10000;     // 10s

  // ===================== 主逻辑 =====================
  const url = $request ? $request.url : '';
  console.log(`[Unlock] ${url}`);

  // 模式B: 中转 Worker
  if (WORKER_ENABLED && WORKER_URL && typeof $task !== 'undefined') {
    const opts = {
      url: `${WORKER_URL}?url=${encodeURIComponent(url)}`,
      method: $request.method || 'POST',
      headers: $request.headers || {},
      body: $response.body || $request.body || '',
      timeout: WORKER_TIMEOUT
    };
    delete opts.headers['Host'];
    delete opts.headers['host'];
    
    $task.fetch(opts).then(
      resp => { $done({ body: resp.body }); },
      () => { fallbackLocal(); }
    );
    return;
  }

  // 模式A: 本地 handler
  fallbackLocal();

  function fallbackLocal() {
    const hit = UNLOCK_CONFIG.find(c => url.indexOf(c.url) !== -1);
    if (!hit || !$response) { $done({}); return; }

    try {
      const obj = JSON.parse($response.body);
      $done({ body: JSON.stringify(hit.handler(obj)) });
      console.log(`[Unlock] ✓ ${hit.url}`);
    } catch (e) {
      console.log(`[Unlock] ✗ ${e.message}`);
      $done({});
    }
  }
})();
