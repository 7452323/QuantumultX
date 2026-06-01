/**
 * 🐣 布丁扫描自动签到 - 每日+5MB 云空间
 * 
 * 功能: 自动调用 cloud_storage/get_donate_record 检查状态 + coupon/create 签到
 * 奖励: everyday_login_donate_size = 5242880 (5MB)
 * 
 * 安装:
 *   [rewrite_local]
 *   ^https?:\/\/www\.budingscan\.com\/server\/coupon\/create url script-request-body buding_checkin.js
 *   
 *   [task_local]
 *   30 9 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/buding_checkin.js, tag=布丁签到, enabled=true
 *   
 *   [mitm]
 *   hostname = www.budingscan.com
 * 
 * 使用:
 *   1. 启用 rewrite + mitm
 *   2. 打开布丁扫描 App → 自动抓取请求 headers
 *   3. 设置定时签到（建议每天9:30）
 * 
 * @repo https://github.com/7452323/QuantumultX
 */

const STORAGE_KEY = 'buding_headers';
const SUB_KEY = '###BUDING###';

// ── 入口 ──
!(async () => {
  if (typeof $request !== 'undefined') {
    await captureHeaders();
  } else {
    await doCheckin();
  }
})().catch(e => { console.log(e); $notify('布丁签到', '❌ 异常', e.message || e); })
  .finally(() => typeof $request !== 'undefined' ? $done() : $done());

// ═══════════════════════════════════
//  抓取 headers（rewrite 模式）
// ═══════════════════════════════════
async function captureHeaders() {
  if ($request.method === 'OPTIONS') return;

  const headers = {};

  // QX 的 headers 都是小写，转成标准格式
  const rawHeaders = $request.headers || {};

  // 提取关键头部
  const keyHeaders = [
    'x-ai-gateway-signature', 'x-ai-gateway-app-id',
    'x-ai-gateway-timestamp', 'x-ai-gateway-signed-headers',
    'x-ai-gateway-nonce', 'x-device-id',
    'x-vaid', 'x-channel', 'x-nation',
    'x-package-name', 'x-uid', 'x-phone-name',
    'x-phone-id', 'x-phone-os', 'x-ver', 'x-brand',
    'host', 'user-agent', 'accept', 'accept-language',
    'content-type', 'connection', 'accept-encoding'
  ];

  for (const k of keyHeaders) {
    if (rawHeaders[k]) {
      // 恢复大写格式
      const formatted = k.replace(/(^|-)(\w)/g, (_, a, b) => a + b.toUpperCase());
      headers[formatted] = rawHeaders[k];
    }
  }

  const uid = headers['X-Uid'] || '';
  const phoneId = headers['X-Phone-Id'] || '';

  // 从 body 提取 phone_id
  let phone_id = '';
  if ($request.body) {
    const m = $request.body.match(/request_id=([a-f0-9]+)/);
    if (m) phone_id = m[1];
  }
  if (!phone_id && phoneId) {
    phone_id = phoneId.replace(/-/g, '').toLowerCase();
  }

  if (!uid && !phoneId) {
    console.log('❌ 未找到关键标识，跳过');
    return;
  }

  // 去重 + 存储
  let raw = $prefs.valueForKey(STORAGE_KEY) || '';
  let list = raw ? raw.split(SUB_KEY).filter(Boolean) : [];

  const dedupKey = uid || phone_id;
  list = list.filter(item => {
    try {
      const h = JSON.parse(item);
      return h['X-Uid'] !== dedupKey && h['X-Phone-Id'] !== dedupKey;
    } catch { return false; }
  });

  const entry = JSON.stringify({ headers, phone_id, uid: dedupKey });
  list.push(entry);
  $prefs.setValueForKey(list.join(SUB_KEY), STORAGE_KEY);

  $notify('布丁签到', `✅ 抓取成功 (${list.length} 个账号)`,
    `${uid.slice(0, 16)}... | phone_id: ${phone_id.slice(0, 10)}...`);
}

// ═══════════════════════════════════
//  执行签到（task 模式）
// ═══════════════════════════════════
async function doCheckin() {
  const raw = $prefs.valueForKey(STORAGE_KEY);
  if (!raw) {
    $notify('布丁签到', '❌ 未抓到数据', '先打开布丁扫描 App 获取 headers');
    return;
  }

  const list = raw.split(SUB_KEY).filter(Boolean);
  let success = 0, failed = 0;
  const results = [];

  for (let i = 0; i < list.length; i++) {
    try {
      const entry = JSON.parse(list[i]);
      const headers = entry.headers || {};
      const phone_id = entry.phone_id || '';

      console.log(`📱 账号${i + 1} 开始签到...`);

      // 检查签到状态
      const ts = Math.floor(Date.now() / 1000);
      const donateUrl =
        `https://www.budingscan.com/cloud_storage/get_donate_record?phone_id=${phone_id}&request_id=${phone_id}-${ts}&request_time=${ts}&rtype=0`;

      const donateResp = await httpGet(donateUrl, headers);
      const donateData = tryJson(donateResp);

      if (donateData && donateData.data && donateData.data.daily_status === 1) {
        console.log(`✅ 账号${i + 1}: 今日已签到`);
        results.push(`账号${i + 1}: ✅ 今日已签到`);
        success++;
        continue;
      }

      // 获取配置（确认奖励大小）
      const configResp = await httpPost(
        'https://www.budingscan.com/server/get_dynamic_config',
        '', headers
      );
      const configData = tryJson(configResp);
      const dailySize = (configData && configData.result &&
        configData.result.everyday_login_donate_size)
        ? (parseInt(configData.result.everyday_login_donate_size) / 1024 / 1024)
        : 5;

      // 执行签到
      const ts2 = Math.floor(Date.now() / 1000);
      const body = `request_id=${phone_id}-${ts2}&request_time=${ts2}`;

      const resp = await httpPost(
        'https://www.budingscan.com/server/coupon/create',
        body, headers
      );
      const data = tryJson(resp);

      if (data && data.code === 0) {
        console.log(`✅ 账号${i + 1}: 签到成功 +${dailySize}MB`);
        results.push(`账号${i + 1}: ✅ +${dailySize}MB`);
        success++;
      } else {
        const msg = (data && data.msg) || '签到失败';
        console.log(`❌ 账号${i + 1}: ${msg}`);
        results.push(`账号${i + 1}: ❌ ${msg}`);
        failed++;
      }
    } catch (e) {
      console.log(`❌ 账号${i + 1}: ${e.message}`);
      results.push(`账号${i + 1}: ❌ ${e.message}`);
      failed++;
    }

    if (i < list.length - 1) await sleep(2000);
  }

  $notify('布丁签到', `成功 ${success} / 失败 ${failed}`,
    results.slice(0, 5).join('\n'));
}

// ═══════════════════════════════════
//  工具函数
// ═══════════════════════════════════

function tryJson(resp) {
  try { return JSON.parse(resp); } catch { return null; }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function httpGet(url, headers) {
  return new Promise((resolve, reject) => {
    $task.fetch({ url, headers, method: 'GET' })
      .then(r => resolve(r.body), e => reject(e));
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers, method: 'POST' };
    if (body) opts.body = body;
    $task.fetch(opts)
      .then(r => resolve(r.body), e => reject(e));
  });
}
