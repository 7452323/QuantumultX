---
name: javdb-lookup
version: 1.0.0
description: Javdb 番号查询工具 — 搜索番号、获取标题/评分/演员/标签/封面等信息，支持 Telegram/微信发送结果。| JAV database lookup tool — search by code, get title/rating/actors/tags/cover, supports Telegram/WeChat delivery.
metadata:
  openclaw:
    emoji: "🔞"
---

# Javdb 番号查询

查询 JAV 番号详细信息，返回结构化数据并支持图片发送。

## 前置条件

- `Node.js` — 运行查询脚本
- `opencc` — 繁简转换（`pip install opencc-python-reimplemented`）
- `googletrans` — 日文翻译（`pip install googletrans==4.0.0-rc1`）
- `curl` — 网页请求

## 查询流程

### Step 1: 调用查询脚本

```bash
node scripts/javdb_lookup.js <番号>
```

**示例：**
```bash
node scripts/javdb_lookup.js SONE-001
```

**返回 JSON 格式：**
```json
{
  "code": "SONE-001",
  "title": "翻译后的标题",
  "score": "8.5分",
  "date": "2025-01-01",
  "duration": "120分钟",
  "actors": ["演员1", "演员2"],
  "tags": ["标签1", "标签2"],
  "cover_url": "https://c0.jdbstatic.com/covers/xx/xxx.jpg",
  "detail_url": "https://javdb.com/v/xxx",
  "success": true
}
```

### Step 2: 发送结果给用户

#### Telegram 发送（含封面图 + 文字）

使用 Telegram 消息工具发送：

```
action: send
target: {user_telegram_id}
text: 消息文本
media: {cover_url}
```

**消息格式：**
```
🎬 番号: {code}
📌 标题: {title}
⭐ 评分: {score}
🎭 演员: {actors}
🏷️ 标签: {tags}
📅 日期: {date}
⏱ 时长: {duration}
🔗 详情: {detail_url}
```

#### 微信发送

使用消息工具发送文字信息，封面图片通过 `--media` 参数单独发送。

### Step 3: 封面

封面 URL 格式：`https://c0.jdbstatic.com/covers/{vid前2字母}/{vid}.jpg`

## 注意事项

- 番号不区分大小写
- 标题自动日译中
- tags.json 为翻译对照文件请勿修改
- 查询不到结果时提示用户检查番号格式
