---
name: camoufox-workflow
description: JS逆向工程工作流技能。6阶段工作流（任务理解→侦察→源码分析→动态验证→算法还原→验证交付），JSVMP双路径分析。
author: 7452323
category: reverse-engineering
tags: [js-reverse, camoufox, signature, jsvmp]
---

# Camoufox Workflow - JS逆向工作流

## 硬约束 Checklist

启动技能后必须完成以下3项检查才能开始分析：

### CHECK-1: MCP 版本检查 + 环境自检
### CHECK-2: 经验库速查
- tiktok.com / X-Bogus / X-Gnarly → jsvmp-dual-sign 方案
- douyin.com / a_bogus → jsdom 环境伪装
- nmpa.gov.cn / RS 412 / sdenv → sdenv 纯 Node.js
- obfuscator.io → 通用四板斧

## 6阶段工作流

### Phase 1: 任务理解 → Phase 2: 侦察 → Phase 3: 源码分析 → Phase 4: 动态验证 → Phase 5: 算法还原 → Phase 6: 验证交付

## JSVMP 双路径分析

### 路径A: 四板斧（轻量，优先）
1. 数组解混淆 2. 常量折叠 3. 死代码删除 4. 控制流平坦化还原

### 路径B: 环境仿真（重量，路径A无效时）
- jsdom 环境伪装（喂入-截出）
- Firefox + playwright 真实浏览器
- sdenv 纯 Node.js
