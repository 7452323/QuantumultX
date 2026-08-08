// sampler.ts v3.0 — WebViewController 全功能逆向封装
// 职责：页面控制、请求/响应拦截、Hook 采样、全局探针、
//        跨脚本搜索、JS 美化、存储转储、证据导出
import {
  INJECT_BASE,
  INJECT_PROBE,
  INJECT_RESPONSE_TRACKING,
  INJECT_SOURCE,
  INJECT_FORENSICS,
  listScriptsJS,
  fetchScriptJS,
  evalUserJS,
} from "./inject"

// ── 类型定义 ───────────────────────────────────────────────

export interface RequestRecord {
  id: number
  url: string; method: string
  headers: Record<string, string>
  body: string; navigationType: string; ts: number
}

export interface ResponseRecord {
  url: string; method: string
  status: number; statusText: string; duration?: number
  headers: Record<string, string>
  body: string; ts: number
}

export interface HookSample {
  kind: string
  path?: string; args?: string[]; ret?: string
  error?: string; async?: boolean; duration?: number
  stack?: string
  // response 字段
  url?: string; status?: number; statusText?: string
  headers?: Record<string, string>; body?: string; method?: string
  ts: number
}

export interface ProbeItem {
  path: string; type: string; category: string; native: boolean
}

export interface SearchMatch {
  src: string; idx: number; match: string; context: string
}

export interface FetchedScript {
  url: string; status?: number; length?: number; content?: string; error?: string
}

export interface StorageDump {
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
}

export interface GlobalEntry {
  key: string; type: string
  value?: string; keys?: string[]; len?: number
}

export interface Evidence {
  version: string
  exportedAt: string; currentURL: string
  summary: Record<string, number>
  requests: RequestRecord[]
  responses: ResponseRecord[]
  hookSamples: HookSample[]
  probeResults: ProbeItem[]
  scripts: string[]
  hookedPaths: string[]
  storage: StorageDump
  globals: GlobalEntry[]
  cookies: { name: string; value: string; domain: string; path: string; isSecure: boolean; isHTTPOnly: boolean }[]
}

let nextId = 1

// ── Sampler 类 ─────────────────────────────────────────────

export class Sampler {
  readonly webView: WebViewController

  requests: RequestRecord[] = []
  responses: ResponseRecord[] = []
  hookSamples: HookSample[] = []
  probeResults: ProbeItem[] = []
  scripts: string[] = []
  hookedPaths: string[] = []
  currentURL = ""
  loading = false
  onChange?: () => void

  constructor() {
    this.webView = new WebViewController()

    this.webView.shouldAllowRequest = async (req) => {
      this.requests.push({
        id: nextId++,
        url: req.url, method: req.method,
        headers: req.headers ?? {},
        body: req.body ? req.body.toDecodedString() : "",
        navigationType: req.navigationType, ts: Date.now(),
      })
      if (this.requests.length > 500) this.requests = this.requests.slice(-500)
      this.emit()
      return true
    }

    this.webView.addScriptMessageHandler("jsrvHook", (payload?: HookSample) => {
      if (!payload || typeof payload !== "object") return
      const kind = payload.kind

      if (kind === "response" || kind === "ws_send" || kind === "ws_message") {
        this.responses.push({
          url: payload.url ?? "",
          method: payload.method ?? (kind === "ws_send" ? "WS↑" : kind === "ws_message" ? "WS↓" : "GET"),
          status: payload.status ?? 0,
          statusText: payload.kind ?? "",
          duration: payload.duration,
          headers: payload.headers ?? {},
          body: payload.body ?? "",
          ts: payload.ts ?? Date.now(),
        })
        if (this.responses.length > 500) this.responses = this.responses.slice(-500)
      } else {
        this.hookSamples.push(payload)
        if (this.hookSamples.length > 1000) this.hookSamples = this.hookSamples.slice(-1000)
      }
      this.emit()
    }).catch(() => {})
  }

  private emit() { if (this.onChange) this.onChange() }

  // ── 页面控制 ─────────────────────────────────────────────

