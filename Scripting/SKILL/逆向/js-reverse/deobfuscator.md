---
name: deobfuscator
description: "JavaScript/通用代码反混淆解密技能 — 针对 jsjiami/sojson/obfuscator.io/packer/jsfuck/RC4/Base64/ProGuard 等常见加密混淆一键还原"
author: 7452323
version: "2.0.0"
tags: [deobfuscation, javascript, decryption, reverse-engineering, obfuscator]
---

# deobfuscator — 代码反混淆解密技能

## 能处理什么

|混淆类型|特征|解密方法|
|---|---|---|
|**jsjiami v6 / sojson**|`jsjiami.com` 水印, `_0x`变量|隔离沙箱执行解密函数, AST回填字符串|
|**jsjiami v7**|v7版, 首行声明变量表|先分离字符串表, 再沙箱执行解密|
|**obfuscator.io**|大量`_0x` + 自执行数组|数组展开 → 常量折叠 → 控制流还原 → 死代码删除|
|**awsc (阿里云混淆)**|阿里云CDN默认混淆|同obfuscator方案处理|
|**jjencode**|`$=~[];$={...}` 开头|jjdecode专用恢复|
|**JSFuck**|仅由 `[]()!+`|解释器还原|
|**Dean Edwards Packer**|`eval(function(p,a,c,k,e,d)`|自动解包|

## 企业软件密码解密

来自 DecryptTools 项目，专门针对国产企业软件的配置密码解密：万户OA、用友NC、金蝶EAS、致远OA、蓝凌OA、帆软报表、海康威视、Navicat、FinalShell、WebLogic、Druid、Spring (Jasypt)

## 工作流程

```
1. 检测混淆类型
2. 识别加密函数
3. 沙箱执行解密函数（isolated-vm 安全执行）
4. AST 回填
5. AST 净化（常量折叠、控制流还原、分支修剪、死变量删除、格式化）
6. 输出可读代码
```

## decode_action 自动化方案（推荐）

利用 GitHub Actions 自动解密：fork `smallfawn/decode_action` → 放入 input.js → 触发 Action → 60s 后 output.js

## 常见混淆模式识别

|特征|混淆类型|
|---|---|
|`jsjiami.com` / `sojson.com`|jsjiami|
|大量 `_0x[0-9a-f]{4,6}` 变量|obfuscator.io / jsjiami|
|`function(p,a,c,k,e,d)`|Packer|
|只有 `[]()!+`|JSFuck|
