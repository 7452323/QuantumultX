# Hermes 逆向技能树 — 完整索引

> 自动更新于 2026-06-02

## 索引结构

| # | 技能名称 | 分类 | 描述 |
|---|---------|------|------|
| 1 | algorithm-reverse | JS逆向 | 签名还原、混合加密拆解 |
| 2 | android-reverse-engineering | 移动端 | APK反编译/smali修改/Frida Hook |
| 3 | anti-debug | JS逆向 | 反调试对抗：9种debugger模式 |
| 4 | ast-deobfuscation | 反混淆 | Babel AST分层反混淆 |
| 5 | binary-diffing | 二进制 | Diaphora/BinDiff二进制对比 |
| 6 | book-source-master | 代理脚本 | Legado阅读3.0书源编写 |
| 7 | camoufox-workflow | JS逆向 | 6阶段工作流 |
| 8 | code-obfuscation-deobfuscation | 混淆分析 | 混淆类型识别/还原 |
| 9 | context-optimizer | 工具 | 上下文精简 |
| 10 | cross-platform-proxy-scripting | 代理脚本 | QX/Surge/Loon多平台适配 |
| 11 | deobfuscator | 反混淆 | jsjiami/sojson一键还原 |
| 12 | desktop-app-reverse-engineering | 桌面端 | Wails/Electron/Tauri逆向 |
| 13 | env-patch | JS逆向 | Node.js补环境 |
| 14 | find-crypto-entry | JS逆向 | 加密参数入口定位 |
| 15 | har-to-proxy-script | 代理脚本 | HAR→代理脚本转换 |
| 16 | ida-reverse-analysis | 二进制 | IDAPython/加密算法识别 |
| 17 | pyinstaller-reverse | Python | PyInstaller解包→反编译 |
| 18 | qx-script-master | 代理脚本 | QX/Surge/Loon全能脚本 |
| 19 | web-api-protocol-reverse | Web协议 | ChatGPT私有协议逆向 |
| 20 | web-tool-reverse-engineer | Web工具站 | 在线工具站批量逆向 |
| 21 | reverse-playbook | 通用框架 | 7大通用逆向模式 |
| 22 | jsrpc-auto-reverse | JS逆向 | JSRPC全自动逆向方案 |

## 9大逆向子领域
1. JS逆向 2. 反调试/反混淆 3. 桌面应用逆向 4. 移动端逆向 5. Web API协议逆向 6. 代码混淆/反混淆 7. 二进制逆向 8. 代理脚本开发 9. Python应用逆向

## ONE App 逆向关键参数
- AES: `l*bv%Ziq000Biaog` / IV: `8597506002939249`
- Sign: MD5(MD5(ip.platform.ts.uk.uuid) + salt)
- CDN: enimg.k8b3rsp.com (图片AES加密)

## QX/Surge/Loon 生态吸收
本次从46个项目中吸收的知识：去广告三大流派、reject家族详解、RevenueCat、多平台统一架构等。