  async open(url: string): Promise<string> {
    const normalized = /^https?:\/\//i.test(url) ? url : "https://" + url
    this.loading = true; this.emit()
    try {
      const ok = await this.webView.loadURL(normalized)
      if (!ok) { this.loading = false; this.emit(); return "加载失败" }
      await this.webView.waitForLoad()
      this.currentURL = normalized
    } catch (e: any) {
      this.loading = false; this.emit()
      return "异常：" + (e?.message ?? String(e))
    }
    this.loading = false
    // 自动安装核心模块
    await this.installBase()
    await this.installResponseTracking()
    this.emit()
    return "已加载：" + normalized
  }

  async installBase() {
    try { return String(await this.webView.evaluateJavaScript<string>(INJECT_BASE) ?? "") }
    catch (e: any) { return "注入失败：" + (e?.message ?? String(e)) }
  }

  async installResponseTracking() {
    try { return String(await this.webView.evaluateJavaScript<string>(INJECT_RESPONSE_TRACKING) ?? "") }
    catch (e: any) { return "跟踪失败：" + (e?.message ?? String(e)) }
  }

  // ── Hook ─────────────────────────────────────────────────

  async hook(path: string, opts?: { condition?: string; beforeOnly?: boolean }): Promise<string> {
    const trimmed = path.trim()
    if (!trimmed) return "路径为空"
    try {
      const optsArg = opts ? JSON.stringify(opts) : "undefined"
      const r = await this.webView.evaluateJavaScript<string>(
        "window.__jsrvHookPath(" + JSON.stringify(trimmed) + ", " + optsArg + ")"
      )
      const text = String(r ?? "")
      if (text.startsWith("hooked:")) {
        const clean = trimmed.replace(/^window\./, "")
        if (!this.hookedPaths.includes(clean)) this.hookedPaths.push(clean)
        this.emit()
      }
      return text
    } catch (e: any) { return "Hook 异常：" + (e?.message ?? String(e)) }
  }

  // ── 全局探针 ────────────────────────────────────────────

  async installProbe(): Promise<string> {
    try { return String(await this.webView.evaluateJavaScript<string>(INJECT_PROBE) ?? "") }
    catch (e: any) { return "探针注入失败：" + (e?.message ?? String(e)) }
  }

  async probeGlobal(): Promise<ProbeItem[]> {
    await this.installProbe()
    try {
      const r = await this.webView.evaluateJavaScript<ProbeItem[]>("window.__jsrvProbeGlobal()")
      this.probeResults = Array.isArray(r) ? r : []
      this.emit()
    } catch (e) { console.log("probe failed:", e); this.probeResults = [] }
    return this.probeResults
  }

  async hookClass(className: string, methods: string[]): Promise<string> {
    await this.installProbe()
    try {
      const r = await this.webView.evaluateJavaScript<any>(
        "window.__jsrvHookClass(" + JSON.stringify(className) + "," + JSON.stringify(methods) + ")"
      )
      const hooked = r?.hooked ?? []
      hooked.forEach((h: string) => { if (!this.hookedPaths.includes(h)) this.hookedPaths.push(h) })
      this.emit()
      return "已 Hook: " + (hooked.length > 0 ? hooked.join(", ") : "无") +
        (r?.errors?.length ? " | 错误: " + r.errors.join(", ") : "")
    } catch (e: any) { return "类 Hook 失败：" + (e?.message ?? String(e)) }
  }

  // ── 源码分析 ────────────────────────────────────────────

  async installSource(): Promise<string> {
    try { return String(await this.webView.evaluateJavaScript<string>(INJECT_SOURCE) ?? "") }
    catch (e: any) { return "源码模块注入失败：" + (e?.message ?? String(e)) }
  }

  async beautify(code: string): Promise<string> {
    await this.installSource()
    try {
      const r = await this.webView.evaluateJavaScript<string>(
        "window.__jsrvBeautify(" + JSON.stringify(code) + ")"
      )
      return typeof r === "string" ? r : code
    } catch (e) { return code } // 失败则返回原文
  }

