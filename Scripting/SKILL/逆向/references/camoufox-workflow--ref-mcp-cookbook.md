> ⚠️ v3.3.0 起，本文档的核心动作清单已回迁到 SKILL.md 核心层。
> 本文档保留作为深度背景参考，但**以 SKILL.md 为准**。如发现不一致，以 SKILL.md 为准。

# MCP 工具使用手册

## 概述

本手册详细说明 `camoufox-reverse` MCP 服务器的使用方式，
提供常见逆向场景下的具体操作步骤。

## 工具速查表

### camoufox-reverse MCP（65 个工具，v0.4.0+）

| 类别 | 工具 | 核心用途 |
|------|------|---------|
| **浏览器** | `launch_browser` / `close_browser` | 启动/关闭反检测浏览器 |
| **导航** | `navigate` / `reload` / `go_back` | 页面导航 |
| **页面交互** | `click` / `type_text` / `wait_for` | 元素交互 |
| **截图** | `take_screenshot` / `take_snapshot` | 截图 / 无障碍树 |
| **页面信息** | `get_page_info` / `get_page_html` | 页面状态和 HTML |
| **源码搜索** | `search_code` | 在所有 JS 中搜索（结构化结果，默认 max_results=50） |
| **精确搜索** | `search_code(..., script_url=...)` | 在指定脚本中搜索（前后 3 行上下文，适合大文件） | <!-- v3.1.0: migrated from search_code_in_script -->