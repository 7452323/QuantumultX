# JSVMP 源码级插桩专项指南（第四板斧）

> **v2.5.0 新增文档**。本指南讲解 camoufox-reverse MCP v0.4.0+ 提供的源码级插桩能力（`instrument_jsvmp_source` / `get_instrumentation_log` / `find_dispatch_loops`）的使用方法论，是 JSVMP 四板斧中"第四板斧"的完整说明。
>
> 与 `jsvmp-analysis.md` 的第一/二/三板斧互补——前三板斧诊断"VM 看外界 / 外界看 VM"，本文档讲解"VM 看自己"。

---

## 1. 为什么需要源码级插桩

### 1.1 传统 hook 的盲区

**`hook_jsvmp_interpreter`** 即使升级到 v0.4.0 的多路径版本（apply/call/bind + Reflect.*/Proxy 全局对象 + timing/random），仍然只能看到 VMP 路由到**可 hook JS API** 的部分。但RS 5/6、Akamai sensor_data v2/v3、webmssdk（短视频平台）、obfuscator.io 这类 VMP 的典型结构是：

```js
// 典型的自包含 VMP 字节码分发循环
function _vm(bytecode) {
  var stack = [], pc = 0, env = window;
  while (pc < bytecode.length) {
    var op = bytecode[pc++];
    switch (op) {
      case 1: stack.push(env[bytecode[pc++]]); break;    // GET：env[key] 直接访问
      case 2: var k = stack.pop(), o = stack.pop(); stack.push(o[k]); break;  // 属性读取
      case 3: var args = stack.splice(-bytecode[pc++]);
              var fn = stack.pop(); stack.push(fn.apply(null, args)); break;  // apply hook 可见
      case 4: stack.push(bytecode[pc++] + stack.pop()); break;                // 纯字符串拼接
    }
  }
}
```

### 1.2 源码级插桩的原理

**`instrument_jsvmp_source`** 在 HTTP 层拦截目标脚本，在脚本抵达浏览器前把源码改写成等价的"带 tap 的版本"。改写后的源码**继续正常执行**——VMP 照跑不误，但每一次对宿主环境或对象的交互都被记录。

---

## 2. 两种改写模式：regex vs AST

### 2.1 `mode="regex"`（默认，零依赖）

- **原理**：纯正则匹配 `<identifier>[<expr>]`，替换为 `__mcp_tap_get(identifier, expr, tag)`
- **优点**：无外部 CDN 依赖，页面离线也能用；速度极快；大文件安全（10MB+ VMP 也能秒级改写）
- **覆盖率**：~80% 的 member access；**不覆盖函数调用 tap**

### 2.2 `mode="ast"`（高保真，需 CDN）

- **原理**：MCP 侧 esprima-python 解析，99% 覆盖率，同时改写 member access 和 call
- **优点**：不会误改写字符串字面量/正则
- **v0.5.0 变化**：从"页面内加载 acorn CDN"改为 MCP 侧 esprima-python 解析，挑战页也可用

### 2.3 选择建议

| 情况 | 选 |
|------|-----|
| 首次分析某个 VMP，联网环境 | **AST** |
| 离线/受限网络 | regex |
| VMP 文件 > 5 MB | regex |
| 关心 VMP 调了哪些方法 | **AST** |
| 关心 VMP 读了哪些属性 | 任一 |

---

## AST 模式健康诊断（v2.6.0 新增）

通过 `get_instrumentation_status()` 的 `active_patterns[i].last_mode_used` 字段判断实际路径：

| `last_mode_used` | 含义 |
|---|---|
| `"ast"` | MCP 侧 esprima 成功，全量 AST 改写 |
| `"regex"` | 显式指定了 mode="regex" |
| `"regex (fallback)"` | mode="ast" 但 esprima 解析失败，自动回落 regex |
| `"ast_page"` | deprecated 的页面内 Acorn 实现 |

---

## 3. 黄金 8 步流程

### Step 1 — 启动 + 网络捕获

```
Actions:
  launch_browser(headless=False)
  start_network_capture(capture_body=True)
```

### Step 2 — 第一次导航定位 VMP 脚本 URL

```
Actions:
  navigate(url="https://target.com/", wait_until="load")
  list_network_requests(resource_type="script")
  → 找 size 最大的 JS（100KB+，sdenv-*.js / FuckCookie_*.js / webmssdk.es5.js）
```

### Step 3 — 确认是 VMP

```
Actions:
  find_dispatch_loops(script_url="<VMP_URL>", min_case_count=20)
  → case_count > 50 基本确认是 VMP
```

### Step 4 — 装源码级插桩（核心）

