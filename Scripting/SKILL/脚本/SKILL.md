---
name: 脚本
description: "代理脚本编写技能。覆盖 QX/Surge/Loon/Stash 五大平台脚本写法、HAR→脚本工作流、多端点校验型 SDK 脚本（Adapty 范式）、RevenueCat 解锁、常用脚本模板。"
tags: [QuantumultX, Surge, Loon, proxy, script, har, rewrite, mitm, adapty, revenuecat]
---

# 代理脚本编写技能

从抓包到脚本到上线全流程。用户提供 HAR/JSON/ZIP 抓包数据时，分析后输出可用的代理脚本。

---

## 📋 快速导航

| # | 章节 | 内容 |
|---|------|------|
| 1 | 配置语法详解 | [general] [dns] [policy] [server] [filter] [rewrite] [task] [mitm] |
| 2 | 脚本类型总览 | 解锁 / 签到 / Cookie / 去广告 / 面板 |
| 3 | 脚本 API 参考 | $task.fetch / $notify / $prefs / $persistentStore / $done |
| 4 | HAR→脚本工作流 | 抓包 → 分析 → 生成 rewrite/task 规则 |
| 5 | Rewrite 详解 | 响应体修改 / 请求头修改 / reject / reject-dict / 302 |
| 6 | Task 详解 | cron/event-interaction/event-network + task-gallery |
| 7 | 资源解析器 | 自定义节点/分流/重写转换 |
| 8 | 配置片段 (snippet) | .snippet 文件创建与引用 |
| 9 | 持久化与 BoxJS | $prefs.write/read + BoxJS 订阅管理 |
| 10 | 去广告实战 | 从抓包到 reject / reject-dict / 响应体替换 |
| 11 | 实战模板 | 5 个可直接用的完整脚本模板 |

---

## 一、配置文件详解

### [general] 通用设置

```
server_check_url=http://www.qualcomm.cn/generate_204   ;节点测试地址
server_check_timeout=2000                                 ;测试超时(ms)
resource_parser_url=https://.../resource-parser.js       ;资源解析器
geo_location_checker=http://ip-api.com/json/?lang=zh-CN, https://.../IP_API.js
running_mode_trigger=filter, filter, asus-5g:all_direct  ;按WiFi自动切换模式
ssid_suspended_list=Asus                                  ;暂停列表
dns_exclusion_list=*.qq.com                              ;不走fake-ip域名
udp_whitelist=53, 80-427, 444-65535                      ;UDP白名单
udp_drop_list=1900, 80                                    ;UDP丢弃(不发ICMP)
fallback_udp_policy=direct
excluded_routes=192.168.0.0/16, 172.16.0.0/12, 100.64.0.0/10, 10.0.0.0/8
doh_user_agent=Agent/1.0
;dns_reject_domain_behavior = loopback | no-error-no-answer | nxdomain | none
;icmp_auto_reply = true
```

### [dns] DNS 设置

```
[dns]
server=114.114.114.114                                     ;普通DNS(多个并发)
server=223.5.5.5
doh-server=https://dns.alidns.com/dns-query              ;DoH (并发)
doq-server = quic://dns.adguard.com                       ;DoQ (覆盖DoH)
;prefer-doh3                                               ;启用DoH3
;no-system                                                 ;禁用系统DNS
;no-ipv6
circumvent-ipv4-answer = 127.0.0.1, 0.0.0.0             ;DNS去广告过滤
;server=/*.taobao.com/223.5.5.5                          ;指定域名DNS
;address=/example.com/192.168.1.1                        ;域名→IP映射
;alias=/example.com/another-example.com                  ;域名别名映射
```

### [policy] 策略组

**6 种类型：**
| 类型 | 说明 |
|------|------|
| static | 手动选择节点 |
| available | 自动选第一个可用 |
| round-robin | 轮流使用 |
| url-latency-benchmark | 选延迟最低 |
| dest-hash | 相同域名固定节点 |
| ssid | 按网络自动切换 |

```conf
[policy]
static=🍎 苹果服务, direct, proxy, img-url=https://...
static=🌏 国外网站, proxy, direct, img-url=...
static=🇭🇰 香港节点, server-tag-regex=香港|HK|Hong, img-url=...

;server-tag-regex 按节点名正则筛选
;resource-tag-regex 按订阅标签正则筛选
;img-url 策略组图标(108×108 png)
```

### [server_local] 本地节点

```conf
[server_local]
;Shadowsocks
shadowsocks=example.com:80, method=aes-128-gcm, password=pwd, obfs=http, obfs-host=apple.com, obfs-uri=/resource/file, fast-open=false, udp-relay=false, tag=ss-01

;Shadowsocks + TLS
shadowsocks=example.com:443, method=chacha20, password=pwd, obfs=over-tls, obfs-host=apple.com, tls-verification=true, udp-relay=true, tag=ss-tls-01

;Shadowsocks 2022
shadowsocks=example.com:80, method=2022-blake3-aes-128-gcm, password=BJDBGeLKx/..., udp-relay=true, tag=ss2022-01

;VMess
vmess=example.com:443, method=none, password=uuid, obfs=over-tls, fast-open=false, udp-relay=false, tag=vmess-tls
;disable aead: aead=false ;TLS指纹: tls-pubkey-sha256=xxx

;Trojan
trojan=example.com:443, password=pwd, over-tls=true, tls-verification=true, fast-open=false, udp-relay=false, tag=trojan-01
;Reality
trojan=example.com:443, password=pwd, over-tls=true, reality-base64-pubkey=xxx, reality-hex-shortid=xxx, tag=trojan-reality

;HTTP
http=user:pass@example.com:80, over-tls=false, tag=http-01

;SOCKS5
socks5=user:pass@example.com:1080, over-tls=false, udp-relay=false, tag=socks5-01
```

### [server_remote] 远程节点订阅

```conf
[server_remote]
https://example.com/sub, tag=订阅名称, update-interval=86400, opt-parser=true, img-url=https://..., enabled=true
;本地节点片段
;servers.snippet, tag=本地节点, enabled=false
```

### [filter_local] 本地分流

```conf
[filter_local]
;规则类型: host / host-suffix / host-keyword / user-agent / geoip / ip-cidr / ip-cidr6 / ip-asn / final
;动作: proxy / direct / reject / reject-200 / reject-tinygif
host, example.com, proxy
host-suffix, .apple.com, direct
host-keyword, adservice, reject
geoip, cn, direct
ip-cidr, 10.0.0.0/8, direct
final, proxy
;force-remote-dns 参数: host, example.com, proxy, force-remote-dns
```

### [filter_remote] 远程分流

```conf
[filter_remote]
https://raw.githubusercontent.com/DivineEngine/Profiles/master/Quantumult/Filter/Guard/Advertising.list, tag=🚦去广告, update-interval=86400, opt-parser=true, enabled=true
;force-policy 覆盖远程规则内的策略组名
;opt-parser=true 开启资源解析器
```

### [rewrite_local] 本地重写

```conf
[rewrite_local]
;reject: 拒绝请求(返回200+空body)
https://example.com/api/ads url reject

;reject-dict: 拒绝JSON请求(返回200+{})
https://example.com/api/json url reject-dict

;reject-200: 返回200+空body(不修改内容类型)
https://example.com/api/v1 url reject-200

;reject-img: 拒绝图片请求(返回1px透明GIF)
^https://example\.com/ads/gif url reject-img

;reject-array: 拒绝JSON数组请求(返回[])
^https://example\.com/api/list url reject-array

;请求头修改
^https://example\.com/account url request-header "X-Skip-Ad: true"

;响应体修改(正则替换)
^https://example\.com/api/data url response-body "old" replace "new"

;响应体JSON字段修改
^https://example\.com/api/user url response-json "vip" replace "true"

;302重定向
^https://example\.com/old url 302 https://example.com/new

;脚本处理(远程)
^https://example\.com/api url script-path=https://example.com/script.js
```

### [rewrite_remote] 远程重写

```conf
[rewrite_remote]
https://raw.githubusercontent.com/xxx/xxx/rewrite.snippet, tag=BoxJS, opt-parser=true, enabled=true
```

### [task_local] 计划任务

