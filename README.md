# 7452323 签到框架

一套轻量、自包含的 Surge / Quantumult X / Stash / Loon 多平台签到脚本框架。

## 设计原则

- **自包含** — 每个脚本内嵌完整 Env 适配层，无需外部依赖
- **C5-3 通知** — 统一通知风格：`👤账号 \n 时间 ✅/❌ 任务 \n 🏆/💰 结果 \n 🎯 总状态`
- **零冗余** — sgmodule 与脚本分离，业务逻辑与平台适配分离
- **参数驱动** — 通过 `$argument` 注入 `enable_cookie`/`debug`/`tasks` 等运行时参数
- **Sliverkiss 风格** — `#!arguments=cron:xxx,enable_cookie:1,debug:0` 逗号分隔 + `{{{}}}三花括号`

## 目录结构

```
/
├── task/                  # 签到脚本（核心业务逻辑）
│   ├── kuwo_upgrade.js      酷我音乐升级签到
│   ├── lyrebird_checkin.js  Lyrebird Emby签到
│   ├── thtv_checkin.js      探花TV签到
│   └── txtnovel_checkin.js  书香门第签到
├── surge/script/          # Surge 模块定义
│   ├── kuwo_upgrade.sgmodule
│   ├── lyrebird_checkin.sgmodule
│   ├── thtv_checkin.sgmodule
│   └── txtnovel_checkin.sgmodule
├── tools/                 # 脚手架工具
│   └── new_sign.sh        创建新签到脚本模板
└── README.md
```

## 通知格式 (C5-3)

```
👤 用户名
08:01  ✅ 签到
08:05  ✅ 听歌
🏆 Lv.13 成长值:12345

🎯 全部完成  1/1
```

- 标题：脚本名（`$.name`）
- 正文第一行：`👤 用户名/ID`
- 中间行：`时间  ✅/❌ 任务内容`
- 底部 KPI：`🏆/💰 数值` + `🎯 总状态`

## 扩展签到

```bash
bash tools/new_sign.sh <脚本名> <显示名>
```

示例：
```bash
bash tools/new_sign.sh example "示例签到"
```

会生成 `task/example_checkin.js` 和 `surge/script/example_checkin.sgmodule`。

然后：
1. 编辑 `task/example_checkin.js` 补全签到逻辑
2. 编辑 sgmodule 中的 pattern/MITM hostname
3. `git add && git commit && git push`

## 脚本规范

每个 `.js` 文件必须包含文件头注释，注明：
- rewrite_local 规则（Cookie 采集）
- task_local 规则（定时任务）
- MITM hostname
- 支持的环境变量

## sgmodule 规范

```ini
#!name=签到名
#!desc=描述
#!author=7452323
#!category=签到
#!arguments=cron:0 10 * * *,enable_cookie:1,debug:0,hostname:example.com
#!arguments-desc=参数说明

[Script]
脚本名 = type=cron,cronexp="{{{cron}}}",wake-system=1,timeout=30,\
script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/xxx.js,\
argument="enable_cookie={{{enable_cookie}}}&debug={{{debug}}}"
脚本名_cookie = type=http-request,\
pattern=^https?:\/\/example\.com\/,\
script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/xxx.js,\
requires-body=1

[MITM]
hostname = %APPEND% {{{hostname}}}
```

## 变量规范

| 概念 | 格式 | 示例 |
|------|------|------|
| Cookie Key | `{name}_cookie` | `txtnovel_cookie` |
| Token Key | `{name}_token` | `lyrebird_token` |
| 多账号分隔符 | `&` 或 `\n` | `&` (kuwo), `\n` (thtv) |
| argument 分隔 | `&` query-string | `enable_cookie=1&debug=0` |
| #!arguments 分隔 | `,` 逗号 | `cron:xxx,enable_cookie:1` |

## 通知场景

| 场景 | 通知内容 |
|------|---------|
| 签到成功 | `👤 xxx \n 时间 ✅ 签到成功 \n 💰 奖励 \n 🎯 已完成` |
| 今日已签 | `👤 xxx \n 时间 ✅ 今日已签到 \n 💰 余额 \n 🎯 已完成` |
| Cookie 过期 | `👤 xxx \n 时间 ❌ Cookie 已过期 \n 🎯 失败` |
| 网络错误 | `👤 xxx \n 时间 ❌ 请求异常 \n 🎯 失败` |
| 无 Cookie | `⚠️ 未获取到 Cookie \n 请先访问触发采集 \n 🎯 失败` |
