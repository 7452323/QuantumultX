# JSVMP 虚拟机保护分析指南

## 什么是 JSVMP

JSVMP（JavaScript Virtual Machine Protection）是一种高级 JS 代码保护技术，将原始 JS 源码编译为自定义字节码，运行时由内嵌的虚拟机解释器逐条执行。这意味着：

- 原始代码逻辑不再以 JS AST 形式存在，无法通过传统反混淆手段还原
- 代码以字节码数组 + 解释器循环的形式运行
- 常见于RS、JY、某数等商业级反爬方案

**核心原则：不反编译字节码，用行为追踪法（Hook / 插桩 / 日志分析 / 源码级插桩四板斧）从 I/O 两端夹逼 + 中间层观察定位签名逻辑。**

> **v2.5.0 更新**：第四板斧「源码级插桩」由 camoufox-reverse MCP v0.4.0 的 `instrumentation(action='install', ...)` 提供支持，在 HTTP 层改写 VMP 源码，对每个 `obj[key]` 和 `fn(args)` 插入 tap，捕获 VM 内部 switch/case 调度——是RS 5/6、Akamai sensor_data、webmssdk、obfuscator.io 这类"VM 自包含"场景的通用武器。详见 [`jsvmp-source-instrumentation.md`](./jsvmp-source-instrumentation.md)。

---

## 识别 JSVMP

### 文件特征

| 特征 | 描述 |
|------|------|
| 文件大小 | 200KB+ 的单文件，通常 500KB~2MB |
| 变量命名 | 完全无意义：单字母（`a`, `b`, `c`）或 `_0x` 前缀 |
| 超大数组 | 包含数千个数字元素的数组（字节码） |
| 解释器循环 | `while(true) { switch(opcode) { case 0: ... case 1: ... } }` |
| 栈操作 | 频繁出现 `push`、`pop`、`shift` 操作 |
| API 劫持 | 重写 `XMLHttpRequest`、`fetch`、`document.cookie` 等原生 API |

### 代码模式示例

```javascript
// 典型的 JSVMP 解释器结构
var _0x1234 = [3, 15, 7, 22, ...]; // 字节码数组
var _0x5678 = [];                   // 操作栈
var _0xabcd = 0;                    // 指令指针

function _0xefgh() {
  while (true) {
    var _0x9999 = _0x1234[_0xabcd++];
    switch (_0x9999) {
      case 0: _0x5678.push(_0x1234[_0xabcd++]); break;  // PUSH
      case 1: var a = _0x5678.pop(), b = _0x5678.pop(); _0x5678.push(a + b); break; // ADD
      case 2: /* ... */ break;
      // 数十到数百个 case
    }
  }
}
```

### 如何确认是 JSVMP

```
MCP 操作（推荐顺序）：
  - scripts(action='list') → 找到异常大的 JS 文件（100KB+）
  - search_code(keyword='switch', script_url=<大 JS 的 url>, context_chars=500)   ← v0.4.0 推荐首选
    → 返回 candidates: [{fn_name, case_count, char_range, preview}]
    → case_count > 50 的基本确认是 VMP 解释器
  - dump_jsvmp_strings(script_url=<大 JS 的 url>) → 提取字符串数组
    → 看 suspicious_patterns 是否包含 "JSVMP interpreter loop (while+switch, large source)"
    → 看 api_names 是否包含 navigator/screen/encrypt/md5/hmac 等

兜底手动方式（大文件 search_code 超时时）：
  - search_code(keyword="switch", script_url=N) → 前后 3 行上下文
  - search_code(keyword="case 0:|case 1:|case 2:", script_url=N)
  - scripts(action='get', script_id=N, start_line=..., end_line=...) → 按 char_range 读取分发体
```

---

## 四板斧方法论（v2.5.0 更新）

### 四板斧关系图

