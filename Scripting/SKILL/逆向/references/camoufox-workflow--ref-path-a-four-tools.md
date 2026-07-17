# 路径 A：算法追踪 — 四板斧完整方法论

> **触发条件**：Phase 2 识别出反爬为签名型/行为型且确认用路径 A 时读此文档

## 一、四板斧总览

| 板斧 | 名称 | 工具 | 擅长 |
|------|------|------|------|
| 第一斧 | Hook I/O | inject_hook_preset + hook_function(mode=intercept) | 请求链路劫持、动态 Cookie |
| 第二斧 | 插桩解释器 | hook_function(mode=trace) + hook_jsvmp_interpreter | 调用链追踪 |
| 第三斧 | 日志分析 | get_jsvmp_log + 反向追踪 | 反推公式 |
| 第四斧 | 源码级插桩 | instrumentation(action=install) + instrumentation(action=log) | VM 内部调度，签名型首选 |

## 二、快速路径（8 步流程）

1. search_code(keyword=switch) 确认 VMP
2. hook_jsvmp_interpreter 一键装通用探针
3. inject_hook_preset(cookie) + inject_hook_preset(xhr)
4. instrumentation(action=install, url_pattern=**, mode=ast, tag=vmp1)
5. instrumentation(action=reload) 让探针先于 VMP 生效
6. 触发目标操作
7. instrumentation(action=log, tag=vmp1, type_filter=tap_get, limit=300)
8. get_jsvmp_log + analyze_cookie_sources 交叉印证

## 三、第一板斧：Hook I/O

- 出口：inject_hook_preset(xhr/fetch/cookie) + analyze_cookie_sources
- 入口：inject_hook_preset(crypto) + hook_function(String.fromCharCode)
- 关联出入口数据推断签名公式

## 四、第二板斧：插桩解释器

- search_code(keyword=switch) 定位字节码分发函数
- hook_function(mode=trace, max_captures=N) 分层追踪
- hook_jsvmp_interpreter(mode=proxy, trackProps=True) 监控签名容器
- compare_env 采集环境基准

## 五、第三板斧：日志分析

- get_trace_data + get_jsvmp_log + get_console_logs + get_runtime_probe_log
- 反向追踪法：从签名值出发，逐层反向寻找输入
- evaluate_js 验证提取的算法

## 六、第四板斧：源码级插桩

1. instrumentation(action=install, url_pattern, mode=ast|regex, tag=vmp1)
2. instrumentation(action=reload) 让插桩先于 VMP 执行
3. instrumentation(action=log, tag=vmp1, type_filter=tap_get|tap_method|tap_call)
   - hot_keys: VMP 读取的环境属性指纹集
   - hot_methods: VMP 调用的方法
   - hot_functions: VMP 调用的函数
4. instrumentation(action=stop) 完工清理

## 七、降级梯度

L1: instrumentation(mode=ast) → L2: instrumentation(mode=regex) → L3: hook_jsvmp_interpreter(mode=transparent) → L4: hook_jsvmp_interpreter(mode=proxy) [仅行为型] → L5: 路径 B → L6: 浏览器自动化

## 八、还原策略

| 情况 | 策略 |
|------|------|
| 标准算法（MD5/HMAC/AES） | 纯算法还原 (crypto/hashlib) |
| 定制化逻辑但输入域清晰 | Node.js vm 沙箱 / Python execjs |
| 环境指纹多 + cookie 来自 HTTP | 路径 B jsdom 环境伪装 |

## 九、JSVMP 核心经验

1. I/O 是目标，不是字节码本身
2. 先 Hook 出口再 Hook 入口
3. hook_function(mode=trace) 必须设 max_captures
4. get_trace_data 需要本地过滤
5. 前三板斧对签名型不可用
6. search_code(keyword, script_url=url) 替代全局搜索