```conf
[task_local]
;类型1: cron(定时任务)
0 8 * * * https://raw.githubusercontent.com/xxx/script.js, tag=签到, img-url=https://..., enabled=true

;类型2: event-interaction(UI交互，长按策略组唤出)
event-interaction https://raw.githubusercontent.com/xxx/ui-check.js, tag=流媒体检测, img-url=checkmark.seal.system, enabled=true

;类型3: event-network(网络切换触发)
event-network script.js, tag=网络切换, enabled=false

;参数说明:
;url#force-timeout=10000&method=POST — 脚本超时+请求方法
;tag= — 任务名称
;img-url= — 图标(108×108 png)
;enabled=true/false
```

### [mitm] MITM 设置

```conf
[mitm]
;开启MITM需先安装根证书并信任
hostname = *.example.com, *.app.com, api.target.com
;pass-content-type — 仅处理指定Content-Type
;pass-content-type = text/html, application/json
```

---

## 二、脚本 API 参考

### QX 原生 API

```javascript
// HTTP 请求
$task.fetch(request).then(response => {
  // response.statusCode, response.headers, response.body
  $done();
}, reason => {
  // reason.error
  $done();
});

// request 对象格式
const request = {
  url: "https://example.com/api",
  method: "POST",         // GET/POST/PUT/DELETE/PATCH/HEAD
  headers: {"Key": "Value"},
  body: JSON.stringify({data: "test"}),  // POST请求体
  opts: {
    redirection: true,         // 跟随重定向(默认true)
    'skip-cert-verify': false,  // 跳过证书验证
    'auto-cookie': false        // 自动Cookie管理
  }
};

// 通知
$notify("标题", "副标题", "正文");

// 持久化存储(QX)
$prefs.valueForKey("key");    // 读
$prefs.setValueForKey("value", "key"); // 写

// 环境变量(脚本url中#后的参数)
const args = $environment.variables;
// url#force-timeout=10000&method=POST → args["force-timeout"], args["method"]

// 完成信号
$done();                    // 无返回值
$done({});                  // 空对象结束
$done(response);            // 修改响应后返回

// 日志
console.log("debug info");
```

### $task.fetch 参数详解

```javascript
const req = {
  url: "string",                                         // 必填
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD", // 默认GET
  headers: { "Content-Type": "application/json" },        // 可选
  body: "string | JSON.stringify(obj)",                   // POST时使用
  opts: {
    redirection: true,          // 自动跟随重定向(默认true)
    'skip-cert-verify': false,   // 跳过证书验证
    'auto-cookie': false         // 自动保存Cookie
  }
};
```

### 多平台适配速查

| 功能 | QX | Surge | Loon |
|------|----|-------|------|
| HTTP请求 | $task.fetch | $httpClient.get/post | $httpClient.get/post |
| 持久化存储 | $prefs | $persistentStore | $persistentStore |
| 通知 | $notify | $notification.post | $notification.post |
| 完成 | $done() | $done() | $done() |
| 日志 | console.log | console.log | console.log |

### $task.fetch 响应对象

```json
{
  "statusCode": 200,
  "headers": {"Content-Type": "application/json"},
  "body": "响应体字符串"
}
```

---

## 三、HAR → 脚本工作流

### 从抓包到脚本

```
1. 开启 QX HTTP抓取(长按风车 / 工具&分析→HTTP抓取)
2. 操作目标App → 关闭抓包
3. 查看抓包数据 → 找到目标请求
4. 分析URL、请求头、请求体、响应体
5. 根据需求决定脚本类型:
   - 去广告 → rewrite reject/reject-dict
   - 修改响应 → rewrite response-body/response-json
   - 签到/Cron → task_local + 脚本
   - 采集Cookie → rewrite request-header 捕获
6. 编写脚本 → 测试验证
```

### HAR 文件分析

当用户提供 HAR 文件/JSON/ZIP 时：

```javascript
// 1. 解析HAR entry
{
  "request": {
    "method": "POST",
    "url": "https://api.example.com/login",
    "headers": [{"name":"Cookie","value":"token=xxx"}],
    "postData": {"mimeType":"application/json","text":"{\"user\":\"test\"}"}
  },
  "response": {
    "status": 200,
    "headers": [{"name":"Set-Cookie","value":"session=abc"}],
    "content": {"text":"{\"success\":true}"}
  }
}

// 2. 提取关键信息
const url = entry.request.url;
const method = entry.request.method;
const reqHeaders = entry.request.headers;
const reqBody = entry.request.postData?.text;
const resBody = entry.response.content?.text;

// 3. 生成对应规则
// 去广告 → reject
// 修改响应 → response-body/response-json
// Cookie采集 → request-header
```


| URL 包含 ad/ads/sponsor | `^url url reject` 或 `^url url reject-dict` |
| 响应体 JSON 含 `"vip":0` | `^url url response-json "vip" replace "1"` |
| 响应体 HTML 含广告元素 | `^url url response-body "ad-code" replace ""` |
| 请求头含 Cookie/Token | rewrite request-header 捕获 + task_local 使用 |
| POST 签到接口 | task_local cron + 脚本执行签到 |
| 响应体含 `"ads":[...]` | `^url url response-json "ads" replace "[]"` |

---

## 四、Rewrite 详解

### 4.1 响应体修改

```conf
[rewrite_local]
;全响应体正则替换
^https://example\.com/api/v1/user url response-body "old-text" replace "new-text"

;JSON字段修改
^https://example\.com/api/v1/user url response-json "vip" replace "1"
^https://example\.com/api/v1/user url response-json "vip_expire" replace "4092599349"

;数组字段置空
^https://example\.com/api/v1/ads url response-json "ads" replace "[]"

;多字段修改(多次写)
^https://example\.com/api/v1/user url response-json "vip" replace "1"
^https://example\.com/api/v1/user url response-json "coins" replace "9999"
```

### 4.2 请求头修改

```conf
[rewrite_local]
;注入请求头
^https://example\.com/api/v1/data url request-header "X-API-Key: xxx"

;修改请求头值
^https://example\.com/api/v1/login url request-header "Authorization: Bearer token123"

;捕获Cookie(用于签到脚本)
^https://example\.com/api/v1/login url request-header "Cookie: .*"
```

### 4.3 Reject 系列

```conf
;reject — 拒绝请求(HTTP 200 + 空body)
;适用于: 图片广告、脚本文件
^https?://.*\.example\.com/ads/.* url reject

;reject-dict — 拒绝JSON请求(HTTP 200 + {})
;适用于: JSON API广告
^https?://.*\.example\.com/api/ad url reject-dict

;reject-200 — 返回200+空body(不修改Content-Type)
;适用于: 某些严格检查Content-Type的App
^https?://.*\.example\.com/track url reject-200

;reject-img — 返回1px透明GIF
;适用于: 图片广告
^https?://.*\.example\.com/ad\.gif url reject-img

;reject-array — 返回200 + []
;适用于: 期望数组响应的API
^https?://.*\.example\.com/api/list url reject-array
```

### 4.4 302 重定向

```conf
;URL重定向
^https://example\.com/old-path url 302 https://example.com/new-path

;跳转到空页面
^https://example\.com/ad-landing url 302 https://example.com/blank
```

### 4.5 脚本处理

```conf
;远程脚本
^https://example\.com/api/target url script-path=https://raw.githubusercontent.com/xxx/script.js
;远程脚本 + 自定义参数(url#后加参数)
^https://example\.com/api/target url script-path=https://raw.githubusercontent.com/xxx/script.js#key=value

;本地脚本(QX 脚本目录下的文件)
^https://example\.com/api/target url script-path=script.js
```

### 4.6 响应体脚本处理

```javascript
// 当rewrite脚本拦截到响应时:
const body = $response.body;

// 修改JSON
let obj = JSON.parse(body);
obj.data.vip = true;
obj.data.ads = [];
$done({body: JSON.stringify(obj)});

// 正则替换
const newBody = body.replace(/old/g, 'new');
$done({body: newBody});

// 直接返回新body
$done({body: '{"success":true,"vip":true}'});

// 修改响应头
$done({
  body: newBody,
  headers: {"X-Custom": "value"}
});
```

---


## 五、跨平台适配框架（Env.js）

