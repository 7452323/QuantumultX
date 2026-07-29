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
└── script.json                  → 能力声明
```

## 检查清单

1. **搜索 `TabView`** — 有则标记"需改顶部布局"
2. **搜索 `home_screen_default_ui.tsx`** — 有则标记"需加 NavigationStack"
3. **搜索 `AVPlayer` / `AVPlayerView`** — 有则标记"需补播放器功能"
4. **搜索 `widget.tsx`** — 检查 Widget 模板
5. **搜索 `intent.tsx`** — 检查 Intent 模板
6. **搜索旧文字** — "setup_token"、"Token 来自浏览器"、"手动填写 Token"
7. **检查 import** — 全局 API 不得从 scripting import
8. **检查 script.json** — capability 是否匹配入口文件

# 第二步：类型1 — home_screen_default_ui.tsx 适配

## 必须检查

默认导出的最外层组件必须被 `<NavigationStack>` 包裹：

```tsx
// ❌ 错误（App 不再自动包裹）
export default function HomeScreenView() {
  return (
    <ScrollView>...</ScrollView>
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

# 第三步：类型2 — index.tsx TabView → 顶部 HStack 按钮

## 扫描现有代码

找出所有底部 TabView：
- 搜索 `<TabView` 及其子 `<Tab`
- 记录 Tab 数量和每个 Tab 的内容（name, icon, 页面组件）
- 记录是否有 `iOS 18 兼容` 的两套代码

## 改造方法

```tsx
// ❌ 旧（底部 TabView）
import { TabView, Tab, Label } from "scripting"
<TabView selection={tabIndex} onTabIndexChanged={function(v){setTabIndex(v)}}>
  <Tab tabItem={<Label text="首页" systemImage="house" />}>
    <NavigationStack>
      <HomeView />
    </NavigationStack>
  </Tab>
  <Tab tabItem={<Label text="设置" systemImage="gear" />}>
    <NavigationStack>
      <SettingsView />
    </NavigationStack>
  </Tab>
</TabView>

// ✅ 新（顶部 HStack + 条件渲染）
// import 移除: TabView, Tab, Label（如果不再被其他地方使用）
const tabs = [
  { name: "首页", icon: "house" },
  { name: "设置", icon: "gear" },
] as const
const [selectedTab, setSelectedTab] = useState<string>("首页")

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
                background={active ? "systemBlue" : "clear"}
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
3. **iOS 18 兼容代码** → 如果同时有 iOS 18 和旧版两套 <TabView>，直接完全替换
4. **`selection` 用 `useObservable`** → 改成 `useState`
5. **`tabIndex` + `onTabIndexChanged`** → 改成 `selectedTab` + `setSelectedTab`
6. **子 Tab 原有的 `NavigationStack`** → 外层 NavigationStack 已经包裹了，子页面可以去掉内部的 NavigationStack 或被条件渲染保留两个 NavigationStack 层级（不影响功能）
7. **移除未使用的 import** — `TabView`, `Tab`, `Label` 如果不再用就删掉

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

## 5.4 脚本退出

所有入口必须确保 Script.exit() 被调用：

```tsx
// ✅ 正确（finally 确保退出）
async function run() {
  await Navigation.present({ element: <App /> })
}
run().finally(Script.exit)
// 或
run().catch(console.error).finally(Script.exit)
```

错误写法：
```tsx
// ❌ run() 后没有 .finally(Script.exit)
// ❌ intent.tsx 中 return 后没调 Script.exit()
```

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

1. ✅ 每个尺寸都有对应的视图
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
// 或使用 TimelineProvider（推荐）
```

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

# 第八步：类型5/6 — app_intents.tsx / Live Activity 适配

## app_intents.tsx 标准

```tsx
import { Widget, Script } from "scripting"

// 提供 toggle/button action 给交互小组件
async function toggleAction() { ... }
```

## Live Activity 标准

```tsx
import { ActivityKit } from "scripting"

// 启动 / 更新 / 结束 Live Activity
const activity = await ActivityKit.start(...)
```

## 检查项

1. ✅ 引用了正确的 Scripting API（ActivityKit, Widget, Intent）
2. ✅ 类型声明匹配
3. ✅ 错误处理完善
4. ✅ `.finally(Script.exit)` 确保退出

# 第九步：收尾验证

## 自动检查清单

- [ ] `home_screen_default_ui.tsx` 被 NavigationStack 包裹（如果有）
- [ ] 所有底部 TabView 已改为顶部 HStack
- [ ] 播放器有完整的点赞/下载/画质切换
- [ ] 所有 import 正确（全局API不从scripting import）
- [ ] TextField/SecureField 没有 placeholder/keyboardType/autocapitalization
- [ ] background 没有用 "transparent"
- [ ] Text 没有 alignment 属性
- [ ] Button 有 title（即使配了 systemImage）
- [ ] 所有 fetch/async 有 try-catch
- [ ] 所有入口有 .finally(Script.exit)
- [ ] Widget 有 null 数据 fallback + try-catch + 多尺寸
- [ ] Intent 有无参数时正常退出
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
