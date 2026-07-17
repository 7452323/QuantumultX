---
name: jsrpc-auto-reverse
description: JSRPC + Flask + Burp autoDecoder 全自动 JS 逆向方案。Chrome DevTools MCP 连接真实浏览器 → 运行时 Hook 探针自动发现加密入口 → JSRPC WebSocket 调用 → Flask 代理 → Burp 无缝对接。
author: 7452323
category: reverse-engineering
tags: [jsrpc, autoDecoder, chrome-devtools-mcp, flask-proxy, burp, runtime-hook, webpack]
---

# JSRPC Auto Reverse — JSRPC 全自动 JS 逆向方案

## 核心哲学
**不补环境、不还原算法、不反混淆**——直接连真实浏览器调加密函数。

## 适用场景
- 登录参数加密（RSA/AES/SM2/SM4/MD5/自定义编码）
- 数据爬取时响应内容加密
- 请求签名（sign/token/enc）
- 需要与 Burp 配合进行抓包、改包

## 体系架构

```
Phase 0: 输入校验 → Phase 1: 浏览器连接+请求复现 → Phase 2: 加密入口发现
→ Phase 2.5: Webpack 模块解析 → Phase 3: 依赖提取 → Phase 4: 代码生成
→ Phase 5: 浏览器注入 → Phase 6: 启动服务 → Phase 7: Burp 配置
```

## 核心组件

### 1. 运行时 Hook 探针
预注入到页面的 JS 探针，Hook fetch/XHR/crypto.subtle/JSON.stringify。

### 2. 加密候选评分
7 维度评分系统（name_score, source_keyword_score, runtime_stack_score, request_correlation, input_output_shape, module_export_score, verification_score），阈值 > 0.6 进入验证。

### 3. JSRPC (WebSocket 远程调用)
```javascript
var client = new Hlclient("ws://127.0.0.1:12080/ws?group=xxx");
client.regAction("encrypt", function(param, resolve) {
  var result = window.encryptFunc(param);
  resolve(String(result));
});
```

### 4. Flask 代理 → autoDecoder → Burp 无缝对接

## 能力边界

### 支持：页面导航、evaluate_script、initScript、Hook fetch/XHR/crypto.subtle、Webpack module cache

### 不支持：真实 JS 断点、闭包未导出函数、WASM 未导出内部函数、Service Worker 内部闭包、VMP 静态还原、CSP WebSocket 绕过
