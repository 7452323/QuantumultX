// AppStore 限免面板 - Surge Panel Script
// 数据来源: AppRaven (appraven.net/appraven/graphql)
// 参数: appCount=8 (默认显示8条, 最多30条), region=cn (地区)

(async () => {
  let count = 8;
  let region = 'cn';
  if (typeof $argument === 'string' && $argument) {
    let m = $argument.match(/appCount=(\d+)/);
    if (m) count = parseInt(m[1]);
    m = $argument.match(/region=([a-z]{2})/);
    if (m) region = m[1];
  }
  count = Math.min(Math.max(count, 1), 30);

  const GRAPHQL_URL = 'https://appraven.net/appraven/graphql';
  const MAX_PAGES = 20;
  let bodyApps = [];
  let iapApps = [];

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      let resp = await new Promise((resolve, reject) => {
        $httpClient.post({
          url: GRAPHQL_URL,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `{dailyDeals(page:${page}){content{id title subject oldPriceTier newPriceTier app{id title ITunesId}}}}`
          })
        }, (err, resp, body) => {
          if (err) reject(typeof err === 'string' ? err : err.message || 'Request failed');
          else resolve(body);
        });
      });

      let data = JSON.parse(resp);
      let deals = data?.data?.dailyDeals?.content || [];
      if (deals.length === 0) break;

      for (const deal of deals) {
        if (deal.newPriceTier === 0) {
          if (deal.oldPriceTier !== null) {
            if (bodyApps.length < count) bodyApps.push(deal);
          } else if (deal.subject) {
            if (iapApps.length < count) iapApps.push(deal);
          } else {
            if (bodyApps.length < count) bodyApps.push(deal);
          }
        }
      }

      if (bodyApps.length >= count && iapApps.length >= count) break;
    }

    let lines = [];

    lines.push('━━━ 本体限免 ━━━');
    if (bodyApps.length === 0) {
      lines.push('  暂无');
    } else {
      bodyApps.forEach((deal, i) => {
        lines.push(`  ${i+1}. ${deal.app.title}`);
      });
    }

    lines.push('');
    lines.push('━━━ 内购限免 ━━━');
    if (iapApps.length === 0) {
      lines.push('  暂无');
    } else {
      iapApps.forEach((deal, i) => {
        lines.push(`  ${i+1}. ${deal.app.title} (${deal.subject})`);
      });
    }

    $done({
      title: `AppStore 限免 (${region.toUpperCase()})`,
      content: lines.join('\n'),
      icon: 'gift.circle',
      'icon-color': '#FF2D55'
    });
  } catch (e) {
    $done({
      title: 'AppStore 限免',
      content: '获取失败: ' + (typeof e === 'string' ? e : e.message),
      icon: 'exclamationmark.circle',
      'icon-color': '#FF3B30'
    });
  }
})();
