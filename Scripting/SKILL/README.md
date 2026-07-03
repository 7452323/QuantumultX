# 🧠 Scripting · SKILL 技能仓库

> 基于 [Scripting App](https://scriptingapp.github.io) 的 AI 技能集，适配 AI 助手（Claude/其他 LLM Agent）调用。

---

## 📂 目录结构

```
SKILL/
├── README.md          ← 技能仓库总说明
└── 杠精/              ← 9种风格·110+条贴吧实战模板
    ├── SKILL.md       ← 技能定义文档（含模板库）
    ├── skill.json     ← 技能元数据（图标、配色）
    └── scripts/
        └── index.tsx  ← 可互动的 Scripting App 脚本
```

---

## 🎯 现有技能一览

### 🎭 杠精 — 抬杠生成器

> *看见什么都能杠两句 · 基于英雄联盟吧 · 穿越火线吧 · 王者荣耀吧 真实对线素材打磨*

| 属性 | 内容 |
|------|------|
| **风格数** | 9 种（祖安 / CF技术杠 / 电竞粉杠 / 杠精课代表 / 阴阳怪气 / 策划喷子 / 退坑老鸟 / 段位哥 / 手速警察） |
| **模板量** | 110+ 条话术模板，全部来自贴吧实战金句 |
| **覆盖社区** | 英雄联盟吧 · 穿越火线吧 · 王者荣耀吧 |
| **运行方式** | 纯 LLM 文本生成 / Scripting App 互动界面 / MCP 工具 三种模式 |
| **图标** | 💬 `bubble.left.and.exclamationmark.bubble.right` · 红色 |

---

## 📖 技能开发规范

每个技能子目录需包含：

- **`SKILL.md`** — 技能使用文档（目的、调用方式、模板、示例）
- **`skill.json`** — 技能元数据
  ```json
  {
    "icon": "SF Symbol 名称",
    "color": "SwiftUI Color 名称",
    "iconImage": null
  }
  ```
- **`scripts/`** (可选) — 可执行的 Scripting App 脚本
  - `index.tsx` — 主入口，`Navigation.present()` 模式
  - `intent.tsx` — Shortcuts / Share Sheet 集成（可选）
  - `widget.tsx` — 桌面小组件（可选）

---

## 🚀 添加新技能

1. 在 `SKILL/` 下创建技能文件夹，以技能名称命名
2. 放入 `SKILL.md` + `skill.json`
3. 如有需要，添加 `scripts/index.tsx` 交互界面
4. 更新本 README.md 的技能列表

---

*最后更新: 2026-07-04*