```
                   ┌── 第一板斧 Hook 出入口 ──────────┐
                   │  inject_hook_preset(xhr|fetch    │
                   │    |crypto|cookie|websocket      │
                   │    |debugger_bypass|runtime_probe)│
                   │  analyze_cookie_sources          │
                   └────────┬─────────────────────────┘
                            │
              夹逼 I/O ──→ ┌─┴─┐ ──→ 推断签名公式
                            │VMP│
              中间层 ──→  ┌─┘   └─┐ ──→ 追踪执行链路
                         │
  ┌── 第二板斧 插桩解释器 ────────────┐   ┌── 第四板斧 源码级插桩 ──────────┐
  │  search_code(keyword='switch',   │   │  instrumentation(action='install')│
  │    script_url=..., context_chars) │   │  instrumentation(action='log')   │
  │  hook_function(mode='trace',     │   │  → summary.hot_keys             │
  │    分发函数/子函数)              │   │  → summary.hot_methods          │
  │  hook_jsvmp_interpreter          │   │  → summary.hot_functions        │
  │    (mode='proxy', trackProps=True)│   └────────┬────────────────────────┘
                                          └────────┬────────────────────────┘
                                                   │
                            ↓                      ↓
                   ┌── 第三板斧 日志分析 ──────────────────┐
                   │  get_trace_data + get_jsvmp_log       │
                   │    + get_runtime_probe_log            │
                   │    + instrumentation(action='log')    │
                   │  反向追踪法（从签名值→明文）            │
                   │  多次请求对比法（找变化因子）          │
                   └───────────────────────────────────────┘
```

**板斧选择矩阵**：

| VMP 特征 | 推荐板斧组合 |
|---------|-------------|
| 签名通过 CryptoJS / atob / MD5 等可 hook API 走 | 第一 + 第三（hot API hook + 日志反推） |
| VMP 通过 `Function.apply/call` 调子函数 | 第二 + 第三（`hook_jsvmp_interpreter` 多路径 + 日志） |
| VMP 自包含，算法全在 switch/case 内（RS 5/6、Akamai、webmssdk、obfuscator.io） | **第四板斧首选**，配合第一板斧做 I/O 边界 |
| VMP 深度绑定浏览器环境（compare_env 差异大 + 签名随环境变） | 路径 B 环境伪装（见 SKILL.md 场景 10），配第四板斧 `hot_keys` 定位指纹集 |

---

### 快速路径：v0.4.0 黄金 8 步流程（推荐先试，70%+ RS/Akamai/webmssdk 场景直接搞定）

```
Step 1 — search_code(keyword='switch', script_url=..., context_chars=500) 确认 VMP + 记下 fn_name / char_range
Step 2 — hook_jsvmp_interpreter(script_url=<VMP basename>) 装多路径探针
Step 3 — inject_hook_preset("cookie", persistent=True) + inject_hook_preset("xhr", persistent=True)
Step 4 — instrumentation(action='install', url_pattern="**/<VMP 文件>", mode="ast", tag="vmp1")  ← 核心新步
Step 5 — instrumentation(action='reload') 让所有探针先于 VMP 生效 + 清日志
Step 6 — 触发业务操作
Step 7 — instrumentation(action='log', tag_filter="vmp1", limit=300) 看 hot_keys / hot_methods / hot_functions
Step 8 — analyze_cookie_sources() 归因最终 cookie 来源
```

详细步骤见 [`jsvmp-source-instrumentation.md`](./jsvmp-source-instrumentation.md)「黄金 8 步流程」节。

---

### 三板斧旧流程（保留以应对第四板斧无法使用的场景）

对于典型 JSVMP，也可以继续用以下一键工具：

```
MCP 操作：
  - hook_jsvmp_interpreter → 自动 Hook Function.prototype.apply + 追踪 30+ 敏感属性读取
  - dump_jsvmp_strings → 提取字符串数组，识别 API 名称，检测混淆模式
  - 触发目标操作（翻页、提交等）
  - get_jsvmp_log → 获取结构化分析结果：
    · API 调用统计（哪些原生函数被 VM 调用）
    · 属性读取摘要（哪些环境属性被访问）
    · 调用时序（帮助定位签名生成节点）
  - compare_env → 收集完整浏览器环境（navigator/screen/canvas/WebGL/Audio/timing）
    · 用于后续 Node.js/Python 补环境时对照

快速路径无法解决时，再进入手动三板斧流程 ↓
```

### 第一板斧：Hook 出入口（确定 I/O 边界）

**目标**：不看 VM 内部实现，只关心"什么进去了"和"什么出来了"。

#### 1.1 Hook 出口 — 签名值去了哪里

