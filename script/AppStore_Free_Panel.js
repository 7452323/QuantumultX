// AppStore 限免面板 - Surge Panel Script
// 数据来源: https://api.zxki.cn/api/appfree
// 参数: appCount=8 (默认显示8条，最多30条)

(async () => {
  let count = 8;
  if (typeof $argument === 'string' && $argument) {
    let m = $argument.match(/appCount=(\d+)/);
    if (m) count = parseInt(m[1]);
  }
  count = Math.min(Math.max(count, 1), 30);

  try {
    let data = await new Promise((resolve, reject) => {
      $httpClient.get({
        url: 'https://api.zxki.cn/api/appfree',
        headers: { 'User-Agent': 'Surge/5.0' }
      }, (err, resp, body) => {
        if (err) reject(new Error(err));
        else {
          try { resolve(JSON.parse(body)); }
          catch(e) { reject(new Error('JSON parse failed')); }
        }
      });
    });

    let bodyApps = data.apps?.['本体限免'] || [];
    let iapApps = data.apps?.['内购限免'] || [];
    let updated = data.last_updated || '';

    let lines = [];
    
    lines.push('━━━ 本体限免 ━━━');
    if (bodyApps.length === 0) {
      lines.push('  暂无');
    } else {
      bodyApps.slice(0, count).forEach((app, i) => {
        let name = (app.name || '').replace(/\/\/.*$/, '').trim();
        lines.push(`  ${i+1}. ${name}`);
      });
    }

    lines.push('');
    lines.push('━━━ 内购限免 ━━━');
    if (iapApps.length === 0) {
      lines.push('  暂无');
    } else {
      iapApps.slice(0, count).forEach((app, i) => {
        let name = (app.name || '').replace(/\/\/.*$/, '').trim();
        lines.push(`  ${i+1}. ${name}`);
      });
    }

    if (updated) {
      lines.push('');
      lines.push(`更新时间: ${updated}`);
    }

    $done({
      title: 'AppStore 限免',
      content: lines.join('\n'),
      icon: 'gift.circle',
      'icon-color': '#FF2D55'
    });
  } catch (e) {
    $done({
      title: 'AppStore 限免',
      content: '获取失败: ' + e.message,
      icon: 'exclamationmark.circle',
      'icon-color': '#FF3B30'
    });
  }
})();
