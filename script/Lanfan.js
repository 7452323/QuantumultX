/* ═══════════════════════════════════════════════════════
   懒饭 PRO — 会员解锁 + 高清视频 + 去广告
   v2.0

   [rewrite_local]
   ^https?:\/\/lanfanapp\.com\/api\/v1\/(user\/prime|prime\/promotion_banner|recipe\/page_detail|homepage\/feed|story\/get_v2|plan\/(paged|get_quiz|group\/get_all)) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Lanfan.js

   [URL-rewrite]
   ^https?:\/\/video5?\.chuimg\.com\/.+\/v\.0_10000\. /307 v.

   [mitm]
   hostname = lanfanapp.com, *.chuimg.com
   ═══════════════════════════════════════════════════════ */

let body = $response.body;
if (!body) { $done({}); }

try {
  const obj = JSON.parse(body);

  // ── 用户会员状态 ─────────────────────────────────
  const user = obj?.content?.user;
  if (user) {
    user.is_prime = true;
    user.user_homepage_prime_banner = { button_text: '', text: '' };
    if (user.prime) {
      user.prime.is_prime = true;
      user.prime.expires_time = '2099-12-31 23:59:59';
    }
  }

  // ── 递归解锁所有层级 ───────────────────────────
  function unlock(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const k in obj) {
      const v = obj[k];
      if (k === 'is_prime') obj[k] = true;
      else if (k === 'unlocked') obj[k] = true;
      else if (k === 'watch_type') obj[k] = 1;
      else if (k === 'watermark') obj[k] = false;
      else if (k === 'tips' && typeof v === 'string' && v.includes('会员')) obj[k] = '';
      if (typeof v === 'object') unlock(v);
    }
  }
  unlock(obj);

  // ── 去推广 ──────────────────────────────────────
  if (obj?.content?.prime_promotion_banner) {
    obj.content.prime_promotion_banner = null;
  }

  body = JSON.stringify(obj);

} catch (_) {}

$done({ body });
