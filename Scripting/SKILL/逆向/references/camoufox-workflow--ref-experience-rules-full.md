> ⚠️ v3.3.0 起，本文档的核心经验法则（24 条）已回迁到 SKILL.md 核心层。
> 本文档保留作为深度背景参考，但**以 SKILL.md 为准**。如发现不一致，以 SKILL.md 为准。

# 经验法则完整版（30 条）

> **说明**：SKILL.md 核心层保留了前 10 条最常用的。本文档是完整的 30 条
>
> **版本**：v3.1.0（MCP v0.9.0 工具名迁移）
>
> **来源**：v3.0.0 从 46 条压缩合并而来，基于三次真实站点（瑞数/TikTok/抖音）实战数据

---

## 一、识别与选择（5 条）

### 规则 1：反爬类型识别是 Phase 0 的 Phase 0

> 合并原 #28

不加任何 hook 先 navigate，观察 redirect_chain / initial_status / 加载的 JS 特征，三分法判定签名型/行为型/纯混淆。

**用错档的工具不是效率差，是根本跑不通。**

```
MCP 操作：
  navigate(url)  // 不传 pre_inject_hooks
  → 读 initial_status / final_status / redirect_chain
  → 按三分法判断表判定类型
```

### 规则 2：JSVMP 双路径决策

> 合并原 #11, #29, #30

识别到 JSVMP 后先判断走路径 A（算法追踪）还是路径 B（环境伪装）。

签名型反爬只有一条路：`instrumentation(action='install', mode="ast")`，源码级插桩不动环境，是唯一能同时"观察 VMP"和"让挑战通过"的手段。

`hook_jsvmp_interpreter(mode="transparent")` 是 `mode="proxy"` 的签名安全备选，源码级插桩失败再退到这里。

### 规则 3：Cookie 归因优先于 setter hook

> 合并原 #1, #25

分析动态 Cookie 第一步永远是 `analyze_cookie_sources()`，它能区分三种模式：
- 纯 JS 写入
- 纯 HTTP Set-Cookie
- JS 算 token + 服务端带回来

RS/Akamai 最常见的第三种模式下，单纯 hook `document.cookie` setter 什么都抓不到。

### 规则 4：`pre_inject_hooks` 的正确定位

> 合并原 #26, #30

- **行为型反爬**：可用，首屏挑战页（RS 412、Akamai 首包）必须用它在 navigate 时装好 hook
- **签名型反爬**：**不可用**，永远不要对签名型反爬用它

### 规则 5：经验案例优先匹配 cacheOpts 区分变体

> 原 #40

同一 SDK 体系存在多个变体（单签名 vs 双签名、bdms.paths vs cacheOpts），Phase 0.5 指纹匹配时应优先检测 `cacheOpts` 和 `X-Gnarly` 来区分。

---

## 二、工具技巧（10 条）

### 规则 6：`get_request_initiator` 是黄金路径

> 原 #9

看到加密参数 → 获取请求 ID → `get_request_initiator(request_id=N)` → 直达签名函数，省去大量搜索。

### 规则 7：`inject_hook_preset` 一键到位

> 原 #10

不要手写常见 Hook，预设模板覆盖 xhr/fetch/crypto/websocket/debugger_bypass/cookie/runtime_probe。

### 规则 8：源码级插桩优先于运行时 hook（对 VM 自包含场景）

> 合并原 #23, #24

RS 5/6、Akamai sensor_data、webmssdk 这类"算法全部在 opcode dispatch 循环内"的 VMP，`hook_jsvmp_interpreter` 仍然看不到 switch/case 内部。

```
MCP 操作：
  instrumentation(action='install', url_pattern="**/<VMP文件>", mode="ast", tag="vmp1")
  → 是唯一能打开黑箱的工具

  instrumentation(action='log', tag='vmp1', type_filter='tap_get', limit=200)
  → hot_keys 指纹学习法 30 秒就能告诉你 VMP 读了哪些环境属性
```

### 规则 9：`instrumentation(action='reload')` 取代裸 `reload`

> 原 #27

装完 hook 想让它先于页面 JS 跑，裸 `reload()` 不能保证顺序。

```
MCP 操作：
  instrumentation(action='reload')
  → 一步到位，默认 clear_log=True 拿到干净快照
```

### 规则 10：`search_code(keyword, script_url=url)` 定位大文件

> 原 #16

JSVMP 文件通常 200KB+，用 `search_code(keyword, script_url=url)` 在指定脚本中搜索，获取前后上下文。