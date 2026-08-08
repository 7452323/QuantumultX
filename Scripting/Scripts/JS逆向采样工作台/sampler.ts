// Sampler —— WebViewController 封装 v2.0。
// 职责：页面加载、请求拦截记录、响应拦截记录、Hook 注入与采样回传、
//        脚本枚举/源码提取、Cookie、证据导出含统计摘要。
import {
  INJECT_BASE,
  INJECT_RESPONSE_TRACKING,
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

export interface ResponseRecord {
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  method: string
  ts: number
  // 关联到 request（按 url+method+时间近似匹配，非精确）
}

export interface HookSample {
  kind: string        // "call" | "response"
  path?: string       // call 时是函数路径
  args?: string[]
  ret?: string
  error?: string
  async?: boolean
  // response 专属字段
  url?: string
  status?: number
  statusText?: string
  headers?: Record<string, string>
  body?: string
  method?: string
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
  version: string
  exportedAt: string
  currentURL: string
  summary: {
    requests: number
    responses: number
    hookSamples: number
    hookCallSamples: number
    hookResponseSamples: number
    scripts: number
    hookedPaths: number
    cookies: number
  }
  requests: RequestRecord[]
  responses: ResponseRecord[]
  hookSamples: HookSample[]
  scripts: string[]
  hookedPaths: string[]
  cookies: { name: string; value: string; domain: string; path: string; isSecure: boolean; isHTTPOnly: boolean }[]
}

let nextId = 1

export class Sampler {
  readonly webView: WebViewController
  requests: RequestRecord[] = []
  responses: ResponseRecord[] = []
  hookSamples: HookSample[] = []
  scripts: string[] = []
  hookedPaths: string[] = []
  currentURL = ""
  loading = false
  onChange?: () => void

  constructor() {
    this.webView = new WebViewController()

    // 请求拦截
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
      if (this.requests.length > 500) {
        this.requests = this.requests.slice(-500)
      }
      this.emit()
      return true
    }

    // Hook 采样 + 响应回传（同一个 messageHandler，kind 区分）
    this.webView
      .addScriptMessageHandler("jsrvHook", (payload?: HookSample) => {
        if (!payload || typeof payload !== "object") return

        if (payload.kind === "response") {
          // 页面内 fetch/XHR hook 回传的响应
          this.responses.push({
            url: payload.url ?? "",
            status: payload.status ?? 0,
            statusText: payload.statusText ?? "",
            headers: payload.headers ?? {},
            body: payload.body ?? "",
            method: payload.method ?? "GET",
            ts: payload.ts ?? Date.now(),
          })
          if (this.responses.length > 500) {
            this.responses = this.responses.slice(-500)
          }
        } else {
          // Hook 采样
          this.hookSamples.push(payload)
          if (this.hookSamples.length > 1000) {
            this.hookSamples = this.hookSamples.slice(-1000)
          }
        }
        this.emit()
      })
      .catch((e) => console.log("addScriptMessageHandler failed:", e))
  }

  private emit() {
    if (this.onChange) this.onChange()
  }

  // 打开目标页面，自动安装基础 Hook + 响应拦截
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
    // 自动安装基础 + 响应拦截
    try {
      await this.webView.evaluateJavaScript(INJECT_BASE)
    } catch (e) {
      console.log("install base failed:", e)
    }
    try {
      await this.webView.evaluateJavaScript(INJECT_RESPONSE_TRACKING)
    } catch (e) {
      console.log("install response tracking failed:", e)
    }
    this.emit()
    return "已加载：" + normalized
  }

  // 安装 Hook 基础设施
  async installBase(): Promise<string> {
    try {
      const r = await this.webView.evaluateJavaScript<string>(INJECT_BASE)
      return String(r ?? "")
    } catch (e: any) {
      return "注入失败：" + (e?.message ?? String(e))
    }
  }

  // 安装响应拦截（fetch + XHR hook）
  async installResponseTracking(): Promise<string> {
    try {
      const r = await this.webView.evaluateJavaScript<string>(INJECT_RESPONSE_TRACKING)
      return String(r ?? "")
    } catch (e: any) {
      return "跟踪安装失败：" + (e?.message ?? String(e))
    }
  }

  // Hook 指定函数路径
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

  // 汇总导出证据（含统计摘要）
  async buildEvidence(): Promise<Evidence> {
    const cookies = await this.getCookies()
    const callSamples = this.hookSamples.filter((s) => s.kind === "call")
    const responseSamples = this.hookSamples.filter((s) => s.kind === "response")
    return {
      version: "2.0",
      exportedAt: new Date().toISOString(),
      currentURL: this.currentURL,
      summary: {
        requests: this.requests.length,
        responses: this.responses.length,
        hookSamples: this.hookSamples.length,
        hookCallSamples: callSamples.length,
        hookResponseSamples: responseSamples.length,
        scripts: this.scripts.length,
        hookedPaths: this.hookedPaths.length,
        cookies: cookies.length,
      },
      requests: this.requests,
      responses: this.responses,
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
    this.responses = []
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
