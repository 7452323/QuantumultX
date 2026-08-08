// sampler.ts v4.0 — 全自动逆向采样器
// 打开页面 → 自动注入全部模块 → 自动扫描 → 自动取证
import {
  loadInjectCode,
  listScriptsJS,
  fetchScriptJS,
  evalUserJS,
  replayRequestJS,
} from "./inject"

// ── 类型 ──────────────────────────────────────────────────

export interface RequestRecord {
  id: number; url: string; method: string
  headers: Record<string, string>; body: string
  navigationType: string; ts: number
}
export interface ResponseRecord {
  url: string; method: string
  status: number; statusText: string; duration?: number
  headers: Record<string, string>; body: string; ts: number
}
export interface HookSample {
  kind: string; path?: string; args?: string[]; ret?: string
  error?: string; async?: number; duration?: number; stack?: string
  url?: string; status?: number; body?: string; method?: string
  ts: number
}
export interface ProbeItem {
  path: string; type: string; category: string; native: boolean
}
export interface ProbeCategory {
  category: string; count: number
  top20: { path: string; native: boolean }[]
}
export interface SearchResult {
  totalScripts: number
  results: { src: string; idx: number; match: string; ctx: string }[]
}
export interface FetchedScript {
  url: string; status?: number; length?: number; content?: string; error?: string
}
export interface StorageDump {
  localStorage: Record<string, string>
  sessionStorage: Record<string, string>
}
export interface GlobalEntry {
  key: string; type: string; val?: string; keys?: string[]; len?: number
}
export interface Evidence {
  version: string; exportedAt: string; currentURL: string
  summary: Record<string, number>
  requests: RequestRecord[]; responses: ResponseRecord[]
  hookSamples: HookSample[]; probeResults: ProbeItem[]
  scripts: string[]; hookedPaths: string[]
  storage: StorageDump; globals: GlobalEntry[]
  cookies: { name: string; value: string; domain: string; path: string; isSecure: boolean; isHTTPOnly: boolean }[]
}

let nextId = 1

export class Sampler {
  readonly webView = new WebViewController()
  requests: RequestRecord[] = []
  responses: ResponseRecord[] = []
  hookSamples: HookSample[] = []
  probeResults: ProbeItem[] = []
  probeByCategory: ProbeCategory[] = []
  scripts: string[] = []
  hookedPaths: string[] = []
  storageDump: StorageDump = { localStorage: {}, sessionStorage: {} }
  globalsDump: GlobalEntry[] = []
  currentURL = ""
  loading = false
  autoSetupDone = false
  onChange?: () => void

  // 独立可控的加载状态
  state: Record<string, boolean> = {}

  constructor() {
    this.webView.shouldAllowRequest = async (req) => {
      this.requests.push({
        id: nextId++, url: req.url, method: req.method,
        headers: req.headers ?? {},
        body: req.body ? req.body.toDecodedString() : "",
        navigationType: req.navigationType, ts: Date.now(),
      })
      if (this.requests.length > 500) this.requests = this.requests.slice(-500)
      this.emit()
      return true
    }

    this.webView.addScriptMessageHandler("jsrvHook", (payload?: any) => {
      if (!payload || typeof payload !== "object") return
      const k = payload.kind
      if (k === "response" || k === "ws_send" || k === "ws_message") {
        this.responses.push({
          url: payload.url ?? "",
          method: payload.method ?? (k === "ws_send" ? "WS↑" : k === "ws_message" ? "WS↓" : "GET"),
          status: payload.status ?? 0, statusText: payload.statusText ?? k,
          duration: payload.duration,
          headers: payload.headers ?? {}, body: payload.body ?? "",
          ts: payload.ts ?? Date.now(),
        })
        if (this.responses.length > 500) this.responses = this.responses.slice(-500)
      } else {
        this.hookSamples.push(payload as HookSample)
        if (this.hookSamples.length > 1000) this.hookSamples = this.hookSamples.slice(-1000)
      }
      this.emit()
    }).catch(() => {})
  }

  private emit() { this.onChange?.() }

  // ── 全自动加载 ──────────────────────────────────────────

