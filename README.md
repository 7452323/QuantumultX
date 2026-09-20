<div align="center">

# 🍀 QuantumultX

### 个人配置 · 签到脚本 · Surge模块 · Loon插件 · Venera漫画源

</div>

---

## 📁 仓库结构

```
QuantumultX/
├── task/                  # 签到脚本 (QX task_local)
│   ├── Reading/           #   微信读书全功能自动化 (来源:TomCatXue)
│   ├── Hdhive.js          #   RE0影巢签到
│   ├── Readify.js         #   Readify深读签到
│   ├── kuwoczz.js         #   酷我音乐签到
│   ├── sehuatang_checkin.js  # 色花堂签到
│   └── sxmd.js            #   书香门第签到
│
├── script/                # 脚本 (QX rewrite_local)
│   ├── ReadingAd/         #   微信读书防强更净化 (来源:TomCatXue)
│   ├── Frameworks/        #   Env.js / BoxJS 框架
│   ├── *.js               #   各类 App 解锁/功能脚本
│   └── porn ...           #   (你懂的)
│
├── surge/                 # Surge 模块
│   ├── script/            #   签到模块 (Readify / Reading / ReadingAd)
│   └── *.sgmodule         #   功能模块
│
├── loon/                  # Loon 插件
│   ├── Scrip/             #   签到插件 (Hdhive / Readify / Reading)
│   ├── *.plugin           #   功能插件
│   └── *.lpx              #   重写规则
│
├── script/Frameworks/boxjs/boxjs.json  # BoxJS 订阅配置
├── venera-sources/        # Venera 漫画源 (picacg / ehentai / jm / wnacg ...)
├── Javdb/                 # JavDB 番号查询工具
├── Userscripts/           # 油猴脚本
├── icon/                  # 图标资源
└── Rule/                  # 分流规则
```

---

## 📲 签到脚本

| 脚本 | 功能 | 定时 | 平台 |
|------|------|------|------|
| **微信读书** | 每日阅读领卡 + 周二翻牌抽奖 + 周五限免入架 | 23:00 / 周二20:00 / 周五10:00 | QX · Surge · Loon |
| **Readify深读** | 每日签到连续打卡，自动刷新token | 08:00 | QX · Surge · Loon |
| **RE0影巢** | 每日签到，Next.js Server Action协议 | 00:20 | QX · Surge · Loon |
| **酷我音乐** | 每日听歌任务领取VIP | 09:00 | QX · Surge |
| **色花堂** | 每日签到 | 08:00 | QX |
| **书香门第** | 每日签到维持会员 | 08:00 | QX · Surge |

### 🔧 微信读书自动化 (来源: TomCatXue)

> [!NOTE]
> 脚本来源：[TomCatXue/MyCookieCenter](https://github.com/TomCatXue/MyCookieCenter)
> 内置纯JS逆向签名算法，401自动脱机换票，无需手动干预

| 脚本 | 功能 | 说明 |
|------|------|------|
| `weread_cookie.js` | 凭据捕获 | 打开App自动抓取 vid/skey/refreshToken/deviceId |
| `weread_claim.js` | 每日领取 | 阅读时长达标自动领书币/体验卡 |
| `weread_flip.js` | 周二翻牌 | 自动翻牌抽奖，Cookie超时自动换票重试 |
| `weread_free.js` | 周五限免 | 自动拉取限免书库批量入架 |
| `weread.js` | 全功能合一 | 以上功能聚合版 |

### 🛡️ 微信读书防强更 (来源: TomCatXue)

> [!NOTE]
> 专为 8.2.6 等老版本设计，屏蔽强更弹窗锁定免费AI听书

| 文件 | 平台 | 位置 |
|------|------|------|
| `wxread.js` | 核心脚本 | `script/ReadingAd/` |
| `ReadingAd.sgmodule` | Surge | `surge/script/` |
| `ReadingAd.plugin` | Loon | `loon/` |

---

## 🎨 Venera 漫画源

| 源 | 文件 | 说明 |
|----|------|------|
| Picacg | `picacg.js` | 哔咔漫画 |
| Ehentai | `ehentai.js` | E-Hentai |
| JM | `jm.js` | 禁漫天堂 |
| WNACG | `wnacg.js` | WNACG |
| Mxs | `mxs.js` | 漫画星球 |
| Hcomic | `hcomic.js` | 漫画柜 |
| Jcomic | `jcomic.js` | JComicer |
| Rouman | `rouman.js` | 肉漫 |

---

## 🎬 JavDB 番号查询

```bash
node Javdb/scripts/javdb_lookup.js "SSIS-001"
```

支持番号查询、演员信息、标签分类、封面预览、评分日期，自动繁转简+日译中。

---

## 📦 快速订阅

### QX 配置引用

```ini
[task_local]
0 8 * * ? https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Readify.js, tag=Readify深读, enabled=true
0 23 * * ? https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Reading/weread_claim.js, tag=微信读书·每日领取, enabled=true

[rewrite_local]
^https?:\/\/readifyapp\.voiceclub\.cn\/api url script-an-header-echo https://raw.githubusercontent.com/7452323/QuantumultX/main/task/Readify.js

[MITM]
hostname = readifyapp.voiceclub.cn, weread.qq.com, i.weread.qq.com
```

### Surge 模块

```
https://raw.githubusercontent.com/7452323/QuantumultX/main/surge/script/Readify.sgmodule
https://raw.githubusercontent.com/7452323/QuantumultX/main/surge/script/Reading.sgmodule
https://raw.githubusercontent.com/7452323/QuantumultX/main/surge/script/ReadingAd.sgmodule
```

### Loon 插件

```
https://raw.githubusercontent.com/7452323/QuantumultX/main/loon/Scrip/Readify.plugin
https://raw.githubusercontent.com/7452323/QuantumultX/main/loon/Scrip/Reading.plugin
https://raw.githubusercontent.com/7452323/QuantumultX/main/loon/ReadingAd.plugin
```

### BoxJS 订阅

```
https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Frameworks/boxjs/boxjs.json
```

---

## 📋 BoxJS 可视化配置

支持 BoxJS 订阅一键管理所有签到账号与参数：

| 应用 | Key | 说明 |
|------|-----|------|
| 微信读书 | `weread_auth_v2` | App全量凭据 (自动捕获) |
| Readify深读 | `readify_accounts` | email#password |
| RE0影巢 | `HDHIVE_ACCOUNTS` | user#pass |
| 酷我音乐 | `kuwo_data` | Cookie数据 |
| 色花堂 | `SEHUATANG_COOKIE` | Cookie |
| 书香门第 | `sxmd_data` | Cookie |

---

## 📄 License

<details>
<summary>MIT License (点击预览)</summary>

```
MIT License

Copyright (c) 2026 7452323

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
```

</details>

---

<div align="center">

**仅供学习交流使用，下载后请在24小时内删除**

⭐ 如果觉得有用，点个 Star

</div>