代理脚本开发通常需要适配多平台（QX/Surge/Loon/Egern/Stash）。Env.js 是社区标准封装库，提供统一的存储、通知、HTTP 接口。

### 平台 API 对照

| 功能 | QX | Surge | Loon | Egern |
|------|-----|-------|------|-------|
| 持久化 | `$prefs.valueForKey` / `setValueForKey` | `$persistentStore.read` / `write` | `$persistentStore.read` / `write` | `$config.get` / `set` |
| 通知 | `$notify(title, sub, body)` | `$notification.post(title, sub, body)` | `$notification.post(title, sub, body)` | `$notification(title, sub, body)` |
| HTTP | `$task.fetch` | `$httpClient` | `$httpClient` | `$api.http` |
| 完成 | `$done()` | `$done()` | `$done()` | `$done()` |

### 三平台统一读写

```javascript
// 通用持久化
function read(key) {
    if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
    if (typeof $config !== 'undefined') return $config.get(key);
    return null;
}
function write(val, key) {
    if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, key);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key);
    if (typeof $config !== 'undefined') return $config.set(key, val);
    return false;
}
```

### 通用通知封装

```javascript
function notify(title, subtitle, body) {
    if (typeof $notify !== 'undefined') $notify(title, subtitle, body);
    else if (typeof $notification !== 'undefined') {
        if (typeof $notification.post !== 'undefined') $notification.post(title, subtitle, body);
        else $notification(title, subtitle, body);
    }
}
```

### Env.js 骨架

```javascript
const $ = new Env('ScriptName');

// 存储封装
$.read = (key) => read(key);
$.write = (val, key) => write(val, key);

// 主逻辑
!(async () => {
    const result = await doWork();
    $.msg('完成', '', result);
    $.done();
})();
```



## 六、常用脚本模式与模板

### Unlock（解锁会员）
适用于 JSON 响应体，常见字段：`vip`、`isVip`、`member`、`expireTime`、`isMember`、`isPaid`。

```javascript
const url = $request.url;
if (url.includes('api/subscribe') || url.includes('api/vip/status')) {
    let body = JSON.parse($response.body);
    if (body.data) {
        body.data.vip = true;
        body.data.isVip = 1;
        body.data.member = true;
        body.data.expireTime = 3250368000000; // 2099-12-31
        body.data.expireDate = "2099-12-31 23:59:59";
    }
    $done({ body: JSON.stringify(body) });
} else {
    $done({});
}
```

### Checkin（自动签到）
定时任务 + Token 持久化，每次签到后更新 Token。

```javascript
const $ = new Env('AutoCheckin');
const TOKEN_KEY = 'checkin_token';
const API_URL = 'https://api.example.com/checkin';

!(async () => {
    const token = $.read(TOKEN_KEY);
    if (!token) { $notification.post('签到失败', '', 'Token 未配置'); $done(); return; }
    const resp = await fetch(API_URL, { headers: { Authorization: token } });
    const data = await resp.json();
    if (data.code === 0) {
        $.write(data.new_token || token, TOKEN_KEY);
        $.msg('签到成功', '', data.message || '');
    }
    $done();
})();
```

### Cookie 捕获
```javascript
const cookie = $request.headers['Cookie'] || $request.headers['cookie'];
if (cookie && cookie.includes('sess')) {
    $persistentStore.write(cookie, 'captured_cookie');
    $notification.post('Cookie 捕获成功', '', cookie.slice(0, 50) + '...');
}
$done();
```

### 去广告（API 拦截）
```javascript
const url = $request.url;
const adPatterns = [
    'api/ad', 'api/ads', 'adservice', 'analytics', 'log/promotion',
    'ads-config', 'commercial', 'sponsor'
];
if (adPatterns.some(p => url.includes(p))) {
    $done({ status: 'HTTP/1.1 200 OK', body: '' });
} else {
    $done({});
}
```



## 七、HAR Parser 自动化工具

自动解析 HAR/ZIP 抓包文件，提取 API 端点、鉴权头、VIP 字段。

### 用法
```bash
python3 har_parser.py <file.har|file.zip> [--save]
python3 har_parser.py --url https://example.com/session.har
```

### 功能
- 自动跳过静态资源（.js/.css/.png/.woff/.svg/.mp4）和 Analytics/Tracking/Ads
- 高亮鉴权头：Cookie、Authorization、Token、X-Auth、X-Api-Key
- 递归搜索 JSON 响应中的 VIP/订阅 字段（vip、isVip、member、subscription、expireTime、isPaid 等）
- `--save` 导出 JSON 分析报告，供后续脚本编写参考

### 集成到工作流
```bash
# 1. 抓包导出 HAR
# 2. 自动分析
python3 har_parser.py traffic.har --save
# 3. 查看提取的 API + VIP 字段
cat traffic.har.analysis.json
# 4. 针对性编写解锁/签到脚本
```

### 源码（ har_parser.py ）
```python
#!/usr/bin/env python3
"""
HAR 解析工具 — 从抓包文件提取关键 API 接口

支持:
  .har 文件（HTTP Archive）
  .zip 文件（部分抓包工具导出格式）
  .json 文件（Mitmproxy/Surge 导出）

用法:
  python3 har_parser.py 抓包.har
  python3 har_parser.py 抓包.zip
  python3 har_parser.py 抓包.json
  python3 har_parser.py 抓包.har --verbose   # 显示更多详情
"""

import json, sys, zipfile, os
from io import StringIO

def load_har(path):
    """加载 HAR 文件，支持 .har/.zip/.json"""
    data = None

    # 如果是 .zip，尝试解压后读取 .har
    if path.endswith('.zip'):
        print(f"📦 检测到 ZIP 压缩包，解压中...")
        with zipfile.ZipFile(path) as z:
            # 找里面的 .har/.json 文件
            har_files = [n for n in z.namelist() if n.endswith('.har') or n.endswith('.json')]
            if not har_files:
                print("❌ ZIP 内未找到 .har 或 .json 文件")
                print(f"   文件列表: {z.namelist()}")
                sys.exit(1)
            target = har_files[0]
            print(f"   读取: {target}")
            data = json.loads(z.read(target))
    else:
        # 直接读 .har 或 .json
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)

    return data

def extract_entries(data):
    """从 HAR 结构中提取 entries 列表"""
    # 标准 HAR 格式
    if 'log' in data and 'entries' in data['log']:
        return data['log']['entries']
    # Mitmproxy 格式
    if 'entries' in data:
        return data['entries']
    # 直接是数组
    if isinstance(data, list):
        return data
    print("⚠️  无法识别的格式，支持: HAR / Mitmproxy / 数组")
    return []

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    path = sys.argv[1]
    verbose = '--verbose' in sys.argv

    if not os.path.exists(path):
        print(f"❌ 文件不存在: {path}")
        sys.exit(1)

    print(f"📂 文件: {path} ({os.path.getsize(path)/1024:.0f}KB)")
    data = load_har(path)
    entries = extract_entries(data)
    print(f"📊 共 {len(entries)} 条请求\n")

    # 过滤并显示关键 API
    count = 0
    for e in entries:
        url = e['request']['url']
        method = e['request']['method']
        status = e['response']['status']
        mime = e['response']['content'].get('mimeType', '')
        size = e['response']['content'].get('size', 0)

        # 过滤无关请求
        skip_exts = ['.js', '.css', '.png', '.jpg', '.gif', '.svg', '.ico', '.woff', '.ttf']
        if any(url.endswith(ext) for ext in skip_exts): continue
        if any(k in url for k in ['analytics', 'log', 'stat', 'google', 'jpush', 'umeng']): continue
        if size < 50: continue

        count += 1
        print(f"\n{'='*60}")
        print(f"{'🟢' if status == 200 else '🟡'} {method} {status} | {size/1024:.1f}KB | {mime.split('/')[-1]}")
        print(f"  URL: {url[:150]}")

        # 显示请求头（关键字段）
        headers = {h['name']: h['value'] for h in e['request'].get('headers', []) if h['name'] in ('Cookie', 'Authorization', 'User-Agent', 'X-Token', 'token')}
        if headers:
            for k, v in headers.items():
                print(f"  {k}: {v[:80]}..." if len(v) > 80 else f"  {k}: {v}")

        # 显示响应体字段
        text = e['response']['content'].get('text', '')
        if text and len(text) < 5000:
            try:
                obj = json.loads(text)
                if isinstance(obj, dict):
                    print(f"  响应字段: {', '.join(obj.keys())[:120]}")
                    # 标记可疑的 VIP/订阅字段
                    vip_keys = [k for k in obj.keys() if any(v in k.lower() for v in ['vip', 'vip_type', 'is_vip', 'svip', 'member', 'subscription', 'expire'])]
                    if vip_keys:
                        print(f"  🔑 可能需要的字段: {', '.join(vip_keys)}")
                        for k in vip_keys[:3]:
                            print(f"     {k} = {json.dumps(obj[k], ensure_ascii=False)[:60]}")
            except:
                pass

        if not verbose and count >= 30:
            print(f"\n⚠️  显示前 30 条，使用 --verbose 查看全部")
            break

    print(f"\n📋 共显示 {count} 条 API 请求")

if __name__ == '__main__':
    main()

```


