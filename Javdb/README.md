# 🎬 JavDB 番号查询工具

改自其他大佬，原脚本具体谁写的我也不清楚。

一键查询番号详细信息，自动翻译标签为简体中文。

**支持三种使用方式：**
1. 🖥️ **命令行** — 服务器上直接跑
2. 🤖 **Telegram Bot** — 发 `/av 番号` 秒查
3. 🦞 **OpenClaw Agent** — 跟 AI 说一声就查

---

## ✨ 功能

- 🔍 输入番号，秒查详情
- 🌐 标签自动翻译（日文/繁体/英文 → 简体中文）
- ⭐ 评分自动转星级显示
- 🖼️ 显示封面图链接
- 🚀 翻译表托管在 GitHub，自动拉取更新

---

## 🚀 方式一：命令行使用

### 第1步：安装 Node.js

**Ubuntu / Debian：**
```bash
sudo apt update && sudo apt install -y nodejs curl
```

**CentOS / Rocky / Alma：**
```bash
sudo yum install -y nodejs curl
```

**macOS：**
```bash
brew install node
```

**Windows：**
去 https://nodejs.org 下载安装包，一路下一步安装。

---

### 第2步：下载脚本和翻译表

```bash
mkdir -p ~/javdb && cd ~/javdb
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/av.mjs
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/tags.json
```

> 如果 `wget` 用不了，试试 `curl -O` 代替。

---

### 第3步：查询番号

```bash
cd ~/javdb && node av.mjs /av SONE-763
```

如果出现结果，说明成功了！

---

### 第4步（可选）：设置快捷命令

```bash
echo "alias av='node ~/javdb/av.mjs'" >> ~/.bashrc && source ~/.bashrc
```

之后只需：
```bash
av /av SONE-763
```

---

## 🤖 方式二：接入 Telegram Bot

按照下面的步骤一步步做，就能在 Telegram 里用 `/av 番号` 查了。

### 第1步：创建 Bot

