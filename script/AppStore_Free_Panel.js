// AppStore 限免面板 - Surge Module
// 数据源: AppRaven GraphQL API (逆向自 AppRaven iOS 应用)
// 支持参数: appCount(显示条数), region(地区, 如 cn/us/jp)
// 换区通过 region 参数切换 App Store 国家/地区

(async () => {
  const args = typeof $argument === 'string' ? JSON.parse($argument) : {};
  const appCount = parseInt(args.appCount) || 8;
  const region = (args.region || 'cn').toLowerCase();

  const GRAPHQL_URL = 'https://appraven.net/appraven/graphql';

  const regionName = {
    cn: '🇨🇳 中国', us: '🇺🇸 美国', jp: '🇯🇵 日本',
    gb: '🇬🇧 英国', hk: '🇭🇰 香港', tw: '🇹🇼 台湾',
    kr: '🇰🇷 韩国', de: '🇩🇪 德国', fr: '🇫🇷 法国',
    ca: '🇨🇦 加拿大', au: '🇦🇺 澳大利亚'
  }[region] || region.toUpperCase();

  try {
    // 获取 AppRaven 限免数据
    const dealsData = await new Promise((resolve, reject) => {
      $httpClient.post({
        url: GRAPHQL_URL,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Surge/5.0' },
        body: JSON.stringify({
          query: `query GetDailyDeals($page: Int!) {
            dailyDeals(page: $page) {
              content {
                id oldPriceTier newPriceTier sponsored released
                app { id title subtitle ITunesId
                  genres { title } }
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

    // 筛选限免 (newPriceTier === 0, 有原价)
    let freeDeals = deals.filter(d =>
      d.newPriceTier === 0 &&
      d.oldPriceTier !== null &&
      d.oldPriceTier > 0
    );
    // 如果没有有原价的, 退而求其次
    if (!freeDeals.length) freeDeals = deals.filter(d => d.newPriceTier === 0);
    // 取前 appCount 个
    freeDeals = freeDeals.slice(0, Math.min(appCount, 30));

    // 构建输出
    let lines = [`📱 AppStore 限免 · ${regionName}\n`];

    for (const deal of freeDeals) {
      const app = deal.app || {};
      const itunesId = app.ITunesId;
      const title = app.title || '未知';
      const subtitle = app.subtitle || '';
      const genres = (app.genres || []).map(g => g.title).join(' / ') || '';
      const appStoreUrl = `https://apps.apple.com/${region}/app/id${itunesId}`;
      const tag = deal.sponsored ? '💼' : '🔥';

      lines.push(
        `${tag} **[${title}](${appStoreUrl})**` +
        (subtitle ? `\n    ${subtitle}` : '') +
        `\n    📉 限免中${genres ? ` · ${genres}` : ''}`
      );
    }

    lines.push(`\n---\n数据: AppRaven · ${new Date().toLocaleString('zh-CN')}`);

    $done({
      title: `AppStore 限免 (${freeDeals.length})`,
      content: lines.join('\n')
    });

  } catch (e) {
    $done({
      title: 'AppStore 限免',
      content: `❌ 获取失败: ${e.message || e}`
    });
  }
})();