## 八、Task 详解

### 5.1 task_local 格式

```conf
[task_local]
;cron: 定时任务
格式: cron 脚本路径, tag=名称, img-url=图标, enabled=开/关

;event-interaction: UI交互(长按策略组/节点唤出)
event-interaction 脚本路径, tag=名称, img-url=图标, enabled=true

;event-network: 网络切换触发
event-network 脚本路径, tag=名称, enabled=false
```

### 5.2 cron 表达式

```
分钟 小时 日 月 周
*    *    * * *   = 每分钟
0    8    * * *   = 每天8点
*/30 *    * * *   = 每30分钟
0    8,20 * * *   = 每天8点和20点
0    9    * * 1-5 = 工作日9点
```

### 5.3 task-gallery(任务仓库)

```json
// gallery.json 格式
{
  "name": "签到脚本集",
  "description": "日常签到脚本",
  "tasks": [
    {
      "name": "签到",
      "url": "https://example.com/checkin.js",
      "cron": "0 8 * * *",
      "enabled": true,
      "icons": ["https://example.com/icon.png"]
    }
  ]
}
```

### 5.4 签到脚本模板

```javascript
// 签到脚本通用模板
const $ = new Env("签到脚本名称");

(async () => {
  // 1. 读取Cookie/Token
  const cookie = $.read("cookie_key");
  if (!cookie) {
    $.msg("签到失败", "未获取到Cookie", "请先通过重写采集Cookie");
    $.done();
    return;
  }

  // 2. 执行签到请求
  const response = await $.http.post({
    url: "https://api.example.com/checkin",
    headers: {
      "Cookie": cookie,
      "User-Agent": "Mozilla/5.0..."
    }
  });

  // 3. 解析结果
  const result = JSON.parse(response.body);
  if (result.success) {
    $.msg("签到成功", `获得${result.points}积分`, `总积分: ${result.total}`);
  } else {
    $.msg("签到失败", result.message || "未知错误", "");
  }
})();

function Env(name) {
  const isQX = typeof $task !== "undefined";
  const isSurge = typeof $httpClient !== "undefined";
  const isLoon = typeof $loon !== "undefined";

  this.read = (key) => {
    if (isQX) return $prefs.valueForKey(key);
    if (isSurge || isLoon) return $persistentStore.read(key);
  };

  this.write = (value, key) => {
    if (isQX) return $prefs.setValueForKey(value, key);
    if (isSurge || isLoon) return $persistentStore.write(value, key);
  };

  this.msg = (title, sub, body) => {
    if (isQX) $notify(title, sub, body);
    if (isSurge) $notification.post(title, sub, body);
    if (isLoon) $notification.post(title, sub, body);
  };

  this.http = {
    post: (params) => new Promise((resolve, reject) => {
      if (isQX) {
        $task.fetch({...params, method: "POST"}).then(resp => resolve(resp), err => reject(err));
      } else if (isSurge || isLoon) {
        $httpClient.post(params, (err, resp) => err ? reject(err) : resolve(resp));
      }
    }),
    get: (params) => new Promise((resolve, reject) => {
      if (isQX) {
        $task.fetch({...params, method: "GET"}).then(resp => resolve(resp), err => reject(err));
      } else if (isSurge || isLoon) {
        $httpClient.get(params, (err, resp) => err ? reject(err) : resolve(resp));
      }
    })
  };

  this.done = () => { $done(); };

  // 持久化存储管理(多账户)
  this.readAllKeys = () => {
    // QX: $prefs 无法列举所有key，需要自行维护key列表
    // 建议用固定的key命名: `scriptname_cookies`
    const raw = this.read("cookies");
    return raw ? JSON.parse(raw) : {};
  };
  this.saveCookies = (cookies) => {
    this.write(JSON.stringify(cookies), "cookies");
  };

  this.done = () => { $done(); };
}
```

### 5.5 多账户签到模板

```javascript
// 多账户签到
const $ = new Env("多账户签到");
const accounts = JSON.parse($.read("accounts") || "[]");

(async () => {
  if (accounts.length === 0) {
    $.msg("无账户", "请先在BoxJS或持久化中配置账户信息", "");
    $.done();
    return;
  }

  let results = [];
  for (const acc of accounts) {
    try {
      const resp = await $.http.post({
        url: "https://api.example.com/checkin",
        headers: { "Cookie": acc.cookie }
      });
      const data = JSON.parse(resp.body);
      results.push(`${acc.name}: ${data.message}`);
    } catch (e) {
      results.push(`${acc.name}: 失败`);
    }
  }

  $.msg("签到完成", `成功 ${accounts.length} 个账户`, results.join("\n"));
})();
```

### 5.6 Cookie 采集脚本

```conf
[rewrite_local]
;捕获登录时的Cookie
^https://example\.com/api/login url script-path=https://raw.githubusercontent.com/xxx/cookie.js
```

```javascript
// cookie.js — Cookie采集
const cookie = $request.headers["Cookie"] || $request.headers["cookie"];
if (cookie) {
  // 保存到持久化存储
  const existing = JSON.parse($prefs.valueForKey("cookies") || "{}");
  existing["example"] = cookie;
  $prefs.setValueForKey(JSON.stringify(existing), "cookies");
  $notify("Cookie获取成功", "example.com", cookie.substring(0, 50) + "...");
}
$done({});
```

---

## 九、去广告实战

### 6.1 去广告流程

```
1. 开启HTTP抓包 → 操作App → 关闭抓包
2. 在抓包列表中按关键字搜索: ad, ads, sponsor, promotion, tracking
3. 确定广告请求URL
4. 选择去广告方案:

方案A: URL直接拒绝
^https?://.*example\.com/ads/.* url reject

方案B: JSON API 返回空
^https?://.*example\.com/api/v1/ad url reject-dict

方案C: 响应体删除广告字段
^https?://.*example\.com/api/home url response-json "banner_ads" replace "[]"

方案D: 响应体正则过滤
^https?://.*example\.com/api/data url response-body "<ad>.*?</ad>" replace ""

5. 将规则添加到 [rewrite_local]
6. 将域名添加到 [mitm] hostname
7. 测试验证
```

### 6.2 去广告模板

```conf
[rewrite_local]
# 方案A: URL关键词匹配拒绝
^https?://.*\.googlesyndication\.com/.* url reject
^https?://.*\.doubleclick\.net/.* url reject
^https?://.*\.googleadservices\.com/.* url reject
^https?://.*\.applovin\.com/.* url reject

# 方案B: 特定API路径拒绝
^https?://api\.example\.com/v\d+/ad(url)? reject
^https?://api\.example\.com/v\d+/track(url)? reject-200

# 方案C: 响应体JSON字段清除
^https?://api\.example\.com/v\d+/home url response-json "ads" replace "[]"
^https?://api\.example\.com/v\d+/home url response-json "sponsor" replace "null"

[mitm]
hostname = *.googlesyndication.com, *.doubleclick.net, *.applovin.com, api.example.com
```

---

## 十、配置片段(snippet)

### 7.1 snippet 文件格式

```conf
; snippet 文件放在 iCloud/Quantumult X/Profiles/ 或 Scripts/ 目录
; 以 .snippet 后缀保存

[rewrite_local]
^https?://api\.example\.com/ad url reject

[mitm]
hostname = api.example.com
```

