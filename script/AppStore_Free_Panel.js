// AppStore 限免面板 - Surge Panel
// 数据源: AppRaven GraphQL API

(async () => {
  const args = {};
  if (typeof $argument === 'string') {
    $argument.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) args[k.trim()] = (v || '').trim();
    });
  }

  let appCount = parseInt(args.appCount) || 8;
  if (appCount > 30) appCount = 30;
  if (appCount < 1) appCount = 1;
  const region = (args.region || 'cn').toLowerCase();

  const flags = {
    cn: '🇨🇳', us: '🇺🇸', jp: '🇯🇵', kr: '🇰🇷', hk: '🇭🇰',
    tw: '🇹🇼', gb: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', ru: '🇷🇺',
    au: '🇦🇺', ca: '🇨🇦', sg: '🇸🇬', my: '🇲🇾', th: '🇹🇭',
    vn: '🇻🇳', it: '🇮🇹', es: '🇪🇸', br: '🇧🇷', mx: '🇲🇽',
    nl: '🇳🇱', se: '🇸🇪', no: '🇳🇴', dk: '🇩🇰', fi: '🇫🇮',
    pl: '🇵🇱', tr: '🇹🇷', sa: '🇸🇦', ae: '🇦🇪', in: '🇮🇳'
  };
  const flag = flags[region] || '🌍';

  try {
    const dealsData = await new Promise((resolve, reject) => {
      $httpClient.post({
        url: 'https://appraven.net/appraven/graphql',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Surge/5.0' },
        body: JSON.stringify({
          query: `query GetDailyDeals($page: Int!) {
            dailyDeals(page: $page) {
              content {
                id oldPriceTier newPriceTier
                app { id title ITunesId }
              }
              hasNext
            }
          }`,
          variables: { page: 0 }
        })
      }, (err, resp, data) => {
        if (err) reject(err);
        else resolve(JSON.parse(data));
      });
    });

    let deals = dealsData?.data?.dailyDeals?.content || [];
    if (!deals.length) {
      $done({ title: `${flag} 限免(0)`, content: '暂无数据' });
      return;
    }

    let freeDeals = deals.filter(d =>
      d.newPriceTier === 0 &&
      d.oldPriceTier !== null &&
      d.oldPriceTier > 0
    );
    if (!freeDeals.length) freeDeals = deals.filter(d => d.newPriceTier === 0);
    freeDeals = freeDeals.slice(0, appCount);

    if (!freeDeals.length) {
      $done({ title: `${flag} 限免(0)`, content: '今日暂无限免' });
      return;
    }

    // 第一版风格: 简洁编号列表
    let lines = [];
    freeDeals.forEach((deal, i) => {
      let name = deal.app?.title || '未知';
      lines.push(`  ${i+1}. ${name}`);
    });

    $done({
      title: `${flag} 限免(${freeDeals.length}) | ${region.toUpperCase()}`,
      content: lines.join('\n'),
      icon: 'gift.circle',
      'icon-color': '#FF2D55'
    });

  } catch (e) {
    $done({
      title: `${flag} 限免`,
      content: `❌ ${e.message || e}`,
      icon: 'exclamationmark.circle',
      'icon-color': '#FF3B30'
    });
  }
})();
