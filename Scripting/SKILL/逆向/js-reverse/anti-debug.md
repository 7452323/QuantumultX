---
name: anti-debug
description: JS反调试对抗 + 二进制级反调试技能。识别并绕过4类JS反调试手段（无限debugger、DevTools检测、时间检测、属性检测），以及Linux/Windows原生反调试、反VM、反DBI、代码完整性检测。
author: 7452323
tags: [anti-debug, anti-devtools, debugger, js-reverse]
---

# Anti-Debug — JS反调试对抗技能

## 4类反调试

### 1. 无限 debugger

| 模式 | 特征 | 绕过方式 |
|------|------|----------|
| constructor | `function(){}["constructor"](...)` | 重写 constructor |
| setInterval | 定时触发 debugger | 拦截 setInterval |
| eval | eval 中注入 debugger | 重写 eval |
| Function | new Function('debugger') | 重写 Function |
| Object.defineProperty | getter/setter 触发 | 提前 Hook |
| iframe | 子页面 debugger | 拦截 iframe 创建 |
| worker | Web Worker debugger | 拦截 Worker |

### 2. DevTools 检测
- 元素检测、控制台检测、窗口大小检测、颜色格式检测
- 抗格式化(tamper)、anti-Selenium、域名验证

### 3. 时间检测
- `Date.now` / `performance.now` 差值
- setTimeout 延迟分析

### 4. 属性检测
- `element[n]` 访问、原型链遍历、异常消息解析

## 统一5步流程

1. 识别反调试类型（断点定位触发点）
2. Hook 关键函数（constructor/setInterval/eval/Function）
3. 替换实现（返回无操作的 stub）
4. 验证绕过（确认代码正常运行）
5. 固化补丁（保存到环境补丁中）

## 三合一 bypass 核心代码

同时 Hook eval、new Function、constructor 三种 debugger 注入方式，并修复 toString 防止检测：

```javascript
(function() {
    'use strict';
    let temp_eval = eval;
    // 1. Bypass eval → debugger
    window.eval = function () {
        if (typeof arguments[0] == "string") {
            arguments[0] = arguments[0].replaceAll(/debugger/g, '');
        }
        return temp_eval(...arguments);
    }
    // 2. Bypass new Function → debugger
    let Bypass_debugger = Function;
    Function = function () {
        for (let i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == "string") {
                arguments[i] = arguments[i].replaceAll(/debugger/g, '');
            }
        }
        return Bypass_debugger(...arguments);
    }
    // 3. Bypass constructor → debugger
    Function.prototype.constructor = function () {
        for (let i = 0; i < arguments.length; i++) {
            if (typeof arguments[i] == "string") {
                arguments[i] = arguments[i].replaceAll(/debugger/g, '');
            }
        }
        return Bypass_debugger(...arguments);
    }
})();
```

## Binary-Level Anti-Debug

覆盖 Linux ptrace / /proc / rdtsc / signal 检测及 Windows PEB / NtQuery / TLS Callback / INT3 检测的绕过方法。
