// JSReverse Workbench v4.0
// 全自动注入 + 全按钮加载态 + 请求重放 + 一键取证
import {
  Script, Navigation, NavigationStack,
  List, Section, Text, TextField, VStack, HStack, Spacer,
  TabView, Tab, useState, useEffect, useObservable, RoundedRectangle,
} from "scripting"
import { WebView } from "scripting"
import { Sampler, type ProbeCategory, type ResponseRecord } from "./sampler"

const sampler = new Sampler()
const QL = QuickLook

// ── 工具 ────────────────────────────────────────────────────

function host(u: string) { try { return new URL(u).host } catch { return u.slice(0, 50) } }
function sp(u: string) { try { const x = new URL(u); return (x.pathname + x.search).slice(0, 80) || "/" } catch { return u.slice(0, 80) } }
function tms(ms: number) { const d = new Date(ms); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0") + ":" + String(d.getSeconds()).padStart(2, "0") }
function mc(m: string) { const m2 = m.toUpperCase(); if (m2 === "GET") return "systemBlue"; if (m2 === "POST" || m2 === "WS↑") return "systemOrange"; if (m2 === "PUT" || m2 === "PATCH" || m2 === "WS↓") return "systemPurple"; if (m2 === "DELETE") return "systemRed"; return "secondaryLabel" }
function sc(s: number) { if (s >= 200 && s < 300) return "systemGreen"; if (s >= 400 && s < 500) return "systemOrange"; if (s >= 500 || s === 0) return "systemRed"; return "secondaryLabel" }
function cc(c: string) { switch (c) { case "crypto": return "systemRed"; case "network": return "systemBlue"; case "encoding": return "systemOrange"; case "auth": return "systemPurple"; case "storage": return "systemGreen"; case "native": return "systemTeal"; default: return "secondaryLabel" } }

// ── 组件 ────────────────────────────────────────────────────

function Btn({ label, color = "systemBlue", ontap, disabled }: { label: string; color?: string; ontap: () => void; disabled?: boolean }) {
  return (
    <VStack onTapGesture={disabled ? undefined : ontap}>
      <HStack padding={{ top: 9, bottom: 9 }} spacing={8}>
        <Text foregroundStyle={(disabled ? "tertiaryLabel" : color) as any}>{label}</Text>
        <Spacer />
        <Text foregroundStyle={(disabled ? "tertiaryLabel" : color) as any}>›</Text>
      </HStack>
    </VStack>
  )
}

function Stat({ labels }: { labels: string[] }) {
  return (
    <HStack padding={{ top: 4, bottom: 2 }} spacing={10}>
      {labels.map((l, i) => <Text key={i} font="caption" foregroundStyle="secondaryLabel">{l}</Text>)}
    </HStack>
  )
}

// 通用加载包装
function useLoader(refresh: () => void) {
  const [busy, setBusy] = useState("")
  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key)
    const msg = await fn()
    setBusy("")
    refresh()
    return msg
  }
  return { busy, run }
}

