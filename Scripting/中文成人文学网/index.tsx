/**
 * crxs-downloader - crxs.me 成人小说下载器
 *
 * 功能：
 * 1. 下载单篇短篇小说（输入小说详情页 URL，自动提取所有章节）
 * 2. 下载整部长篇小说（输入小说详情页 URL，自动抓取所有章节合并）
 * 3. 搜索下载（按书名或作者名搜索）
 *
 * 原理：直接使用 fetch() 获取页面 HTML，通过正则提取内容。
 * 该网站无需 Cloudflare 验证，可直接访问。
 *
 * 使用方式：
 * 1. 在 Scripting 中运行此脚本
 * 2. 选择下载方式
 * 3. 输入小说详情页 URL 或搜索关键词
 * 4. 等待下载完成
 * 5. 文件保存在「文件」App → crxs-downloads 文件夹
 */

import {
  Script,
  Navigation,
  NavigationStack,
  List,
  Button,
  Text,
  Section,
  ProgressView,
  VStack,
  useState,
  fetch,
} from "scripting"

// 声明全局函数类型
declare function alert(message?: string): void

declare function prompt(options: {
  title: string
  message?: string
  placeholder?: string
  defaultValue?: string
  cancelLabel?: string
  confirmLabel?: string
  obscureText?: boolean
  keyboardType?: string
}): Promise<string | null>

// ============================================================
// 配置
// ============================================================

const BASE_URL = "https://www.crxs.me"
const DOWNLOAD_DIR = FileManager.documentsDirectory + "/crxs-downloads"

// ============================================================
// 工具函数
// ============================================================

/** 确保下载目录存在 */
async function ensureDownloadDir() {
  if (!(await FileManager.exists(DOWNLOAD_DIR))) {
    await FileManager.createDirectory(DOWNLOAD_DIR, true)
  }
}

/** 安全的文件名（替换非法字符） */
function safeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .substring(0, 200)
}

/** 获取页面 HTML 文本 */
async function fetchHTML(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }
  return await response.text()
}

// ============================================================
// 内容提取
// ============================================================

interface ChapterLink {
  title: string
  url: string
}

interface FictionInfo {
  title: string
  author: string
  tags: string[]
}

interface ChapterContent {
  title: string
  content: string
}

/**
 * 从小说详情页提取信息
 * 页面结构：
 * - 标题：<title>书名 - 成人小说网</title>
 * - 作者：<a href="/fictions/keyword-作者.html">
 * - 标签：<a href="/fictions/tag-{id}.html">
 */
async function extractFictionInfo(url: string): Promise<FictionInfo> {
  const html = await fetchHTML(url)

  const info: FictionInfo = {
    title: "",
    author: "",
    tags: [],
  }

  // 提取标题
  const titleMatch = html.match(/<title>([^<]+?)\s*-\s*成人小说网<\/title>/)
  if (titleMatch) {
    info.title = titleMatch[1].trim()
  }

  // 提取作者
  const authorMatch = html.match(
    /<a[^>]*href=["']\/fictions\/keyword-([^"']+)\.html["'][^>]*>([^<]+)<\/a>/
  )
  if (authorMatch) {
    info.author = authorMatch[2].trim()
  }

  // 提取标签（排除通用标签）
  const tagRegex =
    /<a[^>]*href=["']\/fictions\/tag-\d+\.html["'][^>]*>([^<]+)<\/a>/g
  let tagMatch
  const excludeTags = ["编辑推荐", "长篇连载", "中篇连载", "短篇"]
  while ((tagMatch = tagRegex.exec(html)) !== null) {
    const tag = tagMatch[1].trim()
    if (!excludeTags.includes(tag) && !tag.match(/\(\d+\)/)) {
      info.tags.push(tag)
    }
  }

  return info
}

/**
 * 从小说详情页提取所有章节链接
 */
async function extractChapterLinks(url: string): Promise<ChapterLink[]> {
  const html = await fetchHTML(url)

  const chapters: ChapterLink[] = []
  const seen = new Set<string>()

  // 匹配所有 /fiction/id- 开头的链接
  const linkRegex =
    /<a[^>]*href=["'](\/fiction\/id-[^"']+\.html)["'][^>]*>([^<]+)<\/a>/g
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    const text = match[2].trim()

    // 排除导航链接
    if (
      text === "开始阅读" ||
      text === "导览" ||
      text === "上一章" ||
      text === "下一章" ||
      text === "首页" ||
      text.length === 0
    ) {
      continue
    }

    // 排除 fiction detail 自身的 ID（短 ID），只保留章节的 base64 ID（长 ID）
    const idPart = href.replace("/fiction/id-", "").replace(".html", "")
    if (idPart.length < 20) continue

    const fullUrl = href.startsWith("http") ? href : BASE_URL + href

    if (!seen.has(fullUrl)) {
      seen.add(fullUrl)
      chapters.push({ title: text, url: fullUrl })
    }
  }

  return chapters
}

