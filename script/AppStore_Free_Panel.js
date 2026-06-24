// AppStore 限免面板 - Surge Panel Script
// 数据来源: https://api.zxki.cn/api/appfree
// 参数: appCount=8 (显示条数), action=show|switch(换区), region=(目标地区), group=Proxy(策略组名)
// 用法: 编辑参数 action=switch&region=日本 → 敲面板执行换区 → 改回 action=show 恢复

(async () => {
  let args = {};
  if (typeof $argument === 'string' && $argument) {
    $argument.split('&').forEach(p => {
      let [k, v] = p.split('=');
      if (k && v) args[k.trim()] = v.trim();
    });
  }

  // 换区模式
  if (args.action === 'switch' && args.region) {
    let group = args.group || 'Proxy';
    try {
      $surge.setSelectGroupPolicy(group, args.region);
      $done({
        title: '✅ 换区成功',
        content: `策略组: ${group}\n已切换至: ${args.region}\n\n再次点击刷新面板`,
        icon: 'checkmark.circle',
        'icon-color': '#34C759'
      });
    } catch (e) {
      $done({
        title: '❌ 换区失败',
        content: `策略组 [${group}] 或地区 [${args.region}] 不存在\n\n请检查参数`,
        icon: 'xmark.circle',
        'icon-color': '#FF3B30'
      });
    }
    return;
  }

  // 显示模式（默认）
  let count = parseInt(args.appCount) || 8;
  count = Math.min(Math.max(count, 1), 30);
  let group = args.group || 'Proxy';

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

    if (updated) lines.push('');
    if (updated) lines.push(`🕐 ${updated}`);

    lines.push('');
    lines.push('━━━ 换区 ━━━');
    lines.push('编辑参数换区:');
    lines.push('  action=switch&region=日本');
    lines.push(`  当前策略组: ${group}`);

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
