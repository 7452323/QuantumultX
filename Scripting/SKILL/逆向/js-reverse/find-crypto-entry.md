---
name: find-crypto-entry
description: 定位加密参数生成入口技能 — 从最终请求/响应倒推加密函数在代码中的精确位置和调用链。5种题型对应的定位策略。
author: 7452323
tags: [js-reverse, crypto-entry, signature, call-stack]
---

# Find Crypto Entry — 定位加密参数生成入口

## 5种题型入口定位策略

| 题型 | 特征 | 定位策略 | 定位时间 |
|------|------|----------|----------|
| 时间戳/随机数 | 参数看起来像时间戳 | 搜索时间戳生成代码 | ~5分钟 |
| 简单函数调用 | 参数来自某函数返回值 | 打点搜索 | ~15分钟 |
| 中等混淆 | 函数名/变量名被混淆 | AST解混淆后搜索 | ~30分钟 |
| 控制流平坦化 | switch-case 迷宫 | 控制流还原后定位 | ~1h |
| VMP 虚拟机 | 字符串表+虚拟机执行 | 数据流追踪 | ~数小时 |

## 定位方法论

### 从请求倒推
```
最终请求的 URL/Header/Body
→ 搜索关键字（参数名/路径/特征字符串）
→ 从搜索结果回溯调用链
→ 找到写出点（setRequestHeader / append / 直接赋值）
```

### Hook 关键函数
```javascript
// Hook XMLHttpRequest
var originalOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function() {
    console.log('open:', arguments);
    return originalOpen.apply(this, arguments);
};

// Hook Cookie
Object.defineProperty(document, 'cookie', {
    set: function(val) { debugger; return val; }
});
```

## 协作链

`find-crypto-entry → algorithm-reverse → Python复现`
