---
name: console-claw-skill
description: Use this skill when the user wants ready-to-send Codex prompts for one-shot deployment, linkage, validation, or optimization of a codex-console + CLIProxyAPI + openClaw stack (especially Telegram bot integration). Trigger on requests to replace codex-manager playbooks with codex-console, generate end-to-end install prompts, create acceptance prompts, or refine this deployment playbook into reusable templates.
---

# codex-openclaw-playbook-skill

把用户给出的部署目标整理成可直接复制给 Codex 的提示词，核心是一步到位完成三段联动
- 安装并启动 codex-console
- 安装并联动 CLIProxyAPI
- 安装 openClaw 并接入 Telegram Bot

## 输出规则

1. 只输出可执行提示词与必要占位符
2. 涉及密钥时只保留占位符，不回填真实值
3. 默认给最短可用版本，用户要详细版再展开
4. 任务是生成提示词，不代执行部署

## 实战优化逻辑（黄金做法）

1. 强制 Codex 输出"执行结果"而不是"分析方案"
2. 按阶段验收，每阶段都要有可验证结果
3. 明确失败分支处理，要求发现异常后自动修复并重启服务
4. 收尾时统一汇总地址、配置路径、密钥存放位置、库存和可用性状态

## 常见失败模式（必须规避）

- 只给计划，不落地执行
- 服务启动了但没做接口验收
- 没验证 openClaw 实际走 CLIProxyAPI `/v1`
- Telegram Bot 只配置不验活
- 没有最终汇总，后续难维护

## 标准流程

1. 识别用户目标
- 首次搭建整套链路
- 维护现有环境并提升库存稳定性
- 仅做 openClaw 可用性验收

2. 选择模板
- 全量部署用 `references/full-deploy-template.md`
- 库存与稳定性优化用 `references/replenishment-optimization-template.md`
- 验收测试用 `references/openclaw-acceptance-template.md`

3. 填充变量
- Telegram Bot Token
- 服务监听地址或端口（如用户指定）
- 最低库存目标（如用户指定）

4. 交付
- 先给主模板
- 再给可选增强模板
- 最后附最简使用说明（不超过 3 条）

## 必检清单

- 是否明确要求 Codex 直接执行而非只分析
- 是否要求 CLIProxyAPI 管理接口做 401/200 校验
- 是否要求 codex-console 与 CLIProxyAPI 建立自动上传与库存联动
- 是否要求 openClaw 上游明确走 CLIProxyAPI `/v1`
- 是否要求 Telegram Bot 对接并返回 bot 用户名
- 是否要求最终汇总地址、配置路径、密钥存放位置、库存数量

## 参考文件

- `references/full-deploy-template.md`
- `references/replenishment-optimization-template.md`
- `references/openclaw-acceptance-template.md`
- `references/quick-usage.md`
