# 🎬 JavDB 番号查询工具

一键查询番号详细信息，自动翻译标签为简体中文。

## ✨ 功能

- 🔍 输入番号，秒查详情
- 🌐 标签自动翻译（日文/繁体/英文 → 简体中文）
- ⭐ 评分自动转星级显示
- 🖼️ 显示封面图链接
- 🚀 翻译表托管在 GitHub，自动拉取更新

## 📦 文件说明

| 文件 | 说明 |
|------|------|
| `av.mjs` | 主程序脚本 |
| `tags.json` | 标签翻译映射表（933+ 条） |

## 🚀 使用方法

### 环境要求

- [Node.js](https://nodejs.org/) (v16+)
- `curl` 命令行工具

### 快速开始

```bash
# 下载脚本
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/av.mjs

# 下载翻译表
wget https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/tags.json

# 查询番号
node av.mjs /av SONE-763
```

### 设置别名（方便使用）

```bash
echo "alias av='node /path/to/av.mjs'" >> ~/.bashrc && source ~/.bashrc
```

之后只需：

```bash
av /av SONE-763
```

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

## 🔄 翻译更新机制

脚本启动时自动从仓库拉取最新 `tags.json`，无需手动更新：

1. 优先从 GitHub 远程拉取
2. 远程失败则使用本地缓存
3. 拉取成功自动覆盖本地缓存

你只需更新仓库里的 `tags.json`，所有用户的脚本都会自动同步。

## 🏷️ 标签覆盖范围

- **日文 → 简体中文**：覆盖职业、体型、服装、情境、动作、玩法等
- **繁体中文 → 简体中文**：同上
- **英文 → 简体中文**：覆盖画质、题材、角色、行为、服装、情境等

共 **933+** 条翻译映射，持续更新中。

## 📝 注意事项

- 查询需要能访问 javdb.com
- 如遇到未翻译的标签，欢迎提交 PR 更新 `tags.json`
- 查询频率过快可能触发网站风控，建议间隔使用

## 📄 许可证

MIT
