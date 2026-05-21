# xbookcn 电子书下载器

## 功能
从 [blog.xbookcn.net](https://blog.xbookcn.net) 和 [book.xbookcn.net](https://book.xbookcn.net) 下载成人情色小说。

## 使用方法
1. 运行脚本
2. 选择下载来源（短篇情色小说 / 长篇情色小说）
3. 浏览分类或直接查看小说列表
4. 选择要下载的小说/章节
5. 下载完成后导出到「文件」App

## 技术方案
- 使用 `fetch()` 获取 HTML 页面
- 使用正则解析 HTML 提取文章内容
- 保存为 UTF-8 文本文件
- 使用 `DocumentPicker.exportFiles()` 导出文件