### 7.2 引用 snippet

```conf
;在配置文件中引用：
rewrite.snippet, tag=自定义重写, enabled=true
```

---

## 十一、资源解析器

### 8.1 作用

将不兼容格式的远程资源(节点/分流/重写)自动转换为 QX 可用格式。

### 8.2 配置

```conf
[general]
resource_parser_url= https://fastly.jsdelivr.net/gh/KOP-XIAO/QuantumultX@master/Scripts/resource-parser.js
```

### 8.3 使用

在 `server_remote` / `filter_remote` / `rewrite_remote` 中添加：
```
opt-parser=true
```
即可启用解析器处理该订阅。

---

## 十二、持久化与 BoxJS

### 9.1 QX 持久化

```javascript
// QX
$prefs.valueForKey("key");        // 读
$prefs.setValueForKey("value", "key"); // 写
```

### 9.2 BoxJS 订阅

BoxJS 提供 Web UI 管理持久化数据，通过 rewrite_remote 添加：

```conf
[rewrite_remote]
https://raw.githubusercontent.com/chavyleung/scripts/master/box/rewrite/boxjs.rewrite.quanx.conf, tag=BoxJS, opt-parser=true, enabled=true
```

然后在 BoxJS 里添加订阅(JSON)来管理各脚本的配置。

---

## 十三、完整脚本模板

### 模板1: 去重写广告(最简)

```conf
[rewrite_local]
^https?://.*\.example\.com/ad\.json url reject-dict
[mitm]
hostname = *.example.com
```

### 模板2: JSON解锁会员

```conf
[rewrite_local]
^https?://api\.example\.com/v1/user url response-json "vip" replace "1"
^https?://api\.example\.com/v1/user url response-json "vip_expire" replace "4092599349"
[mitm]
hostname = api.example.com
```

### 模板3: 响应体替换

```conf
[rewrite_local]
^https?://api\.example\.com/v1/user url response-body "\"vip\":false" replace "\"vip\":true"
[mitm]
hostname = api.example.com
```

### 模板4: 每日签到(task_local)

```conf
[task_local]
0 8 * * * https://raw.githubusercontent.com/xxx/checkin.js, tag=每日签到, img-url=https://raw.githubusercontent.com/xxx/icon.png, enabled=true
```

### 模板5: 多规则组合

```conf
[rewrite_local]
^https?://api\.example\.com/v1/home url response-json "ads" replace "[]"
^https?://api\.example\.com/v1/home url response-json "banners" replace "[]"
^https?://api\.example\.com/v1/user url response-json "vip" replace "1"
^https?://stats\.example\.com/track url reject-200

[mitm]
hostname = api.example.com, stats.example.com
```

---

## 十四、URL Scheme 远程操作

通过 URL Scheme 实现配置导入和资源添加：

```
quantumult-x:///update-configuration?remote-resource=url-encoded-json
quantumult-x:///add-resource?remote-resource=url-encoded-json
quantumult-x:///ui?module=gallery&action=add
```

### 配置导入 JSON 格式

```json
{
    "server_remote": [
        "https://example.com/sub, tag=节点订阅, opt-parser=true, enabled=true"
    ],
    "filter_remote": [
        "https://example.com/filter.list, tag=分流规则, force-policy=策略组名, enabled=true"
    ],
    "rewrite_remote": [
        "https://example.com/rewrite.snippet, tag=重写规则, opt-parser=true, enabled=true"
    ]
}
```

### task-gallery + icon-gallery 格式

```json
// task-gallery (任务仓库)
{
  "name": "签到脚本集",
  "description": "日常签到脚本",
  "task": [
    {"config": "0 8 * * * https://example.com/checkin.js, tag=签到, img-url=icon.png, enabled=true", "addons": "https://example.com/rewrite.snippet"}
  ]
}

// icon-gallery (图标仓库)
{
  "name": "图标包",
  "description": "策略组图标",
  "icons": [
    {"name": "Netflix", "url": "https://example.com/netflix.png"},
    {"name": "YouTube", "url": "https://example.com/youtube.png"}
  ]
}
```

## 十五、资源解析器参数化 UI 协议

> QX v1.5.6+ 支持

资源解析器脚本可通过 `$parser` 对象声明 hash 参数，让 QX 客户端自动渲染编辑界面：

```javascript
// 解析器脚本中定义:
$parser.hashSchema = function() {
  return {
    "param1": { label: "参数名", type: "text", placeholder: "输入..." },
    "switch1": { label: "开关", type: "boolean", default: true }
  };
};

$parser.hashToUI = function(hash) {
  // hash: "key1=val1&key2=val2"
  // 返回 UI 组件描述
};

$parser.uiToHash = function(values) {
  // values: { "key1": "val1" }
  // 返回 URL hash 字符串
};
```

---

## 注意事项

- 添加 rewrite 规则后，对应的域名必须添加到 [mitm] hostname 中
- MITM 需要信任根证书才能生效
- 正则表达式中的 `.` 需要转义为 `\.`
- 多个 rewrite 规则作用于同一 URL 时，按顺序执行
- task_local 需 QX 处于运行状态且 task 开关开启
- 远程资源(server_remote/filter_remote/rewrite_remote)建议开启 `opt-parser=true` 以兼容各种格式
- 配置片段 .snippet 放在 `iCloud/Quantumult X/Profiles/` 或 `Scripts/` 目录
- 策略组的 `server-tag-regex` 支持正则匹配节点名进行筛选

---

## 十六、RevenueCat 4.x 订阅解锁（重要更新）

### 十、RevenueCat 4.x 订阅（原始）

### 10.1 RevenueCat SDK 特征识别

RevenueCat 是 iOS App 最常用的第三方订阅管理 SDK。抓包时通过以下特征识别：

```json
// 请求头特征
X-Platform: iOS
X-Version: 4.x              // SDK 版本
X-StoreKit2-Enabled: false  // StoreKit1 模式
X-Client-Bundle-ID: com.example
Authorization: Bearer appl_...  // RevenueCat 公钥

// 响应头特征
x-signature: ...  // SDK 4.x 新增响应签名验证
x-revenuecat-etag: ...
```

常见 RevenueCat 域名：
- `api.revenuecat.com`（主域名）
- `api.rc-backup.com`（备用域名）

### 10.2 RevenueCat 4.x 关键变化

SDK 4.x 相比旧版增加了 `x-signature` 响应签名验证机制。**只改响应体不够**——SDK 会校验签名，body 改了但签名不对，SDK 直接拒绝并用缓存数据覆盖。

**解决方案：双规则（body + header 两条规则指向同一个脚本）**

```ini
[MITM]
hostname = api.revenuecat.com, api.rc-backup.com

[rewrite_local]
# 规则1: 改响应体 - 注入PRO权益
^https?://api.(revenuecat|rc-backup).com/v1/.* url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/AppName.js

# 规则2: 去签名头 - 否则SDK拒绝修改后的body
^https?://api.(revenuecat|rc-backup).com/v1/.* url script-response-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/AppName.js
```

### 10.3 JavaScript 脚本模板

```javascript
// ==Header模式（script-response-header）==
if (!$response.body) {
  var h = $response.headers;
  delete h['x-signature'];        // 去签名验证
  delete h['etag'];               // 去缓存标签
  delete h['x-revenuecat-etag'];
  h['Cache-Control'] = 'no-cache'; // 强制重新拉取
  $done({headers: h});
  return;
}

// ==Body模式（script-response-body）==
try {
  var obj = JSON.parse($response.body);
  var now = new Date().toISOString();

  // 永久买断: expires_date = null
  // 订阅制: expires_date = 未来日期
  var pro = {
    expires_date: null,
    product_identifier: "product_id",
    purchase_date: now
  };

  // 任何含 subscriber 的响应都注入
  if (obj.subscriber) {
    obj.subscriber.entitlements = { pro: pro };
    obj.subscriber.subscriptions = { product_id: {
      expires_date: null, period_type: "normal",
      purchase_date: now, store: "app_store"
    }};
  }
  // offerings 也注入保底（部分SDK版从offerings读权益）
  if (obj.offerings) {
    obj.subscriber = { entitlements: { pro: pro }, subscriptions: {} };
  }

  $done({body: JSON.stringify(obj)});
} catch(e) { $done({}); }
```

