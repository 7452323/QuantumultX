---
name: cross-platform-proxy-scripting
description: 跨平台代理脚本编写技能。Quantumult X / Surge / Loon / Egern / Stash / Shadowrocket 统一脚本开发，多平台适配层，Env.js框架。
author: 7452323 (converted from Private Gist)
tags:
  - quantumultx
  - surge
  - loon
  - egern
  - proxy
  - script
---

# Cross Platform Proxy Scripting — 跨平台代理脚本编写

## 平台适配层

| 功能 | QX | Surge | Loon | Egern |
|------|-----|-------|------|-------|
| 持久化 | $prefs | $persistentStore | $persistentStore | $config.get |
| 通知 | $notify | $notification | $notification.post | $notification |
| HTTP | $task.fetch | $httpClient | $httpClient | $api.http |
| 完成 | $done() | $done() | $done() | $done() |

## Env.js 核心 API

```javascript
const $ = new Env('脚本名');
// 存储: $.read(key) / $.write(val, key)
// 通知: $.msg(title, sub, body)
// HTTP: $.get(url, cb) / $.post(url, body, cb)
// 日志: $.log(msg)
// 完成: $.done(data)
```

## 三平台统一写法

```javascript
function read(key) {
    if (typeof $prefs !== 'undefined') return $prefs.valueForKey(key);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.read(key);
}
function write(val, key) {
    if (typeof $prefs !== 'undefined') return $prefs.setValueForKey(val, key);
    if (typeof $persistentStore !== 'undefined') return $persistentStore.write(val, key);
}
```

## 常用脚本模式

- 解锁类：响应体 JSON 修改 / Header 注入
- 签到类：Cron 定时 + 持久化 Token
- 面板类：Surge Panel / QX Panel
- 去广告类：API 置空 / 内容替换