```
MCP 操作：
  - inject_hook_preset(preset="xhr", persistent=True)   → 持久化拦截 XHR（跨导航不丢失）
  - inject_hook_preset(preset="fetch", persistent=True) → 持久化拦截 Fetch
  - hook_function(
      function_path="Document.prototype.cookie",
      hook_code="console.log('[COOKIE_SET]', arguments[0], new Error().stack)",
      position="before", non_overridable=True
    ) → 拦截 Cookie 写入（防覆盖）
  - reload() → 刷新页面触发 Hook
  - get_console_logs → 查看捕获的签名值和调用栈
```

**关键信息提取**：
- 签名参数名（如 `sign`、`m`、`_signature`）
- 签名值的格式（长度、字符集、编码方式）
- 签名值出现在请求的哪个位置（URL params / Body / Header / Cookie）

#### 1.2 Hook 入口 — 明文从哪里来

```
MCP 操作：
  - inject_hook_preset(preset="crypto", persistent=True)
    → 持久化 Hook btoa/atob/JSON.stringify/JSON.parse

  - hook_function(function_path="String.fromCharCode",
      hook_code="if(arguments.length > 1) console.log('[fromCharCode]', Array.from(arguments).map(Number), String.fromCharCode(...arguments))",
      position="before")
    → JSVMP 高频使用 fromCharCode 构造字符串
```

#### 1.3 I/O 关联分析

拿到出口和入口的数据后，进行关联：

```
已知信息：
  出口：sign=a1b2c3d4e5f6... (32位hex → 疑似MD5)
  入口：CryptoJS.MD5 输入 = "page=1&ts=1680000000&key=secret123"

关联结论：
  sign = MD5("page=" + page + "&ts=" + timestamp + "&key=" + secret_key)
```

---

(Full content continued... This is a large document covering four-axe methodology for JSVMP analysis)

---

## 实战检查清单（v2.5.0 扩充四板斧项）

**第一板斧 — Hook 出入口**：
- [ ] `search_code(keyword='switch', script_url=..., context_chars=500)` 确认是 VMP（case_count > 50）
- [ ] `inject_hook_preset("xhr", persistent=True)` + `("fetch", persistent=True)` 捕获请求出口
- [ ] `inject_hook_preset("cookie", persistent=True)` **原型链级** cookie hook
- [ ] `analyze_cookie_sources` 归因最终 cookie（HTTP vs JS）
- [ ] `inject_hook_preset("crypto", persistent=True)` 捕获加密原语入口
- [ ] Hook String.fromCharCode（JSVMP 高频信号）

**第二板斧 — 插桩解释器**：
- [ ] `hook_jsvmp_interpreter(script_url=<VMP basename>)` 多路径探针
- [ ] 分层 `hook_function(mode='trace')`（粗 → 中 → 细）
- [ ] `hook_jsvmp_interpreter(mode='proxy', trackProps=True, targets=[...])` 监控签名容器

**第三板斧 — 日志分析**：
- [ ] `get_jsvmp_log` + `get_trace_data` + `get_runtime_probe_log` + `get_console_logs`
- [ ] 反向追踪法，找到签名值首次出现的位置
- [ ] 多次请求对比，确认变化因子和固定因子

**第四板斧 — 源码级插桩 [v2.5.0 新增]**：
- [ ] `instrumentation(action='install', url_pattern=..., mode="ast"|"regex", tag=...)` 装好
- [ ] `instrumentation(action='reload')` 让插桩先于 VMP 生效
- [ ] 读 `instrumentation(action='log')` 三个 summary：`hot_keys` / `hot_methods` / `hot_functions`
- [ ] `instrumentation(action='stop')` 完工清理

**环境/时序**：
- [ ] 若目标是首屏挑战页，用 `navigate(pre_inject_hooks=[...])` 或 `via_blank=True`
- [ ] `compare_env` 采集环境基准
- [ ] `bypass_debugger_trap` 绕过反调试

**还原与验证**：
- [ ] 根据 hot_methods 判断算法类型
- [ ] 选择还原策略（纯算法 / 沙箱 / 完整 VM / jsdom 环境伪装 / 浏览器）
- [ ] 实现并验证签名计算结果
- [ ] 端到端验证（连续 5+ 次请求稳定）