// ══════════════════════════════════════════════════════════════
// Tab 1: 会话 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function SessionTab({ refresh }: { refresh: () => void }) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState("输入 URL 开始")
  const { busy, run } = useLoader(refresh)

  async function open() {
    setStatus("加载中…")
    const msg = await sampler.open(url)
    setStatus(msg)
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle="会话" navigationBarTitleDisplayMode="inline">
        <Section header={<Text>目标页面</Text>} footer={<Text foregroundStyle={sampler.autoSetupDone ? "systemGreen" : "secondaryLabel"}>{status}</Text>}>
          <TextField title="URL" value={url} onChanged={setUrl} prompt="https://example.com" />
          <Btn label={sampler.loading ? "⏳ 加载中…" : "打开并自动取证"} ontap={open} disabled={sampler.loading} />
        </Section>

        <Section header={<Text>浏览器</Text>}>
          <VStack frame={{ height: 380 }} background={<RoundedRectangle cornerRadius={12} fill="secondarySystemBackground" />}>
            <WebView controller={sampler.webView} />
          </VStack>
          <HStack spacing={10}>
            <Btn label="← 后退" ontap={() => { try { sampler.webView.goBack() } catch {} }} />
            <Btn label="→ 前进" ontap={() => { try { sampler.webView.goForward() } catch {} }} />
            <Btn label="⟳ 刷新" ontap={() => { try { sampler.webView.reload() } catch {} }} />
            <Btn label="清空" color="systemRed" ontap={() => { sampler.clearRequests(); sampler.clearHooks(); refresh() }} />
          </HStack>
        </Section>

        <Section header={<Text>手动操作</Text>}>
          <Btn label={busy === "reprobe" ? "⏳ 扫描中…" : "🔍 重新扫描函数"}
            ontap={async () => setStatus(await run("reprobe", () => sampler.reprobe()))} disabled={busy !== ""} color="systemPurple" />
          <Btn label={busy === "forensic" ? "⏳ 取证中…" : "🕵️ 刷新取证"}
            ontap={async () => setStatus(await run("forensic", () => sampler.refreshForensics()))} disabled={busy !== ""} color="systemOrange" />
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
  const { busy, run } = useLoader(refresh)
  const [replayResult, setReplayResult] = useState("")

  const q = search.trim().toLowerCase()
  const reqs = sampler.requests.filter(r => {
    if (mFilter && r.method.toUpperCase() !== mFilter.toUpperCase()) return false
    if (q && !r.url.toLowerCase().includes(q)) return false
    return true
  })

  function findResp(url: string, method: string) {
    const rev = [...sampler.responses].reverse()
    return rev.find(r => r.url === url && r.method === method) || rev.find(r => r.url === url)
  }

  async function replay(id: number) {
    const r = await run("replay", async () => {
      const res = await sampler.replayRequest(id)
      const body = res.content ? ("\nBody(" + (res.length ?? 0) + "B): " + (res.content || "").slice(0, 1000)) : ""
      setReplayResult("Status: " + (res.status ?? "?") + " " + (res.error ?? "") + body)
      return "状态: " + (res.status ?? "?")
    })
    return r
  }

  return (
    <NavigationStack>
      <List navigationTitle={`网络 (${sampler.requests.length})`} navigationBarTitleDisplayMode="inline">
        <Section>
          <Stat labels={[sampler.requests.length + " 请求", sampler.responses.length + " 响应"]} />
        </Section>

        <Section header={<Text>筛选</Text>}>
          <TextField title="搜索" value={search} onChanged={setSearch} prompt="URL / 域名…" />
          <HStack spacing={8}>
            {["GET", "POST", "PUT", "DELETE", "WS"].map(m => (
              <Text key={m} font="caption" foregroundStyle={mFilter === m ? "systemBlue" : "tertiaryLabel"}
                onTapGesture={() => setMF(mFilter === m ? "" : m)}>{m}</Text>
            ))}
          </HStack>
        </Section>

        <Section header={<Text>请求</Text>}>
          {reqs.length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">暂无匹配。打开目标页面后自动采集。</Text>
          ) : reqs.slice(-200).reverse().map(req => {
            const resp = findResp(req.url, req.method)
            const open = selId === req.id
            return (
              <VStack key={req.id} spacing={3} onTapGesture={() => setSelId(open ? 0 : req.id)}>
                <HStack spacing={6}>
                  <Text font="caption" foregroundStyle={mc(req.method)}>{req.method}</Text>
                  <VStack spacing={0}>
                    <Text font="caption">{host(req.url)}</Text>
                    <Text font="caption" foregroundStyle="secondaryLabel">{sp(req.url)}</Text>
                  </VStack>
                  <Spacer />
                  {resp ? <Text font="caption" foregroundStyle={sc(resp.status)}>{resp.status}</Text> : <Text font="caption" foregroundStyle="tertiaryLabel">…</Text>}
                </HStack>
                {open ? (
                  <VStack spacing={3} padding={{ top: 4, bottom: 2 }}>
                    <Text font="caption" foregroundStyle="secondaryLabel">{req.url}</Text>
                    {req.body ? <Text font="caption" foregroundStyle="tertiaryLabel">Req: {req.body.slice(0, 600)}</Text> : null}
                    {resp ? (
                      <VStack spacing={2}>
                        <HStack spacing={8}>
                          <Text font="caption" foregroundStyle={sc(resp.status)}>{resp.status} {resp.statusText}</Text>
                          {resp.duration ? <Text font="caption" foregroundStyle="tertiaryLabel">{resp.duration}ms</Text> : null}
                        </HStack>
                        {resp.body ? <Text font="caption" foregroundStyle="tertiaryLabel">Body: {resp.body.slice(0, 800)}</Text> : null}
                      </VStack>
                    ) : null}
                    <HStack spacing={12}>
                      <Text font="caption" foregroundStyle="systemOrange"
                        onTapGesture={() => replay(req.id)}>🔄 重放</Text>
                    </HStack>
                    {replayResult && selId === req.id ? (
                      <Text font="caption" foregroundStyle="systemGreen">{replayResult}</Text>
                    ) : null}
                  </VStack>
                ) : null}
              </VStack>
            )
          })}
        </Section>

        <Section header={<Text>响应 ({sampler.responses.length})</Text>} footer={<Text>含 fetch/XHR/WebSocket</Text>}>
          {sampler.responses.length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">暂无。</Text>
          ) : sampler.responses.slice(-100).reverse().map((r, i) => (
            <VStack key={`r-${r.ts}-${i}`} spacing={2}>
              <HStack spacing={6}>
                <Text font="caption" foregroundStyle={sc(r.status)}>{r.status || r.statusText}</Text>
                <Text font="caption" foregroundStyle={mc(r.method)}>{r.method}</Text>
                <Text font="caption">{r.body ? r.body.slice(0, 100) : sp(r.url)}</Text>
                {r.duration ? <Text font="caption" foregroundStyle="tertiaryLabel">{r.duration}ms</Text> : null}
              </HStack>
            </VStack>
          ))}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 3: 探针 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function ProbeTab({ refresh }: { refresh: () => void }) {
  const [hookPath, setHookPath] = useState("")
  const [hookResult, setHookResult] = useState("")
  const [className, setClassName] = useState("")
  const [classMethods, setClassMethods] = useState("")
  const [classResult, setClassResult] = useState("")
  const [hookSearch, setHookSearch] = useState("")
  const [showStack, setShowStack] = useState(0)
  const [cFilter, setCFilter] = useState("")
  const { busy, run } = useLoader(refresh)

  const hq = hookSearch.trim().toLowerCase()
  const hooks = sampler.hookSamples.filter(h => {
    if (!hq) return true
    return (h.path ?? "").toLowerCase().includes(hq) || (h.ret ?? "").toLowerCase().includes(hq)
  }).filter(h => {
    if (cFilter === "async") return h.async === 1
    if (cFilter === "error") return !!h.error
    if (cFilter === "slow") return (h.duration ?? 0) > 10
    return true
  })

  return (
    <NavigationStack>
      <List navigationTitle={`探针 (${sampler.probeResults.length})`} navigationBarTitleDisplayMode="inline">
        {/* 分类函数 */}
        <Section header={<Text>已发现函数（按分类）</Text>} footer={<Text>打开页面后自动扫描。点击 Hook 即时生效。</Text>}>
          {sampler.probeByCategory.length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">未扫描。请先打开目标页面。</Text>
          ) : sampler.probeByCategory.map(cat => (
            <Section key={cat.category} header={
              <HStack spacing={6}>
                <Text foregroundStyle={cc(cat.category)}>{cat.category}</Text>
                <Text font="caption" foregroundStyle="secondaryLabel">{cat.count}</Text>
              </HStack>
            }>
              {cat.top20.map(p => (
                <HStack key={p.path} spacing={4}>
                  <VStack spacing={0}>
                    <Text font="caption">{p.path.length > 45 ? "…" + p.path.slice(-45) : p.path}</Text>
                    {p.native ? <Text font="caption" foregroundStyle="tertiaryLabel">[native]</Text> : null}
                  </VStack>
                  <Spacer />
                  <Text font="caption" foregroundStyle="systemBlue"
                    onTapGesture={async () => { setHookResult(await sampler.hook(p.path)); refresh() }}>Hook</Text>
                </HStack>
              ))}
            </Section>
          ))}
        </Section>

        {/* 类 Hook */}
        <Section header={<Text>类原型 Hook</Text>}>
          <TextField title="类名" value={className} onChanged={setClassName} prompt="XMLHttpRequest" />
          <TextField title="方法（逗号分隔）" value={classMethods} onChanged={setClassMethods} prompt="open, send" />
          <Btn label={busy === "classhook" ? "⏳" : "Hook 类方法"} ontap={async () => {
            setClassResult(await run("classhook", () => sampler.hookClass(className, classMethods.split(",").map(s => s.trim()).filter(Boolean))))
          }} disabled={busy !== ""} color="systemOrange" />
          {classResult ? <Text font="caption" foregroundStyle={classResult.startsWith("✅") ? "systemGreen" : "systemRed"}>{classResult}</Text> : null}
        </Section>

        {/* 手动 Hook */}
        <Section header={<Text>手动 Hook</Text>}>
          <TextField title="函数路径" value={hookPath} onChanged={setHookPath} prompt="window.sign" />
          <Btn label={busy === "hook" ? "⏳" : "Hook"} ontap={async () => {
            setHookResult(await run("hook", () => sampler.hook(hookPath)))
          }} disabled={busy !== ""} />
          {hookResult ? <Text font="caption" foregroundStyle={hookResult.startsWith("✅") ? "systemGreen" : "systemRed"}>{hookResult}</Text> : null}
        </Section>

        {/* 采样日志 */}
        <Section header={<Text>采样日志 ({hooks.length}/{sampler.hookSamples.length})</Text>}>
          <TextField title="筛选" value={hookSearch} onChanged={setHookSearch} prompt="路径/返回值…" />
          <HStack spacing={8}>
            {(["", "async", "error", "slow"] as const).map(t => (
              <Text key={t} font="caption" foregroundStyle={cFilter === t ? "systemBlue" : "tertiaryLabel"}
                onTapGesture={() => setCFilter(cFilter === t ? "" : t)}>{t || "全部"}</Text>
            ))}
          </HStack>
          {hooks.length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">暂无。Hook 函数后操作页面触发。</Text>
          ) : hooks.slice(-50).reverse().map((h, i) => (
            <VStack key={`h-${h.ts}-${h.path ?? ""}-${i}`} spacing={2}>
              <HStack spacing={6}>
                <Text font="caption" foregroundStyle="systemBlue">{h.path ?? "?"}</Text>
                {h.async ? <Text font="caption" foregroundStyle="systemOrange">async</Text> : null}
                {h.error ? <Text font="caption" foregroundStyle="systemRed">err</Text> : null}
                {h.duration ? <Text font="caption" foregroundStyle="tertiaryLabel">{(h.duration).toFixed(0)}ms</Text> : null}
                <Spacer /><Text font="caption" foregroundStyle="tertiaryLabel">{tms(h.ts)}</Text>
              </HStack>
              {h.args?.length ? <Text font="caption" foregroundStyle="secondaryLabel">args: {h.args.join(" ║ ").slice(0, 300)}</Text> : null}
              {h.ret !== undefined && h.ret !== "undefined" ? <Text font="caption" foregroundStyle="secondaryLabel">ret: {h.ret.slice(0, 400)}</Text> : null}
              {h.error ? <Text font="caption" foregroundStyle="systemRed">{h.error}</Text> : null}
              {h.stack ? (
                <VStack spacing={0}>
                  <Text font="caption" foregroundStyle="tertiaryLabel" onTapGesture={() => setShowStack(showStack === h.ts ? 0 : h.ts)}>
                    {showStack === h.ts ? "▲ 堆栈" : "▼ 堆栈"}</Text>
                  {showStack === h.ts ? <Text font="caption" foregroundStyle="quaternaryLabel">{h.stack}</Text> : null}
                </VStack>
              ) : null}
            </VStack>
          ))}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 4: 源码 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function SourceTab({ refresh }: { refresh: () => void }) {
  const [search, setSearch] = useState("")
  const [grep, setGrep] = useState("")
  const [grepRes, setGrepRes] = useState<any[]>([])
  const [grepTotal, setGrepTotal] = useState(0)
  const [grepMsg, setGrepMsg] = useState("")
  const [scriptUrl, setScriptUrl] = useState("")
  const [scriptSrc, setScriptSrc] = useState("")
  const [beautified, setBeautified] = useState("")
  const [showBeaut, setShowBeaut] = useState(false)
  const [jsCode, setJsCode] = useState("")
  const [jsResult, setJsResult] = useState("")
  const { busy, run } = useLoader(refresh)

  const sq = search.trim().toLowerCase()
  const filtered = sampler.scripts.filter(u => !sq || u.toLowerCase().includes(sq))

  async function doGrep() {
    const r = await sampler.searchScripts(grep)
    setGrepRes(r.results)
    setGrepTotal(r.totalScripts)
    setGrepMsg(`${r.results.length} 处匹配 (${r.totalScripts} 脚本)`)
    refresh()
  }

  async function viewScript(url: string) {
    setScriptUrl(url)
    setBeautified("")
    setShowBeaut(false)
    const f = await sampler.fetchScript(url)
    setScriptSrc(f.content ?? (f.error ? "err: " + f.error : "无内容"))
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle="源码" navigationBarTitleDisplayMode="inline">
        {/* 跨脚本搜索 */}
        <Section header={<Text>跨脚本搜索</Text>}>
          <TextField title="正则" value={grep} onChanged={setGrep} prompt="encrypt|sign|AES|md5" />
          <Btn label={busy === "grep" ? "⏳" : "搜索所有脚本"} ontap={async () => { setGrepMsg(await run("grep", async () => { await doGrep(); return "ok" })) }}
            disabled={busy !== ""} color="systemRed" />
          {grepMsg ? <Text font="caption" foregroundStyle="systemGreen">{grepMsg}</Text> : null}
          {grepRes.slice(0, 50).map((r: any, i: number) => (
            <VStack key={`g-${i}`} spacing={2}
              onTapGesture={() => r.src.startsWith("(inline") ? {} : viewScript(r.src)}>
              <HStack spacing={4}>
                <Text font="caption" foregroundStyle="systemRed">{r.match}</Text>
                <Text font="caption" foregroundStyle="secondaryLabel">{r.src.slice(0, 50)}</Text>
              </HStack>
              <Text font="caption" foregroundStyle="tertiaryLabel">{r.ctx.slice(0, 200)}</Text>
            </VStack>
          ))}
        </Section>

        {/* 脚本列表 */}
        <Section header={<Text>脚本 ({filtered.length}/{sampler.scripts.length})</Text>}>
          <TextField title="搜索" value={search} onChanged={setSearch} prompt="URL…" />
          <Btn label={busy === "refresh" ? "⏳" : "刷新列表"} ontap={async () => {
            setSearch(await run("refresh", () => sampler.refreshScripts()))
          }} disabled={busy !== ""} />
          {filtered.length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">暂无。</Text>
          ) : filtered.slice(0, 60).map(url => (
            <VStack key={url} spacing={1} onTapGesture={() => viewScript(url)}>
              <Text font="caption" foregroundStyle={url === scriptUrl ? "systemBlue" : "label"}>{sp(url)}</Text>
              <Text font="caption" foregroundStyle="tertiaryLabel">{host(url)}</Text>
            </VStack>
          ))}
        </Section>

        {/* 源码 */}
        {scriptSrc ? (
          <Section header={<Text>源码 {scriptUrl ? sp(scriptUrl) : ""}</Text>}>
            <HStack spacing={12}>
              <Btn label={busy === "beautify" ? "⏳" : "美化"} ontap={async () => {
                setBeautified(await run("beautify", async () => { const b = await sampler.beautify(scriptSrc); setBeautified(b); setShowBeaut(true); return "ok" }))
              }} disabled={busy !== ""} color="systemOrange" />
              {beautified ? (
                <Btn label={showBeaut ? "原文" : "美化后"} ontap={() => setShowBeaut(!showBeaut)} color="systemBlue" />
              ) : null}
            </HStack>
            <Text font="caption">{(showBeaut ? beautified : scriptSrc).slice(0, 10000)}</Text>
          </Section>
        ) : null}

        {/* 控制台 */}
        <Section header={<Text>控制台</Text>}>
          <TextField title="JS" value={jsCode} onChanged={setJsCode} prompt="document.title" />
          <Btn label={busy === "eval" ? "⏳" : "执行"} ontap={async () => {
            setJsResult(await run("eval", async () => await sampler.evalJS(jsCode)))
          }} disabled={busy !== ""} />
          {jsResult ? <Text font="caption" foregroundStyle="systemGreen">{jsResult.slice(0, 2000)}</Text> : null}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Tab 5: 取证 ────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════

function EvidenceTab({ refresh }: { refresh: () => void }) {
  const [cookies, setCookies] = useState<any[]>([])
  const [exportPreview, setExportPreview] = useState("")
  const [storageSearch, setStorageSearch] = useState("")
  const { busy, run } = useLoader(refresh)

  const ls = sampler.storageDump?.localStorage ?? {}
  const ss = sampler.storageDump?.sessionStorage ?? {}
  const globals = sampler.globalsDump ?? []
  const sq = storageSearch.toLowerCase()

  function filterObj(o: Record<string, string>, limit = 30) {
    const entries = Object.entries(o).filter(([k]) => !sq || k.toLowerCase().includes(sq))
    return entries.slice(0, limit)
  }

  return (
    <NavigationStack>
      <List navigationTitle="取证" navigationBarTitleDisplayMode="inline">
        <Section header={<Text>存储</Text>}>
          <Btn label={busy === "forensic" ? "⏳" : "刷新存储数据"} ontap={async () => {
            setCookies((await sampler.getCookies()).map((c: any) => ({ name: c.name, value: c.value, domain: c.domain })))
            await run("forensic", () => sampler.refreshForensics())
          }} disabled={busy !== ""} color="systemGreen" />
          <TextField title="搜索 Key" value={storageSearch} onChanged={setStorageSearch} prompt="token / auth / key…" />
        </Section>

        <Section header={<Text>localStorage ({Object.keys(ls).length})</Text>}>
          {Object.keys(ls).length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">空</Text>
          ) : filterObj(ls).map(([k, v]) => (
            <VStack key={"ls-" + k} spacing={1}>
              <Text font="caption" foregroundStyle="systemBlue">{k}</Text>
              <Text font="caption" foregroundStyle="tertiaryLabel">{String(v).slice(0, 200)}</Text>
            </VStack>
          ))}
        </Section>

        <Section header={<Text>sessionStorage ({Object.keys(ss).length})</Text>}>
          {Object.keys(ss).length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">空</Text>
          ) : filterObj(ss).map(([k, v]) => (
            <VStack key={"ss-" + k} spacing={1}>
              <Text font="caption" foregroundStyle="systemBlue">{k}</Text>
              <Text font="caption" foregroundStyle="tertiaryLabel">{String(v).slice(0, 200)}</Text>
            </VStack>
          ))}
        </Section>

        <Section header={<Text>Cookie ({cookies.length})</Text>}>
          <Btn label={busy === "cookies" ? "⏳" : "读取"} ontap={async () => {
            setCookies((await sampler.getCookies()).map((c: any) => ({ name: c.name, value: c.value, domain: c.domain })))
            refresh()
          }} disabled={busy !== ""} />
          {cookies.map((c: any, i: number) => (
            <HStack key={"ck-" + i} spacing={4}>
              <Text font="caption" foregroundStyle="systemBlue">{c.name}</Text>
              <Text font="caption" foregroundStyle="secondaryLabel">{c.domain}</Text>
              <Spacer />
              <Text font="caption" foregroundStyle="tertiaryLabel">{String(c.value).slice(0, 35)}</Text>
            </HStack>
          ))}
        </Section>

        <Section header={<Text>全局变量 ({globals.length})</Text>}>
          {globals.slice(0, 40).map((g: any, i: number) => (
            <VStack key={"g-" + i} spacing={1}>
              <HStack spacing={6}>
                <Text font="caption" foregroundStyle="systemBlue">{g.key}</Text>
                <Text font="caption" foregroundStyle="tertiaryLabel">{g.type}</Text>
                {g.len !== undefined ? <Text font="caption" foregroundStyle="tertiaryLabel">{g.len}项</Text> : null}
              </HStack>
              {g.val ? <Text font="caption" foregroundStyle="secondaryLabel">{g.val.slice(0, 120)}</Text> : null}
              {g.keys?.length ? <Text font="caption" foregroundStyle="secondaryLabel">{g.keys.join(", ")}</Text> : null}
            </VStack>
          ))}
        </Section>

        <Section header={<Text>导出</Text>}>
          <Btn label={busy === "preview" ? "⏳" : "预览摘要"} ontap={async () => {
            const e = await sampler.buildEvidence()
            setExportPreview(JSON.stringify(e.summary, null, 2))
            refresh()
          }} disabled={busy !== ""} />
          {exportPreview ? <Text font="caption" foregroundStyle="secondaryLabel">{exportPreview.slice(0, 1500)}</Text> : null}
          <Btn label="导出 JSON" ontap={async () => {
            const e = await sampler.buildEvidence()
            const p = FileManager.documentsDirectory + "/jsrv-v4-" + Date.now() + ".json"
            FileManager.writeAsStringSync(p, JSON.stringify(e, null, 2))
            setExportPreview("已导出: " + p)
            refresh()
            await QL.previewURLs([p])
          }} color="systemGreen" />
        </Section>
      </List>
    </NavigationStack>
  )
}

// ══════════════════════════════════════════════════════════════
// Root
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
      <Tab title="会话" systemImage="safari.fill" value={0}><SessionTab refresh={refresh} /></Tab>
      <Tab title="网络" systemImage="arrow.left.arrow.right.circle.fill" value={1}><NetworkTab refresh={refresh} /></Tab>
      <Tab title="探针" systemImage="scope" value={2}><ProbeTab refresh={refresh} /></Tab>
      <Tab title="源码" systemImage="doc.text.magnifyingglass" value={3}><SourceTab refresh={refresh} /></Tab>
      <Tab title="取证" systemImage="briefcase.fill" value={4}><EvidenceTab refresh={refresh} /></Tab>
    </TabView>
  )
}

async function run() {
  await Navigation.present(<RootView />)
  sampler.dispose()
  Script.exit()
}
run()