  async open(url: string): Promise<string> {
    const normalized = /^https?:\/\//i.test(url) ? url : "https://" + url
    this.loading = true; this.autoSetupDone = false; this.emit()
    try {
      const ok = await this.webView.loadURL(normalized)
      if (!ok) { this.loading = false; this.emit(); return "打开失败" }
      await this.webView.waitForLoad()
      this.currentURL = normalized
    } catch (e: any) {
      this.loading = false; this.emit()
      return "异常: " + (e?.message ?? String(e))
    }
    // 自动全装
    const results = await this.autoSetup()
    this.loading = false
    this.autoSetupDone = true
    this.emit()
    const parts = []
    if (results?.injected) parts.push("模块已注入")
    if (results?.probed !== undefined) parts.push(results.probed + "函数可Hook")
    if (results?.scripts !== undefined) parts.push(results.scripts + "脚本")
    return parts.length > 0 ? parts.join(" | ") : "已加载: " + normalized
  }

  async autoSetup() {
    try {
      await this.webView.evaluateJavaScript(loadInjectCode())
    } catch (e) { console.log("inject-all failed:", e); return null }

    let probed = 0, scriptCount = 0
    try {
      const raw = await this.webView.evaluateJavaScript<ProbeItem[]>("window.__jsrvProbeGlobal()")
      this.probeResults = Array.isArray(raw) ? raw : []
      probed = this.probeResults.length
      try {
        const cats = await this.webView.evaluateJavaScript<ProbeCategory[]>(
          "window.__jsrvProbeResults(window.__jsrvProbeGlobal())"
        )
        this.probeByCategory = Array.isArray(cats) ? cats : []
      } catch (e) {}
    } catch (e) { console.log("probe failed:", e) }

    try {
      const s = await this.webView.evaluateJavaScript<string[]>(listScriptsJS())
      this.scripts = Array.isArray(s) ? s : []
      scriptCount = this.scripts.length
    } catch (e) { console.log("scripts failed:", e) }

    // 异步拉取证（不阻塞返回）
    this.autoDumpForensics()
    return { injected: true, probed, scripts: scriptCount }
  }

  private async autoDumpForensics() {
    try {
      const s = await this.webView.evaluateJavaScript<StorageDump>("window.__jsrvDumpStorage()")
      if (s) this.storageDump = s
    } catch (e) {}
    try {
      const g = await this.webView.evaluateJavaScript<GlobalEntry[]>("window.__jsrvDumpGlobals()")
      if (Array.isArray(g)) this.globalsDump = g
    } catch (e) {}
    this.emit()
  }

  // ── Hook ─────────────────────────────────────────────────

  async hook(path: string, opts?: { condition?: string }): Promise<string> {
    const trimmed = path.trim()
    if (!trimmed) return "❌ 路径为空"
    try {
      const optsArg = opts ? JSON.stringify(opts) : "undefined"
      const r = await this.webView.evaluateJavaScript<string>(
        "window.__jsrvHookPath(" + JSON.stringify(trimmed) + "," + optsArg + ")"
      )
      const text = String(r ?? "")
      if (text.startsWith("ok:") || text.startsWith("already:")) {
        if (text.startsWith("ok:")) {
          const clean = trimmed.replace(/^window\./, "")
          if (!this.hookedPaths.includes(clean)) this.hookedPaths.push(clean)
        }
        this.emit()
        return text.startsWith("ok:") ? "✅ " + text.slice(3) : "⚠️ " + text.slice(8)
      }
      if (text.startsWith("nf:")) return "❌ 未找到: " + text.slice(3)
      if (text.startsWith("naf:")) return "❌ 不是函数: " + text.slice(4)
      if (text.startsWith("badcond:")) return "❌ 条件语法错误: " + text.slice(8)
      return "❌ " + text
    } catch (e: any) { return "❌ 异常: " + (e?.message ?? String(e)) }
  }

  async hookClass(className: string, methods: string[]): Promise<string> {
    const trimmed = className.trim()
    if (!trimmed || methods.length === 0) return "❌ 参数不足"
    try {
      const js = "window.__jsrvHookClass(" + JSON.stringify(trimmed) + "," + JSON.stringify(methods) + ")"
      const r = await this.webView.evaluateJavaScript<any>(js)
      const hooked = r?.hooked ?? []
      const errors = r?.errors ?? []
      hooked.forEach((h: string) => { if (!this.hookedPaths.includes(h)) this.hookedPaths.push(h) })
      this.emit()
      const parts: string[] = []
      if (hooked.length > 0) parts.push("✅ Hooked: " + hooked.join(", "))
      if (errors.length > 0) parts.push("❌ " + errors.join("; "))
      return parts.join(" | ") || "无操作"
    } catch (e: any) { return "❌ 失败: " + (e?.message ?? String(e)) }
  }

  // ── 探针 ─────────────────────────────────────────────────

