---
name: cf-bypass
description: Cloudflare 绕过全套方案 — 从请求层(TLS指纹)到浏览器层(Playwright/patchright/nodriver)到Turnstile解法。包含实战测试过的方案和已知局限性。
category: reverse-engineering
triggers: [cf bypass, cloudflare 绕过, turnstile solver, flare solverr, curl_cffi, Just a moment, Checking your browser, 403 forbidden, cloudflare challenge]
---

# Cloudflare Bypass 技能

来源: https://github.com/Esonhugh/pydoll-cf-waf-bypasser-skills

## 环境现状

| 工具 | 状态 |
|------|------|
| pydoll-python | ✅ 已装 2.23.0 |
| turnstile_solver | ✅ 已装 3.16b |
| cloudscraper | ✅ 已装 1.2.71 |
| curl_cffi | ✅ 已装 0.15.0 |
| patchright | ✅ 已装 1.60.0 |
| nodriver | ✅ 已装 0.50.3 |
| camoufox | ✅ 已装 |
| FlareSolverr | ✅ 已部署 Docker |

## 实战测试结果（目标: uaa002.com）

### ❌ 失败的方案（双重重保护）

| 方法 | 结果 | 原因 |
|------|------|------|
| cloudscraper | 403 | 仅过基础 IUAM，Turnstile 无效 |
| curl_cffi | 403 | TLS 指纹不够 |
| Playwright headless | Challenge | 无 stealth 直接被检测 |
| patchright | Challenge | 打补丁的 Playwright 仍被检测 |
| nodriver | Challenge | 也被检测 |
| Camoufox (Firefox) | Challenge | Firefox 指纹更易被 CF 标记 |
| FlareSolverr | Timeout 60s | Turnstile + JS Challenge 双重重压 |
| Pydoll expect_and_bypass | ❌ 超时 | Turnstile 版本不兼容 |
| turnstile_solver | ❌ 超时 | sitekey 动态生成 |
| **Hermes 内置 browser (stealth)** | **✅ 成功** | 唯一成功绕过 JS Challenge 的工具 |

### ⚠️ 关键发现：CF 覆盖范围

当 CF 保护级别为 **Turnstile + Managed Challenge** 时，**全站所有端点都受保护**。基于 HTTP 请求的书源在全面 CF 保护的站上**完全无法工作**。

## 多层绕过方案

### Level 0: Pydoll 一键绕过
```python
from pydoll.browser import Chrome
from pydoll.browser.options import ChromiumOptions
# ⚠️ Pydoll >= 2.x 导入路径变了
```

### Level 1: TLS 指纹层
```python
from curl_cffi import requests
r = requests.get('https://target.com', impersonate='chrome131')
```
局限性: 仅过 TLS 指纹检测，Turnstile/JS Challenge 无效。

### Level 3: Turnstile 解法
使用 turnstile_solver（基于 patchright）

## Turnstile 用户脚本绕过模式

用户在 Tampermonkey/Greasemonkey 中通过 iframe + 事件伪造 + MutationObserver 捕获 token。

## 已知局限

1. **Turnstile + JS Challenge 双重重保护** — 当前环境无代理时无解
2. **需要住宅代理** — 机房 IP 被 CF 标记
3. **Turnstile token 自动化获取全方案失败** — 2026-06-08 实战测试
4. **Pydoll 版本导入变更** ≥2.x 时 `from pydoll.browser import Chrome`