1. 打开 Telegram，搜索 [@BotFather](https://t.me/BotFather)
2. 发送 `/newbot`
3. 取名字 → 取用户名（以 `bot` 结尾）
4. BotFather 给你一个 **Token**，像这样：
   ```
   1234567890:ABCdefGHIJklmNOPqrstUVwxyz-1234567
   ```

---

### 第2步：装环境和下载文件

```bash
# 装 Node.js
sudo apt update && sudo apt install -y nodejs curl

# 创建项目文件夹
mkdir -p ~/javdb && cd ~/javdb

# 下载文件
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/av.mjs
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/tags.json

# 初始化项目
npm init -y

# 安装 Bot 框架
npm install telegraf
```

---

### 第3步：创建 Bot 启动脚本

```bash
cat > ~/javdb/bot.mjs << 'BOTEOF'
import { Telegraf } from "telegraf";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ⚠️ 把下面这行的 Token 换成你自己的！
const BOT_TOKEN = "1234567890:ABCdefGHIJklmNOPqrstUVwxyz-1234567";

const bot = new Telegraf(BOT_TOKEN);

bot.command("av", async (ctx) => {
  const args = ctx.message.text.split(" ").slice(1).join(" ");
  if (!args) {
    return ctx.reply("用法: /av 番号\n例如: /av SONE-763");
  }
  await ctx.reply("🔍 查询中...");
  try {
    const { stdout } = await execFileAsync("node", [
      join(__dirname, "av.mjs"),
      `/av ${args}`,
    ]);
    await ctx.reply(stdout.trim());
  } catch {
    await ctx.reply("❌ 查询失败，请稍后重试");
  }
});

bot.launch();
console.log("🤖 Bot 已启动，快去 Telegram 发 /av 试试！");
BOTEOF
```

---

### 第4步：修改 Token

```bash
nano ~/javdb/bot.mjs
```

找到 `BOT_TOKEN` 那一行，换成你自己的 Token。
`Ctrl + X` → `Y` → `回车` 保存退出。

---

### 第5步：启动

```bash
cd ~/javdb && node bot.mjs
```

看到 `🤖 Bot 已启动` 就成功了！

---

### 第6步：后台运行（关掉终端也不停）

**方法一：screen**
```bash
sudo apt install -y screen
screen -dmS javbot bash -c "cd ~/javdb && node bot.mjs"
screen -r javbot  # 查看日志，Ctrl+A 然后 D 退出查看
```

**方法二：pm2（更稳定，支持开机自启）**
```bash
sudo npm install -g pm2
cd ~/javdb && pm2 start bot.mjs --name javbot
pm2 save && pm2 startup
pm2 logs javbot     # 查看日志
pm2 restart javbot  # 重启
pm2 stop javbot     # 停止
```

---

### 第7步：在 Telegram 中使用

打开你的 Bot，发送 `/av SONE-763`，就会收到查询结果！

---

## 🦞 方式三：OpenClaw Agent 使用

如果你是 OpenClaw 用户（龙虾），可以直接让 AI 助手帮你查番号。

### 安装方法一：从 ClawHub 安装（推荐）

```bash
openclaw skills install javdb-lookup
```

> 如果 ClawHub 上没有，可以用方法二。

### 安装方法二：手动克隆到技能目录

```bash
# 进入 OpenClaw 技能目录
cd ~/.openclaw/workspace/skills

# 克隆仓库或直接下载
git clone https://github.com/7452323/QuantumultX.git tmp_javdb
cp -r tmp_javdb/Javdb ./javdb-lookup
rm -rf tmp_javdb

# 或者直接下载 Javdb 文件夹
wget -O ~/.openclaw/workspace/skills/javdb-lookup/SKILL.md \
  https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/SKILL.md
```

### 安装方法三：QuantumultX 仓库已有，直接引用

如果你已经 clone 了 `7452323/QuantumultX` 仓库：
```bash
# 量子里的 Javdb 文件夹已经包含全部文件
ls ~/QuantumultX/Javdb/
# → av.mjs  README.md  scripts/  tags.json
```

### 使用方式

装好后，直接对 AI 说：

> 帮我查一下番号 SONE-763
> 
> 查番号 IPX-999
> 
> javdb 搜一下 ABW-334

AI 会自动运行脚本查询并返回结果，包括标题、评分、演员、标签、封面链接等。

### 依赖检查

首次使用前确保以下依赖已安装：

```bash
# Node.js（已有则跳过）
node --version

# Python 翻译库（用于日文→中文）
pip install googletrans==4.0.0-rc1
pip install opencc-python-reimplemented

# curl
curl --version
```

### 文件结构说明

```
Javdb/
├── README.md           ← 本文件（使用说明）
├── SKILL.md            ← OpenClaw 技能定义（Agent 读取用）
├── av.mjs              ← 主查询脚本（支持 CLI 和 Agent 调用）
├── tags.json           ← 翻译对照表（勿修改）
└── scripts/
    └── javdb_lookup.js ← Agent 专用查询脚本（JSON 格式输出，供程序解析）
```

- **av.mjs**：命令行和 Telegram Bot 使用，输出人类可读的文字
- **scripts/javdb_lookup.js**：OpenClaw Agent 使用，输出 JSON 供程序解析

---

## 📋 输出示例

```
🎬 SONE-763

标题: SONE-763
导演: 宝瀬博教
片商: S1 NO.1 STYLE
日期: 2025-06-24
评分: ★★★★☆
演员: 河北彩花、フランクフルト林
标签: 各种职业、荡妇、单体作品、女上位、戏剧、淫语
播放: https://javdb.com/v/a8yV0p
封面: https://c0.jdbstatic.com/covers/a8/a8yV0p.jpg
```

---

## 🔄 翻译更新机制

脚本启动时自动从仓库拉取最新 `tags.json`，无需手动更新：

1. 优先从 GitHub 远程拉取
2. 远程失败则使用本地缓存
3. 拉取成功自动覆盖本地缓存

你只需更新仓库里的 `tags.json`，所有用户的脚本都会自动同步。

---

## 🏷️ 标签覆盖范围

- **日文 → 简体中文**：覆盖职业、体型、服装、情境、动作、玩法等
- **繁体中文 → 简体中文**：同上
- **英文 → 简体中文**：覆盖画质、题材、角色、行为、服装、情境等

共 **933+** 条翻译映射，持续更新中。

---

## 📝 注意事项

- 查询需要能访问 javdb.com（可能需要科学上网）
- 如遇到未翻译的标签，欢迎提交 PR 更新 `tags.json`
- 查询频率过快可能触发网站风控，建议间隔使用

---

## 📄 许可

MIT