  async searchScripts(pattern: string): Promise<{ totalScripts: number; results: SearchMatch[] }> {
    await this.installSource()
    try {
      const r = await this.webView.evaluateJavaScript<any>(
        "window.__jsrvSearchAll(" + JSON.stringify(pattern) + ")"
      )
      return r ?? { totalScripts: 0, results: [] }
    } catch (e) { return { totalScripts: 0, results: [] } }
  }

  // ── 取证 ────────────────────────────────────────────────

  async installForensics(): Promise<string> {
    try { return String(await this.webView.evaluateJavaScript<string>(INJECT_FORENSICS) ?? "") }
    catch (e: any) { return "取证模块注入失败：" + (e?.message ?? String(e)) }
  }

  async dumpStorage(): Promise<StorageDump> {
    await this.installForensics()
    try {
      const r = await this.webView.evaluateJavaScript<StorageDump>("window.__jsrvDumpStorage()")
      return r ?? { localStorage: {}, sessionStorage: {} }
    } catch (e) { return { localStorage: {}, sessionStorage: {} } }
  }

  async dumpGlobals(): Promise<GlobalEntry[]> {
    await this.installForensics()
    try {
      const r = await this.webView.evaluateJavaScript<GlobalEntry[]>("window.__jsrvDumpGlobals()")
      return Array.isArray(r) ? r : []
    } catch (e) { return [] }
  }

  // ── 脚本 ─────────────────────────────────────────────────

  async refreshScripts(): Promise<string[]> {
    try {
      const r = await this.webView.evaluateJavaScript<string[]>(listScriptsJS())
      this.scripts = Array.isArray(r) ? r : []
      this.emit()
    } catch (e) { this.scripts = [] }
    return this.scripts
  }

  async fetchScript(url: string): Promise<FetchedScript> {
    try {
      const r = await this.webView.evaluateJavaScript<FetchedScript>(fetchScriptJS(url))
      return r ?? { url, error: "无返回" }
    } catch (e: any) { return { url, error: e?.message ?? String(e) } }
  }

  async evalJS(code: string): Promise<string> {
    if (!code.trim()) return ""
    try {
      const r = await this.webView.evaluateJavaScript(evalUserJS(code))
      if (r === undefined || r === null) return "undefined"
      if (typeof r === "string") return r
      try { return JSON.stringify(r) } catch { return String(r) }
    } catch (e: any) { return "执行异常：" + (e?.message ?? String(e)) }
  }

  // ── Cookie ──────────────────────────────────────────────

  async getCookies() {
    try { return await this.webView.getAllCookies() } catch (e) { return [] }
  }

  // ── 证据导出 ────────────────────────────────────────────

  async buildEvidence(): Promise<Evidence> {
    const cookies = await this.getCookies()
    const storage = await this.dumpStorage()
    const globals = await this.dumpGlobals()
    return {
      version: "3.0",
      exportedAt: new Date().toISOString(),
      currentURL: this.currentURL,
      summary: {
        requests: this.requests.length,
        responses: this.responses.length,
        hookSamples: this.hookSamples.length,
        probeFunctions: this.probeResults.length,
        scripts: this.scripts.length,
        hookedPaths: this.hookedPaths.length,
        storageKeys: Object.keys(storage.localStorage).length + Object.keys(storage.sessionStorage).length,
        globalVars: globals.length,
        cookies: cookies.length,
      },
      requests: this.requests,
      responses: this.responses,
      hookSamples: this.hookSamples,
      probeResults: this.probeResults,
      scripts: this.scripts,
      hookedPaths: this.hookedPaths,
      storage, globals,
      cookies: cookies.map((c) => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        isSecure: c.isSecure, isHTTPOnly: c.isHTTPOnly,
      })),
    }
  }

  clearRequests() { this.requests = []; this.responses = []; this.emit() }
  clearHooks() { this.hookSamples = []; this.emit() }

  dispose() {
    try { this.webView.dispose() } catch (e) {}
  }
}
