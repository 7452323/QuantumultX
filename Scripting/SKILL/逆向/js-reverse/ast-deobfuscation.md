---
name: ast-deobfuscation
description: 使用 Babel AST 对 JavaScript 做分层、可回退的定向反混淆。7步流程 + 三层自动架构（通用→检测→适配）+ 8站点适配器。
author: 7452323
version: "1.0.0"
tags: [ast, babel, deobfuscation, javascript, reverse-engineering, control-flow-flattening, string-decryption]
---

# AST 反混淆技能

工具链: `@babel/parser` + `@babel/traverse` + `@babel/generator` + `@babel/types`

## 技能协作链

| 技能 | 职责 |
|------|------|
| ast-deobfuscation | AST 静态反混淆：字符串解密、常量折叠、控制流还原、死代码删除 |
| env-patch | 运行时环境补丁，沙箱执行 |
| find-crypto-entry | 定位加密算法入口 |
| algorithm-reverse | 逆向加密算法实现 |

典型协作链: `ast-deobfuscation → find-crypto-entry → algorithm-reverse`

## 三层自动架构

### 第1层：通用变换层
- 结构标准化、常量折叠、Proxy 函数与对象字典内联、虚假分支清理、死代码移除、字符串 RC4/Base64 解码

### 第2层：混淆检测层
- sojson v6/v7、obfuscator.io、awsc、jjencode、jsconfuser、aaencode、jsfuck

### 第3层：站点适配层
- reese84、顶象、极验4、同花顺、网易易盾、小红书

## 7步流程

```
Step 0: 混淆检测 + 评估
Step 1: 字符串解密（沙箱执行解密函数）
Step 2: 常量折叠
Step 3: 控制流平坦化还原
Step 4: 死代码删除
Step 5: 变量重命名（可选）
Step 6: 代码格式化输出
Step 7: 语义反压缩（可选）
```

## jsjiami.com 专项破解指南

jsjiami.com（原 sojson）是国内最主流的 JS 加密服务，版本 V5 到 V7。

### 版本识别

| 特征 | 版本 |
|------|------|
| 代码硬编码 `jsjiami.com.v5` | V5（旧版，易解） |
| 代码硬编码 `jsjiami.com.v6` + 无多态性 | V6 |
| 代码硬编码 `jsjiami.com.v7` + 每次加密结果不同 | V7（多态性） |

### V7 多态性破解要点

1. **运行时特征检测**（而非文本签名）
2. **多态字符串解码**：定位 stringArray 和 stringArrayDecoder，沙箱执行
3. **多态花指令**：通过 Babel AST 的 `isSideEffectFree` 判断删除
4. **V7 IIFE 字符串表重排**：必须在沙箱中先让 IIFE 跑完，再用解码器获取正确的字符串

### 域名锁定绕过

```javascript
// 典型模式
var host = window.location.hostname;
if (host !== 'allowed.domain.com') {
    while(1) { debugger; }
}
// 绕过：env-patch mock location.hostname
```
