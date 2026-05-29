/**
 * 🐣 ClearMark 抖音去水印 - QX Task 模式 (100%可靠)
 * 
 * 原理: 调用远程 API 解析抖音链接 → 获取无水印 CDN URL
 * 不需要抓包/MitM，不需要证书
 * 
 * 安装: Quantumult X → 设置 → Task → 添加
 * 
 * 用法:
 *   手动: 复制抖音链接 → 运行此 Task → 通知显示无水印链接
 *   参数: url=https://v.douyin.com/xxx
 * 
 * @repo https://github.com/7452323/QuantumultX
 */

const API_BASE = 'https://160556.xyz/api';

async function main() {
  try {
    // 1. 获取抖音链接 (参数优先, 其次剪贴板)
    let url = '';
    if (typeof $argument !== 'undefined' && $argument) {
      try { 
        const args = JSON.parse($argument);
        url = args.url || '';
      } catch(e) { 
        url = $argument;
      }
    }
    
    if (!url && typeof $clipboard !== 'undefined') {
      url = $clipboard;
    }
    
    if (!url) {
      $notify('ClearMark 抖音', '❌ 缺少链接', '请先复制抖音链接，或在参数中传入 url=');
      return;
    }

    // 2. 提取链接中的有效 URL
    const urlMatch = url.match(/https?:\/\/v\.douyin\.com\/\S+/);
    if (!urlMatch) {
      $notify('ClearMark 抖音', '❌ 无效链接', url.substring(0, 50));
      return;
    }
    const douyinUrl = urlMatch[0];

    $notify('ClearMark 抖音', '🔍 解析中...', '');

    // 3. 调用 API
    const resp = await $task.fetch({
      url: API_BASE + '?url=' + encodeURIComponent(douyinUrl),
      method: 'GET',
      timeout: 30
    });

    if (resp.statusCode !== 200) {
      $notify('ClearMark 抖音', '❌ API 错误', 'HTTP ' + resp.statusCode);
      return;
    }

    const data = JSON.parse(resp.body);

    if (!data.success || !data.video_url) {
      $notify('ClearMark 抖音', '❌ 解析失败', data.error || '未知错误');
      return;
    }

    // 4. 复制无水印链接到剪贴板
    if (typeof $clipboard !== 'undefined') {
      $clipboard = data.video_url;
    }

    // 5. 通知
    const title = data.title || '(无标题)';
    const shortUrl = data.video_url.substring(0, 80) + '...';
    
    $notify(
      'ClearMark 抖音 ✅', 
      '无水印视频链接已复制',
      title.substring(0, 50) + '\n' + shortUrl
    );

    // 6. 尝试下载 (如果在移动网络下可能失败)
    if (typeof $download !== 'undefined' && typeof $prefs !== 'undefined') {
      const autoDownload = $prefs.valueForKey('clearmark_auto_download');
      if (autoDownload === 'true') {
        $download(data.video_url);
      }
    }

    // 7. 日志
    console.log('✅ ClearMark: ' + (data.title || '成功'));
    console.log('🎬 ' + data.video_url);

  } catch (e) {
    $notify('ClearMark 抖音', '❌ 错误', e.message || String(e));
    console.log('❌ ClearMark: ' + (e.message || e));
  }
}

main();
