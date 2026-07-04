---
name: 百度
description: 百度输入法皮肤制作 — 输入主题名、作者、颜色，一键生成 iOS (.bdi) / Android (.bds) 皮肤包
metadata:
  display_name: "百度输入法皮肤制作器"
  icon: "keyboard"
  color: "systemBlue"
  intent_patterns: "百度输入法,输入法皮肤,baiduime,bds,bdi,iOS皮肤,键盘皮肤,皮肤制作"
  platforms: ["iOS", "Android"]
---

# Purpose

制作百度输入法皮肤。原生支持 iOS (.bdi) 与 Android (.bds) 双平台，生成 ZIP 格式皮肤包，可直接通过 DocumentInteraction 分享到百度输入法应用。

# Instructions

## 百度输入法皮肤制作器

### 核心能力

1. **输入主题信息** — 皮肤名称、作者
2. **选择配色** — 8 套预设主题色
3. **平台选择** — 默认 iOS，可选 Android
4. **一键生成** — 输出完成 ZIP (.bdi/.bds) 到 Documents，并通过分享菜单发送到百度输入法

### 文件结构

百度皮肤本质是 **ZIP 压缩包**，iOS 后缀 `.bdi`，Android 后缀 `.bds`。

```
MySkin.bdi                    # iOS
├── Info.txt                  ← 皮肤元数据 (Name/Style/SupportPlatform/Author)
├── res/
│   ├── default.css           ← 614 个 STYLE 的配色/图片映射
│   ├── back.til              ← 九宫格切片配置
│   ├── back.png              ← 占位图（需替换为真实素材）
│   ├── graph.png             ← 图标集
│   ├── en.png                ← 26 字母+大小写
│   ├── plus.png              ← 数字/符号
│   ├── pluss.png             ← 小数字
│   ├── bh6.png               ← 笔画
│   ├── texts.png             ← 文字指示
│   └── add_sp.png            ← 双拼
├── land/                     ← 横屏布局
│   ├── gen.ini               ← 全局输入区/候选词/面板/更多
│   ├── def_26.ini            ← 26键默认键盘
│   ├── cand0.cnd             ← 候选词样式
│   ├── hint1.pop             ← 气泡提示
│   └── [16 套输入法布局].ini   ← en_26/num_9/symbol/py_26/bh …
└── port/                     ← 竖屏布局（同 land 结构）
    └── ...
```

### 核心 ini 格式

#### Info.txt

```
Name=我的皮肤
Style=Default
SupportPlatform=I        ← I=iOS, A=Android
Author=Akino
```

#### res/default.css（614 STYLE）

```ini
[GLOBAL]
STYLE_NUM=614
FOR=720

[STYLE101]背景
NM_COLOR=0f1729ff
[STYLE102]字体
NM_COLOR=e2e8f0ff
FONT_CLEARTYPE=1
FONT_SIZE=40
...
[STYLE211]=q
NM_IMG=en,1
HL_IMG=en,1
...
```

#### def_26.ini（26键键盘）

```ini
[INPUT]
BACK_STYLE=101
FORE_STYLE=102

[CAND]
VIEW_RECT=0,0,800,60
LAYOUT_NAME=cand1
TYPE=4

[PANEL]
BACK_STYLE=103
FORE_STYLE=102
SIZE=800,245

[MORE]
GRID=4,5
SYM_LAYOUT=symbol
CELL_STYLE=106
CELL_SIZE=50,50

[LIST]
BACK_STYLE=121
CELL_SIZE=57,60
POS=33,43
VIEW_RECT=0,0,800,118

[KEY60]
CELL_STYLE=133
PADDING=10,10,10,10

[KEY61]
STYLE=106
VIEW_RECT=10,452,96,70
HOLD=F50

[KEY65]
STYLE=106
VIEW_RECT=700,108,100,60
```

### 按键事件代码表

| 代码 | 功能 |
|------|------|
| F1 | 切换到符号 |
| F4 | 返回 |
| F45 | 中英切换 |
| F48 | 符号面板 |
| F49 | 换行 |
| F50 | 长按切换 |

### 图片素材规范

| 素材 | 格式 | 说明 |
|------|------|------|
| res/back.png | PNG 24bit | 键盘背景（含底色） |
| res/graph.png | PNG 透明 | STYLE161-183 图标 |
| res/en.png | PNG 透明 | 26 字母+大小写字图 |
| res/plus.png | PNG 透明 | 数字/符号图 |
| res/bh6.png | PNG 透明 | 笔画图 |
| res/texts.png | PNG 透明 | 文字指示图 |
| res/add_sp.png | PNG 透明 | 双拼图 |

占位图是 1×1 像素灰色 PNG。正式打包时需按命名规范替换为真实素材。

### 安装与应用

#### iOS

1. 生成的 .bdi 文件通过分享面板（DocumentInteraction）发送到百度输入法
2. 或在文件 app 中选中 .bdi → 共享 → "百度输入法"
3. 皮肤立即生效

#### Android

1. 把 .bds 文件传给手机
2. 百度输入法 → 超级皮肤 → 本地 → 选择文件
3. 或通过 adb:
```bash
adb push skin.bds /sdcard/baidu/ime/skins/
shell am broadcast -a com.baidu.input.skin.REFRESH
```

### 自定义素材替换

1. 生成的皮肤包中所有 res/*.png 都是 1×1 占位
2. 按命名规范准备真实 PNG 素材
3. 解压 .bdi/.bds → 替换 res/*.png → 重新 zip → 改后缀
4. 或直接替换后再次通过本工具生成

### 配色预设

| 名称 | 背景色 | 前景色 | 强调色 |
|------|--------|--------|--------|
| 深海蓝 | #0F1729 | #E2E8F0 | #F87171 |
| 星空紫 | #1E1143 | #EDE9FE | #A78BFA |
| 森林绿 | #0A2E1A | #DCFCE7 | #FBBF24 |
| 樱草粉 | #3B0E2A | #FCE7F3 | #FB7185 |
| 深岩灰 | #1A1A1A | #F5F5F5 | #F97116 |
| 碧海浪 | #0C2E3E | #CFEAFE | #06B6D4 |
| 暖沙金 | #2E2810 | #FEF9C3 | #F59E0B |
| 极光青 | #0A2E3E | #CCFBF1 | #14B8A6 |

## 参考项目

| 项目 | 说明 |
|------|------|
| Gearkey/baidu_input_skins ⭐17 | 最近活跃，有 BGtool |
| vancolate/baidu-input-skin-saved | 纯皮肤包 |
| bencn/BSkin | 制作工具 |
| ShenHongFei/baidu-ime-skin-moui-pure | 纯净皮 |
