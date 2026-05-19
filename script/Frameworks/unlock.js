/*
Unlock Framework v3
QX / Surge / Loon

用法: 修改 UNLOCK_CONFIG 后部署

[rewrite_local]
^https?:\/\/api\.app\.com\/(vip|user|subscription) url script-response-body unlock.js
[mitm]
hostname = api.app.com

免责声明: 仅供学习研究，下载后24h内删除。
*/

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
              __typename: 'AppStoreSubscription',
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
      if (o.data) {
        o.data.remaining = 99999;
        o.data.quota = 99999;
      }
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
];

// 常用: 扫描全能王→vip_type=svip, Notability→/global替换, Foodie→vip=1

(function() {
  const url = $request ? $request.url : '';
  console.log(`[Unlock] ${url}`);

  const hit = UNLOCK_CONFIG.find(c => url.indexOf(c.url) !== -1);
  if (!hit) { $done({}); return; }

  try {
    const obj = JSON.parse($response.body);
    $done({ body: JSON.stringify(hit.handler(obj)) });
    console.log(`[Unlock] ${hit.url}`);
  } catch (e) {
    console.log(`[Unlock] ${e.message}`);
    $done({});
  }
})();
