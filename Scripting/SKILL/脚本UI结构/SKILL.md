---
name: scripting-ui-updater
description: 万能脚本 UI 适配 — 覆盖全部6大类脚本的 NavigationStack 自包、TabView 改顶部、播放器补齐、导入修复、过时清理、Widget/Intent 模板修复
metadata:
  display_name: "脚本 UI 万能适配"
  intent_patterns: "万能适配,全面优化,优化UI,适配UI,NavigationStack,底部Tab改顶部,播放页功能补齐,home_screen_default_ui,修复导入,修复过时,代码审查,检查脚本"
---

# Purpose

适配 **任意 Scripting App 脚本** 到最新 App 版本。覆盖全部 6 大类脚本：

| # | 脚本类型 | 入口文件 | 主要功能 |
|---|---------|---------|---------|
| 1 | **首页 Tab** | `home_screen_default_ui.tsx` | 首页第一个选项卡展示的内容 |
| 2 | **标准 UI** | `index.tsx` | 全屏 App（Navigation.present） |
| 3 | **小组件** | `widget.tsx` | 桌面小组件（小/中/大） |
| 4 | **意图/快捷指令** | `intent.tsx` | Share Sheet / 快捷指令入口 |
| 5 | **交互意图** | `app_intents.tsx` | 可交互小组件按钮 |
| 6 | **Live Activity** | `live_activity.tsx` | 灵动岛/锁屏 |

# 第一步：识别脚本类型

使用 `file_tool read` 扫描脚本目录，找到所有入口文件：

```
script-dir/
├── home_screen_default_ui.tsx   → 类型1
├── index.tsx                    → 类型2（可能同时有widget/intent）
├── widget.tsx                   → 类型3
├── intent.tsx                   → 类型4
├── app_intents.tsx              → 类型5
├── live_activity.tsx            → 类型6
└── script.json                  → 元信息
```

## 检查清单

1. **搜索 `<TabView`** — 有则标记"需改顶部布局"
2. **搜索 `home_screen_default_ui.tsx`** — 检查是否被 NavigationStack 包裹
3. **搜索 `AVPlayer` / `AVPlayerView`** — 有则标记"需补播放器功能"
4. **搜索 `widget.tsx`** — 检查 Widget 模板
5. **搜索 `intent.tsx`** — 检查 Intent 模板
6. **搜索 `app_intents.tsx`** — 检查交互意图
7. **搜索 `live_activity.tsx`** — 检查 Live Activity
8. **搜索旧文字** — "setup_token"、"Token 来自浏览器"、"手动填写 Token"
9. **检查 import** — 全局 API 不得从 scripting import
10. **检查主页框架** — 是否用 `Navigation.present` 或 `Navigation.present({ element: ... })`

# 第二步：类型1 — home_screen_default_ui.tsx 适配

## 必须检查

默认导出的最外层组件**必须**被 `<NavigationStack>` 包裹：

```tsx
// ❌ 错误（App 不再自动包裹）
export default function HomeScreenView() {
  return (
    <ScrollView>...</ScrollView>
  )
}

// ❌ 错误（ZStack 也不是 NavigationStack）
export default function HomeScreenDefaultUi() {
  return (
    <ZStack>...</ZStack>
  )
}

// ✅ 正确
export default function HomeScreenView() {
  return (
    <NavigationStack>
      <ScrollView>...</ScrollView>
    </NavigationStack>
  )
}
```

## 特别处理

- 如果已有 NavigationStack，但它是 App 旧版本自动加的 `HomeScreenView` 父级组件，检查是否在 `<TabView>` / `<VStack>` 外部
- 确保没有重复嵌套 2 层 NavigationStack
- 注意直接使用 `<ZStack>` / `<VStack>` / `<ScrollView>` 作为根组件的情况

# 第三步：类型2 — index.tsx TabView → 顶部 HStack 按钮

## 扫描现有代码

找出所有底部 TabView：
- 搜索 `<TabView` 及其子 `<Tab` / `<TabItem`
- 记录 Tab 数量和每个 Tab 的内容（name, icon, 页面组件）
- 检查是否有两套代码（iOS 18 兼容 `Device.systemVersion >= 18`）
- 检查是否有自定义 `useTabs()` hook
- 检查 `selection` 是用 `useObservable` 还是 `useState`