### 10.4 RevenueCat 抓包关键字段解读

| HAR字段 | 含义 | 用途 |
|---------|------|------|
| `X-Platform: iOS` | iOS平台 | 确认是Apple端订阅 |
| `X-StoreKit2-Enabled: false` | 使用StoreKit1 | 依赖服务端验证，可MITM |
| `X-Version: 4.x` | SDK版本号 | ≥4.x需要处理x-signature |
| `Authorization: Bearer appl_...` | RevenueCat公钥 | 区分是RevenueCat请求 |
| `x-signature` | 响应签名 | 必须删除否则body修改无效 |
| `x-revenuecat-etag` | 响应缓存标签 | 删除强制走新数据 |
| `$RCAnonymousID:xxx` | 匿名用户ID | 每个安装唯一 |
| `X-Client-Bundle-ID` | App的Bundle ID | 确认目标App |
| `product_entitlement_mapping` | 产品→权益映射 | 知道哪个product对应哪个entitlement |
| `/v1/subscribers/{id}` | 订阅状态（核心） | 改这里返回PRO |
| `/v1/subscribers/{id}/offerings` | 付费墙 | 注入subscriber保底 |
| `/v1/receipts` | 收据验证 | "恢复购买"触发，注入PRO |

### 10.5 永久买断 vs 订阅制

| 类型 | expires_date | 特点 |
|------|-------------|------|
| 永久买断 | `null` | 一次付费永久使用，不续期 |
| 订阅制 | `2099-12-31T23:59:59Z` | 定期扣费，有过期时间 |
| 免费试用 | 同上（但 `period_type: "trial"`） | 限时免费体验 |

### 10.6 常见问题

**Q: 恢复购买成功，但下次启动又没了？**
A: SDK启动时后台刷新订阅状态。如果MITM没拦截订阅刷新请求，返回的"无PRO"状态会覆盖缓存。方案：全API路径匹配 + 清掉etag/signature头。

**Q: 抓包里没有 `/v1/subscribers/{id}` 请求？**
A：SDK缓存了上次结果。杀掉app重开，或者卸载重装（首次启动必定请求）。

**Q: Surge/Loon怎么配？**
A：Surge用 `type=http-response`，Loon用 `http-response` 单条规则即可（两者都同时拦截body+header）。

---

## 十七、多端点校验型 SDK 脚本写法（Adapty 范式）

> Adapty 是一种典型——改一个端点不够，SDK 会在多个端点交叉验证购买状态。以后遇到同类 SDK，按这个写法套。

### 17.1 识别信号

请求头含 SDK 专用 profile ID 字段（如 `adapty-sdk-profile-id`、`adjust-id`、`branch-id`），域名是 API 平台。HAR 中可能看不到购买校验请求——它们只在购买/恢复/过期时触发。

### 17.2 核心模式：按 URL 路径分分支 mock

多端点 SDK 必须针对每个 API 路径返回**不同的 mock 结构**：

```javascript
if (/(analytics\/profiles|purchase\/app-store)/.test($request.url)) {
  // 分支 A: transactions
  data.attributes.apple_validation_result.transactions = [...]

}
if (/(receipt\/validate|purchase-containers)/.test($request.url)) {
  // 分支 B: receipt + latest_receipt_info
  data.attributes.apple_validation_result = { receipt: {...}, status: 0 }
}
```

### 17.3 响应模板

```
data.type = "profile_apple"
data.attributes.subscriptions = { id: premium }
data.attributes.paid_access_levels = { premium }
data.attributes.apple_validation_result
  ├─ transactions[]                          ← profiles 端点
  ├─ receipt.in_app[] + latest_receipt_info[] ← receipt 端点
  └─ status: 0                               ← 通用
```

profileId 从请求头取，不写死。

### 17.4 Rule 写法

```ini
# QX
^https?:\/\/api\.xxx\.io\/api\/v\d\/sdk\/(analytics\/profiles|in-apps\/(apple\/receipt\/validate|purchase-containers)|purchase\/app-store) url script-response-body App.js

# Surge
app-profile = type=http-response,pattern=^https?:\/\/api\.xxx\.io\/api\/v\d\/sdk\/(analytics\/profiles|purchase\/app-store),requires-body=1,script-path=App.js
app-receipt = type=http-response,pattern=^https?:\/\/api\.xxx\.io\/api\/v\d\/sdk\/in-apps\/(apple\/receipt\/validate|purchase-containers),requires-body=1,script-path=App.js

# Loon
^https?:\/\/api\.xxx\.io\/api\/v\d\/sdk\/(analytics\/profiles|purchase\/app-store) url script-response-body App.js
^https?:\/\/api\.xxx\.io\/api\/v\d\/sdk\/in-apps\/(apple\/receipt\/validate|purchase-containers) url script-response-body App.js
```

### 17.5 常见坑

| 症状 | 原因 | 修复 |
|------|------|------|
| 改 profile 后仍锁 | 没拦 receipt/validate 端点 | 补规则 |
| 恢复购买失败 | 没拦 purchase-containers | 补规则 |
| 报错崩溃 | `data.type` 写错 | 改为 `profile_apple` |
| 改后重启失效 | SKReceipt 过期触发重新校验 | 全路径覆盖 |

---

## 十八、Surge 独有脚本类型

### 十、Surge 独有类型（原始）

Surge 除了 `http-request` / `http-response` / `cron` / `generic` 外，还有三种其他平台没有的脚本类型。

### 10.1 `type=event` — 事件脚本

当指定事件发生时触发。目前支持两种事件：

**`network-changed` — 网络变化时触发：**
```ini
[Script]
network-watch = type=event,event-name=network-changed,script-path=network.js
```

```javascript
// network.js — 网络变化时通知
$notification.post('网络切换', $network.wifi.ssid || '蜂窝网络', 
  `DNS: ${$network.dns.join(', ')}`);
$done();
```

**`notification` — 通知事件：**
Surge 弹出通知时触发，脚本可以获取通知内容：
```javascript
// notification = type=event,event-name=notification,script-path=noti.js
console.log($event.data);  // 通知数据
$done();
```

### 10.2 `type=dns` — DNS 脚本

自定义 DNS 响应，可以拦截/修改特定域名的解析结果：

```ini
[Script]
dns-rules = type=dns,script-path=dns.js
```

```javascript
// 拦截指定域名，返回自定义 IP
if ($domain === 'ads.example.com') {
  $done({ matched: true, address: '127.0.0.1', ttl: 600 });
} else if ($domain === 'tracker.example.com') {
  $done({ matched: true, drop: true });  // 直接丢弃
} else {
  $done({});  // 不处理，走正常 DNS
}
```

参数说明：
- `matched: true` — 匹配此规则
- `address: 'IP'` — 返回自定义 IP（IPv4 或 IPv6）
- `drop: true` — 丢弃该 DNS 查询
- `ttl: 秒数` — 缓存时间

### 10.3 `type=rule` — 规则脚本

在 `[Rule]` 段中作为规则使用。可以动态决定是否匹配：

```ini
[Script]
ssid-rule = type=rule,script-path=ssid-rule.js

[Rule]
SCRIPT,ssid-rule,ProxyA
```

```javascript
// ssid-rule.js — 根据 WiFi SSID 决定是否走代理
if ($network.wifi.ssid === 'MyHome') {
  $done({ matched: false });  // 不匹配，继续下一条规则
} else {
  $done({ matched: true });   // 匹配，走 ProxyA
}
```

可用的 `$request` 属性：
```javascript
$request.hostname     // 主机名
$request.destPort     // 目标端口
$request.processPath  // 进程路径
$request.userAgent    // User-Agent
$request.url          // 完整 URL
$request.sourceIP     // 源 IP
$request.dnsResult    // DNS 解析结果
```

### 10.4 `$network` — 网络状态对象

Surge 独有（QX/Loon 均无）：

```javascript
// WiFi 信息
$network.wifi.ssid;      // WiFi 名称
$network.wifi.bssid;     // WiFi BSSID

// 蜂窝网络
$network.cellular.radio; // 蜂窝制式 (LTE/NR/etc)

// DNS
$network.dns;            // DNS 服务器列表 [String]

// 网关
$network.gateway;        // 网关 IP
```