/**
 * 从章节页面提取标题和正文
 * 内容在 div.fiction-body > p 元素中
 */
async function extractChapterContent(url: string): Promise<ChapterContent> {
  const html = await fetchHTML(url)

  const result: ChapterContent = {
    title: "",
    content: "",
  }

  // 提取章节标题
  const titleMatch = html.match(
    /<title>([^<]+?)\s*-\s*[^-]+?\s*-\s*成人小说网<\/title>/
  )
  if (titleMatch) {
    result.title = titleMatch[1].trim()
  }

  // 提取正文：div.fiction-body 内的所有 p 标签
  const bodyMatch = html.match(
    /<div[^>]*class=["'][^"']*fiction-body[^"']*["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div|$)/
  )

  if (bodyMatch) {
    const bodyHtml = bodyMatch[1]
    const paragraphs: string[] = []

    // 提取所有 <p> 标签内容
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/g
    let pMatch

    while ((pMatch = pRegex.exec(bodyHtml)) !== null) {
      const text = cleanHtml(pMatch[1])
      if (text) {
        paragraphs.push(text)
      }
    }

    // 如果没找到 p 标签，取整个 body 文本
    if (paragraphs.length === 0) {
      const text = cleanHtml(bodyHtml)
      if (text) paragraphs.push(text)
    }

    result.content = paragraphs.join("\n\n")
  }

  return result
}

/** 去除 HTML 标签，转换实体 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim()
}

// ============================================================
// 下载逻辑
// ============================================================

/** 下载整部小说（通用函数） */
async function downloadFiction(
  fictionUrl: string,
  onProgress: (current: number, total: number, status: string) => void
): Promise<string> {
  onProgress(0, 0, "正在获取小说信息...")

  const [info, chapters] = await Promise.all([
    extractFictionInfo(fictionUrl),
    extractChapterLinks(fictionUrl),
  ])

  if (chapters.length === 0) {
    throw new Error("未找到任何章节，请确认 URL 是否正确")
  }

  const bookName =
    info.title ||
    chapters[0].title.replace(/第[一二三四五六七八九十\d]+章\s*/, "").trim() ||
    "未命名小说"

  const fileName = safeFileName(bookName) + ".txt"
  const filePath = DOWNLOAD_DIR + "/" + fileName

  // 构建文件头
  let fullText = `《${bookName}》\n`
  if (info.author) fullText += `作者：${info.author}\n`
  if (info.tags && info.tags.length > 0) {
    fullText += `标签：${info.tags.join("、")}\n`
  }
  fullText += `共 ${chapters.length} 章\n`
  fullText += `来源：${fictionUrl}\n`
  fullText += `下载日期：${new Date().toLocaleDateString("zh-CN")}\n`
  fullText += "=".repeat(60) + "\n\n"

  // 逐章下载
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i]
    onProgress(i + 1, chapters.length, `[${i + 1}/${chapters.length}] ${ch.title}`)

    try {
      const page = await extractChapterContent(ch.url)
      fullText += `## ${page.title || ch.title}\n\n`
      fullText += page.content + "\n\n"
      fullText += "---\n\n"
    } catch (e: any) {
      fullText += `## ${ch.title}\n\n[下载失败: ${e.message || e}]\n\n---\n\n`
    }
  }

  await FileManager.writeAsString(filePath, fullText)

  // 返回结果摘要
  let summary = `✅ 下载完成！\n\n`
  summary += `书名：《${bookName}》\n`
  summary += `作者：${info.author || "未知"}\n`
  summary += `章数：${chapters.length}\n`
  summary += `文件：${fileName}\n`
  summary += `位置：crxs-downloads/\n`
  summary += `总字数：${fullText.length} 字`

  return summary
}

// ============================================================
// 主界面
// ============================================================