## 全部 TabView 变体模式（覆盖所有已知脚本）

### 模式A: 标准 `<Tab>` 组件（ComicReader, TMP.link, Scripting Music）
```tsx
<TabView selection={selection}>
  <Tab title="首页" systemImage="house.fill" value={0}>
    <NavigationStack><HomeView /></NavigationStack>
  </Tab>
</TabView>
```

### 模式B: `Tab as TabItem` 别名（IPA-Tool）
```tsx
import { TabView, Tab as TabItem } from "scripting";
<TabView selection={selection} tabBarMinimizeBehavior="automatic">
  <TabItem title="" systemImage="magnifyingglass" value={Tab.Search} role="search" badge={count}>
    <SearchView />
  </TabItem>
</TabView>
```

### 模式C: 旧版 `tabItem={<Label />}`（糖心2旧iOS、Video Downloader2）
```tsx
<TabView tint="systemPink">
  <NavigationStack tabItem={<Label title="首页" systemImage="house.fill" />}>
    <HomeView />
  </NavigationStack>
</TabView>
```

### 模式D: 两套 iOS 版本分支代码（糖心2）
```tsx
const isNew = parseFloat(Device.systemVersion) >= 18;
if (isNew) {
  return <TabView tint="systemPink"><Tab title="首页" ...>...</Tab></TabView>
}
return <TabView tint="systemPink"><NavigationStack tabItem={<Label .../>}>...</NavigationStack></TabView>
```

## TabView 属性提取检查清单

转换前，逐项检查以下 TabView 属性：

| 属性 | 位置 | 转换处理 |
|------|------|---------|
| `selection={selection}` | `<TabView>` | 确认是 `useObservable` 还是 `useState`；`useObservable`→`useState` |
| `tint="systemPink"` | `<TabView>` | 记录颜色，用于顶部按钮选中态（默认 systemBlue，有 tint 则用 tint 色） |
| `tabBarMinimizeBehavior` | `<TabView>` | **必须删除**，顶部 HStack 不需要 |
| `tabViewStyle` | `<TabView>` | **必须删除** |
| `tabViewBottomAccessory` | `<TabView>` | 提取内容，改为条件渲染放在内容页下方 |
| `sheet={{ isPresented, content }}` | `<TabView>` | 提取为独立 `.sheet()` 调用 |
| `value={0}` 或 `value="home"` | `<Tab>` | 记录所有 value，改为字符串 name |
| `badge={count}` | `<Tab>` / `<TabItem>` | 在顶部按钮上显示角标：`{badge > 0 ? <Text font="caption2" foregroundStyle="red">{badge}</Text> : null}` |
| `role="search"` | `<Tab>` / `<TabItem>` | 无特殊处理，同普通按钮 |
| `title=""` (空字符串) | `<Tab>` / `<TabItem>` | 记录空标题，转换时用 `title=""` |
| `systemImage="..."` | `<Tab>` / `<TabItem>` | 照搬到 Button 的 systemImage |

## 改造方法

```tsx
// ❌ 旧（底部 TabView）— 任意变体模式
import { TabView, Tab, Label } from "scripting"
<TabView selection={tabIndex} tint="systemPink">
  <Tab title="首页" systemImage="house" value={0}>
    <NavigationStack><HomeView /></NavigationStack>
  </Tab>
  <Tab title="设置" systemImage="gear" value={1}>
    <NavigationStack><SettingsView /></NavigationStack>
  </Tab>
</TabView>

// ✅ 新（顶部 HStack + 条件渲染）
// import 移除: TabView, Tab, Label, TabItem（如果不再被其他地方使用）
// import 添加: useState, ScrollView, HStack, Divider, Button（如没import）
const tabs = [
  { name: "首页", icon: "house" },
  { name: "设置", icon: "gear" },
] as const
const [selectedTab, setSelectedTab] = useState<string>("首页")
const accentColor = "systemPink" // 从原 tint 属性继承

return (
  <NavigationStack>
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      {/* 顶部 Tab 按钮栏 */}
      <ScrollView axes="horizontal" showsIndicators={false}>
        <HStack padding={{ leading: 12, trailing: 12, top: 6, bottom: 6 }}
                spacing={6}>
          {tabs.map(function(tab) {
            const active = selectedTab === tab.name
            return (
              <Button
                key={tab.name}
                title={tab.name}
                systemImage={tab.icon}
                action={function() { setSelectedTab(tab.name) }}
                background={active ? accentColor : "clear"}
                foregroundStyle={active ? "white" : "label"}
                frame={{ maxWidth: "infinity" }}
                padding={{ leading: 14, trailing: 14, top: 8, bottom: 8 }}
                clipShape={{ type: "rect", cornerRadius: 8 }}
              />
            )
          })}
        </HStack>
      </ScrollView>
      <Divider />
      {/* 条件渲染内容页 */}
      {selectedTab === "首页" ? <HomeView /> : null}
      {selectedTab === "设置" ? <SettingsView /> : null}
    </VStack>
  </NavigationStack>
)
```