典型用途：根据网络环境切换策略、WiFi SSID 判断、DNS 变更通知。

### 10.5 Surge 模块封装

与 QX 的配置嵌入不同，Surge 用 `.sgmodule` 文件封装模块：

```ini
#!name=示例模块
#!desc=模块描述
#!author=作者
#!homepage=https://github.com/...

[Script]
解锁 = type=http-response,pattern=^https?://api\.example\.com/vip,script-path=https://...,requires-body=true

[Script]
签到 = type=cron,cronexp="30 8 * * *",script-path=https://...,timeout=60

[MITM]
hostname = api.example.com
```

使用 `Script-Hub` 可以在各平台模块间互相转换。


### 十一、高级技巧（原始）


---

## 十八、Script-Hub 平台自动转换

  const result = await resp.json();
  const msg = result.message || '签到完成';

  ctx.notify({ title: '签到结果', body: msg });
}
```

### 9.8 存量脚本迁移

现有 QX/Surge 脚本迁移到 Egern 的对照表：

|操作|QX 写法|Egern 写法|
|---|---|---|
|修改变量|`$done({body: JSON.stringify(obj)})`|`return {body: obj}`|
|解析响应|`JSON.parse($response.body)`|`await ctx.response.json()`|
|读请求头|`$request.headers['Cookie']`|`ctx.request.headers.get('Cookie')`|
|返回空|`$done({})` (不修改)|`return` (不修改)|
|拒绝请求|无法|`return ctx.abort()`|
|直接响应|无法|`return ctx.respond({status:200, body:'OK'})`|
|读存储|`$prefs.valueForKey('k')`|`ctx.storage.get('k')`|
|写存储|`$prefs.setValueForKey('v', 'k')`|`ctx.storage.set('k', 'v')`|

### 9.9 自动转换（推荐）

**方案一：Script-Hub（全自动，推荐）**

[Script-Hub](https://github.com/Script-Hub-Org/Script-Hub) 是一个高级脚本转换器，支持 QX → Surge/Loon/Stash/Egern/Shadowrocket 之间的互转：

```yaml
# 使用方法
# 1. 浏览器打开 Script-Hub 网页
# 2. 来源类型: QX 重写/ Surge 模块 / Loon 插件
# 3. 目标类型: Egern
# 4. 输入我们的 QX rewrite 规则链接
# 5. 一键转换 → 得到 Egern 配置
```

转换效果示例：

```
# QX 规则:
^https?://api\.example\.com/vip url script-response-body https://.../App.js

# → Script-Hub 自动转为 Egern:
http-response:
  - match: ^https?://api\.example\.com/vip
    script: https://.../App.js

# QX [task_local]:
30 8 * * * https://.../checkin.js

# → Egern:
schedule:
  - cron: 30 8 * * *
    script: https://.../checkin.js

# QX [mitm]:
hostname = api.example.com

# → Egern:
mitm:
  - hostname: api.example.com
```

**方案二：Egern 模块转换器（仅限 Surge→Egern）**

[gen.egernapp.com](https://gen.egernapp.com/) 可以将 Surge 模块转为 Egern 格式。

**注意：** 脚本内部的 JS 代码（`$done()` vs `return`）Script-Hub 尚不能自动转换。如需在 Egern 原生运行脚本，参考 9.2-9.6 节的迁移指南。





---

## 十九、高级技巧：jq filter 与 reject 变体


### 11.1 JQ 表达式修改（无需JS，更轻量）

QX 最新版本支持 JQ 表达式直接在重写规则中修改 JSON 响应体，无需编写 JavaScript。

**JQ 语法示例：**

```
# 将 ads 数组置空
^https?:\/\/api\.example\.com\/ad url script-response-body jq '.ads = []'

# 将 ad_enabled 设为 false
^https?:\/\/api\.example\.com\/config url script-response-body jq '.ad_enabled = false'

# 同时修改多个字段
^https?:\/\/api\.example\.com\/vip\/info url script-response-body jq '.vip = 1 | .vip_type = "svip" | .expires = "4092599349000"'

# 深层嵌套操作
^https?:\/\/api\.example\.com\/user url script-response-body jq '.data.vip = true | .data.expireTime = "4092599349000"'

# 删除字段
^https?:\/\/api\.example\.com\/response url script-response-body jq 'del(.ads) | del(.tracker)'
```

**JQ vs JS 的选择：**

|场景|推荐方式|原因|
|---|---|---|
|简单字段修改（改1-3个值）|JQ|一行搞定，性能好|
|复杂逻辑（条件判断、循环）|JS|JQ 不支持复杂逻辑|
|去广告（置空数组/改开关）|JQ|最常用场景，JQ 最合适|
|替换整个响应体|JS|需要完整构造新 JSON|
|按 URL 分路径处理|JS|JQ 无法做 URL 判断|

### 11.2 Reject 系列（无需脚本，零开销去广告）

QX 内置的 reject 类型是去广告最高效的方式：

```
# 直接拒绝请求（返回 404）
^https?:\/\/ad\.example\.com\/track url reject

# 返回空 JSON 对象（适用于广告API）
^https?:\/\/api\.example\.com\/ad url reject-dict

# 返回空 JSON 数组
^https?:\/\/api\.example\.com\/ad\/items url reject-array

# 返回 1px 图片
^https?:\/\/ad\.example\.com\/banner url reject-img

# 返回空 200
^https?:\/\/ad\.example\.com\/ping url reject-200
```

### 11.3 Conf 文件管理规则

```
# AD_Block.conf
[rewrite_local]
^https?:\/\/ad\.example\.com url reject
^https?:\/\/api\.example\.com\/ad url reject-dict

