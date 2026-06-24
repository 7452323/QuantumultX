// AppStore 限免面板 - Surge Module
// 数据源: AppRaven GraphQL API (逆向自 AppRaven)
// 参数: appCount (条数), region (地区: cn/us/jp 等)

(async () => {
  // Surge 传递的参数是 query string 格式, 不是 JSON!
  const args = {};
  if (typeof $argument === 'string') {
    $argument.split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      if (k) args[k.trim()] = (v || '').trim();
    });
  }

  let appCount = parseInt(args.appCount) || 8;
  if (appCount > 30) appCount = 30;
  const region = (args.region || 'cn').toLowerCase();

  const GRAPHQL_URL = 'https://appraven.net/appraven/graphql';

  const regionEmoji = {
    cn: '🇨🇳', us: '🇺🇸', jp: '🇯🇵', gb: '🇬🇧',
    hk: '🇭🇰', tw: '🇹🇼', kr: '🇰🇷', de: '🇩🇪',
    fr: '🇫🇷', ca: '🇨🇦', au: '🇦🇺'
  };

  try {
    const dealsData = await new Promise((resolve, reject) => {
      $httpClient.post({
        url: GRAPHQL_URL,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Surge/5.0' },
        body: JSON.stringify({
          query: `query GetDailyDeals($page: Int!) {
            dailyDeals(page: $page) {
              content {
                id oldPriceTier newPriceTier sponsored released
                app { id title subtitle ITunesId genres { title } }
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
      $done({ title: 'AppStore 限免', content: '暂无数据' });
      return;
    }

    // 限免 = newPriceTier===0 且有原价
    let freeDeals = deals.filter(d =>
      d.newPriceTier === 0 &&
      d.oldPriceTier !== null &&
      d.oldPriceTier > 0
    );
    if (!freeDeals.length) freeDeals = deals.filter(d => d.newPriceTier === 0);
    freeDeals = freeDeals.slice(0, appCount);

    const emoji = regionEmoji[region] || '🌍';
    let lines = [`📱 ${emoji} AppStore 限免\n`];

    for (const deal of freeDeals) {
      const app = deal.app || {};
      const title = app.title || '未知';
      const subtitle = app.subtitle || '';
      const genres = (app.genres || []).map(g => g.title).join(' / ') || '';
      const url = `https://apps.apple.com/${region}/app/id${app.ITunesId}`;
      const tag = deal.sponsored ? '💼' : '🔥';

      lines.push(
        `${tag} **[${title}](${url})**` +
        (subtitle ? `\n    ${subtitle}` : '') +
        `\n    📉 限免中${genres ? ` · ${genres}` : ''}`
      );
    }

    lines.push(`\n---\nAppRaven · ${new Date().toLocaleString('zh-CN')}`);

    $done({
      title: `限免 (${freeDeals.length})`,
      content: lines.join('\n')
    });

  } catch (e) {
    $done({
      title: '限免',
      content: `❌ ${e.message || e}`
    });
  }
})();
