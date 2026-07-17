# MCP 工具分类索引 + v0.9.0 迁移指南

## 工具分类表

### Browser

| 工具名 | 一行描述 |
|--------|---------|
| launch_browser | 启动/关闭反检测浏览器 |
| navigate | 导航到 URL |

### Page

| 工具名 | 一行描述 |
|--------|---------|
| click | 点击页面元素 |
| evaluate_js | 执行 JS |

### Network

| 工具名 | 一行描述 |
|--------|---------|
| network_capture | 启停网络捕获 |
| list_network_requests | 列出请求 |

### Scripts

| 工具名 | 一行描述 |
|--------|---------|
| scripts(action=list) | 列出脚本 |
| search_code | 搜索代码 |

### Hook

| 工具名 | 一行描述 |
|--------|---------|
| add_init_script | 注入脚本 |
| hook_function | 函数追踪/Hook |
| inject_hook_preset | 一键预设 Hook |

### JSVMP

| 工具名 | 一行描述 |
|--------|---------|
| hook_jsvmp_interpreter | 通用探针 |
| instrumentation | 源码级插桩 |
| analyze_cookie_sources | Cookie 归因 |

## v0.8.x → v0.9.0 迁移

| v0.8.x 旧名 | v0.9.0 新名 |
|-------------|-------------|
| start_network_capture | network_capture(action=start) |
| search_code_in_script | search_code(keyword, script_url=url) |
| trace_function | hook_function(path, mode=trace) |
| instrument_jsvmp_source | instrumentation(action=install) |
| get_instrumentation_log | instrumentation(action=log) |

## 6 个月 Shim 兼容期

旧工具名仍可调用至 2027-01-01

## Session/Assertion 工具移除

start/stop_reverse_session, add/verify_assertion 等已移除
