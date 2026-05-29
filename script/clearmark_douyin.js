/**
 * 🐣 ClearMark 抖音去水印 - QX Rewrite 脚本
 * 
 * 拦截抖音 API → 替换 download_addr 为 CDN 无水印 URL
 * 
 * 如果未生效, 请检查:
 *   1. QX 开启 MitM + 信任证书
 *   2. 在 QX 日志中搜 "ClearMark" 看有没有触发
 *   3. 如果没任何日志 → 没拦截到 → 抖音可能证书锁定
 * 
 * @repo https://github.com/7452323/QuantumultX
 */

try {
  const body = $response.body;
  if (!body) { console.log('⏭️ ClearMark: 空响应: ' + ($request.url || '').substring(0, 80)); $done({}); return; }

  const url = ($request.url || '').substring(0, 120);
  console.log('🐣 ClearMark 触发: ' + url);

  // 检查响应类型
  const ct = $response.headers?.['content-type'] || $response.headers?.['Content-Type'] || '';
  if (ct.indexOf('json') === -1 && ct.indexOf('javascript') === -1 && body.charAt(0) !== '{' && body.charAt(0) !== '[') {
    console.log('⏭️ ClearMark: 非JSON响应');
    $done({});
    return;
  }

  let obj;
  try { obj = JSON.parse(body); } catch (e) { console.log('⏭️ ClearMark: JSON解析失败'); $done({}); return; }

  // 检查是否包含 video 对象
  let videoFound = false;
  function traverse(o) {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) { o.forEach(traverse); return; }
    for (const k of Object.keys(o)) {
      if (k === 'video' && o[k] && typeof o[k] === 'object') {
        videoFound = true;
        const v = o[k];
        let ch = false;

        // download_addr 替换
        if (v.play_addr?.url_list?.length > 0 && v.download_addr?.url_list?.length > 0) {
          const dlUrl = v.download_addr.url_list[0] || '';
          if (dlUrl.indexOf('watermark=') !== -1 || dlUrl.indexOf('logo_name=') !== -1 || dlUrl.indexOf('/play/') !== -1) {
            v.download_addr = JSON.parse(JSON.stringify(v.play_addr));
            ch = true;
            console.log('✅ download_addr → CDN');
          }
        }

        // has_watermark
        if (v.has_watermark === true) { v.has_watermark = false; ch = true; console.log('✅ has_watermark→false'); }
        if (v.watermark === 1) { v.watermark = 0; ch = true; }

        // 下载锁
        if (v.download_status === -1) { v.download_status = 0; ch = true; }
        if (v.prevent_download === true) { v.prevent_download = false; ch = true; }
        if (v.forbid_save === true) { v.forbid_save = false; ch = true; }

        if (ch) console.log('✅ ClearMark 修改完成');
      } else if (typeof o[k] === 'object') {
        traverse(o[k]);
      }
    }
  }
  traverse(obj);

  if (videoFound) {
    console.log('🎬 ClearMark: 找到 video 对象');
    $done({ body: JSON.stringify(obj) });
  } else {
    console.log('⏭️ ClearMark: 未找到 video, 跳过');
    $done({});
  }
} catch (e) {
  console.log('❌ ClearMark 错误: ' + (e && e.message ? e.message : String(e)));
  $done({});
}