[mitm]
hostname = ad.example.com, api.example.com
```

### 11.4 模块化设计

复杂脚本建议拆分为 Cookie/签到/解锁 三个独立文件。

### 十二、仓库结构说明（原始）

### 文件分布

|目录|平台|格式|说明|
|---|---|---|---|
|`script/`|通用|`.js`|核心脚本源码|
|`surge/`|Surge / Egern|`.sgmodule`|Surge 模块，Egern 通用|
|`loon/`|Loon|`.plugin` / `.lpx`|Loon 插件（新旧双格式）|

## 二十、复杂响应篡改高级模式（2026 新增）

> 基于 ShortcutStudio / 各类 SaaS 限额系统的通用破解范式。覆盖条件拦截、配置开关、结构化数据伪造、多端点编排四层。

### 19.1 四层架构

```
┌─────────────────────────────────────────────────┐
│  Layer 4: 多端点编排                              │
│  不同 API 路径 → 不同处理函数                       │
├─────────────────────────────────────────────────┤
│  Layer 3: 结构化数据伪造                           │
│  构建嵌套 JSON，含类型校验、默认值                   │
├─────────────────────────────────────────────────┤
│  Layer 2: 配置开关层                               │
│  BoxJS / URL 参数 / 持久化存储 控制 mock 开/关       │
├─────────────────────────────────────────────────┤
│  Layer 1: 条件拦截层                               │
│  URL 正则匹配 + body 存在性检查 + 安全 JSON 解析     │
└─────────────────────────────────────────────────┘
```

### 19.2 Layer 1 — 条件拦截（先判断再动手）

```javascript
// 通用条件拦截模板 — 只改目标 API，其余原样返回
async function handleResponse(request, response) {
  const url = request.url;
  const limitsPattern = /\/users\/me\/limits(?:[?#/]|$)/i;
  const signPattern   = /\/sign(?:[?#/]|$)/i;
  const generatePattern = /\/generate(?:[?#/]|$)/i;

  // URL 不匹配 → 原样返回
  if (!limitsPattern.test(url) && !signPattern.test(url) && !generatePattern.test(url)) {
    return response;
  }

  // body 不存在 → 原样返回
  if (!response.body || response.body.trim() === '') {
    return response;
  }

  // 安全 JSON 解析
  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch (e) {
    return response;  // 非 JSON 不处理
  }

  // 类型校验
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return response;
  }

  return parsed;
}
```

### 19.3 Layer 2 — 配置开关（BoxJS + URL 参数双层）

```javascript
// 配置优先级：URL 参数 > BoxJS 持久存储 > 硬编码默认值

// 默认配置
const DEFAULTS = {
  limitsMock: 'off',           // 总开关
  messagesLimit: 999,
  downloadsLimit: 999,
  searchesLimit: 999,
  uploadsLimit: 999,
  marketplaceDownloadsLimit: 999,
  chatInputCharsLimit: 20000,
};

// BoxJS 存储键名
const BOXJS_KEYS = {
  limitsMock: 'ShortcutStudio.limitsMock',
  messagesLimit: 'ShortcutStudio.messagesLimit',
  downloadsLimit: 'ShortcutStudio.downloadsLimit',
  searchesLimit: 'ShortcutStudio.searchesLimit',
  uploadsLimit: 'ShortcutStudio.uploadsLimit',
  marketplaceDownloadsLimit: 'ShortcutStudio.marketplaceDownloadsLimit',
  chatInputCharsLimit: 'ShortcutStudio.chatInputCharsLimit',
};

// 持久化读取
function readConfig() {
  const config = {};
  for (const [key, boxjsKey] of Object.entries(BOXJS_KEYS)) {
    let val = null;
    try { val = $.getItem(boxjsKey); } catch(e) {}
    if (val != null && String(val).trim() !== '') {
      config[key] = val;
    }
  }
  return { ...DEFAULTS, ...config };
}

// URL 参数覆盖（?limitsMock=on&messagesLimit=9999）
function readUrlParams(url) {
  const params = {};
  try {
    const q = url.split('?')[1];
    if (!q) return params;
    q.split('&').forEach(pair => {
      const [k, v = ''] = pair.split('=', 2);
      const decoded = decodeURIComponent(v.replace(/\+/g, ' '));
      if (k) params[k] = decoded;
    });
  } catch(e) {}
  return params;
}

// 统一开关判断
function isMockEnabled(limitsMock) {
  const v = String(limitsMock ?? '').trim().toLowerCase();
  return v === 'on' || v === '1' || v === 'true' || v === 'yes' || v === 'enable' || v === 'enabled';
}
```

### 19.4 Layer 3 — 结构化数据伪造（构建嵌套 JSON）

```javascript
// 函数式字段构建器 — 带类型校验、边界默认
function buildLimitField(value, fallback = 0) {
  const num = parseInt(String(value ?? ''), 10);
  const limit = Number.isFinite(num) && num >= 0 ? num : fallback;

  return {
    allowed: limit > 0,
    current: 0,
    limit: limit,
    remaining: limit,
  };
}

// 余额/积分类字段
function buildCreditField(value, fallback = 99999) {
  const num = parseInt(String(value ?? ''), 10);
  const amount = Number.isFinite(num) && num >= 0 ? num : fallback;

  return {
    total: amount,
    used: 0,
    remaining: amount,
    unit: 'credits',
  };
}

// 注入限额响应
function injectLimits(originalBody, config) {
  const obj = typeof originalBody === 'string'
    ? JSON.parse(originalBody)
    : originalBody;

  obj.limits = obj.limits && typeof obj.limits === 'object' ? obj.limits : {};

  obj.limits.messages = buildLimitField(config.messagesLimit);
  obj.limits.downloads = buildLimitField(config.downloadsLimit);
  obj.limits.searches = buildLimitField(config.searchesLimit);
  obj.limits.uploads = buildLimitField(config.uploadsLimit);
  obj.limits.marketplace_downloads = buildLimitField(config.marketplaceDownloadsLimit);
  obj.limits.chat_input_chars = buildLimitField(config.chatInputCharsLimit);

  return obj;
}
```

### 19.5 Layer 4 — 多端点编排（完整版）

```ini
# config斯诺
hostname = api.shortcutstudio.app

# 每个端点独立处理
^https://api\.shortcutstudio\.app/generate([?#/]|$) url script-response-body https://xxx/response.js
^https://api\.shortcutstudio\.app/sign([?#/]|$)     url script-response-header https://xxx/request.js
^https://api\.shortcutstudio\.app/users/me/limits([?#/]|$) url script-response-body https://xxx/response.js
^https://api\.shortcutstudio\.app/users/me/limits([?#/]|$) url script-response-header https://xxx/request.js
```

```javascript
// response.js — 统一出口，按 URL 分发
const HANDLERS = {
  limits: handleLimitsResponse,
  sign: handleSignResponse,
};

async function main() {
  const url = $request.url.toLowerCase();

  // 分发
  for (const [name, handler] of Object.entries(HANDLERS)) {
    if (url.includes(`/${name}`)) {
      $response = await handler($request, $response);
      break;
    }
  }

  done($response);
}

main().catch(e => {
  console.error(e);
  done({});
});

function handleLimitsResponse(request, response) {
  if (!response?.body) return response;

  const config = readConfig();
  const urlParams = readUrlParams(request.url);
  const merged = { ...config, ...urlParams };

  if (!isMockEnabled(merged.limitsMock)) return response;

  let parsed;
  try { parsed = JSON.parse(response.body); } catch { return response; }

  const enriched = injectLimits(parsed, merged);

  // 清理 Content-Length（body 改了，原长度失效）
  const headers = response.headers && typeof response.headers === 'object'
    ? { ...response.headers } : {};
  delete headers['Content-Length'];
  delete headers['content-length'];

  return { ...response, body: JSON.stringify(enriched), headers };
}
```

### 19.6 关键遗漏清单（避免踩坑）

| 遗漏 | 后果 | 必须加 |
|------|------|--------|
| 未检查 `$response.body` 存在 | 非 body 响应直接崩溃 | `if (!?.body) return` |
| JSON.parse 无 try-catch | 非 JSON 500 错误 | 全部包裹 |
| 未清理 Content-Length | body 改了但长度标记是旧的，QX 报错 | `delete headers['Content-Length']` |
| 没做类型校验 | 数组被当对象改 | `typeof === 'object' && !Array.isArray` |
| 忽略配置优先级 | BoxJS/参数/默认混读 | 三层合并 `{...defaults, ...boxjs, ...urlParams}` |
| 无 mock 开关 | 全局生效无法关 | 三层判断 `on/1/true/yes/enable` |

### 19.7 与 RevenueCat 双规则对比

| 维度 | RevenueCat 模式 | SaaS 限额模式 (本节) |
|------|----------------|-------------------|
| 目标 | 改 body 注入 entitlement | 改 body 注入 limit 数值 |
| Header 改动 | 去 x-signature/etag | 去 Content-Length |
| 配置层 | 一般写死 | BoxJS + URL 参数可调 |
| 多端点 | 单一subscriber端点 | generate/sign/limits 三分 |
| 数据复杂度 | 嵌套 entitlement 对象 | 嵌套 limit 对象 + buildLimitField |
| X-Header | 必有 (StoreKit) | 一般无 |

### 19.8 通用破解 SaaS 的 5 步法

```
Step 1: 抓包 → 找到 /limits / /quota / /usage / /me / /subscription 等端点
Step 2: 找响应体中控制限额的 JSON 字段（常见：limits, quota, usage, subscription, plan）
Step 3: 分析字段结构（是纯数字？对象含 limit/used/remaining？嵌套层级？）
Step 4: 写 mock 响应：对应字段替换为极大值 / allowed: true / expires_date: null
Step 5: 配置 BoxJS 开关 + Content-Length 清理 → 全局生效
```

### 19.9 BoxJS 订阅写法

BoxJS 面板需提供 mock 开关 + 数值自定义：

```json
{
  "id": "ShortcutStudio@youth",
  "name": "ShortcutStudio 破解",
  "keys": [
    "@ShortcutStudio.limitsMock",
    "@ShortcutStudio.messagesLimit",
    "@ShortcutStudio.downloadsLimit"
  ],
  "settings": [
    {
      "id": "@ShortcutStudio.limitsMock",
      "val": "off",
      "type": "radios",
      "items": [
        { "key": "on", "label": "开启 mock" },
        { "key": "off", "label": "关闭 mock" }
      ]
    },
    {
      "id": "@ShortcutStudio.messagesLimit",
      "val": 999,
      "type": "number",
      "label": "消息次数"
    }
  ],
  "author": "@youth",
  "repo": "https://github.com/..."
}
```
