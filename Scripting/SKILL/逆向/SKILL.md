---
name: 逆向
description: Scripting 抓包逆向技能树。利用 on-device HTTP/HTTPS 流量捕获（http_capture）+ JS 逆向 + Web API 协议逆向，实现从抓包到协议还原的全流程。
display_name: "逆向工程"
intent_patterns: "逆向,反编译,脱壳,JS逆向,反调试,Frida,Ghidra,IDA,解混淆,二进制,协议逆向,签名还原,补环境,AST,Unicorn,Android逆向,iOS逆向,小程序逆向,Cloudflare绕过,抓包,http_capture,http_proxy,HAR,代理脚本,QuantumultX,Surge,加密参数,签名算法,接口逆向"
---

# 逆向工程技能树 - Scripting 版

利用 Scripting http_capture 本地抓包 + http_proxy 代理规则 + Node/Python 环境。

## 子技能索引

### JS 逆向核心 (js-reverse/)
- algorithm-reverse.md: JS 逆向算法还原
- anti-debug.md: JS 反调试对抗
- ast-deobfuscation.md: Babel AST 分层定向反混淆
- env-patch.md: JS 补环境统一技能
- find-crypto-entry.md: 定位加密参数生成入口
- deobfuscator.md: 11 种混淆类型自动化反混淆
- jsrpc-auto-reverse.md: JSRPC + Flask 全自动逆向
- camoufox-workflow.md: JS 逆向标准化工作流
- code-obfuscation-deobfuscation.md: 二进制级混淆分析

### Web API 协议逆向 (web-api/)
- web-api-protocol-reverse.md: Web API 协议逆向通用方法论
- cf-bypass.md: Cloudflare 绕过全方案
- context-optimizer.md: 上下文压缩策略

### 代理脚本 (proxy-script/)
- har-to-proxy-script.md: HAR 导出 到 QX/Surge 脚本
- cross-platform-proxy-scripting.md: 跨平台代理脚本

### 移动端逆向 (mobile/)
- android-reverse-engineering.md: APK jadx Frida 脱壳全流程

### 安全测试 (security/)
- analyzing-ios-app-security-with-objection.md: iOS Objection 安全测试
- analyzing-android-malware-with-apktool.md: Android 恶意软件静态分析
- analyzing-golang-malware-with-ghidra.md: Go 二进制逆向
- deobfuscating-javascript-malware.md: JS 恶意代码反混淆
- deobfuscating-powershell-obfuscated-malware.md: PowerShell 反混淆
- detecting-api-enumeration-attacks.md: API 枚举/BOLA 检测
- detecting-shadow-api-endpoints.md: Shadow API 端点发现
- exploiting-api-injection-vulnerabilities.md: API 注入漏洞

## 核心工作流

### 1. On-Device 抓包
http_capture start - 操作 App/网页 - http_capture list - 读请求/响应体 - 定位签名/加密参数

### 2. 抓包到代理脚本
http_capture export - 解析 HAR - 生成 QX/Surge/Loon 代理脚本

### 3. JS 逆向全流程
http_capture 定位加密请求 - 下载 JS 源码 - AST 分析 - 环境补丁 - 算法还原 - Node/Python 复现

### 4. Web API 协议逆向
http_capture 侦察接口 - 分析 Fingerprint/Token - 绕过反爬 - 还原协议 - 编写调用代码

### 5. 前端源码下载逆向
browser navigate - execute_js 提取 script src - file_tool download - js-reverse 分析

## Scripting 逆向工具箱

| 工具 | 命令/用法 | 用途 |
|------|-----------|------|
| http_capture | start/stop/list/read_body/export | on-device MITM 抓包 |
| http_proxy | toggle_proxy/switch_node/add_rule | 代理配置 + 规则注入 |
| browser | navigate/execute_js/extract | 网页 JS 提取 + 交互 |
| file_tool | download/write/read/search | 文件下载写入分析 |
| run_shell_command | node/python3/curl | JS/Python 算法复现 |
| get_typescript_diagnostics | 验证 TS 代码 |

## Scripting 逆向标准流程

1. http_capture list - 定位目标接口所在域名/IP
2. http_capture scope_add domain - 缩小捕获范围
3. http_capture start - 开始抓包
4. 操作 App/网页触发请求
5. http_capture stop - 停止
6. http_capture read_body id - 读请求/响应体
7. 分析参数：找 sign/token/timestamp/nonce 等加密字段
8. 如为 Web 端 - browser navigate - execute_js 提取 JS - file_tool 下载
9. 如为 App 端 - http_capture 分析规律 - 对照 js-reverse 方法论
10. 还原算法 - run_shell_command node/python3 复现
11. 编写调用代码（可选: 生成代理脚本）

## 案例：TMP.link 逆向实战

1. http_capture start - 浏览器上传文件 - http_capture list - 定位 API
2. 分析得知 API 域: tmplink-sec.vxtrans.com
3. browser navigate - execute_js 提取 localStorage.app_token
4. file_tool 下载 tmpui.js - 解析 config.preload 找到 uploader.js, api.js
5. uploader.js L857: uptoken = SHA1(uid + filename + filesize + slice_size)
6. L946-950: action=prepare - status 3 = enter upload flow
7. L1107-1112: FormData: filedata + uptoken + index + action=upload_slice
8. L959: 状态码表 1/6/8=完成 2=等待 3=上传分片 4=过期 5=分片完成
9. run_shell_command node 验证 SHA1 计算
10. 编写正确的上传流程代码 - file_tool replace_in_file 更新 - get_typescript_diagnostics 验证

## 注意事项
- 抓包仅用于授权目标（自有账号/设备）
- JS 逆向仅供学习研究
- 代理脚本请勿滥用
- 二进制逆向在多数法域属合法安全研究