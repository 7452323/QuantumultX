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
  const region = (args.region || 'cn').toLowerCase();

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
      $done({ title: '限免(0)', content: '暂无数据' });
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
      $done({ title: '限免(0)', content: '今日暂无限免' });
      return;
    }

    // 视觉宽度计算：中文=2，英文/数字=1
    function vw(s) {
      let w = 0;
      for (const ch of s) {
        if (/[\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef]/.test(ch)) w += 2;
        else w += 1;
      }
      return w;
    }

    // 用全角空格填充到统一视觉宽度，确保"限免中"右对齐
    const maxVw = Math.max(...freeDeals.map(d => vw(d.app?.title || '')));
    const targetVw = Math.min(maxVw + 2, 40);
    let lines = [];
    for (const deal of freeDeals) {
      const title = deal.app?.title || '未知';
      const need = Math.max(0, targetVw - vw(title));
      lines.push(`${title}${'　'.repeat(Math.ceil(need / 2))}限免中`);
    }

    $done({
      title: `限免(${freeDeals.length})`,
      content: lines.join('\n')
    });

  } catch (e) {
    $done({
      title: '限免',
      content: `❌ ${e.message || e}`
    });
  }
})();