```
Actions:
  instrument_jsvmp_source(
    url_pattern="**/sdenv-*.js",
    mode="ast",
    tag="vmp1",
    rewrite_member_access=True,
    rewrite_calls=True,
    max_rewrites=5000,
    cache_rewritten=True
  )
```

### Step 5 — 装兜底 hook

```
Actions:
  inject_hook_preset(preset="cookie", persistent=True)
  inject_hook_preset(preset="xhr", persistent=True)
  inject_hook_preset(preset="fetch", persistent=True)
  inject_hook_preset(preset="crypto", persistent=True)
  hook_jsvmp_interpreter(script_url="<VMP basename>", track_calls=True, track_reflect=True, track_props=True)
  bypass_debugger_trap()
```

### Step 6 — reload_with_hooks 让探针先于 VMP 生效

```
Actions:
  reload_with_hooks(clear_log=True, wait_until="networkidle")
```

### Step 7 — 触发业务操作

```
Actions:
  click(selector=".some-btn") 或 type_text 或 evaluate_js
```

### Step 8 — 读日志，分析 hot_keys / hot_methods / hot_functions

```
Actions (hot_keys):
  get_instrumentation_log(tag_filter="vmp1", type_filter="tap_get", limit=200)
  → summary.hot_keys: VMP 读取了哪些属性（top 30，按频次）

Actions (hot_methods):
  get_instrumentation_log(tag_filter="vmp1", type_filter="tap_method", limit=200)
  → summary.hot_methods: VMP 调用了哪些方法

Actions (hot_functions):
  get_instrumentation_log(tag_filter="vmp1", type_filter="tap_call", limit=200)
  → summary.hot_functions: VMP 调用了哪些函数
```

---

## 4. 进阶技巧

### 4.1 多 VMP 场景

```
 instrument_jsvmp_source(url_pattern="**/webmssdk.es5.js", mode="ast", tag="webmssdk")
 instrument_jsvmp_source(url_pattern="**/a_bogus.js", mode="ast", tag="bogus")
 get_instrumentation_log(tag_filter="webmssdk", type_filter="tap_get")
 get_instrumentation_log(tag_filter="bogus", type_filter="tap_get")
```

### 4.2 key_filter 锁定

```
get_instrumentation_log(tag_filter="vmp1", key_filter="webdriver")
get_instrumentation_log(tag_filter="vmp1", key_filter="MD5")
```

### 4.3 管理插桩 route

```
get_instrumentation_status()
stop_instrumentation(url_pattern="**/sdenv-*.js")
stop_instrumentation()
```

### 4.4 与 runtime_probe 互补

```
inject_hook_preset(preset="runtime_probe", persistent=True)
instrument_jsvmp_source(url_pattern="**/sdenv-*.js", mode="ast", tag="vmp1")
reload_with_hooks()
# 两路都读
get_instrumentation_log(tag_filter="vmp1", limit=300)
get_runtime_probe_log(type_filter="xhr_send", limit=100)
get_runtime_probe_log(type_filter="canvas_toDataURL", limit=50)
```

---

## 5. 常见问题与陷阱

### Q1：`files_rewritten=0` 没改写到

- `url_pattern` 没命中
- VMP 从缓存加载
- pattern 注册太晚（需在 navigate 之前调用）

### Q2：AST 模式报 parse_error

- 降级为 mode="regex"
- 或先 save_script 检查是否有新语法

### Q3：改写后页面崩溃

- VMP 自己做完整性校验 → 用 regex 只改 member access
- Tag 变量名冲突 → 改 tag
- 超过 token 上限 → 调小 max_rewrites

### Q4：hot_keys 没出现预期环境指纹

- 加大 wait_until="networkidle"
- 先确认 files_rewritten > 0
- 检查 tag_filter 是否正确

### Q5：日志爆炸到上限 20000 条

- 用 clear=True 读完清
- 收紧 url_pattern
- 第一次跑用 limit=300

---

## 6. 源码级插桩的还原决策

| hot_methods | hot_keys | cookie 来源 | 策略 |
|-------------|----------|------------|------|
| CryptoJS.MD5 / HMAC | < 10 | js_document_cookie | 纯算法还原 |
| CryptoJS 但环境多 | 10-30 | 混合 | 提取 JS 沙箱 |
| 全是自定义 fn | 30+ | 任意 | 路径 B：jsdom 伪装 |

---

## 7. 参考

- `references/jsvmp-analysis.md`：四板斧方法论总纲
- `references/jsdom-env-patches.md`：环境伪装补丁库（路径 B）
- `references/mcp-cookbook.md` 场景 6：源码级插桩场景化操作
- `cases/universal-vmp-source-instrumentation.md`：骨架案例模板