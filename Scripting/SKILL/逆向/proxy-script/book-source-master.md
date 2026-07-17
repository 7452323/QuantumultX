---
name: book-source-master
description: "Legado 阅读3.0 书源编写技能 — API接口型和HTML网页型两种写法，从字段对照到问题排查到调试技巧。覆盖搜索/详情/目录/正文/分页/Key轮换全流程。"
author: 7452323 (converted from OpenClaw)
version: 1.0.0
tags:
  - legado
  - book-source
  - web-scraping
  - novels
---

# 书源大湿 — Legado 阅读3.0 书源编写技能

有了这个技能，就能写出任何小说网站的书源。覆盖 API 接口型和 HTML 网页型两种写法。

## 书源是什么

书源是一个 JSON 文件，告诉「阅读3.0」App 怎么从一个网站提取小说数据。完整链路：

```
搜索 -> 书籍列表 -> 书籍详情 -> 目录 -> 正文
```

## 第一步：确定数据来源

### A. API 接口型（首选，最稳定）
网站通过 JSON API 返回数据。特征：F12 -> Network -> XHR/Fetch，能看到返回 JSON。
写法：用 `@js:JSON.parse(result)` 解析 JSON。

### B. HTML 网页型（通用）
网站返回 HTML 页面。特征：右键查看源代码有书籍列表。
写法：用 `@css:` 选择器。

## 第二步：字段对照表

### searchUrl
```
API型:  "https://api.example.com/search?q={{key}}&page=0"
HTML型: "https://site.com/search?q={{key}}"
```

`{{key}}` 是 App 自动替换为用户输入的关键词。注意是 `{{key}}` 不是 `{key}`。

### ruleSearch — 解析搜索结果

|字段|API 型写法|HTML 型写法|
|---|---|---|
|`bookList`|`data.books` 或 `@js:` 遍历|`@css:.book-item`|
|`name`|字段名（如 `title`）|`@css:.title@text`|
|`author`|字段名|可直接写死或 `@css:.author@text`|
|`bookUrl`|`@js:` 拼 URL|`@css:a@href`|
|`coverUrl`|字段名|`@css:img@src`|
|`intro`|字段名|可选|

**bookUrl 必须拼完整 URL** 搜索结果通常只有 ID，需要构造完整地址。

### ruleBookInfo — 书籍详情

```json
"ruleBookInfo": {
  "name": "@js:JSON.parse(result).data.book.title",
  "author": "@js:JSON.parse(result).data.book.author",
  "coverUrl": "@js:JSON.parse(result).data.book.cover",
  "intro": "@js:JSON.parse(result).data.book.intro",
  "tocUrl": "@js:'https://example.com/toc?id='+JSON.parse(result).data.book.id"
}
```

## 第三步：分页（翻页）写法

|方式|适用场景|示例|
|---|---|---|
|`{{page}}` URL 占位符|纯 URL 字符串|`?page={{page}}` → `?page=1`|
|`page` JS 变量|`<js>` 或 `@js:` 表达式中|`var p=page!=null?page:1`|

**关键陷阱：** `page` 首次搜索时为 `null`（不是 `undefined`），必须用 `page != null ? page : 1`。

## 常见问题排查

|症状|可能原因|解决方法|
|---|---|---|
|搜不到结果|`{{key}}` 拼错|检查是 `{{key}}` 不是 `{key}`|
|搜到但点进去空白|`bookUrl` 不完整|JS 里拼完整 https:// 地址|
|有详情没目录|`tocUrl` 不对|检查 ruleBookInfo 里的 tocUrl|
|有目录点不开|`cUrl` 没拼全|每条章节必须是完整 URL|
|发现页不显示|`enabledExplore` 没开|加 `"enabledExplore": true`|
|搜索只有第一页|没分页|加 `{{page}}` 或用 JS 算 offset|

## 调试技巧

```bash
curl "https://api.example.com/search?q=测试"
python3 -c "import json; json.load(open('书源.json')); print('合法')"
```

## 完整流程清单

- [ ] 确定数据来源（API 还是 HTML）
- [ ] curl 测试搜索/详情/目录/正文接口
- [ ] 写 `searchUrl` + 分页
- [ ] 写 `ruleSearch` + JS 拼 `bookUrl`
- [ ] 写 `ruleBookInfo` + JS 拼 `tocUrl`
- [ ] 写 `ruleToc` + JS 拼每条 `cUrl`
- [ ] 写 `ruleContent`
- [ ] 要分类发现就写 `exploreUrl`
- [ ] JSON 校验后导入阅读3.0测试
