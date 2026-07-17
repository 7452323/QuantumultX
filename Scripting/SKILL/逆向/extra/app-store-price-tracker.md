---
category: reverse-engineering
name: app-store-price-tracker
description: >-
  Reverse-engineer iOS App Store price-tracking apps (AppRaven etc.) to scrape
  daily deals, price drops, and app metadata via their GraphQL or REST APIs.
  Includes: webpack JS bundle analysis for schema discovery, GraphQL query
  extraction, nginx reverse proxy for port-blocked VPS, and WxPusher push
  delivery info.
version: 1.0.0
author: Hermes Agent
tags: [reverse-engineering, ios, appstore, price-tracker, graphql, webpack, nginx, wxpusher]
---

# iOS App Store 价格追踪 App 逆向 + 推送集成

## When to use

- User wants to scrape App Store daily deals / price drops / free apps
- AppRaven or similar iOS price-tracking app to reverse
- Need to push data to WeChat (Official Account or WxPusher)
- Need daily cron delivery of App Store限免/降价 to users

## Key targets

| Target | API Type | Base URL |
|--------|----------|----------|
| AppRaven | GraphQL (Apollo) | `https://appraven.net/appraven/graphql` |
| App Store | Direct (via AppRaven proxy) | N/A |

## AppRaven API Reverse Engineering

### 1. Locate API endpoint

```bash
# JS bundle is at /static/js/main.*.js on the web front-end
# Extract server URL and API path:
python3 -c "
import re
with open('main.js') as f: js = f.read()
for m in re.findall(r'[\"\\x27](https?://[^\"\\x27]{10,80})[\"\\x27]', js):
    print('URL:', m)
for m in re.findall(r'serverUrl[^;]*', js):
    print('serverUrl:', m[:200])
"
```

Key pattern found: `serverUrl = yn.mainUrl + "/appraven"`, `apiUrl = yn.serverUrl + "/graphql"`

### 2. GraphQL schema (introspection is OFF)

Introspection is disabled (returns ValidationError). Extract queries from the webpack bundle:

```python
# Extract all query/mutation operations from bundle
for m in re.findall(r'(query|mutation)\s+(\w+)\s*\(([^)]*)\)\s*\{[^}]+\{[^}]+(?:[^}]+\{[^}]*\})?\})', js):
    print(f'{m[1]} {m[2]}')
```

### 3. Known queries

| Query Name | Purpose | Key Fields |
|---|---|---|
| `GetHomeContent` | Homepage: dailyDeals, popularApps, appsOnSale, newApps, updatedApps+ | content, id, title, artworkUrl, priceTier |
| `GetDailyDeals` | Today's special deals | oldPriceTier, newPriceTier, sponsored, app {…} |
| `GetAppsOnSale` | Price drop apps (paginated) | miniFilter (ratingCount, genreId), rareOnly, page, pageSize |
| `GetAppDetail($id)` | Single app detail | ITunesId, title, priceTier, rating, genres, developer, version, size |
| `FilterApps` | Filter by genre, sort by popularity | AppFilterInput, AppSortInput (POPULARITY_DAY) |
| `GetNewApps` / `GetUpdatedApps` | New releases / recent updates | miniFilter, page |
| `IAPsOnSalePreview` | In-app purchases on sale | same miniFilter inputs |

### 4. Activity/Price change fields

From `AppActivity` fragment (extracted from bundle):

- `AppActivityPriceChange`: `priceChangeType` ("DROP"/"RAISE"), `priceTierFrom`, `priceTierTo`
- `AppActivityAvailability`: `availabilityChangeType` ("release"/"remove"), `priceTier`
- `AppActivityUpdate`: `versionFrom`, `versionTo`, `updateSize`

Queried via `app(id) { lastActivity { ... } }`

### 5. Sample request

```python
import requests
r = requests.post('https://appraven.net/appraven/graphql', json={
    "query": """query GetDailyDeals($page: Int!) {
        dailyDeals(page: $page) { content {
            id title subject oldPriceTier newPriceTier sponsored
            app { id title subtitle artworkUrl priceTier rating ratingCount }
        }}
    }""",
    "variables": {"page": 0}
}, headers={
    "Content-Type": "application/json",
    "Origin": "https://appraven.net"
})
```

## App Store Price Tier Reference

```python
def price_str(tier):
    if tier == 0: return "免费"
    pm = {1:"$0.99", 2:"$1.99", 3:"$2.99", 10:"$9.99",
          15:"$14.99", 20:"$19.99", 23:"$22.99", 30:"$29.99",
          49:"$48.99", 50:"$49.99", 62:"$61.99"}
    return pm.get(tier, f"${tier}")
```

## WeChat Official Account: 未认证订阅号 Hard Constraints

**HARD NO.** Unverified 订阅号 cannot push content via API. Don't waste time.

### Verified working APIs
- ✅ `cgi-bin/token`
- ✅ `account/getaccountbasicinfo` — 用来确认账号类型
- ✅ `media/upload` — 上传图片素材
- ✅ `draft/add` — 创建草稿

### Verified NOT working (48001)
- ❌ ALL群发/发布API (`freepublish/submit`, `message/mass/send`)
- ❌ ALL菜单API (`menu/create`, `menu/get`)
- ❌ ALL客服消息API (`message/custom/send`)
- ❌ ALL用户管理API (`user/get`)

### Other hard limits
- 自定义菜单「跳转网页」类型**根本不可见**, 不是"只允许公众号链接" — 是压根没有这个按钮
- 发布群发: API 48001, 模拟浏览器操作也不现实(需要手动扫码)

### The only real delivery paths
1. **认证公众号** (¥300/年) 后一切正常
2. **WxPusher** — 第三方推送服务，扫码关注后每天推卡片消息到用户微信
3. **已有小程序 + web-view** — 如果用户有小程序，web-view 可以内嵌任意网页，菜单指向小程序即可
4. **放弃公众号推送** — 直接给用户一个自建页面 + cron更新，告诉用户"自己来刷"

**Diagnostic (run FIRST):**
```bash
curl -s "https://api.weixin.qq.com/cgi-bin/account/getaccountbasicinfo?access_token=$TOKEN"
# account_type=1/2=订阅号, qualification_verify=false=未认证
# If both → tell user immediately, no bypass possible
```

## Cron Setup for Daily Updates

```bash
hermes cron create \
  --schedule "0 * * * *" \
  --name "appraven-daily-update" \
  --prompt "Run /root/gen_appraven_page.py to update the daily deals page" \
  --toolsets terminal
```

## Tools Summary

| File | Location | Purpose |
|---|---|---|
| `gen_appraven_page.py` | `/root/gen_appraven_page.py` | 抓取AppRaven数据生成HTML页面 |
| `wx_push_appraven.py` | `/root/wx_push_appraven.py` | 通过WxPusher推送到微信（支持HTML） |
| `appraven_api.py` | `/root/appraven_api.py` | CLI工具：查限免/降价/应用详情 |

## Pitfalls

- Introspection disabled → 必须从JS bundle提取GraphQL查询
- Webpack bundle 是单行压缩 → 用Python re搜索 `query|mutation|fragment` + gql上下文
- Apollo client 用 `gql``` 标签 → 编译后变成 `kind:"Document"` 对象，搜索 `operation Name` 可找操作名
- App Store artwork URL has `{w}x{h}{c}.{f}` placeholder → 替换为 `512x512bb.jpeg`
- 未认证订阅号大部分API不可用 → Session积累很重要，不要浪费时间绕
- 未认证订阅号不能通过API设菜单 → 直接告诉用户去后台手工设，别试各种接口变体
