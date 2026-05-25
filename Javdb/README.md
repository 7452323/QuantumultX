---
name: javdb-search
description: "JAV 番号查询 — 搜索番号获取封面、演员、详情等信息"
metadata:
  {
    "openclaw": {
      "emoji": "🎬",
      "requires": { "bins": ["curl"], "npm": ["opencc-js"] },
      "install": []
    }
  }
---

# JAV 番号查询

通过番号查询 JAV 影片信息，返回封面、演员、评分等完整信息。支持繁简自动转换、标签翻译、演员名翻译。

## 触发方式

- `/av <番号>` — 例如 `/av SONE-763`、`/av IPX-001`

## 输出格式

```
🎬 SONE-763

标题: 普段は物静かな文系の美女におち●ぽ調教されちゃう 河北彩伽 ...
导演: 宝瀬博教
片商: S1 NO.1 STYLE
日期: 2025-06-24
片长: 160 分鍾
评分: ★★★★☆
评价: 1826人評價
演员: 河北彩花、フランクフルト林
标签: 各种职业、荡妇、单体作品、女上位、戏剧、淫语
封面: [查看封面](...)
播放: [打开页面](...)
```

## 翻译源

- **标签翻译**: 从 `tags.json` (GitHub) 拉取，opencc 繁转简兜底
- **演员名**: 从 `actress.json` (GitHub) 拉取，繁简字库映射兜底
- **标题/导演/片商**: opencc-js 繁转简

## 数据来源

- 搜索结果: https://javdb.com/search?q=<番号>
- 详情页: https://javdb.com/v/<ID>
- 封面: https://c0.jdbstatic.com/covers/<pre> / <ID>.jpg

## 依赖

- `curl` — HTML 获取
- `opencc-js` — 繁简中文转换
