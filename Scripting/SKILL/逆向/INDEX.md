# 逆向技能树 - 子领域详细索引

## JS 逆向核心 (js-reverse/)
- algorithm-reverse.md: 加密算法还原签名定位调用栈追踪
- anti-debug.md: 无限debugger反调试绕过
- ast-deobfuscation.md: Babel AST 7步分层反混淆
- env-patch.md: JS补环境14模块+5条铁律
- find-crypto-entry.md: XHR/fetch Hook栈追踪定位
- deobfuscator.md: 11种混淆类型自动化
- jsrpc-auto-reverse.md: JSRPC+Flask全自动逆向
- camoufox-workflow.md: 6阶段标准化工作流
- code-obfuscation-deobfuscation.md: OLLVM/SMC/VM混淆

## Web API协议逆向 (web-api/)
- web-api-protocol-reverse.md: 通用方法论
- cf-bypass.md: Cloudflare绕过全矩阵
- context-optimizer.md: P0-P3上下文压缩

## 代理脚本 (proxy-script/)
- har-to-proxy-script.md: HAR转QX/Surge脚本
- cross-platform-proxy-scripting.md: Env.js跨平台框架

## 移动端逆向 (mobile/)
- android-reverse-engineering.md: APK解包到协议还原

## 安全测试 (security/)
- analyzing-ios-app-security-with-objection.md
- analyzing-android-malware-with-apktool.md
- analyzing-golang-malware-with-ghidra.md
- deobfuscating-javascript-malware.md
- deobfuscating-powershell-obfuscated-malware.md
- detecting-api-enumeration-attacks.md
- detecting-shadow-api-endpoints.md
- exploiting-api-injection-vulnerabilities.md
- exploiting-excessive-data-exposure-in-api.md
- exploiting-insecure-data-storage-in-mobile.md

## 参考资源 (references/)
43个参考文件含camoufox-workflow系列、AST反混淆参考、安全测试API参考等

## Scripting工具映射
- Charles替代: http_capture
- Chrome DevTools替代: browser (navigate/execute_js)
- Node/Python: run_shell_command
- 代码编辑: file_tool + get_typescript_diagnostics