function MainView() {
  const dismiss = Navigation.useDismiss()
  const [status, setStatus] = useState("就绪")
  const [isDownloading, setIsDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)
  const [result, setResult] = useState("")

  async function downloadSingle() {
    dismiss()

    const url = await prompt({
      title: "下载小说",
      message: "请输入小说详情页的完整 URL\n（短篇和中长篇都支持）",
      placeholder: "https://www.crxs.me/fiction/id-...",
    })
    if (!url) return

    await runDownload(async () => {
      return await downloadFiction(url, (current, total, msg) => {
        setProgress(current)
        setTotalSteps(total)
        setStatus(msg)
      })
    })
  }

  async function downloadBySearch() {
    dismiss()

    const keyword = await prompt({
      title: "搜索下载",
      message: "输入关键词搜索小说（作者名或作品名）",
      placeholder: "例如：少年阿宾",
    })
    if (!keyword) return

    await runDownload(async () => {
      setStatus("正在搜索...")
      setProgress(1)
      setTotalSteps(3)

      const searchUrl =
        BASE_URL +
        "/fictions/keyword-" +
        encodeURIComponent(keyword) +
        ".html"
      const html = await fetchHTML(searchUrl)

      // 从搜索结果提取小说链接
      const fictionRegex =
        /<a[^>]*href=["'](\/fiction\/id-[a-f0-9]+\.html)["'][^>]*>《([^<]+)》<\/a>/g
      let match
      const results: { title: string; url: string }[] = []

      while ((match = fictionRegex.exec(html)) !== null) {
        const href = match[1]
        const title = match[2].trim()
        const fullUrl = href.startsWith("http") ? href : BASE_URL + href
        // 去重
        if (!results.some((r) => r.url === fullUrl)) {
          results.push({ title, url: fullUrl })
        }
      }

      if (results.length === 0) {
        throw new Error(`未找到与"${keyword}"相关的小说`)
      }

      setStatus(`找到 ${results.length} 部小说`)

      // 显示搜索结果
      let resultText = `找到 ${results.length} 部小说：\n`
      for (let i = 0; i < Math.min(results.length, 20); i++) {
        resultText += `\n${i + 1}. 《${results[i].title}》`
      }
      if (results.length > 20) {
        resultText += `\n\n...及另外 ${results.length - 20} 部`
      }

      alert(resultText)

      // 用户选择
      const choice = await prompt({
        title: "选择小说",
        message: `输入序号 (1-${Math.min(results.length, 20)})`,
        placeholder: "1",
        keyboardType: "number",
      })

      if (!choice) return

      const idx = parseInt(choice) - 1
      if (isNaN(idx) || idx < 0 || idx >= Math.min(results.length, 20)) {
        throw new Error("无效的选择")
      }

      setProgress(2)
      setStatus("已选择，正在下载...")

      return await downloadFiction(results[idx].url, (current, total, msg) => {
        setProgress(current)
        setTotalSteps(total)
        setStatus(msg)
      })
    })
  }

  async function runDownload(task: () => Promise<string>) {
    setIsDownloading(true)
    setProgress(0)
    setTotalSteps(0)
    setResult("")

    try {
      await ensureDownloadDir()
      const msg = await task()
      setResult(msg)
    } catch (e: any) {
      setResult(`❌ 错误：${e.message || e}`)
      setStatus("下载失败")
    } finally {
      setIsDownloading(false)
    }
  }

  // ===== 下载中视图 =====
  if (isDownloading) {
    return (
      <NavigationStack>
        <List
          navigationTitle="下载中..."
          navigationBarTitleDisplayMode="inline"
        >
          <Section>
            <VStack alignment="center" spacing={12}>
              <ProgressView
                value={totalSteps > 0 ? progress : undefined}
                total={totalSteps > 0 ? totalSteps : undefined}
              />
              <Text>{status}</Text>
              {totalSteps > 0 && (
                <Text>
                  进度：{progress}/{totalSteps}
                </Text>
              )}
            </VStack>
          </Section>
        </List>
      </NavigationStack>
    )
  }

  // ===== 结果视图 =====
  if (result) {
    return (
      <NavigationStack>
        <List
          navigationTitle="下载完成"
          navigationBarTitleDisplayMode="inline"
          toolbar={{
            cancellationAction: <Button title="关闭" action={dismiss} />,
          }}
        >
          <Section>
            <Text>{result}</Text>
          </Section>
          <Section
            footer={
              <Text>文件保存在「文件」App 的 crxs-downloads 文件夹中</Text>
            }
          >
            <Button
              title="继续下载"
              action={() => {
                setResult("")
                Navigation.present(<MainView />)
              }}
            />
          </Section>
        </List>
      </NavigationStack>
    )
  }

  // ===== 主界面 =====
  return (
    <NavigationStack>
      <List
        navigationTitle="CRXS 下载器"
        navigationBarTitleDisplayMode="large"
        toolbar={{
          cancellationAction: <Button title="关闭" action={dismiss} />,
        }}
      >
        <Section
          header={<Text>下载方式</Text>}
          footer={<Text>支持 www.crxs.me 上的短篇和中长篇小说</Text>}
        >
          <Button title="📖 输入 URL 下载" action={downloadSingle} />
          <Button title="🔍 搜索下载" action={downloadBySearch} />
        </Section>

        <Section header={<Text>使用说明</Text>}>
          <Text>1. 获取小说详情页的 URL（.../fiction/id-xxx.html）</Text>
          <Text>2. 选择「输入 URL 下载」，粘贴 URL</Text>
          <Text>3. 或选择「搜索下载」，输入书名/作者名</Text>
          <Text>4. 等待自动下载所有章节</Text>
          <Text>5. 完成后在「文件」App 中查看</Text>
        </Section>

        <Section header={<Text>关于网站</Text>}>
          <Text>• 无需特殊网络，直连即可访问</Text>
          <Text>• 支持短篇（单章）和中长篇（多章）</Text>
          <Text>• 自动合并所有章节为一个 .txt 文件</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}

// ============================================================
// 入口
// ============================================================

async function run() {
  await ensureDownloadDir()
  await Navigation.present(<MainView />)
  Script.exit()
}

run()