## 注意事项

1. **Tab 数量过多**（≥5 个）→ 用 `ScrollView axes="horizontal"` 包 HStack，防止溢出
2. **Tab 有图标** → 用 `systemImage` 参数配 Button
3. **iOS 18 兼容代码** → 如果同时有 iOS 18 和旧版两套 `<TabView>`，直接完全替换，删除 `Device.systemVersion` 分支
4. **`selection` 用 `useObservable`** → 改成 `useState`
5. **自定义 `useTabs()` hook** → 删除 hook 文件引用，改为 `useState` + 内联 tabs 数组
6. **子 Tab 原有的 `NavigationStack`** → 外层 NavigationStack 已经包裹了，子 NavigationStack 可以保留（不影响功能）
7. **移除未使用的 import** — `TabView`, `Tab`, `Label`, `TabItem`, `useObservable`（如果不再用）等
8. **`tabItem={<Label />}` 旧模式** → 用 title + systemImage 提取信息
9. **`tabViewBottomAccessory`** → 提取为独立的底部视图或 `.sheet()`
10. **`badge` 角标** → 保持在按钮上显示为红色角标文字

# 第四步：类型2 — 播放页功能补齐

如果 `index.tsx` 或其他文件中有 `AVPlayer` / `AVPlayerView`：

## 必须包含的功能

```tsx
// 功能清单（逐一检查，缺什么补什么）
const [liked, setLiked] = useState(false)       // 点赞状态
const [likeCount, setLikeCount] = useState(0)   // 点赞数
const [downloading, setDownloading] = useState(false)
const [downloadProgress, setDownloadProgress] = useState(0)
const [downloadBytes, setDownloadBytes] = useState("")
const [sources, setSources] = useState<FileSource[]>([])  // 画质源
const [selectedQuality, setSelectedQuality] = useState("")

// toolbar 按钮
<Button
  action={toggleLike}
  title={liked ? "赞✓" : "赞"}
  foregroundStyle={liked ? "red" : "secondaryLabel"}
/>
<Button
  action={handleDownload}
  disabled={downloading}
  title={downloading ? "下载中" : "下载"}
  systemImage={downloading ? "arrow.down.circle.dotted" : "arrow.down.circle"}
/>

// 全屏播放器
<AVPlayerView
  player={player}
  entersFullScreenWhenPlaybackBegins={true}
  videoGravity={"resizeAspect"}
/>

// 画质切换
sources.length > 1 ? sources.map(function(source) {
  return <Button
    key={source.name}
    action={function() { switchQuality(source) }}
    title={source.name}
    background={selectedQuality === source.name ? "systemBlue" : "systemGray5"}
  />
}) : null
```

## 需要添加的辅助函数

如果脚本没有这些函数，从 `index.tsx` 的同项目脚本复制（如果有的话），或按以下模板实现：

```tsx
async function refreshAccessToken(): Promise<string | null> { ... }
async function getWriteHeaders(): Promise<Record<string, string>> { ... }
function getAuthHeaders(): Record<string, string> { ... }
async function likeVideo(id: string): Promise<boolean> { ... }
async function unlikeVideo(id: string): Promise<boolean> { ... }
```

下载功能使用 `BackgroundURLSession.startDownload()` + `Photos.saveVideo()` 实现真实进度。
画质选择使用 `player.setSource()` + `player.play()` 切换源。
播放器生命周期需要 `player.dispose()` 清理。

