/**
 * 🐣 ClearMark 抖音去水印脚本 v2
 * 
 * 基于 Douyin API 2026 实测:
 *   - video.has_watermark → false (禁用水印标记)
 *   - download_addr.url_list[0]: watermark=1 → watermark=0
 *   - play_addr.url_list[*]: 已无 playwm, 改为 CDN URL + watermark 参数
 *   - 解锁下载限制
 * 
 * 适用: Quantumult X / Surge / Loon
 * 
 * @author 宝宝
 * @version 2.0
 * @repo https://github.com/7452323/QuantumultX
 */

// ===== 环境初始化 =====
const $ = new Env('ClearMark-抖音');
const url = $request.url;

let rsp_body = $response.body;
if (!rsp_body) { $done({}); }

try {
  let obj = JSON.parse(rsp_body);
  let modified = false;

  // ===== 1. 遍历 JSON, 替换 watermark=1 → watermark=0 =====
  modified = replaceWatermarkParam(obj) || modified;

  // ===== 2. 设置 has_watermark = false =====
  modified = disableWatermarkFlag(obj) || modified;

  // ===== 3. 遍历 JSON, 替换 logo_name= 相关水印参数 =====
  modified = removeLogoParam(obj) || modified;

  // ===== 4. 解锁下载限制 =====
  modified = unlockDownload(obj) || modified;

  if (modified) {
    $done({ body: JSON.stringify(obj) });
  } else {
    $done({ body: rsp_body });
  }
} catch (e) {
  console.log('❌ ClearMark 解析错误: ' + e.message);
  $done({ body: rsp_body });
}

// ===== 工具函数 =====

/**
 * 递归替换 watermark=1 → watermark=0
 * 这是抖音去水印的核心方法 (2026 新版 API)
 */
function replaceWatermarkParam(obj) {
  let changed = false;
  const walk = (o) => {
    if (!o) return;
    if (typeof o === 'string') {
      if (o.includes('watermark=1') || o.includes('logo_name=')) {
        // 不作为顶层处理, 继续
      }
      return;
    }
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) {
        const v = o[i];
        if (typeof v === 'string') {
          if (v.includes('watermark=1')) {
            o[i] = v.replace(/watermark=1/g, 'watermark=0');
            changed = true;
          }
          if (v.includes('logo_name=')) {
            // 移除 logo_name 参数
            o[i] = v.replace(/&logo_name=[^&]+/g, '');
            changed = true;
          }
        } else if (typeof v === 'object') {
          walk(v);
        }
      }
    } else {
      for (const key of Object.keys(o)) {
        const val = o[key];
        if (typeof val === 'string') {
          if (val.includes('watermark=1')) {
            o[key] = val.replace(/watermark=1/g, 'watermark=0');
            changed = true;
          }
          if (val.includes('logo_name=')) {
            o[key] = val.replace(/&logo_name=[^&]+/g, '');
            changed = true;
          }
        } else if (typeof val === 'object') {
          walk(val);
        }
      }
    }
  };
  walk(obj);
  return changed;
}

/**
 * 递归设置 has_watermark = false
 * 同时禁用 related watermark 标记
 */
function disableWatermarkFlag(obj) {
  let changed = false;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      o.forEach(v => walk(v));
    } else {
      for (const key of Object.keys(o)) {
        const val = o[key];
        if (key === 'has_watermark' && val === true) {
          o[key] = false;
          changed = true;
        } else if (key === 'watermark' && val === true) {
          o[key] = false;
          changed = true;
        } else if (typeof val === 'object') {
          walk(val);
        }
      }
    }
  };
  walk(obj);
  return changed;
}

/**
 * 移除 download_addr 中的 logo_name 水印参数
 */
function removeLogoParam(obj) {
  let changed = false;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      o.forEach(v => walk(v));
    } else {
      for (const key of Object.keys(o)) {
        const val = o[key];
        if ((key === 'download_addr' || key === 'play_addr' || key === 'play_addr_265' || key === 'play_addr_h264') && typeof val === 'object') {
          const urlList = val.url_list;
          if (Array.isArray(urlList)) {
            for (let i = 0; i < urlList.length; i++) {
              if (typeof urlList[i] === 'string' && urlList[i].includes('logo_name=')) {
                urlList[i] = urlList[i].replace(/&logo_name=[^&]+/g, '');
                changed = true;
              }
              if (typeof urlList[i] === 'string' && urlList[i].includes('watermark=1')) {
                urlList[i] = urlList[i].replace(/watermark=1/g, 'watermark=0');
                changed = true;
              }
            }
          }
        }
        if (typeof val === 'object') {
          walk(val);
        }
      }
    }
  };
  walk(obj);
  return changed;
}

/**
 * 解锁下载限制
 */
function unlockDownload(obj) {
  let changed = false;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      o.forEach(v => walk(v));
    } else {
      for (const key of Object.keys(o)) {
        const val = o[key];
        // 下载状态相关
        if (key === 'download_status' && val === -1) {
          o[key] = 0; changed = true;
        }
        if (key === 'prevent_download' && val !== false) {
          o[key] = false; changed = true;
        }
        if (key === 'forbid_save' && val !== false) {
          o[key] = false; changed = true;
        }
        // 图片下载
        if (key === 'disable_download' && val !== false) {
          o[key] = false; changed = true;
        }
        // 继续递归
        if (typeof val === 'object') {
          walk(val);
        }
      }
    }
  };
  walk(obj);
  return changed;
}

// ===== Env 兼容层 =====
function Env(name) {
  this.name = name;
  this.log = (msg) => console.log(`[${this.name}] ${msg}`);
  console.log = this.log;

  this.log('🐣 ClearMark v2 抖音去水印已加载');
  this.log('📡 ' + $request.url.substring(0, 80));
}
