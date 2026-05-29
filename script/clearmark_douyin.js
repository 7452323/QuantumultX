/**
 * 🐣 ClearMark 抖音去水印脚本 v2
 * 
 * 原理(2026新版API实测):
 *   1. watermark=1 → watermark=0 (URL参数)
 *   2. has_watermark: true → false
 *   3. 移除 logo_name 参数
 * 
 * 适用: Quantumult X (script-response-body)
 * 
 * @repo https://github.com/7452323/QuantumultX
 */

try {
  // ===== 读取响应体 =====
  let body = $response.body;
  if (!body) { $done({}); return; }

  // ===== 解析 JSON =====
  let obj = JSON.parse(body);
  let raw = JSON.stringify(obj);
  let modified = raw;

  // ===== 1. watermark=1 → watermark=0 =====
  if (modified.indexOf('watermark=1') !== -1) {
    modified = modified.replace(/watermark=1/g, 'watermark=0');
    console.log('✅ watermark=1 → 0');
  }

  // ===== 2. has_watermark: true → false =====
  if (modified.indexOf('"has_watermark":true') !== -1) {
    modified = modified.replace(/"has_watermark":true/g, '"has_watermark":false');
    console.log('✅ has_watermark: true → false');
  } else if (modified.indexOf('"has_watermark": true') !== -1) {
    modified = modified.replace(/"has_watermark": true/g, '"has_watermark": false');
    console.log('✅ has_watermark: true → false');
  }

  // ===== 3. 移除 logo_name 水印参数 =====
  if (modified.indexOf('logo_name=') !== -1) {
    modified = modified.replace(/&logo_name=[^&"]+/g, '');
    console.log('✅ logo_name removed');
  }

  // ===== 4. 解锁下载限制 =====
  if (modified.indexOf('"has_watermark": true') !== -1) {
    modified = modified.replace(/"has_watermark": true/g, '"has_watermark": false');
  }
  // download_status -1 → 0
  modified = modified.replace(/"download_status":-1/g, '"download_status":0');
  modified = modified.replace(/"prevent_download":true/g, '"prevent_download":false');

  // ===== 如果修改了, 返回新响应体 =====
  if (modified !== raw) {
    $done({ body: modified });
  } else {
    $done({});
  }

} catch (e) {
  console.log('❌ ClearMark 抖音错误: ' + (e.message || e));
  $done({});
}
