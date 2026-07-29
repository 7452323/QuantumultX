---
name: scripting-home-screen-ui
description: 为脚本提供 home_screen_default_ui.tsx，使其能被渲染到首页第一个 Tab 中
metadata:
  display_name: "首页 Tab 配置"
  intent_patterns: "首页Tab,首页配置,home_screen_default_ui,首页默认UI,首页第一个Tab,添加首页"
---

# Purpose

Scripting App 新增了 **首页默认脚本 UI 配置功能**：脚本提供 `home_screen_default_ui.tsx` 文件，App 将其渲染到首页第一个选项卡中。

此技能的用途就是帮任意脚本**创建或检查**这个文件。

# 核心逻辑（就三步）

## 1. 扫描脚本目录

```bash
script-dir/
├── index.tsx                    # 主入口
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

# 不需要做的事

- ❌ 不改 TabView 布局（那是脚本自己的 UI 风格）
- ❌ 不改播放器功能
- ❌ 不改 Widget/Intent/Live Activity
- ❌ 不改 import、Script.exit、按钮属性等
- ❌ 不删任何无关代码

只做一件事：**确保脚本有 `home_screen_default_ui.tsx`，且最外层被 `NavigationStack` 包裹**。

# 一句话触发

> **"给这个脚本加首页Tab"**
