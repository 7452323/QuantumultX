---
name: scripting-ui-updater
description: 全面适配 Scripting App 脚本的 UI 结构 — NavigationStack 自包、TabView 改顶部工具栏、播放页全功能补齐
metadata:
  display_name: "Scripting UI 更新适配"
  intent_patterns: "全面优化,适配UI,NavigationStack,底部Tab改顶部,播放页功能补齐,home_screen_default_ui"
---

# Purpose

当用户说"全面优化这个脚本的 UI 结构和功能"或类似意图时，用此技能适配脚本。适配范围包括：

1. `home_screen_default_ui.tsx` 自己包 NavigationStack（App 不再自动包裹）
2. 所有底部 TabView 改为顶部工具栏 HStack 按钮布局
3. 播放页补齐点赞、下载、画质切换、全屏播放器
4. 修复过时文字和异常处理，TypeScript 零错误

# Instructions

## 第一步：扫描脚本结构

使用 `file_tool read` 检查以下内容：

### 1.1 检查 `home_screen_default_ui.tsx`
- 在脚本目录下搜索：`file_tool search_files` 匹配 `home_screen_default_ui.tsx`
- 如果有，检查默认导出组件是否包了 `<NavigationStack>`。没有就加上。

### 1.2 检查 TabView
- 搜索 `TabView` 在 `index.tsx` 和子页面中
- 如果找到了，标记为"需要底部 Tab → 顶部按钮布局"
- 记录 Tab 数量和各 Tab 内容

### 1.3 检查播放页
- 搜索 `AVPlayer`、`AVPlayerView`、`player` 等关键词
- 判断是否有视频/音频播放功能

### 1.4 检查过时文字
- 搜索 "setup_token"、"Token 来自浏览器"、"手动填写 Token" 等旧提示

## 第二步：底部 TabView → 顶部工具栏改造

### 改造方法
```tsx
// ❌ 旧（底部 TabView）
<TabView selection={tabIndex}>
  <Tab tabItem={<Label text="首页" systemImage="house" />}>
    <HomeView />
  </Tab>
  <Tab tabItem={<Label text="设置" systemImage="gear" />}>
    <SettingsView />
  </Tab>
</TabView>

// ✅ 新（顶部 HStack + 条件渲染）
const tabs = ["首页", "设置"] as const
const [selectedTab, setSelectedTab] = useState<string>("首页")

// import 移除: TabView, Tab, Label 等不再需要的

return (
  <NavigationStack>
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      {/* 顶部 Tab 按钮 */}
      <HStack padding={{ leading: 12, trailing: 12, top: 4, bottom: 4 }}
              frame={{ maxWidth: "infinity" }}>
        {tabs.map(function(tab) {
          const active = selectedTab === tab
          return (
            <Button
              key={tab}
              title={tab}
              action={function() { setSelectedTab(tab) }}
              background={active ? "systemBlue" : "clear"}
              foregroundStyle={active ? "white" : "label"}
              frame={{ maxWidth: "infinity" }}
              padding={{ leading: 16, trailing: 16, top: 8, bottom: 8 }}
              clipShape={{ type: "rect", cornerRadius: 8 }}
            />
          )
        })}
      </HStack>

      <Divider />

      {/* 条件渲染内容页 */}
      {selectedTab === "首页" ? <HomeView /> :
       selectedTab === "设置" ? <SettingsView /> : null}
    </VStack>
  </NavigationStack>
)
```

### 关键规则
- 删除 `import` 中的 `TabView`、`Tab`、`Label` 等（如果这些组件不再被其他地方使用）
- 按钮选中态：`background="systemBlue"` + `foregroundStyle="white"`
- 按钮未选中态：`background="clear"` + `foregroundStyle="label"`
- 按钮用 `clipShape={{ type: "rect", cornerRadius: 8 }}` 圆角
- 顶部整排按钮 + `Divider` 分隔 + 下方条件渲染内容

## 第三步：播放页功能补齐

参照 `index.tsx` 中已有的 PlayerView 完整实现（如果存在），复制到当前脚本中：

### 必须包含的功能
1. **点赞/取消点赞** — toolbar 中显示心形 + 计数
2. **下载** — `BackgroundURLSession.startDownload` + `Photos.saveVideo` + 真实进度显示
3. **画质切换** — 多个 `FileSource` 排序，按钮切换
4. **全屏播放器** — `entersFullScreenWhenPlaybackBegins={true}` 或 `videoGravity={"resizeAspect"}`
5. **错误处理** — 加载失败显示错误消息 + 重试按钮
6. **播放器生命周期** — `dispose()` 清理

### 需要添加的辅助函数
- `getValidAccessToken()` / `refreshAccessToken()` / `loadAccessToken()` / `saveAccessToken()` — access_token 管理
- `getWriteHeaders()` / `getAuthHeaders()` — 带认证的请求头
- `likeVideo()` / `unlikeVideo()` — 点赞 API
- `VideoDetail` 类型扩展（含 `fileUrl`、`liked`、`body` 字段）

## 第四步：收尾验证

1. 修复过时的提示文字（如 setup_token.tsx 引用）
2. 给所有 fetch/async 操作加 try-catch
3. 运行 `get_typescript_diagnostics` 确认零错误（单文件 + 全项目）
4. 如果无 `script_name` 则按文件路径诊断

## 一句话触发

用户只需说：
> "全面优化这个脚本的 UI 结构和功能：
> 1. App 不再自动包 NavigationStack 了，`home_screen_default_ui.tsx` 如果有的话自己加
> 2. 所有底部 TabView 全部改成顶部工具栏按钮布局，顶部一整排都拿来做功能按钮区（排序、筛选、设置、切换等）
> 3. 如果有播放页，补齐点赞、下载（BackgroundURLSession）、画质切换、全屏播放器
> 4. 修复过时文字和未处理的异常，验证 TypeScript 零错误"
