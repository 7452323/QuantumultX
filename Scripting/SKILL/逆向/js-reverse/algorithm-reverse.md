---
category: reverse-engineering
name: algorithm-reverse
version: "1.0"
description: JS逆向算法还原统一技能。面向Web/JS逆向中的签名还原、混合加密拆解、Cookie/Header签名、JSVMP/VMP字节码还原、Wasm协议分析、验证码风控参数还原。统一闭环：请求→writer→builder→entry→source。
tags: [js-reverse, algorithm-reduction, signature-crack, captcha, jsvmp, wasm, crypto, python-reproduction]
---

# Algorithm Reverse — JS逆向算法还原统一技能

## 技能分工

本技能是JS逆向算法还原的**总入口**，与其他技能形成协作链：

| 技能 | 关系 | 协作方式 |
|------|------|----------|
| **find-crypto-entry** | 上游 | 入口定位结果传给本技能 |
| **ast-deobfuscation** | 前处理 | 解混淆后的可读代码便于分析 |
| **env-patch** | 环境依赖 | 环境准备完成后复现签名 |
| **jsvmp-reverse** | 下游转交 | VMP题型识别后转交字节码层面 |

## 统一闭环方法论

```text
最终请求 / 最终cookie / 最终verify / 最终WS帧
→ writer（写出点）
→ builder（构造函数）
→ entry（加密入口）
→ source（原始材料）
```

## 6类题型分类

| 题型 | 难度 | 核心挑战 |
|------|------|----------|
| 1. 标准签名 | ★★ | 参数排序、编码一致性、原始串恢复 |
| 2. 混合加密 | ★★★ | 对称+非对称组合、密钥动态生成 |
| 3. Cookie/Header签名 | ★★ | 多参数联动、环境采集→builder→写出 |
| 4. JSVMP/VMP | ★★★★ | 字节码解释器、中间数组恢复、环境位串 |
| 5. Wasm协议 | ★★★★★ | 二进制模块反编译、协议边界 |
| 6. 验证码风控 | ★★★★ | 图像+参数+环境+verify多线并行 |

## 5层检查点体系

| 层 | 内容 | 作用 |
|----|------|------|
| 1. 请求层 | 最终URL/header/body/cookie/WS帧 | 确定参数完整性与编码 |
| 2. 算法层 | 加密算法识别、参与签名的字段和排序规则 | 算法还原核心依据 |
| 3. 密钥层 | 密钥来源、key/iv/salt | 判断密钥动态性 |
| 4. 环境层 | window/document/navigator/指纹/collect | 环境依赖程度 |
| 5. 时序层 | 时间戳/序号/Nonce/token初值 | 可变参数生成与绑定 |

## Python复现规范

从sign-crack提炼的标准化执行流程：提取签名参数 → 定位加密函数 → 分析加密算法 → 生成Python复现代码 → 验证

## 验证码5线拆分

验证码题永远先拆5条线：初始化线 → 图像识别线 → 参数builder线 → 环境指纹线 → verify线

## 常见陷阱

1. **先补环境，再找入口** — 应该先锁定writer和builder
2. **只追求不报错** — 不报错不等于结果正确
3. **只在最终值处打点** — 最终值对了中间可能不对
4. **先读混淆大文件** — 应该从最终请求/sink倒推
5. **先猜算法名** — 应该先存中间值，算法名是确认不是假设
