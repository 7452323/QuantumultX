---
category: reverse-engineering
name: env-patch
version: 1.0.0
description: JS逆向补环境统一技能。在Node.js中运行依赖浏览器环境的JS代码，提供引擎+策略分离架构、诊断驱动循环、4类问题分类、14模块清单、指纹固定化、替代路线决策。
tags: [reverse-engineering, javascript, environment-patching, browser-simulation, proxy, fingerprint, nodejs]
---

# env-patch: JS逆向补环境

## 5条铁律

1. **禁止修改原始JS** — `source/` 下文件只读，所有补丁写在 run.js / sign.js 中
2. **必须 require env_core.js** — 禁止重写工具函数
3. **先分析VMP入口参数** — VMP入口的依赖数组决定补环境边界
4. **加载顺序是致命的** — VMP在 `require()` 瞬间初始化
5. **格式验证优先于请求验证** — 签名长度/前缀与浏览器不一致 = 降级

## 引擎 + 策略分离架构

| 文件 | 角色 | 修改策略 |
|------|------|---------|
| `env_core.js` | **引擎** | 复制后不再修改 |
| `run.js` | **策略** | 每轮诊断后只改此文件 |

## 4类问题分类

| 类型 | 症状 | 策略 |
|------|------|------|
| 1. 缺对象/缺属性 | 代码直接报 `undefined` | 逐项补齐 |
| 2. 原型链/描述符检测 | toString/instanceof 暴露 | 构造器+prototype+实例三层补齐 |
| 3. 指纹检测 | canvas/WebGL/audio/RTC 指纹异常 | 指纹固定化或随机化 |
| 4. 成本过高 | 补环境投入远超收益 | 切换 JsRpc/sdenv/真浏览器 |

## 诊断循环决策树

每轮运行后读取诊断报告，按决策树处理：
- [HANG] 进程卡死 → 反调试处理
- [ERRORS] → 必须立即修复
- [UNDEFINED] → 逐项处理
- 全部清理 → 进入签名格式校验

## 替代路线决策

| 条件 | 推荐路线 |
|------|---------|
| 缺失对象少、依赖链清晰 | **纯补环境** |
| DOM/BOM依赖多 | **sdenv**（魔改jsdom） |
| 补环境遇到VMP opcode级检测 | **JsRpc**（浏览器内执行） |
| 强依赖真实DOM/事件流 | **真浏览器**（Playwright） |

## 常见陷阱

| 陷阱 | 正确做法 |
|------|---------|
| 盲补环境 | 先让环境自吐，再按诊断报告补 |
| 全量模拟 | 逐项回填，最小因果单元 |
| 只补值不补结构 | 先补原型链，再补实例值 |
| 忽略描述符 | 用 Object.defineProperty 显式对齐 |
| 忽略native toString | 用 setFuncNative 保护 |