  async reprobe(): Promise<string> {
    try {
      const raw = await this.webView.evaluateJavaScript<ProbeItem[]>("window.__jsrvProbeGlobal()")
      this.probeResults = Array.isArray(raw) ? raw : []
      try {
        const cats = await this.webView.evaluateJavaScript<ProbeCategory[]>(
          "window.__jsrvProbeResults(window.__jsrvProbeGlobal())"
        )
        this.probeByCategory = Array.isArray(cats) ? cats : []
      } catch (e) {}
      this.emit()
      return "发现 " + this.probeResults.length + " 个函数"
    } catch (e: any) { return "❌ 扫描失败: " + (e?.message ?? String(e)) }
  }

  // ── 脚本 ─────────────────────────────────────────────────

  async refreshScripts(): Promise<string> {
    try {
      const r = await this.webView.evaluateJavaScript<string[]>(listScriptsJS())
      this.scripts = Array.isArray(r) ? r : []
      this.emit()
      return this.scripts.length + " 个脚本"
    } catch (e: any) { return "❌ 失败: " + (e?.message ?? String(e)) }
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
      try { return JSON.stringify(r, null, 2) } catch { return String(r) }
    } catch (e: any) { return "❌ " + (e?.message ?? String(e)) }
  }

  // ── 请求重放 ────────────────────────────────────────────

  async replayRequest(id: number): Promise<FetchedScript> {
    const req = this.requests.find(r => r.id === id)
    if (!req) return { url: "", error: "未找到请求 #" + id }
    try {
      const r = await this.webView.evaluateJavaScript<FetchedScript>(
        replayRequestJS(req.url, req.method, req.headers, req.body || undefined)
      )
      return r ?? { url: req.url, error: "无返回" }
    } catch (e: any) { return { url: req.url, error: e?.message ?? String(e) } }
  }

  // ── 搜索 ─────────────────────────────────────────────────

  async searchScripts(pattern: string): Promise<SearchResult> {
    try {
      const r = await this.webView.evaluateJavaScript<SearchResult>(
        "window.__jsrvSearchAll(" + JSON.stringify(pattern) + ")"
      )
      return r ?? { totalScripts: 0, results: [] }
    } catch (e) { return { totalScripts: 0, results: [] } }
  }

  async beautify(code: string): Promise<string> {
    try {
      const r = await this.webView.evaluateJavaScript<string>(
        "window.__jsrvBeautify(" + JSON.stringify(code) + ")"
      )
      return typeof r === "string" ? r : code
    } catch (e) { return code }
  }

  // ── 取证 ─────────────────────────────────────────────────

  async refreshForensics(): Promise<string> {
    await this.autoDumpForensics()
    const ls = Object.keys(this.storageDump.localStorage).length
    const ss = Object.keys(this.storageDump.sessionStorage).length
    return `localStorage ${ls} | sessionStorage ${ss} | 全局 ${this.globalsDump.length}`
  }

  // ── Cookie ──────────────────────────────────────────────

  async getCookies() {
    try { return await this.webView.getAllCookies() } catch (e) { return [] }
  }

  // ── 导出 ─────────────────────────────────────────────────

  async buildEvidence(): Promise<Evidence> {
    const cookies = await this.getCookies()
    return {
      version: "4.0",
      exportedAt: new Date().toISOString(),
      currentURL: this.currentURL,
      summary: {
        requests: this.requests.length,
        responses: this.responses.length,
        hookSamples: this.hookSamples.length,
        probeFunctions: this.probeResults.length,
        scripts: this.scripts.length,
        hookedPaths: this.hookedPaths.length,
        storageKeys: Object.keys(this.storageDump.localStorage).length + Object.keys(this.storageDump.sessionStorage).length,
        globalVars: this.globalsDump.length,
        cookies: cookies.length,
      },
      requests: this.requests,
      responses: this.responses,
      hookSamples: this.hookSamples,
      probeResults: this.probeResults,
      scripts: this.scripts,
      hookedPaths: this.hookedPaths,
      storage: this.storageDump,
      globals: this.globalsDump,
      cookies: cookies.map((c: any) => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path,
        isSecure: c.isSecure, isHTTPOnly: c.isHTTPOnly,
      })),
    }
  }

  clearRequests() { this.requests = []; this.responses = []; this.emit() }
  clearHooks() { this.hookSamples = []; this.hookedPaths = []; this.emit() }
  dispose() { try { this.webView.dispose() } catch (e) {} }
}
