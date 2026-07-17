# Phase 0-5 详细操作手册

## Phase 0：任务理解与调试环境搭建
- 明确分析目标
- 带 Cookie / 无 Cookie 启动浏览器
- 创建项目目录（Node.js 或 Python）

## Phase 0.5：经验库命中验证
四分支决策：
1. 命中 cases/ 案例
2. 命中 site_* 目录
3. 有历史 session
4. 全未命中（30 秒指纹采集）

## Phase 1：目标侦察
- 网络请求捕获（network_capture/list_network_requests/get_network_request/get_request_initiator）
- 加密参数识别（固定值/动态值/加密值）
- 输出侦察报告

## Phase 2：源码分析
- search_code 关键词搜索定位
- 代码混淆识别（OB/控制流平坦化/eval/JSVMP）
- JSVMP 路径选择决策树
- 反爬类型前置判断（签名型/行为型）
- 调用链追踪
- 提取核心逻辑

## Phase 3：动态验证
- Hook 注入验证（inject_hook_preset/hook_function）
- 伪断点与函数追踪
- 多次请求对比

## Phase 4：算法还原
- 语言选择（Node.js vs Python）
- 解法模式（A纯算法/B沙箱/C WASM/D浏览器/E jsdom）
- 编码原则：先通后全/优先纯算法/中间值对比/配置外置
- 配置文件策略

## Phase 5：断言驱动交付
- 运行验证（5 次请求）
- 更新 Session 档案
- 生成 README.md
- 经验沉淀到 cases/