Hermes逆向技能树-INDEX总索引

INDEX.md

# Hermes 逆向技能树 — 完整索引

> 自动更新于 2026-06-02
> 私有 Gist 专属文件夹，归 7452323 所有

---

## 📁 索引结构

| # | 技能名称 | 分类 | 描述 | 文件数 |
|---|---------|------|------|--------|
| 1 | algorithm-reverse | JS逆向 | 签名还原、混合加密拆解、Cookie/Header签名、JSVMP/Wasm | 1 |
| 2 | android-reverse-engineering | 移动端 | APK反编译/smali修改/Frida Hook/JNI分析/脱壳/重打包 | 1 |
| 3 | anti-debug | JS逆向 | 反调试对抗：无限debugger(9种)、DevTools检测、时间/属性检测 | 1 |
| 4 | ast-deobfuscation | 反混淆 | Babel AST分层反混淆，7步流程+8站点适配器 | 1 |
| 5 | binary-diffing | 二进制 | Diaphora/BinDiff二进制对比、补丁分析、1-day漏洞识别 | 1 |
| 6 | book-source-master | 代理脚本 | Legado阅读3.0书源编写，API/HTML双模式 | 1 |
| 7 | camoufox-workflow | JS逆向 | 6阶段工作流，JSVMP双路径分析，camoufox-reverse MCP | 1 |
| 8 | code-obfuscation-deobfuscation | 混淆分析 | JS/Python/Android混淆类型识别/分析/还原 | 1 |
| 9 | context-optimizer | 工具 | 长会话上下文精简，P0-P3优先级分级 | 1 |
| 10 | cross-platform-proxy-scripting | 代理脚本 | QX/Surge/Loon/Egern/Stash/Shadowrocket多平台适配 | 1 |
| 11 | deobfuscator | 反混淆 | jsjiami/sojson/obfuscator.io/packer/jsfuck/RC4一键还原 | 1 |
| 12 | desktop-app-reverse-engineering | 桌面端 | Wails/Electron/Tauri逆向 + WKWebView注入 + HttpCall AI管道提取 | 1 |
| 13 | env-patch | JS逆向 | Node.js补环境，3层策略(L1→L2→L3)，4种注入方式 | 1 |
| 14 | find-crypto-entry | JS逆向 | 加密参数入口定位，5种题型对应策略 | 1 |
| 15 | har-to-proxy-script | 代理脚本 | HAR→QX/Surge/Loon代理脚本转换 | 1 |
| 16 | ida-reverse-analysis | 二进制 | IDAPython/加密算法识别/DLL分析/F5优化/binary patch | 1 |
| 17 | pyinstaller-reverse | Python | PyInstaller打包应用逆向：解包→反编译→逻辑还原全流程 | 1 |
| 18 | qx-script-master | 代理脚本 | QX/Surge/Loon全能脚本编写，5大类型+HAR解析+Env.js | 1 |
| 19 | web-api-protocol-reverse | Web协议 | ChatGPT官网私有协议逆向：PoW/Turnstile/SSE/号池管理 | 1 |
| 20 | web-tool-reverse-engineer | Web工具站 | tools.miku.ac等在线工具站批量逆向方法论 | 1 |

---

## 🧠 9大逆向子领域

### 1. JS逆向
- algorithm-reverse — 签名/加密算法还原
- anti-debug — 反调试对抗
- ast-deobfuscation — AST反混淆
- camoufox-workflow — JS逆向全流程
- env-patch — 补环境
- find-crypto-entry — 加密入口定位

### 2. 反调试/反混淆
- anti-debug — 9种debugger模式+5种检测绕过
- ast-deobfuscation — Babel AST分层反混淆
- code-obfuscation-deobfuscation — 混淆分析
- deobfuscator — 一键反混淆

### 3. 桌面应用逆向
- desktop-app-reverse-engineering — WKWebView注入+fetch劫持+AI管道提取

### 4. 移动端逆向
- android-reverse-engineering — APK/Frida/JNI

### 5. Web API 协议逆向
- web-api-protocol-reverse — ChatGPT式私有协议逆向
- web-tool-reverse-engineer — 在线工具站批量逆向

### 6. 代码混淆/反混淆
- deobfuscator — 一键还原
- code-obfuscation-deobfuscation — 类型识别+分析
- ast-deobfuscation — AST反混淆

### 7. 二进制逆向
- binary-diffing — 二进制对比
- ida-reverse-analysis — IDA分析

### 8. 代理脚本开发
- cross-platform-proxy-scripting — 多平台适配
- qx-script-master — 5大脚本类型
- har-to-proxy-script — HAR转换
- book-source-master — 书源编写

### 9. Python 应用逆向
- pyinstaller-reverse — PyInstaller解包+反编译

---

## 🆕 本次更新内容 (2026-06-02)

### 新增技能 (3个)
1. **web-api-protocol-reverse** — ChatGPT官网私有协议逆向，PoW/Turnstile绕过，号池管理
2. **web-tool-reverse-engineer** — tools.miku.ac等在线工具站的批量逆向方法论
3. **pyinstaller-reverse** — PyInstaller打包应用逆向全流程

### 完善技能 (2个)
1. **desktop-app-reverse-engineering** — 新增 HttpCall AI Pipeline 逆向方法、fetch劫持、CDP注入
2. **web-api-protocol-reverse** — chatgpt2api深度技术拆解 (OpenAIBackendAPI/号池/PoW/SSE)

### 知识来源
- chatgpt2api (basketikun/chatgpt2api) — ChatGPT协议逆向
- HttpCall 应用逆向 (Wails + AI分析) — 桌面AI管道提取
- tools.miku.ac — 在线工具站逆向方法论
- Akino-CodeBuddy 双脑异步工作流 — soul-v2.md

---

## 🔗 Gist 分布

| Batch | Gist ID | 文件数 | 内容 |
|-------|---------|--------|------|
| Batch1 | 11fddac2b2db7d6003ad09e0267c5f1b | 9个文件 | JS逆向核心 (algorithm-reverse, anti-debug, ast-deobfuscation, env-patch, find-crypto-entry, deobfuscator, code-obfuscation, camoufox-workflow) |
| Batch2 | 3b062cd7ba635d81bee8de694483b9d1 | 8个文件 | 代理脚本 (qx-script-master, cross-platform-proxy-scripting, har-to-proxy-script, book-source-master + android-reverse, desktop-app-reverse, binary-diffing, ida-reverse-analysis) |
| Batch3 | 090b722f263684dca00a84ed978c97dd | 1个文件 | 辅助技能 (context-optimizer) |
| **New** | — | 3个文件 | **web-api-protocol-reverse, web-tool-reverse-engineer, pyinstaller-reverse** |
| INDEX | 8d33c9afc872823cc0b1025882c3fea21 | 1个文件 | 总索引 |

---