# 第五步：通用导入/属性修复（所有类型都检查）

## 5.1 import 规则

| API | 来源 | 错误写法 | 正确写法 |
|-----|------|---------|---------|
| `Storage` | **全局**（无需 import） | `import { Storage } from "scripting"` | 不 import，直接使用 |
| `Photos` | **全局** | `import { Photos } from "scripting"` | 不 import |
| `FileManager` | **全局** | `import { FileManager } from "scripting"` | 不 import |
| `QuickLook` | **全局** | `import { QuickLook } from "scripting"` | 不 import |
| `download` | **全局** | — | 不 import |
| `IntentMemoryStorage` | **全局** | — | 不 import |
| `Keychain` | **全局** | — | 不 import |
| `fetch` | **必须 from "scripting"** | 直接使用 | `import { fetch } from "scripting"` |
| `Script` | **必须 from "scripting"** | 直接使用 | `import { Script } from "scripting"` |
| UI 组件 | **必须 from "scripting"** | — | `import { Text, Button, ... } from "scripting"` |
| `useEffect` | **必须 from "scripting"** | — | `import { useEffect } from "scripting"` |
| `useObservable` | **必须 from "scripting"** | — | `import { useObservable } from "scripting"` |
| `AVPlayer` | **全局** | — | 不 import，直接 `new AVPlayer()` |
| `Device` | **全局** | — | 不 import，直接 `Device.systemVersion` |

> 运行时错误 `undefined is not an object (evaluating 'scripting_1.Storage.set')` = 全局 API 被错误 import。

## 5.2 组件属性错误

### TextField / SecureField
| 错误写法 | 正确写法 |
|---------|---------|
| `placeholder="提示"` | `prompt="提示"` |
| `keyboardType="..."` | ❌ **不支持**，移除 |
| `autocapitalization="..."` | ❌ **不支持**，移除 |
| **缺少 `title` 或 `label`** | 必须提供，如 `title=""` 或 `label=""` |

### Button
| 错误写法 | 正确写法 |
|---------|---------|
| `<Button systemImage="gear" />` | `<Button systemImage="gear" title="" />` |
| `<Button systemImage="xmark" />` | `<Button systemImage="xmark" title="关闭" />` |

### Text
| 错误写法 | 正确写法 |
|---------|---------|
| `<Text alignment="center">` | 无 alignment 属性，改用 `VStack(alignment="center")` 或 `frame` 实现居中 |

### background
| 错误写法 | 正确写法 |
|---------|---------|
| `background="transparent"` | `background="clear"` |

### TabView（额外约束）
| 属性 | 状态 |
|------|------|
| `tint` | 仅旧版 TabView 需要；转换顶部后用作选中色 |
| `tabBarMinimizeBehavior` | 转换后必须删除 |
| `tabViewStyle` | 转换后必须删除 |
| `tabViewBottomAccessory` | 转换后提取为独立组件 |
| `sheet` on TabView | 转换后改为独立 `.sheet()` |

## 5.3 异步操作安全

所有 `fetch`、`await` 调用必须有 try-catch：

```tsx
// ❌ 错误
const r = await fetch(url)
const data = await r.json()

// ✅ 正确
try {
  const r = await fetch(url)
  if (r.ok) {
    const data = await r.json()
    ...
  }
} catch (e: any) {
  console.log("Error: " + e.message)
  // 设置 error state 给用户展示
}
```

## 5.4 脚本退出 — 多种模式

### 模式A: `Navigation.present()` + `.finally(Script.exit)`（推荐）
```tsx
async function run() {
  await Navigation.present({ element: <App /> })
}
run().finally(Script.exit)
// 或
run().catch(console.error).finally(Script.exit)
```

### 模式B: 直接 `Script.exit()` 在 async 末尾
```tsx
async function run() {
  await Navigation.present({ element: <App /> })
  Script.exit()
}
run()
```
⚠️ 这种模式没有 `.finally()`，如果 run() 内抛出异常不会退出。

### 模式C: `.then(() => Script.exit())`
```tsx
run().then(() => Script.exit())
```

