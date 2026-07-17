# JSVMP 虚拟机保护分析指南

## 什么是 JSVMP

JSVMP（JavaScript Virtual Machine Protection）是一种高级 JS 代码保护技术，将原始 JS 源码编译为自定义字节码，运行时由内嵌的虚拟机解释器逐条执行。这意味着：

- 原始代码逻辑不再以 JS AST 形式存在，无法通过传统反混淆手段还原
- 代码以字节码数组 + 解释器循环的形式运行
- 常见于RS、JY、某数等商业级反爬方案

**核心原则：不反编译字节码，用行为追踪法（Hook / 插桩 / 日志分析 / 源码级插桩四板斧）从 I/O 两端夹逼 + 中间层观察定位签名逻辑。**

> **v2.5.0 更新**：第四板斧「源码级插桩」由 camoufox-reverse MCP v0.4.0 的 `instrumentation(action='install', ...)` 提供支持，在 HTTP 层改写 VMP 源码，对每个 `obj[key]` 和 `fn(args)` 插入 tap，捕获 VM 内部 switch/case 调度——是RS 5/6、Akamai sensor_data、webmssdk、obfuscator.io 这类"VM 自包含"场景的通用武器。详见 [`jsvmp-source-instrumentation.md`](./jsvmp-source-instrumentation.md)。 <!-- v3.1.0: migrated from instrument_jsvmp_source -->