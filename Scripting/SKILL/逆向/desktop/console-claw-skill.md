---
name: console-claw-skill
description: Use this skill when the user wants ready-to-send Codex prompts for one-shot deployment, linkage, validation, or optimization of a codex-console + CLIProxyAPI + openClaw stack.
---
# codex-openclaw-playbook-skill
把用户给出的部署目标整理成可直接复制给 Codex 的提示词，核心是一步到位完成三段联动
## 输出规则
1. 只输出可执行提示词与必要占位符
2. 涉及密钥时只保留占位符，不回填真实值
3. 默认给最短可用版本，用户要详细版再展开
## 标准流程
1. 识别用户目标 2. 选择模板 3. 填充变量 4. 交付
## 参考文件
- references/full-deploy-template.md
- references/replenishment-optimization-template.md
- references/openclaw-acceptance-template.md
