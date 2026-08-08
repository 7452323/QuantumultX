// Sampler —— WebViewController 封装。
// 职责：页面加载、请求拦截记录、Hook 注入与采样回传、脚本枚举/源码提取、Cookie、证据导出。
import {
  INJECT_BASE,
  listScriptsJS,
  fetchScriptJS,
  evalUserJS,
} from "./inject"

export interface RequestRecord {
  id: number
  url: string
  method: string
  headers: Record<string, string>
  body: string
  navigationType: string
  ts: number
}

export interface HookSample {
  kind: string
  path: string
  args: string[]
  ret: string
  ts: number
}

export interface ScriptInfo {
  url: string
}

export interface FetchedScript {
  url: string
  status?: number
  length?: number
  content?: string
  error?: string
}

export interface Evidence {
  exportedAt: string
  currentURL: string
  requests: RequestRecord[]
  hookSamples: HookSample[]
  scripts: string[]
  hookedPaths: string[]
  cookies: { name: string; value: string; domain: string; path: string; isSecure: boolean; isHTTPOnly: boolean }[]
}

let nextId = 1

export class Sampler {
  readonly webView: WebViewController
  requests: RequestRecord[] = []
  hookSamples: HookSample[] = []
  scripts: string[] = []
  hookedPaths: string[] = []
  currentURL = ""
  loading = false
  onChange?: () => void

  constructor() {
    this.webView = new WebViewController()

    // 请求拦截：记录每一个被发起的请求（含 body / headers）
    this.webView.shouldAllowRequest = async (request) => {
      this.requests.push({
        id: nextId++,
        url: request.url,
        method: request.method,
        headers: request.headers ?? {},
        body: request.body ? request.body.toDecodedString() : "",
        navigationType: request.navigationType,
        ts: Date.now(),
      })
      // 防止内存无限增长：最多保留最近 500 条
      if (this.requests.length > 500) {
        this.requests = this.requests.slice(-500)
      }
      this.emit()
      return true
    }

    // Hook 采样回传
    this.webView
      .addScriptMessageHandler("jsrvHook", (payload?: HookSample) => {
        if (payload && typeof payload === "object") {
          this.hookSamples.push(payload)
          if (this.hookSamples.length > 1000) {
            this.hookSamples = this.hookSamples.slice(-1000)
          }
          this.emit()
        }
      })
      .catch((e) => console.log("addScriptMessageHandler failed:", e))
  }

  private emit() {
    if (this.onChange) this.onChange()
  }

  // 打开目标页面，等待加载完成后自动安装 Hook 基础设施
  async open(url: string): Promise<string> {
    const normalized = /^https?:\/\//i.test(url) ? url : "https://" + url
    this.loading = true
    this.emit()
    try {
      const ok = await this.webView.loadURL(normalized)
      if (!ok) {
        this.loading = false
        this.emit()
        return "加载失败：" + normalized
      }
      await this.webView.waitForLoad()
      this.currentURL = normalized
    } catch (e: any) {
      this.loading = false
      this.emit()
      return "加载异常：" + (e?.message ?? String(e))
    }
    this.loading = false
    // 页面就绪后自动安装 hook 基础（失败不影响整体）
    try {
      await this.webView.evaluateJavaScript(INJECT_BASE)
    } catch (e) {
      console.log("install base failed:", e)
    }
    this.emit()
    return "已加载：" + normalized
  }

  // 安装 hook 基础设施（页面加载后手动补装）
  async installBase(): Promise<string> {
    try {
      const r = await this.webView.evaluateJavaScript<string>(INJECT_BASE)
      return String(r ?? "")
    } catch (e: any) {
      return "注入失败：" + (e?.message ?? String(e))
    }
  }

  // Hook 指定函数路径（如 window.a.b.c 或 a.b.c）
  async hook(path: string): Promise<string> {
    const trimmed = path.trim()
    if (!trimmed) return "路径为空"
    try {
      const r = await this.webView.evaluateJavaScript<string>(
        "window.__jsrvHookPath(" + JSON.stringify(trimmed) + ")"
      )
      const text = String(r ?? "")
      if (text.startsWith("hooked:")) {
        const clean = trimmed.replace(/^window\./, "")
        if (!this.hookedPaths.includes(clean)) this.hookedPaths.push(clean)
        this.emit()
      }
      return text
    } catch (e: any) {
      return "Hook 异常：" + (e?.message ?? String(e))
    }
  }

  // 枚举页面已加载的 JS 脚本
  async refreshScripts(): Promise<string[]> {
    try {
      const r = await this.webView.evaluateJavaScript<string[]>(listScriptsJS())
      this.scripts = Array.isArray(r) ? r : []
      this.emit()
    } catch (e) {
      console.log("list scripts failed:", e)
      this.scripts = []
    }
    return this.scripts
  }

  // 在页面上下文 fetch 脚本源码
  async fetchScript(url: string): Promise<FetchedScript> {
    try {
      const r = await this.webView.evaluateJavaScript<FetchedScript>(fetchScriptJS(url))
      return r ?? { url, error: "无返回" }
    } catch (e: any) {
      return { url, error: e?.message ?? String(e) }
    }
  }

  // 执行用户输入的任意 JS
  async evalJS(code: string): Promise<string> {
    if (!code.trim()) return ""
    try {
      const r = await this.webView.evaluateJavaScript(evalUserJS(code))
      if (r === undefined || r === null) return "undefined"
      if (typeof r === "string") return r
      try {
        return JSON.stringify(r)
      } catch {
        return String(r)
      }
    } catch (e: any) {
      return "执行异常：" + (e?.message ?? String(e))
    }
  }

  // 读取当前 Cookie
  async getCookies() {
    try {
      return await this.webView.getAllCookies()
    } catch (e) {
      console.log("get cookies failed:", e)
      return []
    }
  }

  // 汇总导出证据
  async buildEvidence(): Promise<Evidence> {
    const cookies = await this.getCookies()
    return {
      exportedAt: new Date().toISOString(),
      currentURL: this.currentURL,
      requests: this.requests,
      hookSamples: this.hookSamples,
      scripts: this.scripts,
      hookedPaths: this.hookedPaths,
      cookies: cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
        isSecure: c.isSecure,
        isHTTPOnly: c.isHTTPOnly,
      })),
    }
  }

  clearRequests() {
    this.requests = []
    this.emit()
  }

  clearHooks() {
    this.hookSamples = []
    this.emit()
  }

  dispose() {
    try {
      this.webView.dispose()
    } catch (e) {
      console.log("dispose failed:", e)
    }
  }
}