### 模式D: `.finally(() => Script.exit())`
```tsx
run().finally(() => Script.exit());
```

### 模式E: Intent 中 IIFE
```tsx
(async function() {
  if (!fileURLs) { Script.exit(); return }
  // ...逻辑...
  await Navigation.present({ element: <ResultView ... /> })
})().catch(function(e) {
  console.error(e)
  console.present()
}).finally(Script.exit)
```

**统一原则**：所有入口必须有 `.finally(Script.exit)` 或等效保证。优先使用模式A。

# 第六步：类型3 — Widget 模板检查

## 标准 Widget 模板

```tsx
// 标准结构
async function loadData(): Promise<Data | null> {
  try {
    const result = await fetch(...)
    if (!result.ok) return null
    return await result.json() as Data
  } catch { return null }
}

function WidgetView({ data }: { data: Data | null }) {
  // 必须处理 data 为 null 的情况
  if (!data) return (
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} alignment="center">
      <Text foregroundStyle="secondaryLabel">暂无数据</Text>
    </VStack>
  )
  
  switch (Widget.family) {
    case "systemSmall": return <SmallView data={data} />
    case "systemMedium": return <MediumView data={data} />
    case "systemLarge": return <LargeView data={data} />
    default: return <MediumView data={data} />
  }
}

async function main() {
  const data = await loadData()
  Widget.present(<WidgetView data={data} />)
}
main()
```

## Widget 检查项

1. ✅ 每个尺寸都有对应的视图（或者单尺寸 widget）
2. ✅ 数据加载带 try-catch
3. ✅ 数据为 null 时有 fallback 视图
4. ✅ 没有使用 `useState`（Widget 内不支持）
5. ✅ `Widget.present()` 在 `main()` 末尾调用
6. ✅ 渐变背景用 `as any`（已知类型缺陷）
7. ✅ `lineLimit` + `minScaleFactor` 防止文字溢出

## Widget refresh 策略

```tsx
// 定时刷新
Widget.present(<View />, { policy: "after", date: new Date(Date.now() + 15 * 60 * 1000) })
// TimelineProvider 方式（推荐用于经常变化的数据）
```

## 单尺寸 Widget 处理

有些 Widget 只提供一个尺寸（如 `Docker Compose Manager`）：
```tsx
async function main() {
  try {
    const output = await loadData()
    Widget.present(<SystemSmallView data={output} />)
  } catch(e) {
    Widget.present(<Text>{String(e)}</Text>)
  }
}
```
检查时：单尺寸也要有错误 fallback。

# 第七步：类型4 — Intent 模板检查

## 标准 Intent 模板

```tsx
import { Intent, Navigation, Script } from "scripting"

async function run() {
  const fileURLs = Intent.fileURLsParameter
  if (!fileURLs || fileURLs.length === 0) {
    Script.exit()
    return
  }
  // ...逻辑...
  await Navigation.present({ element: <ResultView ... /> })
}
run().catch(function(e) {
  console.error(e)
  console.present()
}).finally(Script.exit)
```

## Intent 检查项

1. ✅ IIFE 包裹异步执行体
2. ✅ 读取 `Intent.fileURLsParameter` 或 `Intent.textParameter`
3. ✅ 无参数时调用 `Script.exit()` 正常退出
4. ✅ `.finally(Script.exit)` 确保退出
5. ✅ `.catch()` 中有错误处理（console.present 或 dialog）
6. ✅ 未使用的 import（如 `Path`）已移除

# 第八步：类型5 — app_intents.tsx 交互意图检查

```tsx
import { Widget, Script, Intent } from "scripting"

// 提供 toggle/button action 给交互小组件
async function toggleAction() { ... }

// 检查项
// 1. ✅ 从 "scripting" import Widget, Script
// 2. ✅ 导出的 async 函数有错误处理
// 3. ✅ 无参数时 Script.exit()
// 4. ✅ 类型声明正确
```

# 第九步：类型6 — Live Activity 适配 ⚠️

## ⚠️ 重要：正确的 Live Activity API

