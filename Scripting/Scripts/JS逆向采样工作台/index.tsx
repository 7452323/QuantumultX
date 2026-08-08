// JSReverse Workbench v3.0
// 5 页：会话 | 网络 | 探针 | 源码 | 取证
import {
  Script, Navigation, NavigationStack,
  List, Section, Text, TextField, VStack, HStack, Spacer,
  TabView, Tab, useState, useEffect, useObservable,
} from "scripting"
import { WebView } from "scripting"
import { Sampler, type ProbeItem, type HookSample } from "./sampler"

const sampler = new Sampler()

const QL = QuickLook  // 全局，无需 import

// ── 工具函数 ────────────────────────────────────────────────

function host(url: string): string {
  try { return new URL(url).host } catch { return url.slice(0, 60) }
}
function shortPath(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search).slice(0, 80) || "/" } catch { return url.slice(0, 80) }
}
function ts(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}:${String(d.getSeconds()).padStart(2,"0")}`
}
function mColor(m: string): string {
  const m2 = m.toUpperCase()
  if (m2 === "GET") return "systemBlue"
  if (m2 === "POST" || m2 === "WS↑") return "systemOrange"
  if (m2 === "PUT" || m2 === "PATCH" || m2 === "WS↓") return "systemPurple"
  if (m2 === "DELETE") return "systemRed"
  return "secondaryLabel"
}
function sColor(s: number): string {
  if (s >= 200 && s < 300) return "systemGreen"
  if (s >= 400 && s < 500) return "systemOrange"
  if (s >= 500 || s === 0) return "systemRed"
  return "secondaryLabel"
}
function catColor(c: string): string {
  switch (c) {
    case "crypto": return "systemRed"
    case "network": return "systemBlue"
    case "encoding": return "systemOrange"
    case "auth": return "systemPurple"
    case "storage": return "systemGreen"
    case "native": return "systemTeal"
    default: return "secondaryLabel"
  }
}

// ── 可复用组件 ──────────────────────────────────────────────

function Btn({ label, color = "systemBlue", ontap }: { label: string; color?: string; ontap: () => void }) {
  return (
    <VStack onTapGesture={ontap}>
      <HStack padding={{ top: 9, bottom: 9 }} spacing={8}>
        <Text foregroundColor={color}>{label}</Text>
        <Spacer />
        <Text foregroundColor={color}>›</Text>
      </HStack>
    </VStack>
  )
}

function StatsBar({ labels }: { labels: string[] }) {
  return (
    <HStack padding={{ top: 4, bottom: 2 }} spacing={10}>
      {labels.map((l, i) => (
        <Text key={i} font="caption" foregroundColor="secondaryLabel">{l}</Text>
      ))}
    </HStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 1: 会话 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function SessionTab({ refresh }: { refresh: () => void }) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState("")

  async function load() {
    setStatus("加载中…")
    setStatus(await sampler.open(url))
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle="会话" navigationBarTitleDisplayMode="inline">
        <Section header={<Text>目标页面</Text>}>
          <TextField title="URL" value={url} onChanged={setUrl} prompt="https://example.com" />
          <Btn label={sampler.loading ? "加载中…" : "打开"} ontap={load} />
          <Btn label="重装核心模块" color="systemOrange" ontap={() => sampler.installBase().then(s => { setStatus(s); refresh() })} />
          <Btn label="注入探针模块" color="systemPurple" ontap={() => sampler.installProbe().then(s => { setStatus(s); refresh() })} />
        </Section>

        <Section header={<Text>浏览器</Text>} footer={status ? <Text>{status}</Text> : undefined}>
          <VStack frame={{ height: 380 }} cornerRadius={12} background="secondarySystemBackground">
            <WebView controller={sampler.webView} />
          </VStack>
          <HStack spacing={10}>
            <Btn label="←" ontap={() => { try { sampler.webView.goBack() } catch {} }} />
            <Btn label="→" ontap={() => { try { sampler.webView.goForward() } catch {} }} />
            <Btn label="⟳" ontap={() => { try { sampler.webView.reload() } catch {} }} />
            <Btn label="清空" color="systemRed" ontap={() => { sampler.clearRequests(); sampler.clearHooks(); refresh() }} />
          </HStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 2: 网络 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function NetworkTab({ refresh }: { refresh: () => void }) {
  const [search, setSearch] = useState("")
  const [mFilter, setMF] = useState("")
  const [selId, setSelId] = useState(0)

  const q = search.trim().toLowerCase()
  const reqs = sampler.requests.filter(r => {
    if (mFilter && r.method.toUpperCase() !== mFilter.toUpperCase()) return false
    if (q && !r.url.toLowerCase().includes(q)) return false
    return true
  })

  function findResp(url: string, method: string) {
    const rev = [...sampler.responses].reverse()
    return rev.find(r => r.url === url && r.method === method)
      || rev.find(r => r.url === url)
  }

  return (
    <NavigationStack>
      <List navigationTitle={`网络 (${sampler.requests.length})`} navigationBarTitleDisplayMode="inline">
        <Section>
          <StatsBar labels={[
            sampler.requests.length + " 请求",
            sampler.responses.length + " 响应",
            sampler.currentURL ? host(sampler.currentURL) : "未加载",
          ]} />
        </Section>

        <Section header={<Text>筛选</Text>}>
          <TextField title="搜索" value={search} onChanged={setSearch} prompt="URL / 域名…" />
          <HStack spacing={8}>
            {["GET","POST","PUT","DELETE","WS"].map(m => (
              <Text key={m} font="caption" foregroundColor={mFilter === m ? "systemBlue" : "tertiaryLabel"}
                onTapGesture={() => setMF(mFilter === m ? "" : m)}>{m}</Text>
            ))}
            <Spacer />
            {(search || mFilter) ? (
              <Text font="caption" foregroundColor="systemOrange"
                onTapGesture={() => { setSearch(""); setMF("") }}>清除</Text>
            ) : null}
          </HStack>
        </Section>

        {/* 请求列表 */}
        <Section header={<Text>请求</Text>} footer={<Text>shouldAllowRequest 拦截</Text>}>
          {reqs.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无匹配。</Text>
          ) : (
            reqs.slice(-200).reverse().map(req => {
              const resp = findResp(req.url, req.method)
              const open = selId === req.id
              return (
                <VStack key={req.id} spacing={3} onTapGesture={() => setSelId(open ? 0 : req.id)}>
                  <HStack spacing={6}>
                    <Text font="caption" foregroundColor={mColor(req.method)}>{req.method}</Text>
                    <VStack spacing={0}>
                      <Text font="caption">{host(req.url)}</Text>
                      <Text font="caption" foregroundColor="secondaryLabel">{shortPath(req.url)}</Text>
                    </VStack>
                    <Spacer />
                    {resp ? <Text font="caption" foregroundColor={sColor(resp.status)}>{resp.status}</Text> : null}
                  </HStack>
                  {open ? (
                    <VStack spacing={3} padding={{ top: 4, bottom: 2 }}>
                      <Text font="caption" foregroundColor="secondaryLabel">{req.url}</Text>
                      {req.body ? <Text font="caption" foregroundColor="tertiaryLabel">Req: {req.body.slice(0, 800)}</Text> : null}
                      {resp ? (
                        <VStack spacing={2}>
                          <HStack spacing={8}>
                            <Text font="caption" foregroundColor={sColor(resp.status)}>{resp.status} {resp.statusText}</Text>
                            {resp.duration ? <Text font="caption" foregroundColor="tertiaryLabel">{resp.duration}ms</Text> : null}
                          </HStack>
                          {resp.body ? <Text font="caption" foregroundColor="tertiaryLabel">Body: {resp.body.slice(0, 1000)}</Text> : null}
                        </VStack>
                      ) : null}
                    </VStack>
                  ) : null}
                </VStack>
              )
            })
          )}
        </Section>

        {/* 响应列表 — 含 WS */}
        <Section header={<Text>响应 ({sampler.responses.length})</Text>} footer={<Text>含 WebSocket 消息</Text>}>
          {sampler.responses.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无。</Text>
          ) : (
            sampler.responses.slice(-100).reverse().map((r, i) => (
              <VStack key={`r-${r.ts}-${i}`} spacing={2}>
                <HStack spacing={6}>
                  <Text font="caption" foregroundColor={sColor(r.status)}>{r.status || r.statusText}</Text>
                  <Text font="caption" foregroundColor={mColor(r.method)}>{r.method}</Text>
                  <Text font="caption">{r.body ? r.body.slice(0, 120) : host(r.url)}</Text>
                  {r.duration ? <Text font="caption" foregroundColor="tertiaryLabel">{r.duration}ms</Text> : null}
                </HStack>
              </VStack>
            ))
          )}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 3: 探针 (核心能力) ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function ProbeTab({ refresh }: { refresh: () => void }) {
  const [probeStatus, setProbeStatus] = useState("点击扫描")
  const [catFilter, setCatFilter] = useState("")
  const [probeSearch, setProbeSearch] = useState("")
  const [hookPath, setHookPath] = useState("")
  const [hookResult, setHookResult] = useState("")
  const [className, setClassName] = useState("")
  const [classMethods, setClassMethods] = useState("")
  const [classResult, setClassResult] = useState("")
  const [hookSearch, setHookSearch] = useState("")
  const [hookType, setHookType] = useState("")
  const [showStack, setShowStack] = useState(0)

  // 探针结果
  const cats = ["crypto", "network", "encoding", "auth", "storage", "native", "other"] as const
  function filteredProbe(): [string, ProbeItem[]][] {
    return cats.map(c => {
      let items = sampler.probeResults.filter(p => p.category === c)
      if (catFilter && c !== catFilter) return [c, []] as [string, ProbeItem[]]
      if (probeSearch) {
        const q = probeSearch.toLowerCase()
        items = items.filter(p => p.path.toLowerCase().includes(q))
      }
      return [c, items.slice(0, 30)]
    }).filter(([_, items]) => items.length > 0)
  }

  async function doProbe() {
    setProbeStatus("扫描中…")
    const r = await sampler.probeGlobal()
    setProbeStatus(`发现 ${r.length} 个可 Hook 函数`)
    refresh()
  }

  async function doHook(p: string) {
    setHookResult(await sampler.hook(p))
    refresh()
  }

  async function doClassHook() {
    if (!className.trim() || !classMethods.trim()) { setClassResult("请填写类名和方法"); return }
    setClassResult(await sampler.hookClass(className.trim(), classMethods.split(",").map(s => s.trim()).filter(Boolean)))
    refresh()
  }

  // Hook 采样过滤
  const hq = hookSearch.trim().toLowerCase()
  const filteredHooks = sampler.hookSamples.filter(h => {
    if (!hq) return true
    return (h.path ?? "").toLowerCase().includes(hq) || (h.ret ?? "").toLowerCase().includes(hq)
  }).filter(h => {
    if (!hookType) return true
    if (hookType === "async") return h.async === true
    if (hookType === "error") return !!h.error
    if (hookType === "duration") return (h.duration ?? 0) > 10
    return true
  })

  return (
    <NavigationStack>
      <List navigationTitle={`探针 (${sampler.probeResults.length})`} navigationBarTitleDisplayMode="inline">
        {/* 全局扫描 */}
        <Section header={<Text>全局扫描</Text>}>
          <Btn label={sampler.probeResults.length > 0 ? "重新扫描" : "🔍 扫描全局函数"} color="systemPurple" ontap={doProbe} />
          {probeStatus ? <Text font="caption" foregroundColor="systemGreen">{probeStatus}</Text> : null}
          <TextField title="搜索函数" value={probeSearch} onChanged={setProbeSearch} prompt="筛选路径…" />
          <HStack spacing={6}>
            {cats.map(c => (
              <Text key={c} font="caption"
                foregroundColor={catFilter === c ? catColor(c) : "tertiaryLabel"}
                onTapGesture={() => setCatFilter(catFilter === c ? "" : c)}>{c}</Text>
            ))}
          </HStack>
        </Section>

        {/* 分组结果 */}
        {filteredProbe().map(([cat, items]) => (
          <Section key={cat} header={
            <HStack spacing={6}>
              <Text foregroundColor={catColor(cat)}>{cat}</Text>
              <Text font="caption" foregroundColor="secondaryLabel">{items.length} 个</Text>
            </HStack>
          }>
            {items.map(p => (
              <HStack key={p.path} spacing={4}>
                <VStack spacing={0}>
                  <Text font="caption">{p.path.length > 40 ? p.path.slice(-40) : p.path}</Text>
                  {p.native ? <Text font="caption" foregroundColor="tertiaryLabel">[原生]</Text> : null}
                </VStack>
                <Spacer />
                <Text font="caption" foregroundColor="systemBlue"
                  onTapGesture={() => doHook(p.path)}>Hook</Text>
              </HStack>
            ))}
          </Section>
        ))}

        {/* 类 Hook */}
        <Section header={<Text>类原型 Hook</Text>}>
          <TextField title="类名" value={className} onChanged={setClassName} prompt="XMLHttpRequest" />
          <TextField title="方法列表" value={classMethods} onChanged={setClassMethods} prompt="open, send, setRequestHeader" />
          <Btn label="Hook 类" color="systemOrange" ontap={doClassHook} />
          {classResult ? <Text font="caption" foregroundColor="systemGreen">{classResult}</Text> : null}
        </Section>

        {/* 手动 Hook */}
        <Section header={<Text>手动 Hook</Text>}>
          <TextField title="函数路径" value={hookPath} onChanged={setHookPath} prompt="window.sign" />
          <Btn label="Hook" ontap={async () => { setHookResult(await sampler.hook(hookPath)); refresh() }} />
          {hookResult ? <Text font="caption" foregroundColor="systemGreen">{hookResult}</Text> : null}
        </Section>

        {/* 采样日志 */}
        <Section header={<Text>采样日志 ({filteredHooks.length}/{sampler.hookSamples.length})</Text>}
          footer={<Text>含堆栈、异步标记、错误、耗时</Text>}>
          <TextField title="筛选" value={hookSearch} onChanged={setHookSearch} prompt="按路径/返回值筛选…" />
          <HStack spacing={8}>
            {(["","async","error","duration"] as const).map(t => (
              <Text key={t} font="caption"
                foregroundColor={hookType === t ? "systemBlue" : "tertiaryLabel"}
                onTapGesture={() => setHookType(hookType === t ? "" : t)}>
                {t || "全部"}</Text>
            ))}
          </HStack>
          {filteredHooks.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无采样。</Text>
          ) : (
            filteredHooks.slice(-60).reverse().map((h, i) => (
              <VStack key={`h-${h.ts}-${h.path ?? ""}-${i}`} spacing={2}>
                <HStack spacing={6}>
                  <Text font="caption" foregroundColor="systemBlue">{h.path ?? h.url ?? "?"}</Text>
                  {h.async ? <Text font="caption" foregroundColor="systemOrange">async</Text> : null}
                  {h.error ? <Text font="caption" foregroundColor="systemRed">❌</Text> : null}
                  {h.duration ? <Text font="caption" foregroundColor="tertiaryLabel">{(h.duration).toFixed(0)}ms</Text> : null}
                  <Spacer />
                  <Text font="caption" foregroundColor="tertiaryLabel">{ts(h.ts)}</Text>
                </HStack>
                {h.args?.length ? <Text font="caption" foregroundColor="secondaryLabel">args: {h.args.join(" ║ ").slice(0, 300)}</Text> : null}
                {h.ret !== undefined && h.ret !== "undefined" ? <Text font="caption" foregroundColor="secondaryLabel">ret: {h.ret.slice(0, 400)}</Text> : null}
                {h.error ? <Text font="caption" foregroundColor="systemRed">err: {h.error}</Text> : null}
                {h.stack ? (
                  <VStack spacing={0}>
                    <Text font="caption" foregroundColor="tertiaryLabel" onTapGesture={() => setShowStack(showStack === h.ts ? 0 : h.ts)}>
                      {showStack === h.ts ? "▲ 堆栈" : "▼ 堆栈"}
                    </Text>
                    {showStack === h.ts ? <Text font="caption" foregroundColor="quaternaryLabel">{h.stack}</Text> : null}
                  </VStack>
                ) : null}
              </VStack>
            ))
          )}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 4: 源码 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function SourceTab({ refresh }: { refresh: () => void }) {
  const [scriptSearch, setScriptSearch] = useState("")
  const [grepPattern, setGrepPattern] = useState("")
  const [grepResults, setGrepResults] = useState<{ totalScripts: number; results: any[] }>({ totalScripts: 0, results: [] })
  const [grepStatus, setGrepStatus] = useState("")
  const [scriptUrl, setScriptUrl] = useState("")
  const [scriptContent, setScriptContent] = useState("")
  const [beautified, setBeautified] = useState("")
  const [showBeautified, setShowBeautified] = useState(false)
  const [codeEval, setCodeEval] = useState("")
  const [evalResult, setEvalResult] = useState("")

  const sq = scriptSearch.trim().toLowerCase()
  const filtered = sampler.scripts.filter(u => !sq || u.toLowerCase().includes(sq))

  async function doRefresh() { await sampler.refreshScripts(); refresh() }
  async function viewScript(url: string) {
    setScriptUrl(url)
    const f = await sampler.fetchScript(url)
    setScriptContent(f.content ?? (f.error ? "err: " + f.error : "无内容"))
    setBeautified("")
    setShowBeautified(false)
    refresh()
  }
  async function doBeautify() {
    if (!scriptContent) return
    setBeautified(await sampler.beautify(scriptContent))
    setShowBeautified(true)
    refresh()
  }
  async function doGrep() {
    setGrepStatus("搜索中…")
    const r = await sampler.searchScripts(grepPattern)
    setGrepResults(r)
    setGrepStatus(`找到 ${r.results.length} 处匹配 (${r.totalScripts} 个脚本)`)
    refresh()
  }
  async function doEval() {
    setEvalResult(await sampler.evalJS(codeEval))
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle="源码" navigationBarTitleDisplayMode="inline">
        {/* 跨脚本搜索 */}
        <Section header={<Text>跨脚本搜索</Text>}>
          <TextField title="正则" value={grepPattern} onChanged={setGrepPattern} prompt="encrypt|sign|AES" />
          <Btn label="搜索所有脚本" color="systemRed" ontap={doGrep} />
          {grepStatus ? <Text font="caption" foregroundColor="systemGreen">{grepStatus}</Text> : null}
          {grepResults.results.slice(0, 50).map((r, i) => (
            <VStack key={`grep-${i}`} spacing={2}
              onTapGesture={() => viewScript(r.src.startsWith("(inline") ? "" : r.src)}>
              <HStack spacing={4}>
                <Text font="caption" foregroundColor="systemRed">{r.match}</Text>
                <Text font="caption" foregroundColor="secondaryLabel">{r.src.slice(0, 50)}</Text>
              </HStack>
              <Text font="caption" foregroundColor="tertiaryLabel">{r.context.slice(0, 150)}</Text>
            </VStack>
          ))}
        </Section>

        {/* 脚本列表 */}
        <Section header={<Text>脚本 ({filtered.length}/{sampler.scripts.length})</Text>}>
          <TextField title="搜索" value={scriptSearch} onChanged={setScriptSearch} prompt="URL…" />
          <Btn label="刷新列表" ontap={doRefresh} />
          {filtered.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无脚本。</Text>
          ) : (
            filtered.slice(0, 80).map(url => (
              <VStack key={url} spacing={1} onTapGesture={() => viewScript(url)}>
                <Text font="caption" foregroundColor={url === scriptUrl ? "systemBlue" : "label"}>{shortPath(url)}</Text>
                <Text font="caption" foregroundColor="tertiaryLabel">{host(url)}</Text>
              </VStack>
            ))
          )}
        </Section>

        {/* 源码查看 */}
        {scriptContent ? (
          <Section header={<Text>源码 {scriptUrl ? shortPath(scriptUrl) : ""}</Text>}>
            <HStack spacing={12}>
              <Btn label="美化" color="systemOrange" ontap={doBeautify} />
              {beautified ? (
                <Btn label={showBeautified ? "原样" : "美化后"} color="systemBlue"
                  ontap={() => setShowBeautified(!showBeautified)} />
              ) : null}
            </HStack>
            <Text font="caption">{(showBeautified ? beautified : scriptContent).slice(0, 8000)}</Text>
          </Section>
        ) : null}

        {/* 控制台 */}
        <Section header={<Text>控制台</Text>}>
          <TextField title="JS 代码" value={codeEval} onChanged={setCodeEval} prompt="document.title" />
          <Btn label="执行" ontap={doEval} />
          {evalResult ? <Text font="caption" foregroundColor="systemGreen">{evalResult.slice(0, 2000)}</Text> : null}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 5: 取证 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function EvidenceTab({ refresh }: { refresh: () => void }) {
  const [storageDump, setStorageDump] = useState<Record<string, any>>({})
  const [globalDump, setGlobalDump] = useState<any[]>([])
  const [cookies, setCookies] = useState<any[]>([])
  const [exportPreview, setExportPreview] = useState("")
  const [storageSearch, setStorageSearch] = useState("")

  async function loadStorage() { setStorageDump(await sampler.dumpStorage()); refresh() }
  async function loadGlobals() { setGlobalDump(await sampler.dumpGlobals()); refresh() }
  async function loadCookies() { setCookies((await sampler.getCookies()).map((c: any) => ({ name: c.name, value: c.value, domain: c.domain }))); refresh() }

  async function doPreview() {
    const e = await sampler.buildEvidence()
    setExportPreview(JSON.stringify(e.summary, null, 2))
    refresh()
  }
  async function doExport() {
    const e = await sampler.buildEvidence()
    const p = FileManager.documentsDirectory + "/jsrv-evidence-" + Date.now() + ".json"
    FileManager.writeAsStringSync(p, JSON.stringify(e, null, 2))
    setExportPreview("已导出：" + p)
    refresh()
    await QL.previewURLs([p])
  }

  const ls = storageDump?.localStorage ?? {}
  const ss = storageDump?.sessionStorage ?? {}
  const sq = storageSearch.toLowerCase()
  function filterStorage(obj: Record<string, string>) {
    if (!sq) return Object.entries(obj).slice(0, 40)
    return Object.entries(obj).filter(([k]) => k.toLowerCase().includes(sq)).slice(0, 40)
  }

  return (
    <NavigationStack>
      <List navigationTitle="取证" navigationBarTitleDisplayMode="inline">
        {/* 存储 */}
        <Section header={<Text>存储</Text>}>
          <Btn label="读取所有存储" color="systemGreen" ontap={loadStorage} />
          <TextField title="搜索 Key" value={storageSearch} onChanged={setStorageSearch} prompt="token / key…" />
        </Section>

        <Section header={<Text>localStorage ({Object.keys(ls).length})</Text>}>
          {Object.keys(ls).length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">空 或 未加载</Text>
          ) : (
            filterStorage(ls).map(([k, v]) => (
              <VStack key={"ls-" + k} spacing={1}>
                <Text font="caption" foregroundColor="systemBlue">{k}</Text>
                <Text font="caption" foregroundColor="tertiaryLabel">{String(v).slice(0, 200)}</Text>
              </VStack>
            ))
          )}
        </Section>

        <Section header={<Text>sessionStorage ({Object.keys(ss).length})</Text>}>
          {Object.keys(ss).length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">空 或 未加载</Text>
          ) : (
            filterStorage(ss).map(([k, v]) => (
              <VStack key={"ss-" + k} spacing={1}>
                <Text font="caption" foregroundColor="systemBlue">{k}</Text>
                <Text font="caption" foregroundColor="tertiaryLabel">{String(v).slice(0, 200)}</Text>
              </VStack>
            ))
          )}
        </Section>

        {/* Cookie */}
        <Section header={<Text>Cookie ({cookies.length})</Text>}>
          <Btn label="读取 Cookie" ontap={loadCookies} />
          {cookies.map((c, i) => (
            <HStack key={"ck-" + i} spacing={4}>
              <Text font="caption" foregroundColor="systemBlue">{c.name}</Text>
              <Text font="caption" foregroundColor="secondaryLabel">{c.domain}</Text>
              <Spacer />
              <Text font="caption" foregroundColor="tertiaryLabel">{String(c.value).slice(0, 35)}</Text>
            </HStack>
          ))}
        </Section>

        {/* 全局变量 */}
        <Section header={<Text>全局变量 ({globalDump.length})</Text>}>
          <Btn label="审查全局变量" color="systemOrange" ontap={loadGlobals} />
          {globalDump.slice(0, 60).map((g, i) => (
            <VStack key={"g-" + i} spacing={1}>
              <HStack spacing={6}>
                <Text font="caption" foregroundColor="systemBlue">{g.key}</Text>
                <Text font="caption" foregroundColor="tertiaryLabel">{g.type}</Text>
                {g.len !== undefined ? <Text font="caption" foregroundColor="tertiaryLabel">{g.len} 项</Text> : null}
              </HStack>
              {g.value ? <Text font="caption" foregroundColor="secondaryLabel">{g.value.slice(0, 150)}</Text> : null}
              {g.keys?.length ? <Text font="caption" foregroundColor="secondaryLabel">{g.keys.join(", ")}</Text> : null}
            </VStack>
          ))}
        </Section>

        {/* 导出 */}
        <Section header={<Text>导出证据包</Text>}>
          <Btn label="预览摘要" ontap={doPreview} />
          {exportPreview ? <Text font="caption" foregroundColor="secondaryLabel">{exportPreview.slice(0, 1500)}</Text> : null}
          <Btn label="导出 JSON" color="systemGreen" ontap={doExport} />
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Root ────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function RootView() {
  const sel = useObservable<number>(0)
  const [, setRefresh] = useState(0)
  function refresh() { setRefresh(r => r + 1) }
  useEffect(() => {
    sampler.onChange = refresh
    return () => { sampler.onChange = undefined }
  }, [])

  return (
    <TabView selection={sel}>
      <Tab title="会话" systemImage="safari.fill" value={0}>
        <SessionTab refresh={refresh} />
      </Tab>
      <Tab title="网络" systemImage="arrow.left.arrow.right.circle.fill" value={1}>
        <NetworkTab refresh={refresh} />
      </Tab>
      <Tab title="探针" systemImage="scope" value={2}>
        <ProbeTab refresh={refresh} />
      </Tab>
      <Tab title="源码" systemImage="doc.text.magnifyingglass" value={3}>
        <SourceTab refresh={refresh} />
      </Tab>
      <Tab title="取证" systemImage="briefcase.fill" value={4}>
        <EvidenceTab refresh={refresh} />
      </Tab>
    </TabView>
  )
}

async function run() {
  await Navigation.present(<RootView />)
  sampler.dispose()
  Script.exit()
}

run()
