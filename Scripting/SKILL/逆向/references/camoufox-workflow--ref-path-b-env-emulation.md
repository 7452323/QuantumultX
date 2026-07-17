# 路径 B：环境伪装 — jsdom/vm 沙箱六步法完整方法论

## 核心思想
不分析 JSVMP 内部算法，在 jsdom 中完整运行原始 JSVMP 字节码。

## 步骤 0.5：确认签名函数入口
search_code(keyword=frontierSign|XMLHttpRequest.prototype.open|window.fetch|cacheOpts, script_url=VMP脚本URL)

## 步骤 1：Camoufox 环境指纹采集
4-5 批次 evaluate_js 采集 navigator/screen/document/performance/DOM/canvas/WebGL

## 步骤 2：jsdom 环境采集
在 jsdom 中执行相同采集代码

## 步骤 3：Diff 与严重性分级
- 致命级：Function.prototype.toString/navigator.plugins/webdriver/hasFocus/DOM offset
- 高危级：Object.toString.call/call/chrome/userAgentData/performance/Symbol.toStringTag
- 中危级：30+ API 存根缺失

## 步骤 4：patchEnvironment()
1. markNative 三层防御（最高优先级）
2. navigator 补丁（plugins/webdriver/userAgentData/connection）
3. window 补丁（chrome + 30+ API 存根）
4. document + performance 补丁
5. DOM 布局属性
6. Symbol.toStringTag 全面修复

## 步骤 5：内部验证
win.eval 验证所有检测点通过

## 步骤 6：端到端验证
jsdom 加载 JSVMP → 触发签名 → 截获 → 真实请求（5 次）

## Firefox vs Chrome 差异
- Function.prototype.toString 格式不同
- vendor/vendorSub/productSub 值不同
- window.chrome 在 Firefox 为 undefined

## 常见踩坑
1. Canvas 存根不真实
2. native code 多行格式
3. Symbol.toStringTag 遗漏
4. 补丁必须在 JSVMP 加载前完成
5. 服务端静默拒绝（HTTP 200 + 空 body）
6. cacheOpts 未传入
