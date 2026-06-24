// AppStore 限免面板 - Surge Module
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

  // 国家/地区国旗映射
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

    // 视觉宽度计算：中文=2，英文/数字=1，emoji=2
    function vw(s) {
      let w = 0;
      for (const ch of s) {
        if (/[\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef]/.test(ch)) w += 2;
        else if (/[\u{1F000}-\u{1FFFF}]/u.test(ch)) w += 2; // emoji
        else w += 1;
      }
      return w;
    }

    // 用中点「·」填充，精度为1vw（比全角空格2vw更精细）
    const maxVw = Math.max(...freeDeals.map(d => vw((d.app?.title || ''))));
    const targetVw = Math.min(maxVw + 4, 42);
    let lines = [];
    for (const deal of freeDeals) {
      const title = deal.app?.title || '未知';
      const need = Math.max(0, targetVw - vw(title));
      // 限免中标记取最短 "中"一字 = 2vw，但整体视觉保留
      lines.push(`${flag} ${title}${'·'.repeat(need + 1)}限免中`);
    }

    $done({
      title: `${flag} 限免(${freeDeals.length}) | ${region.toUpperCase()}`,
      content: lines.join('\n')
    });

  } catch (e) {
    $done({
      title: `${flag} 限免`,
      content: `❌ ${e.message || e}`
    });
  }
})();
