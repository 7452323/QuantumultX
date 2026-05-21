# 🎬 JavDB 番号查询工具

改自其他大佬，原脚本具体谁写的我也不清楚。

一键查询番号详细信息，自动翻译标签为简体中文。

## ✨ 功能

- 🔍 输入番号，秒查详情
- 🌐 标签自动翻译（日文/繁体/英文 → 简体中文）
- ⭐ 评分自动转星级显示
- 🖼️ 显示封面图链接
- 🚀 翻译表托管在 GitHub，自动拉取更新

---

## 🚀 快速开始（命令行使用）

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
# 创建文件夹
mkdir -p ~/javdb && cd ~/javdb

# 下载脚本
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/av.mjs

# 下载翻译表
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

每次都要打 `cd ~/javdb && node av.mjs` 太长了，设置一个别名：

```bash
echo "alias av='node ~/javdb/av.mjs'" >> ~/.bashrc && source ~/.bashrc
```

之后只需：

```bash
av /av SONE-763
```

---

## 🤖 接入 Telegram Bot（傻瓜式教程）

按照下面的步骤一步步做，就能在 Telegram 里用 `/av 番号` 查了。

### 第1步：创建一个 Telegram Bot

1. 打开 Telegram，搜索 **[@BotFather](https://t.me/BotFather)**
2. 发送 `/newbot`
3. 按提示给你的 Bot 取个名字（比如 `番号查询机器人`）
4. 再取一个用户名（必须以 `bot` 结尾，比如 `myavbot`）
5. 创建成功后，**BotFather 会给你一个 Token**，像这样：

```
1234567890:ABCdefGHIJklmNOPqrstUVwxyz-1234567
```

**把这个 Token 复制下来，后面要用。**

---

### 第2步：登录服务器

先用 SSH 登录到你的服务器：

```bash
ssh 用户名@你的服务器IP
```

---

### 第3步：安装 Node.js（如果没装过）

```bash
sudo apt update && sudo apt install -y nodejs curl
```

---

### 第4步：创建项目文件夹并下载文件

```bash
mkdir -p ~/javdb && cd ~/javdb
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/av.mjs
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/tags.json
```

---

### 第5步：初始化 Node 项目

```bash
cd ~/javdb && npm init -y
```

---

### 第6步：安装 Telegraf（Bot 框架）

```bash
cd ~/javdb && npm install telegraf
```

---

### 第7步：创建 Bot 启动脚本

执行下面这条命令，一键创建 `bot.mjs`：

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

### 第8步：修改 Token

用下面命令打开 `bot.mjs`，把第14行的 Token 换成你自己的：

```bash
nano ~/javdb/bot.mjs
```

找到这一行：

```javascript
const BOT_TOKEN = "1234567890:ABCdefGHIJklmNOPqrstUVwxyz-1234567";
```

改成 BotFather 给你的 Token，然后按：
- `Ctrl + X` → `Y` → `回车` 保存退出

> 不会用 nano？也可以用 `vi` 或 `vim`，或者用 WinSCP 等工具直接编辑。

---

### 第9步：启动 Bot

```bash
cd ~/javdb && node bot.mjs
```

看到 `🤖 Bot 已启动` 就说明成功了！

**保持这个终端窗口不要关**，或者用 `screen` / `tmux` / `pm2` 让它后台运行。

---

### 第10步：后台运行（关掉终端也不停）

**方法一：使用 screen（推荐）**

```bash
# 安装 screen
sudo apt install -y screen

# 创建后台会话
screen -dmS javbot bash -c "cd ~/javdb && node bot.mjs"
```

以后要查看日志：

```bash
screen -r javbot
```

按 `Ctrl + A` 然后 `D` 可以退出查看但不停止。

**方法二：使用 pm2（更稳定）**

```bash
# 安装 pm2
sudo npm install -g pm2

# 启动
cd ~/javdb && pm2 start bot.mjs --name javbot

# 设置开机自启
pm2 save && pm2 startup
```

常用命令：

```bash
pm2 logs javbot    # 查看日志
pm2 restart javbot # 重启
pm2 stop javbot    # 停止
```

---

### 第11步：在 Telegram 中使用

打开 Telegram，找到你刚创建的 Bot，发送：

```
/av SONE-763
```

就会收到回复：

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

**搞定！🎉**

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

## 📄 许可证

MIT
