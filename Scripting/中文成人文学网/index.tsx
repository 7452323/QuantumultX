import {
 Script, Navigation, NavigationStack, List, Button, Text,
 Form, Section, VStack, HStack, ProgressView,
 DisclosureGroup, TextField, Picker, Toggle,
 Label, Image, Menu, NavigationLink,
 Link, Markdown,
 useState, useEffect
} from "scripting"

// ─── Types ───────────────────────────────────────────────────────

interface StoryItem {
 title: string
 url: string
}

interface ChapterItem {
 title: string
 url: string
}

interface BookInfo {
 title: string
 url: string
 description?: string
}

// ─── Constants ───────────────────────────────────────────────────

const SHORT_STORY_BASE = "https://blog.xbookcn.net"
const LONG_NOVEL_BASE = "https://book.xbookcn.net"

const SHORT_CATEGORIES = [
 { label: "精选作品", url: `${SHORT_STORY_BASE}/search/label/精选作品` },
 { label: "现代情色", url: `${SHORT_STORY_BASE}/search/label/现代情色` },
 { label: "日本情色", url: `${SHORT_STORY_BASE}/search/label/日本情色` },
 { label: "西洋情色", url: `${SHORT_STORY_BASE}/search/label/西洋情色` },
 { label: "伴侣交换", url: `${SHORT_STORY_BASE}/search/label/伴侣交换` },
 { label: "武侠情色", url: `${SHORT_STORY_BASE}/search/label/武侠情色` },
 { label: "奇幻科幻", url: `${SHORT_STORY_BASE}/search/label/奇幻科幻` },
 { label: "家庭乱伦", url: `${SHORT_STORY_BASE}/search/label/家庭乱伦` },
 { label: "性爱调教", url: `${SHORT_STORY_BASE}/search/label/性爱调教` },
 { label: "粗野性交", url: `${SHORT_STORY_BASE}/search/label/粗野性交` },
 { label: "多人群交", url: `${SHORT_STORY_BASE}/search/label/多人群交` },
 { label: "教师学生", url: `${SHORT_STORY_BASE}/search/label/教师学生` },
 { label: "古典情色", url: `${SHORT_STORY_BASE}/search/label/古典情色` },
 { label: "历史情色", url: `${SHORT_STORY_BASE}/search/label/历史情色` },
 { label: "同性情色", url: `${SHORT_STORY_BASE}/search/label/同性情色` },
 { label: "都市生活", url: `${SHORT_STORY_BASE}/search/label/都市生活` },
 { label: "医生护士", url: `${SHORT_STORY_BASE}/search/label/医生护士` },
 { label: "另类其他", url: `${SHORT_STORY_BASE}/search/label/另类其他` },
]

// ─── Utility ────────────────────────────────────────────────────

const SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

// Shared persistent WebViews — one per domain, reused across all requests.
// This keeps cookies/session alive so Cloudflare only challenges the first request.
const webViewPool = new Map<string, WebViewController>()
const domainWarmedUp = new Set<string>()

function getDomain(url: string): string {
 const m = url.match(/https?:\/\/([^\/]+)/)
 return m ? m[1] : url
}

async function getWebView(domain: string): Promise<WebViewController> {
 let wv = webViewPool.get(domain)
 if (!wv) {
 wv = new WebViewController()
 await wv.setCustomUserAgent(SAFARI_UA)
 webViewPool.set(domain, wv)
 }
 return wv
}

async function warmupDomain(domain: string): Promise<void> {
 if (domainWarmedUp.has(domain)) return
 const wv = await getWebView(domain)
 await wv.loadURL(\"https://\" + domain + \"/?m=0\")
 await delay(3000)
 await wv.waitForLoad()
 const html = await wv.getHTML() ?? \"\"
 if (html.includes(\"cf-browser-verification\") || html.includes(\"_cf_chl_opt\") || html.includes(\"cf_challenge\")) {
 await delay(5000)
 await wv.waitForLoad()
 }
 domainWarmedUp.add(domain)
}

async function fetchHTML(url: string): Promise<string> {
 const domain = getDomain(url)
 await warmupDomain(domain)
 const wv = await getWebView(domain)
 const cleanUrl = url.includes(\"?\") ? url : url + \"?m=1\"
 await wv.loadURL(cleanUrl)
 await delay(2000)
 await wv.waitForLoad()
 const html = await wv.getHTML()
 if (!html || html.length < 200) throw new Error(\"\u9875\u9762\u52a0\u8f7d\u5931\u8d25\")
 if (html.includes(\"cf-browser-verification\") || html.includes(\"_cf_chl_opt\")) {
 await delay(5000)
 await wv.waitForLoad()
 const retryHtml = await wv.getHTML()
 if (!retryHtml || retryHtml.length < 200) throw new Error(\"\u9875\u9762\u52a0\u8f7d\u5931\u8d25\")
 if (retryHtml.includes(\"cf-browser-verification\") || retryHtml.includes(\"_cf_chl_opt\"))
 throw new Error(\"\u88ab Cloudflare \u62e6\u622a\")
 return retryHtml
 }
 return html
}

function disposeWebViews(): void {
 webViewPool.forEach(wv => wv.dispose())
 webViewPool.clear()
 domainWarmedUp.clear()
}

function delay(ms: number): Promise<void> {
 return new Promise(r => setTimeout(r, ms))
}