---
name: scripting-home-screen-ui
description: 为 Scripting 脚本创建或修复 home_screen_default_ui.tsx，使脚本可稳定渲染到 App 首页 Home Tab；覆盖 3.3.0 首页 UI、NavigationStack 自管、shared.tsx 无副作用拆分、复杂 TabView 降级为导航入口页。
metadata:
  display_name: "脚本 UI 结构适配"
  intent_patterns: "首页Tab,首页配置,home_screen_default_ui,首页默认UI,首页第一个Tab,添加首页,修复无法渲染此视图,无法渲染此视图,shared.tsx,共享代码提取,避免副作用,导入副作用,NavigationStack,TabView,脚本UI结构"
  assistant_tools:
    - load: true
---

# 目标

为 Scripting 脚本提供或修复 `home_screen_default_ui.tsx`，让脚本可以作为 App 首页 Home Tab 的内容稳定渲染。

这个技能只处理首页 UI 结构，不顺手重构业务、播放器、Widget、Intent、Live Activity。需要改业务时必须另按用户目标处理。

# 官方约束

`home_screen_default_ui.tsx` 是组件入口，不是脚本运行入口。

必须满足：

- 文件名必须是 `home_screen_default_ui.tsx`，位于脚本根目录，和 `index.tsx` 同级。
- 必须有默认导出，且默认导出是函数组件。
- 不要调用 `Navigation.present()` 展示主界面；直接 `return` 视图。
- 不要调用 `Script.exit()`；首页 Tab 是长期挂载的运行实例。
- App 不再自动包导航结构；需要脚本自己提供 `NavigationStack`、`NavigationSplitView`，或明确选择无导航栏。
- 顶层 import 会正常执行，因此不要从带顶层副作用的 `index.tsx` 导入组件。
- 修改文件后真实首页不会热重载，必须在首页菜单点 Reload，或长按 Home 图标刷新。

# 先读代码

动手前必须读取：

1. 脚本根目录，确认有没有 `home_screen_default_ui.tsx`、`shared.tsx`。
2. `index.tsx`，找顶层副作用和主界面结构。
3. 主界面引用的核心页面文件，确认功能入口有哪些。
4. 如果用户说“无法渲染此视图”，优先检查首页入口是否嵌套了复杂 `TabView`、`Navigation.present`、`Script.exit` 或从 `index.tsx` 导入触发副作用。

# 判断 `index.tsx` 是否能导入

如果 `index.tsx` 出现以下任何模式，`home_screen_default_ui.tsx` 禁止从 `./index` 导入：

```tsx
main()
void main()
void run().finally(Script.exit)
run().finally(Script.exit)
Navigation.present(...)
Script.exit()
Script.enableMinimize()
```

原因：ES Module import 会执行 `index.tsx` 顶层代码。首页 Tab 加载时如果触发 `Navigation.present()` 或 `Script.exit()`，会覆盖首页、退出实例，或显示“无法渲染此视图”。

这种项目必须拆出无副作用的 `shared.tsx`，或创建首页专用入口组件。

# 结构选择

不要机械地把完整 App 根视图塞进首页 Tab。按脚本现状选择结构。

## A. 简单单页脚本

适用：主界面本来就是一个 `List`、`ScrollView`、`VStack` 页面，没有复杂 `TabView`、全局 sheet、独立运行生命周期。

可以创建：

```tsx
import { NavigationStack } from "scripting"
import { MainView } from "./shared"

export default function HomeScreenView() {
  return (
    <NavigationStack>
      <MainView />
    </NavigationStack>
  )
}
```

## B. 已有独立运行入口 + 可安全复用页面

适用：`index.tsx` 有 `Navigation.present()` / `Script.exit()`，但页面组件可拆出来复用。

拆分职责：

| 文件 | 职责 | 顶层副作用 |
|---|---|---|
| `shared.tsx` | 类型、API、状态 Provider、页面组件、轻量根组件 | 禁止 |
| `index.tsx` | 独立运行入口，调用 `Navigation.present`，结束时 `Script.exit` | 允许 |
| `home_screen_default_ui.tsx` | 首页 Tab 入口，默认导出组件 | 禁止 |

模板：

```tsx
// shared.tsx
import { List, Section, Text } from "scripting"

export function MainPage() {
  return (
    <List navigationTitle="Home">
      <Section>
        <Text>Content</Text>
      </Section>
    </List>
  )
}
```

```tsx
// index.tsx
import { Navigation, Script } from "scripting"
import { MainPage } from "./shared"

async function main() {
  await Navigation.present({ element: <MainPage /> })
  Script.exit()
}

void main()
```

```tsx
// home_screen_default_ui.tsx
import { NavigationStack } from "scripting"
import { MainPage } from "./shared"

export default function HomeScreenView() {
  return (
    <NavigationStack>
      <MainPage />
    </NavigationStack>
  )
}
```

## C. 完整 App 是 `TabView`

适用：脚本独立运行时是完整 App，例如 `TabView` + 多个 `NavigationStack` + bottom accessory + sheet + 播放器。

