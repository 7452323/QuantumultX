# iOS App Store 价格追踪 App 逆向 + 推送集成

## When to use
- User wants to scrape App Store daily deals / price drops / free apps
- AppRaven or similar iOS price-tracking app to reverse

## Key targets
| Target | API Type | Base URL |
|--------|----------|----------|
| AppRaven | GraphQL (Apollo) | `https://appraven.net/appraven/graphql` |

## AppRaven API Reverse Engineering
### 1. Locate API endpoint
JS bundle at /static/js/main.*.js. Key pattern: `serverUrl = yn.mainUrl + "/appraven"`, `apiUrl = yn.serverUrl + "/graphql"`

### 2. Known queries
| Query Name | Purpose |
|---|---|
| `GetHomeContent` | Homepage: dailyDeals, popularApps, appsOnSale |
| `GetDailyDeals` | Today's special deals |
| `GetAppsOnSale` | Price drop apps (paginated) |
| `GetAppDetail($id)` | Single app detail |

### 3. Sample request
```python
import requests
r = requests.post('https://appraven.net/appraven/graphql', json={
    "query": """query GetDailyDeals($page: Int!) { dailyDeals(page: $page) { content { id title subject oldPriceTier newPriceTier sponsored app { id title artworkUrl priceTier }}} }""",
    "variables": {"page": 0}
}, headers={"Content-Type": "application/json", "Origin": "https://appraven.net"})
```
