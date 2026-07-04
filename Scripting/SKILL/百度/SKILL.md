---
name: 百度
description: 百度输入法皮肤制作 — 输入主题名、作者、颜色，一键生成 .bds 皮肤包
metadata:
  display_name: "百度输入法皮肤制作器"
  intent_patterns: "百度输入法,输入法皮肤,baiduime,bds,键盘皮肤,皮肤制作,输入法主题"
  required_tools: "file_tool,run_shell_command,scripting_reference"
---

# Purpose

用户想制作百度输入法皮肤时使用此技能。输入主题名、作者名称和主题颜色，一键生成完整的 .bds 格式皮肤包，可直接安装到百度输入法使用。

# Instructions

## 百度输入法皮肤制作器

### 核心功能

1. **输入主题信息** — 皮肤名称、作者名称
2. **选择主题色** — RGB 配色方案
3. **一键生成** — 自动生成完整的 Baidu IME Skin (.bds) 文件
4. **文件结构** — 包含 land（横屏）和 port（竖屏）两种布局模式

### 文件结构说明

百度输入法皮肤 .bds 本质是 ZIP 压缩包：

```
MySkin.bds
├── Info.txt          ← 皮肤元数据（名称/作者）
├── res.ini           ← 样式注册表（资源索引）
├── gen.ini           ← 全局配置
├── def_26.ini        ← 26键键盘布局
├── cand0.cnd         ← 候选词样式
├── key_1.ini ... key_24.ini  ← 26个字母按键
├── enter.ini         ← 回车键
├── symbol.ini        ← 符号键
└── res/
    ├── bg.png        ← 键盘背景图（800×250）
    ├── key_bg.png    ← 按键背景底图
    ├── space_bg.png  ← 空格键背景
    ├── enter.png     ← 回车键图
    └── a_n.png ... z_n.png  ← 26个字母按键图
```

### 调用方式

#### 方式一：纯文本生成（无需脚本）

当用户给定要使用的名称、作者、颜色时，直接通过 run_shell_command 运行 Python 脚本生成 .bds 文件。

#### 方式二：生成 Scripting 脚本（index.tsx）

创建 Scripting App 互动界面：

1. 创建 `scripts/index.tsx`
2. 包含：
   - ✅ 皮肤名称输入框
   - ✅ 作者名称输入框
   - ✅ 主题色选择器
   - ✅ 生成按钮 + 结果展示
   - ✅ 预览和分享按钮
3. 安装后可当独立应用使用

### 生成器核心参数

```python
create_skin(
    name,       # 皮肤名称
    author,     # 作者名称
    output,     # 输出文件路径
    style,      # 风格（默认 'default'）
    desc        # 描述
)
```

### 按键事件代码表

| 功能 | 代码 |
|------|------|
| 切换到符号 | F45 |
| 中英切换 | F48 |
| 符号面板 | F49 |
| 长按切换 | F50 |
| 居中显示文字 | CENTER="abc" |

### 图片素材规范

| 素材 | 格式 | 尺寸 | 说明 |
|------|------|------|------|
| bg.png | PNG 24bit | 800×250 | 键盘背景 |
| key_bg.png | PNG | 70×60 | 按键背景 |
| space_bg.png | PNG | 200×60 | 空格键背景 |
| enter.png | PNG | 80×60 | 回车键图 |
| a_n.png ~ z_n.png | PNG | 60×60 | 字母按键 |

### 安装与应用

1. 把 skin.bds 文件传输到手机
2. 百度输入法 → 超级皮肤 → 本地 → 选择文件
3. 皮肤立即生效

## 脚本示例

### 生成基础皮肤包
```python
python3 scripts/make_skin.py "Ocean" "Akino" ocean.bds
```

### 应用到手机
```bash
adb push skin.bds /sdcard/baidu/ime/skins/
shell am broadcast -a com.baidu.inputmethod.SKIN_CHANGED
```

### 反编译已有皮肤
```bash
unzip some_skin.bds -d skin_src/
cat skin_src/res.ini
```