不要默认在 `home_screen_default_ui.tsx` 中返回完整 `TabView`。真实 Scripting 首页本身就是一个 Tab 宿主，在里面再嵌套一套复杂 TabView 很容易出现“无法渲染此视图”，尤其带这些配置时：

- `tabViewBottomAccessory`
- `sheet`
- `sidebarAdaptable`
- 每个 Tab 内再嵌 `NavigationStack`
- 外层又包 `NavigationStack`

推荐做法：独立运行入口保留完整 `TabView`，首页 UI 改成导航入口页。这样所有功能仍可进入，但不在首页宿主里嵌第二个 Tab 栏。

模板：

```tsx
import {
  HStack,
  Image,
  List,
  NavigationLink,
  NavigationStack,
  Section,
  Spacer,
  Text,
  VStack,
  useEffect,
} from "scripting"
import { DiscoverView } from "./discover"
import { LibraryView } from "./library"
import { SearchView } from "./search"
import { SettingView } from "./settings"
import { player } from "./player"
import { ACCENT } from "./theme"

function Entry({
  title,
  subtitle,
  systemImage,
  destination,
}: {
  title: string
  subtitle: string
  systemImage: string
  destination: JSX.Element
}) {
  return (
    <NavigationLink destination={destination}>
      <HStack spacing={12} padding={{ vertical: 6 }}>
        <Image systemName={systemImage} font="title3" foregroundStyle={ACCENT} frame={{ width: 30 }} />
        <VStack alignment="leading" spacing={2}>
          <Text font="headline" lineLimit={1}>{title}</Text>
          <Text font="caption" foregroundStyle="secondaryLabel" lineLimit={1}>{subtitle}</Text>
        </VStack>
        <Spacer />
        <Image systemName="chevron.right" font="footnote" foregroundStyle="tertiaryLabel" />
      </HStack>
    </NavigationLink>
  )
}

function HomeContent() {
  useEffect(() => {
    void player.init()
  }, [])

  return (
    <List navigationTitle="脚本" navigationBarTitleDisplayMode="large" listStyle="insetGroup">
      <Section header={<Text>功能</Text>}>
        <Entry title="发现" subtitle="浏览推荐内容" systemImage="square.grid.2x2" destination={<DiscoverView />} />
        <Entry title="书架" subtitle="查看收藏内容" systemImage="books.vertical.fill" destination={<LibraryView />} />
        <Entry title="搜索" subtitle="查找内容" systemImage="magnifyingglass" destination={<SearchView />} />
        <Entry title="设置" subtitle="配置脚本" systemImage="gear" destination={<SettingView />} />
      </Section>
    </List>
  )
}

export default function HomeScreenView() {
  return (
    <NavigationStack>
      <HomeContent />
    </NavigationStack>
  )
}
```

如果必须保留播放器迷你栏，把它作为 `List` 的一个 Section 放入首页内容，不要使用 `TabView` 的 `tabViewBottomAccessory`。

# 已有 `home_screen_default_ui.tsx` 的修复规则

逐项检查：

1. 默认导出是否是函数组件。
2. 是否调用了 `Navigation.present()`、`Script.exit()`、`Script.enableMinimize()`。
3. 是否从 `./index` 导入，且 `index.tsx` 有顶层运行副作用。
4. 是否外层 `NavigationStack` 包了一个完整复杂 `TabView`。
5. 是否在首页环境里又显示“退出”“最小化”等独立运行按钮。
6. 是否所有原有功能仍有入口，不能为了修复首页丢掉搜索、设置、书架、播放等功能。

修复原则：

- 简单页面：补 `NavigationStack`。
- 有副作用导入：拆 `shared.tsx`。
- 复杂 `TabView`：首页改导航入口页，独立入口保留完整 `TabView`。
- 首页专用组件里不要调用 `Script.exit()`；必要时根据 `Script.env === "home_screen"` 分支。

# 验证

修改后至少做：

```bash
scripting-ts preview_ui /path/to/home_screen_default_ui.tsx
```

同时运行 TypeScript 诊断或项目诊断。预览成功不代表真实首页一定成功；如果用户在真实首页仍看到“无法渲染此视图”，优先把首页入口从完整 `TabView` 改成导航入口页。

# 不要做

- 不要为了首页适配删除功能文件。
- 不要把 `home_screen_default_ui.tsx` 写成调用 `Navigation.present()` 的脚本入口。
- 不要从有 `void main()` / `Script.exit()` 的 `index.tsx` 导入组件。
- 不要在真实 Home Tab 中强塞复杂完整 App 根视图；尤其不要嵌套 `TabView` + `sheet` + `tabViewBottomAccessory`。
- 不要声称预览成功就等于真实首页一定成功；真实首页需要 Reload 后验证。

# 触发语

用户提到以下内容时使用本技能：

- 首页 Tab
- 首页默认 UI
- `home_screen_default_ui.tsx`
- Scripting 主页 UI
- “无法渲染此视图”
- 脚本 UI 结构
- shared.tsx / 避免导入副作用
