---
name: scripting-home-screen-ui
description: 为脚本提供 home_screen_default_ui.tsx，使其能被渲染到首页第一个 Tab 中
metadata:
  display_name: "脚本 UI 万能适配"
  intent_patterns: "首页Tab,首页配置,home_screen_default_ui,首页默认UI,首页第一个Tab,添加首页,shared.tsx,共享代码提取,避免副作用,导入副作用"
---

# Purpose

Scripting App 新增了 **首页默认脚本 UI 配置功能**：脚本提供 `home_screen_default_ui.tsx` 文件，App 将其渲染到首页第一个选项卡中。

此技能的用途就是帮任意脚本**创建或检查**这个文件。

# 核心逻辑（就三步）

## 1. 扫描脚本目录

```bash
script-dir/
├── index.tsx                    # 主入口
├── shared.tsx                   # 共享代码（可选，推荐）
├── home_screen_default_ui.tsx   # 首页 UI（可能有也可能没有）
└── widget.tsx / intent.tsx / …  # 其他文件，不动
```

用 `file_tool read` 看看有没有 `home_screen_default_ui.tsx`。

## 2. 如果没有 → 创建

建一个 `home_screen_default_ui.tsx`，内容就是把脚本的主要界面用 `<NavigationStack>` 包起来展示：

```tsx
import { NavigationStack } from "scripting"
// 引入脚本主页面组件
import { App } from "./index"

export default function HomeScreenView() {
  return (
    <NavigationStack>
      <App />
    </NavigationStack>
  )
}
```

如果主页面组件不叫 `App`，就改成实际导出的名字。如果 `index.tsx` 没有导出视图组件（直接 `Script.exit()` 或 `Navigation.present()`），那就创建一个最小首页视图：

```tsx
import { NavigationStack, Text, VStack } from "scripting"

export default function HomeScreenView() {
  return (
    <NavigationStack>
      <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} alignment="center">
        <Text>欢迎使用此脚本</Text>
      </VStack>
    </NavigationStack>
  )
}
```

## 3. 如果已有 → 检查 NavigationStack

**必须确保最外层是 `<NavigationStack>`**，因为 App 不再自动包裹了：

```tsx
// ❌ 错误 — 没有 NavigationStack
export default function HomeScreenView() {
  return <ScrollView>...</ScrollView>
}

// ❌ 错误 — ZStack/VStack 等也不行
export default function HomeScreenDefaultUi() {
  return <ZStack>...</ZStack>
}

// ✅ 正确
export default function HomeScreenView() {
  return <NavigationStack>
    <ScrollView>...</ScrollView>
  </NavigationStack>
}
```

## 4. ⚠️ 关键陷阱：`import from "./index"` 触发 `void run()` 副作用

### 问题

如果 `home_screen_default_ui.tsx` 写的是：

```tsx
import { App, listGists, Gist } from "./index"
```

而 `index.tsx` 底部有：

```tsx
void run().finally(Script.exit)
```

**当首页 Tab 加载 `home_screen_default_ui.tsx` 时**，ES Module 会执行整个 `index.tsx` 文件，包括 `void run().finally(Script.exit)`。这会导致：
- `Navigation.present()` 全屏打开 App
- 首页 Tab 被覆盖
- 用户感觉「点击首页又打开了一遍脚本」

### 解决方案：`shared.tsx` 模式

把**可共享的代码**（类型、API 函数、常量、组件）提取到一个单独的 `shared.tsx` 文件，这个文件不能有顶级副作用。

**文件职责划分：**

| 文件 | 内容 | 副作用 |
|------|------|--------|
| `shared.tsx` | 类型、API、常量、组件 | ❌ 无 |
| `index.tsx` | 入口：App + run() + void run() | ✅ 有（仅自己运行时） |
| `home_screen_default_ui.tsx` | 首页 Tab UI | ❌ 无 |

**模板 `shared.tsx`：**

```tsx
import { fetch, useState, useEffect, ... } from "scripting"

export const TOKEN_KEY = "..."
export const contentCache = new Map<string, string>()

export interface MyType { ... }

export async function fetchData(): Promise<...> { ... }

export function MyComponent({ ... }) {
  // ...
}
```

**模板 `index.tsx`（从 shared 导入）：**

```tsx
import { Navigation, Script, ... } from "scripting"
import { HomeTab, SettingsTab } from "./shared"

function App() { ... }

async function run() {
  await Navigation.present({ element: <App /> })
}

void run().finally(Script.exit)  // 仅在自己被运行时执行
```

**模板 `home_screen_default_ui.tsx`（从 shared 导入）：**

```tsx
import { useState, useEffect, ... } from "scripting"
import { MyType, fetchData, ... } from "./shared"

export default function HomeScreenView() {
  // ...
}
```

### 判断方法

检查 `index.tsx` 末尾是否有以下模式之一，如果有，**必须使用 `shared.tsx` 模式**：

```tsx
void run().finally(Script.exit)
run().finally(Script.exit)
void run().catch().finally(Script.exit)
Script.exit()  // 在顶部或底部
```

如果 `index.tsx` **没有**顶级副作用（没有 `void run()`、没有 `Script.exit()`），可以直接从 `./index` import。

# 不需要做的事

- ❌ 不改 TabView 布局（那是脚本自己的 UI 风格）
- ❌ 不改播放器功能
- ❌ 不改 Widget/Intent/Live Activity
- ❌ 不删任何无关代码

只做一件事：**确保脚本有 `home_screen_default_ui.tsx`，且最外层被 `NavigationStack` 包裹**。

⚠️ 如果 import from `./index` 触发副作用，先提取共享代码到 `shared.tsx`。

# 一句话触发

> **"给这个脚本加首页Tab"**
