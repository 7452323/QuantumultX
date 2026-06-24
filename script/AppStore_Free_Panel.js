// AppStore 限免面板 - Surge Module
// 数据源: AppRaven GraphQL API (逆向自 AppRaven iOS 应用)
// 价格: Apple Lookup API
// 支持参数: appCount(显示条数), region(地区, 如 cn/us/jp)

(async () => {
  const args = typeof $argument === 'string' ? JSON.parse($argument) : {};
  const appCount = parseInt(args.appCount) || 8;
  const region = (args.region || 'cn').toLowerCase();

  const GRAPHQL_URL = 'https://appraven.net/appraven/graphql';

  function getArtworkUrl(url) {
    if (!url) return '';
    return url.replace('{w}x{h}{c}.{f}', '120x120bb.png');
  }

  const regionName = {
    cn: '🇨🇳 中国', us: '🇺🇸 美国', jp: '🇯🇵 日本',
    gb: '🇬🇧 英国', hk: '🇭🇰 香港', tw: '🇹🇼 台湾',
    kr: '🇰🇷 韩国', de: '🇩🇪 德国', fr: '🇫🇷 法国',
    ca: '🇨🇦 加拿大', au: '🇦🇺 澳大利亚'
  }[region] || region.toUpperCase();

  try {
    // 第1步: 获取 AppRaven 限免数据
    const dealsData = await new Promise((resolve, reject) => {
      $httpClient.post({
        url: GRAPHQL_URL,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Surge/5.0' },
        body: JSON.stringify({
          query: `query GetDailyDeals($page: Int!) {
            dailyDeals(page: $page) {
              content {
                id oldPriceTier newPriceTier sponsored released
                startDate endDate
                app { id title subtitle artworkUrl ITunesId game
                  genres { ITunesId title } }
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

    // 筛选限免 (newPriceTier === 0)
    let freeDeals = deals.filter(d => d.newPriceTier === 0);
    // 如果全免费(可能新上架app无原价), 尽量排除刚发布无原价的
    let goodFreeDeals = freeDeals.filter(d => d.oldPriceTier > 0);
    if (goodFreeDeals.length > 0) freeDeals = goodFreeDeals;
    // 取前 appCount 个
    freeDeals = freeDeals.slice(0, appCount);

    // 第2步: iTunes Lookup 获取地区价格
    const ids = freeDeals.map(d => d.app?.ITunesId).filter(Boolean).join(',');
    let priceMap = {};
    if (ids) {
      try {
        const lookupData = await new Promise((resolve, reject) => {
          $httpClient.get(`https://itunes.apple.com/lookup?id=${ids}&country=${region}`, (err, resp, data) => {
            if (err) resolve(null);
            else resolve(JSON.parse(data));
          });
        });
        if (lookupData?.results) {
          for (const app of lookupData.results) {
            priceMap[app.trackId] = app.formattedPrice || '';
          }
        }
      } catch (e) {}
    }

    // 第3步: 构建输出
    let lines = [`📱 AppStore 限免 · ${regionName}\n`];

    for (const deal of freeDeals) {
      const app = deal.app || {};
      const itunesId = app.ITunesId;
      const title = app.title || '未知';
      const subtitle = app.subtitle || '';
      const artworkUrl = getArtworkUrl(app.artworkUrl);
      const genres = (app.genres || []).map(g => g.title).join(' / ') || '';
      const curPrice = priceMap[itunesId] || 'Free';
      const appStoreUrl = `https://apps.apple.com/${region}/app/id${itunesId}`;
      const tag = deal.sponsored ? '💼' : '🔥';

      lines.push(
        `${tag} **[${title}](${appStoreUrl})**` +
        (subtitle ? ` ${subtitle}` : '') +
        `\n    ~~${curPrice}~~ → **免费**${genres ? ` · ${genres}` : ''}`
      );
    }

    lines.push(`\n---\n数据: AppRaven · 更新: ${new Date().toLocaleString('zh-CN')}`);

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
