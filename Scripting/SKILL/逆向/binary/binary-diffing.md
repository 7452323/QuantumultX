---
name: binary-diffing
description: 二进制Diffing技能 — 使用Diaphora/BinDiff进行二进制对比、补丁分析、1-day漏洞识别。
author: 7452323
tags: [binary-diffing, diaphora, bindiff, patch-analysis, vulnerability]
---

# Binary Diffing — 二进制对比分析

## 工具选择

| 工具 | 优点 | 缺点 |
|------|------|------|
| Diaphora | 免费、支持多架构 | 较慢 |
| BinDiff | 快速、准确 | 商业 |
| TurboDiff | IDA 插件 | 商业 |

## 分析流程

1. 获取 patched 和 unpatched 版本
2. 在 IDA 中分别分析两个版本
3. 生成数据库对比
4. 识别差异函数
5. 分析修改内容
6. 判定是否为安全补丁

## 补丁分析类型

| 类型 | 特征 | 意义 |
|------|------|------|
| 新增校验 | 添加 if/边界检查 | 安全补丁 |
| 修改算法 | 加密/解密逻辑变更 | 功能性补丁 |
| 删除代码 | 移除功能 | 功能性补丁 |
| 数值修改 | 常量/偏移变更 | 参数调整 |
