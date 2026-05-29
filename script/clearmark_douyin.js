/**
 * 🐣 ClearMark 抖音去水印脚本
 * 
 * 功能:
 *   1. 视频: playwm → play 无水印
 *   2. 下载: 解锁下载限制 (disable download lock)
 *   3. 图文: 最高画质
 *   4. 视频: 最高画质+最高帧率
 * 
 * 适用: Quantumult X / Surge / Loon
 * 配合: douyin_clearmark.snippet 使用
 * 
 * @author 宝宝
 * @version 1.0
 * @repo https://github.com/7452323/QuantumultX
 */

// ===== 环境初始化 =====
const $ = new Env('ClearMark-抖音');
let rsp_body = $response.body;
if (!rsp_body) { $done({}); }

try {
  let obj = JSON.parse(rsp_body);
  const url = $request.url;
  let modified = false;

  // ===== 通用: 遍历整个 JSON 树, 替换 playwm → play =====
  modified = replacePlayWm(obj) || modified;

  // ===== 通用: 遍历解锁下载 =====
  modified = unlockDownload(obj) || modified;

  // ===== 通用: 画质增强 =====
  modified = enhanceQuality(obj) || modified;

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
 * 递归遍历对象, 将所有 playwm 替换为 play
 * 这是抖音去水印的核心: playwm = 有水印, play = 无水印
 */
function replacePlayWm(obj) {
  let changed = false;
  const walk = (o) => {
    if (!o) return;
    if (typeof o === 'string') {
      // 不会走到这里, 由父层处理
      return;
    }
    if (Array.isArray(o)) {
      for (let i = 0; i < o.length; i++) {
        const v = o[i];
        if (typeof v === 'string' && v.includes('playwm')) {
          o[i] = v.replace(/playwm/g, 'play');
          changed = true;
        } else if (typeof v === 'object') {
          walk(v);
        }
      }
    } else {
      for (const key of Object.keys(o)) {
        const val = o[key];
        if (typeof val === 'string' && val.includes('playwm')) {
          o[key] = val.replace(/playwm/g, 'play');
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
 * 递归解锁下载限制
 * - download_status: 0=可下载
 * - prevent_download: false
 * - forbid_save: false
 * - disable_download: false
 * - watermark: 0(无水印)
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
        if (key === 'download_status' && val !== 0) {
          o[key] = 0;
          changed = true;
        } else if (key === 'prevent_download' && val !== false) {
          o[key] = false;
          changed = true;
        } else if (key === 'forbid_save' && val !== false) {
          o[key] = false;
          changed = true;
        } else if (key === 'disable_download' && val !== false) {
          o[key] = false;
          changed = true;
        } else if (key === 'watermark' && val !== 0 && val !== 'none') {
          if (typeof val === 'number') { o[key] = 0; changed = true; }
        } else if (key === 'download_mask' && val) {
          o[key] = 0;
          changed = true;
        } else if (key === 'allow_download' && val === false) {
          o[key] = true;
          changed = true;
        } else if (key === 'can_download' && val === false) {
          o[key] = true;
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
 * 画质增强:
 * - 视频: 最高分辨率(Bitrate最高的play_addr)
 * - 图片: 最高质量URL
 */
function enhanceQuality(obj) {
  let changed = false;
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (Array.isArray(o)) {
      o.forEach(v => walk(v));
    } else {
      for (const key of Object.keys(o)) {
        const val = o[key];
        
        // bit_rate 数组: 选最大分辨率
        if (key === 'bit_rate' && Array.isArray(val) && val.length > 1) {
          // 已经是playwm→play替换过的，选分辨率最大
          const sorted = [...val].sort((a, b) => {
            const aSize = (a.play_addr?.width || 0) * (a.play_addr?.height || 0);
            const bSize = (b.play_addr?.width || 0) * (b.play_addr?.height || 0);
            return bSize - aSize;
          });
          // 只保留最高质量的
          if (JSON.stringify(val) !== JSON.stringify(sorted)) {
            o[key] = sorted;
            changed = true;
          }
        }

        // images_list / images: 最高画质
        if ((key === 'images_list' || key === 'images') && Array.isArray(val)) {
          for (const img of val) {
            if (img.url_list && Array.isArray(img.url_list)) {
              // 抖音图片: url_list最后一个通常是最高画质
              if (img.url_list.length > 1) {
                const best = img.url_list[img.url_list.length - 1];
                // 把playwm替换过的图片URL提到第一位
                const wmFree = img.url_list.filter(u => !u.includes('playwm'));
                if (wmFree.length > 0 && wmFree[0] !== img.url_list[0]) {
                  img.url_list = wmFree;
                  changed = true;
                }
              }
            }
          }
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

// ===== Env 兼容层 (from fmz200) =====
function Env(name) {
  this.name = name;
  this.log = (msg) => console.log(`[${this.name}] ${msg}`);
  console.log = this.log;
  
  if (typeof $prefs !== 'undefined') {
    this.getdata = (key) => $prefs.valueForKey(key);
    this.setdata = (key, val) => $prefs.setValueForKey(key, val);
  } else if (typeof $persistentStore !== 'undefined') {
    this.getdata = (key) => $persistentStore.read(key);
    this.setdata = (key, val) => $persistentStore.write(key, val);
  } else {
    this.getdata = () => null;
    this.setdata = () => {};
  }

  this.log('🐣 ClearMark 抖音去水印已加载');
}