```tsx
// ❌ 错误（早期文档写法，不存在 ActivityKit）
import { ActivityKit } from "scripting"
const activity = await ActivityKit.start(...)

// ✅ 正确（实际 API）
import {
  LiveActivity,
  LiveActivityUI,
  LiveActivityUIBuilder,
  LiveActivityUIExpandedCenter,
  LiveActivityUIExpandedLeading,
  LiveActivityUIExpandedTrailing,
  LiveActivityUIExpandedBottom,
  HStack, VStack, Text, Image, Spacer, ProgressView, Gauge,
} from "scripting"

// 定义状态类型
export type ActivityState = {
  progress: number
  total: number
  status: "idle" | "active" | "done" | "error"
  currentLabel: string
}

// 构建 Live Activity UI builder
const builder: LiveActivityUIBuilder<ActivityState> = (state) => {
  return (
    <LiveActivityUI
      content={<LockScreenView {...state} />}              // 锁屏展开视图
      compactLeading={<CompactLeadingView {...state} />}    // 灵动岛紧凑左
      compactTrailing={<CompactTrailingView {...state} />}  // 灵动岛紧凑右
      minimal={<MinimalView {...state} />}                  // 灵动岛最小化
    >
      <LiveActivityUIExpandedCenter>
        <ExpandedCenterView {...state} />
      </LiveActivityUIExpandedCenter>
      <LiveActivityUIExpandedLeading>
        <ExpandedLeadingView {...state} />
      </LiveActivityUIExpandedLeading>
      <LiveActivityUIExpandedTrailing>
        <ExpandedTrailingView {...state} />
      </LiveActivityUIExpandedTrailing>
      <LiveActivityUIExpandedBottom>
        <ExpandedBottomView {...state} />
      </LiveActivityUIExpandedBottom>
    </LiveActivityUI>
  )
}

// 注册 Live Activity
export const MyLiveActivity = LiveActivity.register("MyActivity", builder)

// 启动（在其他文件中）
// const activity = await MyLiveActivity.start({ progress: 0, total: 20, status: "active", ... })
// 更新
// await activity.update({ progress: 10 })
// 结束
// await activity.end()
```

## Live Activity 检查项

1. ✅ 使用正确的 `LiveActivityUI` + `LiveActivityUIBuilder` 模式
2. ✅ 提供了 `content`（锁屏）、`compactLeading`、`compactTrailing`、`minimal` 四个必需区域
3. ✅ 可选区域 `LiveActivityUIExpandedCenter/Leading/Trailing/Bottom` 齐备
4. ✅ 类型定义（状态接口）清晰
5. ✅ 通过 `LiveActivity.register("Name", builder)` 注册
6. ✅ 导出了注册后的 activity 对象（供其他文件 start/update/end）
7. ✅ 有合理的状态类型（progress, total, status）

# 第十步：收尾验证

## 自动检查清单

- [ ] `home_screen_default_ui.tsx` 被 NavigationStack 包裹（如果有）
- [ ] 所有底部 TabView 已改为顶部 HStack（包括别名 TabItem、useTabs hook、两套代码等变体）
- [ ] TabView 的 tint/tabBarMinimizeBehavior/tabViewStyle/bottomAccessory/sheet 等属性已正确处理
- [ ] Tab badge 角标已迁移到顶部按钮
- [ ] 播放器有完整的点赞/下载/画质切换
- [ ] 所有 import 正确（全局API不从scripting import）
- [ ] TextField/SecureField 没有 placeholder/keyboardType/autocapitalization
- [ ] background 没有用 "transparent"
- [ ] Text 没有 alignment 属性
- [ ] Button 有 title（即使配了 systemImage）
- [ ] 所有 fetch/async 有 try-catch
- [ ] 所有入口有 .finally(Script.exit)（或等效保障）
- [ ] Widget 有 null 数据 fallback + try-catch + 多尺寸
- [ ] Intent 有无参数时正常退出
- [ ] **Live Activity 使用了正确的 LiveActivity.register() API（不是 ActivityKit）**
- [ ] 过时文字已更新（setup_token, Token 来自浏览器）
- [ ] 未使用的 import 已移除
- [ ] TypeScript 诊断零错误

最后运行：
```
get_typescript_diagnostics(script_name="<脚本名>")
```
确认零错误后完成。

# 一句话触发

只需说：
> **"万能适配这个脚本"**

或指定脚本名称：
> **"万能适配 ComicReader"**
