---
name: har-to-proxy-script
description: HAR抓包→QuantumultX/Surge/Loon代理脚本转换技能。从HAR文件提取请求/响应数据，生成代理脚本（解锁/签到/Cookie采集/去广告）。
author: 7452323 (converted from Private Gist)
tags:
  - har
  - proxy
  - quantumultx
  - surge
  - script
---

# HAR to Proxy Script — 抓包转代理脚本

## 转换流程

1. 获取 HAR 文件（Scripting http_capture/浏览器导出）
2. 解析 HAR 提取请求/响应数据
3. 识别目标端点和参数
4. 选择脚本类型（Unlock/Checkin/Cookie/AdBlock）
5. 生成对应平台脚本
6. 测试脚本可用性

## 常用转换模式

| 场景 | 提取内容 | 生成脚本 |
|------|----------|----------|
| 解锁会员 | 响应 JSON 结构 | 响应体修改 Unlock 脚本 |
| 签到 | Token/Cookie + API 地址 | Cron 签到脚本 |
| Cookie 采集 | 请求头 Cookie/Authorization | Header 捕获脚本 |
| 去广告 | 广告 API 地址 | Reject/空响应脚本 |

## 脚本模板快速生成

```javascript
// Unlock 脚本模板
const url = $request.url;
if (url.includes('api/subscribe')) {
    let body = JSON.parse($response.body);
    body.data.vip = true;
    body.data.expire = '2099-12-31';
    $done({body: JSON.stringify(body)});
} else {
    $done({});
}

// 签到脚本模板
const cookie = $prefs.valueForKey('cookie_name');
$httpClient.get({url: 'https://api.example.com/checkin', headers: {Cookie: cookie}}, function(err, resp, data) {
    if (err) $done();
    $notification.post('签到结果', '', data);
    $done();
});
```
