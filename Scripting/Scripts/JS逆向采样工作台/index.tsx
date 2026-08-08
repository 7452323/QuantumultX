// JS 逆向采样工作台 v2.0
// 基于 WebViewController 的真实浏览器采样工具
import {
  Script,
  Navigation,
  NavigationStack,
  List,
  Section,
  Text,
  TextField,
  VStack,
  HStack,
  Spacer,
  useState,
  useEffect,
  useObservable,
  TabView,
  Tab,
  Label,
} from "scripting"
import { WebView } from "scripting"
import { Sampler, type HookSample } from "./sampler"

const sampler = new Sampler()

// ── 工具函数 ────────────────────────────────────────────────

function host(url: string): string {
  try { return new URL(url).host } catch { return url.slice(0, 60) }
}
function pathOf(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search).slice(0, 120) || "/" } catch { return "" }
}
function timeStr(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`
}
function methodColor(m: string): string {
  if (m === "GET") return "systemBlue"
  if (m === "POST") return "systemOrange"
  if (m === "PUT" || m === "PATCH") return "systemPurple"
  if (m === "DELETE") return "systemRed"
  return "secondaryLabel"
}
function statusColor(s: number): string {
  if (s >= 200 && s < 300) return "systemGreen"
  if (s >= 300 && s < 400) return "systemOrange"
  if (s >= 400 && s < 500) return "systemOrange"
  if (s >= 500) return "systemRed"
  return "secondaryLabel"
}

// ── TapButton（可复用轻触按钮）─────────────────────────────

function TapButton({ label, color = "systemBlue", onTap }: { label: string; color?: string; onTap: () => void }) {
  return (
    <VStack onTapGesture={onTap}>
      <HStack padding={{ top: 10, bottom: 10 }} spacing={8}>
        <Text foregroundColor={color}>{label}</Text>
        <Spacer />
        <Text foregroundColor={color}>›</Text>
      </HStack>
    </VStack>
  )
}

// ── Stats 栏（Tab 顶部摘要）─────────────────────────────────

function StatsBar({ labels }: { labels: string[] }) {
  return (
    <HStack padding={{ top: 6, bottom: 2 }} spacing={12}>
      {labels.map((l, i) => (
        <Text key={i} font="caption" foregroundColor="secondaryLabel">{l}</Text>
      ))}
    </HStack>
  )
}

// ── Tab 1: 会话 ─────────────────────────────────────────────

function SessionTab({ refresh }: { refresh: () => void }) {
  const [url, setUrl] = useState("")
  const [status, setStatus] = useState("未加载")

  async function openPage() {
    setStatus("加载中…")
    const msg = await sampler.open(url)
    setStatus(msg)
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle="会话" navigationBarTitleDisplayMode="inline">
        {/* URL 输入 */}
        <Section header={<Text>目标地址</Text>}>
          <TextField title="URL" value={url} onChanged={setUrl} prompt="https://example.com" />
          <TapButton label={sampler.loading ? "加载中…" : "打开页面"} onTap={openPage} />
          <TapButton label="重装 Hook 基础" color="systemOrange" onTap={async () => {
            setStatus(await sampler.installBase())
            refresh()
          }} />
          <TapButton label="安装响应跟踪" color="systemOrange" onTap={async () => {
            setStatus(await sampler.installResponseTracking())
            refresh()
          }} />
        </Section>

        {/* 浏览器 */}
        <Section header={<Text>浏览器</Text>} footer={<Text>{status}</Text>}>
          <VStack frame={{ height: 400 }} cornerRadius={12} background="secondarySystemBackground">
            <WebView controller={sampler.webView} />
          </VStack>
          <HStack spacing={12}>
            <TapButton label="← 后退" onTap={() => { try { sampler.webView.goBack() } catch {} }} />
            <TapButton label="前进 →" onTap={() => { try { sampler.webView.goForward() } catch {} }} />
            <TapButton label="刷新" onTap={() => { try { sampler.webView.reload() } catch {} }} />
            <TapButton label="清空" color="systemRed" onTap={() => { sampler.clearRequests(); sampler.clearHooks(); refresh() }} />
          </HStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

// ── Tab 2: 请求 ─────────────────────────────────────────────

function RequestsTab({ refresh }: { refresh: () => void }) {
  const [search, setSearch] = useState("")
  const [filterMethod, setFilterMethod] = useState("")
  const [selectedId, setSelectedId] = useState(0)

  const q = search.trim().toLowerCase()
  const reqs = sampler.requests.filter((r) => {
    if (filterMethod && r.method !== filterMethod) return false
    if (q && !r.url.toLowerCase().includes(q)) return false
    return true
  })

  // 响应匹配：按 URL + method 关联（最近匹配）
  function findResponse(url: string, method: string) {
    const rev = [...sampler.responses].reverse()
    return rev.find((r) => r.url === url && r.method === method)
  }

  return (
    <NavigationStack>
      <List navigationTitle={`请求 (${sampler.requests.length})`} navigationBarTitleDisplayMode="inline">
        {/* 统计 + 搜索 */}
        <Section>
          <StatsBar labels={[
            "请求 " + sampler.requests.length,
            "响应 " + sampler.responses.length,
            sampler.currentURL ? "已加载" : "未加载",
          ]} />
          <TextField title="搜索 URL" value={search} onChanged={setSearch} prompt="过滤 URL…" />
          <HStack spacing={8}>
            {["GET", "POST", "PUT", "DELETE", "XHR"].map((m) => (
              <Text key={m} font="caption" foregroundColor={filterMethod === m ? "systemBlue" : "tertiaryLabel"}
                onTapGesture={() => setFilterMethod(filterMethod === m ? "" : m)}>{m}</Text>
            ))}
            <Spacer />
            <Text font="caption" foregroundColor={search || filterMethod ? "systemOrange" : "tertiaryLabel"}
              onTapGesture={() => { setSearch(""); setFilterMethod("") }}>清除</Text>
          </HStack>
        </Section>

        {/* 请求列表 */}
        <Section footer={<Text>shouldAllowRequest 拦截（含 body）；滑动点击展开详情</Text>}>
          {reqs.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无匹配请求。</Text>
          ) : (
            reqs.slice(-200).reverse().map((req) => {
              const resp = findResponse(req.url, req.method)
              return (
                <VStack key={req.id} spacing={4} onTapGesture={() => setSelectedId(selectedId === req.id ? 0 : req.id)}>
                  <HStack spacing={8}>
                    <Text font="caption" foregroundColor={methodColor(req.method)}>{req.method}</Text>
                    <VStack spacing={1}>
                      <Text font="caption">{host(req.url)}</Text>
                      <Text font="caption" foregroundColor="secondaryLabel">{pathOf(req.url)}</Text>
                    </VStack>
                    <Spacer />
                    {resp ? (
                      <Text font="caption" foregroundColor={statusColor(resp.status)}>{resp.status}</Text>
                    ) : (
                      <Text font="caption" foregroundColor="tertiaryLabel">…</Text>
                    )}
                  </HStack>

                  {/* 展开详情 */}
                  {selectedId === req.id ? (
                    <VStack spacing={4} padding={{ top: 6, bottom: 2 }}>
                      <Text font="caption" foregroundColor="secondaryLabel">{req.url}</Text>
                      <Text font="caption" foregroundColor="secondaryLabel">Headers: {JSON.stringify(req.headers)}</Text>
                      {req.body ? (
                        <Text font="caption" foregroundColor="secondaryLabel">Req Body: {req.body.slice(0, 1200)}</Text>
                      ) : null}
                      {/* 关联响应 */}
                      {resp ? (
                        <VStack spacing={2} padding={{ top: 4 }}>
                          <HStack spacing={8}>
                            <Text font="caption" foregroundColor={statusColor(resp.status)}>{resp.status} {resp.statusText}</Text>
                            <Text font="caption" foregroundColor="tertiaryLabel">{timeStr(resp.ts)}</Text>
                          </HStack>
                          <Text font="caption" foregroundColor="secondaryLabel">Resp Headers: {JSON.stringify(resp.headers)}</Text>
                          {resp.body ? (
                            <Text font="caption" foregroundColor="secondaryLabel">Resp Body: {resp.body.slice(0, 1200)}</Text>
                          ) : null}
                        </VStack>
                      ) : null}
                      <Text font="caption" foregroundColor="tertiaryLabel">type: {req.navigationType}</Text>
                    </VStack>
                  ) : null}
                </VStack>
              )
            })
          )}
        </Section>

        {/* 响应列表 */}
        <Section header={<Text>响应记录 ({sampler.responses.length})</Text>}
          footer={<Text>页面内 fetch/XHR 拦截的响应</Text>}>
          {sampler.responses.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无响应，打开页面并开启响应跟踪。</Text>
          ) : (
            sampler.responses.slice(-100).reverse().map((r, i) => (
              <VStack key={`r-${r.ts}-${i}`} spacing={2}>
                <HStack spacing={8}>
                  <Text font="caption" foregroundColor={statusColor(r.status)}>{r.status}</Text>
                  <Text font="caption" foregroundColor={methodColor(r.method)}>{r.method}</Text>
                  <Text font="caption">{host(r.url)}{pathOf(r.url)}</Text>
                </HStack>
              </VStack>
            ))
          )}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ── Tab 3: Hook ─────────────────────────────────────────────

function HookTab({ refresh }: { refresh: () => void }) {
  const [path, setPath] = useState("")
  const [result, setResult] = useState("")
  const [filterPath, setFilterPath] = useState("")

  const fq = filterPath.trim().toLowerCase()
  const samples = sampler.hookSamples.filter((s) => {
    if (!fq) return true
    return (s.path ?? "").toLowerCase().includes(fq)
  })

  async function doHook() {
    setResult(await sampler.hook(path))
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle={`Hook (${sampler.hookSamples.length})`} navigationBarTitleDisplayMode="inline">
        {/* 添加 Hook */}
        <Section header={<Text>添加 Hook</Text>} footer={<Text>函数路径如 window.sign。Hook 后回页面操作触发。</Text>}>
          <TextField title="函数路径" value={path} onChanged={setPath} prompt="window.sign" />
          <TapButton label="添加 Hook" onTap={doHook} />
          {result ? <Text font="caption" foregroundColor="systemGreen">{result}</Text> : null}
        </Section>

        {/* 已 Hook */}
        <Section header={<Text>已 Hook ({sampler.hookedPaths.length})</Text>}>
          {sampler.hookedPaths.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无</Text>
          ) : (
            <VStack spacing={2}>
              {sampler.hookedPaths.map((p) => (
                <Text key={p} font="caption" foregroundColor="systemBlue">{p}</Text>
              ))}
            </VStack>
          )}
        </Section>

        {/* 采样记录 */}
        <Section header={<Text>采样 ({samples.length})</Text>}
          footer={<Text>最新 50 条。async=Promise 异步, error=异常</Text>}>
          <TextField title="筛选路径" value={filterPath} onChanged={setFilterPath} prompt="按函数路径筛选…" />
          <StatsBar labels={[
            "call " + sampler.hookSamples.filter((s) => s.kind === "call").length,
            "async " + sampler.hookSamples.filter((s) => s.async).length,
            "error " + sampler.hookSamples.filter((s) => s.error).length,
            "response " + sampler.hookSamples.filter((s) => s.kind === "response").length,
          ]} />
          {samples.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无采样。</Text>
          ) : (
            samples.slice(-50).reverse().map((s, i) => (
              <VStack key={`${s.ts}-${s.path ?? ""}-${i}`} spacing={3}>
                <HStack spacing={8}>
                  <Text font="caption" foregroundColor="systemBlue">{s.path ?? s.url ?? "?"}</Text>
                  {s.async ? <Text font="caption" foregroundColor="systemOrange">async</Text> : null}
                  {s.error ? <Text font="caption" foregroundColor="systemRed">err</Text> : null}
                  <Spacer />
                  <Text font="caption" foregroundColor="tertiaryLabel">{timeStr(s.ts)}</Text>
                </HStack>
                {s.args ? (<Text font="caption" foregroundColor="secondaryLabel">args: {s.args.join(" ｜ ")}</Text>) : null}
                {s.ret !== undefined ? (<Text font="caption" foregroundColor="secondaryLabel">ret: {s.ret}</Text>) : null}
                {s.error ? (<Text font="caption" foregroundColor="systemRed">err: {s.error}</Text>) : null}
                {s.body ? (<Text font="caption" foregroundColor="secondaryLabel">body: {s.body}</Text>) : null}
              </VStack>
            ))
          )}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ── Tab 4: 分析 ─────────────────────────────────────────────

function AnalyzeTab({ refresh }: { refresh: () => void }) {
  const [code, setCode] = useState("")
  const [evalResult, setEvalResult] = useState("")
  const [scriptUrl, setScriptUrl] = useState("")
  const [scriptContent, setScriptContent] = useState("")
  const [scriptSearch, setScriptSearch] = useState("")
  const [exportPreview, setExportPreview] = useState("")
  const [cookies, setCookies] = useState<{ name: string; value: string; domain: string }[]>([])

  const sq = scriptSearch.trim().toLowerCase()
  const filteredScripts = sampler.scripts.filter((u) => {
    if (!sq) return true
    return u.toLowerCase().includes(sq)
  })

  async function refreshScripts() {
    await sampler.refreshScripts()
    refresh()
  }
  async function viewScript(url: string) {
    setScriptUrl(url)
    const fetched = await sampler.fetchScript(url)
    setScriptContent(fetched.content ?? `（无内容）${fetched.error ? " error: " + fetched.error : ""}`)
    refresh()
  }
  async function doEval() {
    setEvalResult(await sampler.evalJS(code))
    refresh()
  }
  async function previewExport() {
    const evidence = await sampler.buildEvidence()
    setExportPreview(JSON.stringify(evidence.summary, null, 2))
    refresh()
  }
  async function doExport() {
    const evidence = await sampler.buildEvidence()
    const p = FileManager.documentsDirectory + "/jsrv-evidence-" + Date.now() + ".json"
    FileManager.writeAsStringSync(p, JSON.stringify(evidence, null, 2))
    setExportPreview("已导出：" + p)
    refresh()
    await QuickLook.previewURLs([p])
  }
  async function loadCookies() {
    const c = await sampler.getCookies()
    setCookies(c.map((x) => ({ name: x.name, value: x.value, domain: x.domain })))
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle="分析" navigationBarTitleDisplayMode="inline">
        {/* 脚本 */}
        <Section header={<Text>已加载脚本 ({filteredScripts.length}/{sampler.scripts.length})</Text>}>
          <TextField title="搜索脚本" value={scriptSearch} onChanged={setScriptSearch} prompt="按 URL 搜索…" />
          <TapButton label="刷新脚本列表" onTap={refreshScripts} />
          {filteredScripts.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无匹配脚本。</Text>
          ) : (
            filteredScripts.slice(0, 100).map((url) => (
              <VStack key={url} spacing={2} onTapGesture={() => viewScript(url)}>
                <Text font="caption" foregroundColor={url === scriptUrl ? "systemBlue" : "label"}>{host(url)}{pathOf(url)}</Text>
              </VStack>
            ))
          )}
        </Section>

        {/* 脚本源码预览 */}
        {scriptContent ? (
          <Section header={<Text>源码预览（前 5KB）</Text>}>
            <Text font="caption" foregroundColor="secondaryLabel">{scriptUrl}</Text>
            <Text font="caption">{scriptContent.slice(0, 5000)}</Text>
          </Section>
        ) : null}

        {/* Cookie */}
        <Section header={<Text>Cookie ({cookies.length})</Text>}>
          <TapButton label="读取 Cookie" onTap={loadCookies} />
          {cookies.map((c, i) => (
            <HStack key={`ck-${i}`} spacing={4}>
              <Text font="caption" foregroundColor="systemBlue">{c.name}</Text>
              <Text font="caption" foregroundColor="secondaryLabel">{c.domain}</Text>
              <Spacer />
              <Text font="caption" foregroundColor="tertiaryLabel">{c.value.slice(0, 40)}</Text>
            </HStack>
          ))}
        </Section>

        {/* 控制台 */}
        <Section header={<Text>控制台</Text>} footer={<Text>执行任意 JS；结果自动 JSON 化</Text>}>
          <TextField title="JS 代码" value={code} onChanged={setCode} prompt="document.title" />
          <TapButton label="执行" onTap={doEval} />
          {evalResult ? <Text font="caption" foregroundColor="systemGreen">{evalResult.slice(0, 2000)}</Text> : null}
        </Section>

        {/* 导出 */}
        <Section header={<Text>导出证据</Text>}>
          <TapButton label="预览摘要" color="systemBlue" onTap={previewExport} />
          {exportPreview ? <Text font="caption" foregroundColor="secondaryLabel">{exportPreview}</Text> : null}
          <TapButton label="导出 JSON 并预览" color="systemGreen" onTap={doExport} />
        </Section>
      </List>
    </NavigationStack>
  )
}

// ── Root ────────────────────────────────────────────────────

function RootView() {
  const selection = useObservable<number>(0)
  const [, setRefresh] = useState(0)
  function refresh() { setRefresh((r) => r + 1) }
  useEffect(() => {
    sampler.onChange = refresh
    return () => { sampler.onChange = undefined }
  }, [])

  return (
    <TabView selection={selection}>
      <Tab title="会话" systemImage="safari.fill" value={0}>
        <SessionTab refresh={refresh} />
      </Tab>
      <Tab title="请求" systemImage="arrow.up.arrow.down.circle.fill" value={1}>
        <RequestsTab refresh={refresh} />
      </Tab>
      <Tab title="Hook" systemImage="curlybraces" value={2}>
        <HookTab refresh={refresh} />
      </Tab>
      <Tab title="分析" systemImage="doc.text.magnifyingglass" value={3}>
        <AnalyzeTab refresh={refresh} />
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
