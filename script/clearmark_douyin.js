/**
 * 🐣 ClearMark 抖音去水印脚本 v3
 * 
 * 原理:
 *   - play_addr.url_list[0] → CDN 原生无水印视频
 *   - download_addr.url_list[0] → 带 watermark=1 的水印版
 *   - App 保存视频用 download_addr, 所以替换为 play_addr 的 CDN URL
 * 
 * @repo https://github.com/7452323/QuantumultX
 */

try {
  let body = $response.body;
  if (!body) { $done({}); return; }

  let obj = JSON.parse(body);
  let modified = false;

  // ===== JSON 树遍历, 处理每个 video 对象 =====
  function processVideo(video) {
    if (!video || typeof video !== 'object') return false;
    let changed = false;

    // 1. 去水印标记
    if (video.has_watermark === true) {
      video.has_watermark = false;
      changed = true;
    }

    // 2. 下载限制解锁
    if (video.download_status === -1) {
      video.download_status = 0;
      changed = true;
    }
    if (video.prevent_download === true) {
      video.prevent_download = false;
      changed = true;
    }
    if (video.forbid_save === true) {
      video.forbid_save = false;
      changed = true;
    }

    // 3. ★ 核心: 把 download_addr 的 URL 换成 play_addr 的 CDN URL
    const playUrls = video.play_addr?.url_list;
    const downloadUrls = video.download_addr?.url_list;
    if (playUrls && playUrls.length > 0 && downloadUrls && downloadUrls.length > 0) {
      const cdnUrl = playUrls[0];  // CDN URL (无水印)
      const oldUrl = downloadUrls[0];
      if (oldUrl !== cdnUrl) {
        if (oldUrl.indexOf('watermark=1') !== -1 || oldUrl.indexOf('logo_name=') !== -1) {
          // 把 download_addr 直接换成 play_addr
          video.download_addr = JSON.parse(JSON.stringify(video.play_addr));
          changed = true;
          console.log('✅ download_addr 替换为 CDN URL');
        }
      }
    }

    // 4. 替换任意 URL 字符串中的 watermark=1 → 0
    const walk = (o) => {
      if (!o || typeof o === 'string') return;
      if (Array.isArray(o)) {
        for (let i = 0; i < o.length; i++) {
          if (typeof o[i] === 'string' && o[i].indexOf('watermark=1') !== -1) {
            o[i] = o[i].replace(/watermark=1/g, 'watermark=0');
            changed = true;
          }
          if (typeof o[i] === 'string' && o[i].indexOf('logo_name=') !== -1) {
            o[i] = o[i].replace(/&logo_name=[^&]+/g, '');
            changed = true;
          }
          if (typeof o[i] === 'object') walk(o[i]);
        }
      } else {
        for (const key of Object.keys(o)) {
          const v = o[key];
          if (typeof v === 'string') {
            if (v.indexOf('watermark=1') !== -1) {
              o[key] = v.replace(/watermark=1/g, 'watermark=0');
              changed = true;
            }
            if (v.indexOf('logo_name=') !== -1) {
              o[key] = v.replace(/&logo_name=[^&]+/g, '');
              changed = true;
            }
          } else if (typeof v === 'object') {
            walk(v);
          }
        }
      }
    };
    walk(video);

    return changed;
  }

  // ===== 遍历对象查找 video 对象 =====
  function traverse(obj) {
    if (!obj || typeof obj !== 'object') return false;
    let changed = false;

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (traverse(item)) changed = true;
      }
    } else {
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (key === 'video') {
          if (processVideo(val)) changed = true;
        } else if (typeof val === 'object') {
          if (traverse(val)) changed = true;
        }
      }
    }
    return changed;
  }

  modified = traverse(obj);

  if (modified) {
    $done({ body: JSON.stringify(obj) });
    console.log('✅ ClearMark v3 抖音去水印生效');
  } else {
    console.log('⏭️ 无需修改');
    $done({});
  }

} catch (e) {
  console.log('❌ ClearMark 抖音错误: ' + (e.message || e));
  $done({});
}
