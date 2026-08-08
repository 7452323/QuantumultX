// JS 逆向采样工作台
// 基于 WebViewController 的真实浏览器采样工具：
//   · 加载目标页（真实 WebKit + 登录态）
//   · shouldAllowRequest 拦截记录全部网络请求
//   · evaluateJavaScript 注入 Hook 包裹目标函数，采样参数/返回值
//   · 提取页面已加载脚本源码
//   · 一键导出证据 JSON
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
import { Sampler } from "./sampler"

// 模块级单例：跨 Tab 共享页面、请求记录与采样数据
const sampler = new Sampler()

// ── 工具函数 ────────────────────────────────────────────────

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url.slice(0, 60)
  }
}

function pathOf(url: string): string {
  try {
    const u = new URL(url)
    return (u.pathname + u.search).slice(0, 120) || "/"
  } catch {
    return ""
  }
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
        <Section header={<Text>目标地址</Text>}>
          <TextField
            title="URL"
            value={url}
            onChanged={setUrl}
            prompt="https://example.com"
          />
          <TapButton label={sampler.loading ? "加载中…" : "打开页面"} onTap={openPage} />
          <TapButton
            label="重装 Hook 基础"
            color="systemOrange"
            onTap={async () => {
              setStatus(await sampler.installBase())
              refresh()
            }}
          />
        </Section>

        <Section header={<Text>浏览器</Text>} footer={<Text>{status}</Text>}>
          <VStack frame={{ height: 400 }} cornerRadius={12} background="secondarySystemBackground">
            <WebView controller={sampler.webView} />
          </VStack>
          <HStack spacing={12}>
            <TapButton label="← 后退" onTap={() => { try { sampler.webView.goBack() } catch {} }} />
            <TapButton label="前进 →" onTap={() => { try { sampler.webView.goForward() } catch {} }} />
            <TapButton label="刷新" onTap={() => { try { sampler.webView.reload() } catch {} }} />
            <TapButton
              label="清空请求"
              color="systemRed"
              onTap={() => { sampler.clearRequests(); refresh() }}
            />
          </HStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

// ── Tab 2: 请求 ─────────────────────────────────────────────

function RequestsTab({ refresh }: { refresh: () => void }) {
  const [selectedId, setSelectedId] = useState(0)
  const reqs = sampler.requests

  return (
    <NavigationStack>
      <List navigationTitle={`请求 (${reqs.length})`} navigationBarTitleDisplayMode="inline">
        <Section footer={<Text>shouldAllowRequest 拦截到的全部请求，点击展开详情</Text>}>
          {reqs.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无请求，先打开页面并操作。</Text>
          ) : (
            reqs.map((req) => (
              <VStack
                key={req.id}
                spacing={4}
                onTapGesture={() => setSelectedId(selectedId === req.id ? 0 : req.id)}
              >
                <HStack spacing={8}>
                  <Text font="caption" foregroundColor={methodColor(req.method)}>{req.method}</Text>
                  <VStack spacing={1}>
                    <Text font="caption">{host(req.url)}</Text>
                    <Text font="caption" foregroundColor="secondaryLabel">{pathOf(req.url)}</Text>
                  </VStack>
                  <Spacer />
                  <Text font="caption" foregroundColor="tertiaryLabel">{timeStr(req.ts)}</Text>
                </HStack>
                {selectedId === req.id ? (
                  <VStack spacing={4} padding={{ top: 6, bottom: 2 }}>
                    <Text font="caption" foregroundColor="secondaryLabel">{req.url}</Text>
                    <Text font="caption" foregroundColor="secondaryLabel">Headers: {JSON.stringify(req.headers)}</Text>
                    {req.body ? (
                      <Text font="caption" foregroundColor="secondaryLabel">Body: {req.body.slice(0, 1200)}</Text>
                    ) : null}
                    <Text font="caption" foregroundColor="tertiaryLabel">type: {req.navigationType}</Text>
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

// ── Tab 3: Hook ─────────────────────────────────────────────

function HookTab({ refresh }: { refresh: () => void }) {
  const [path, setPath] = useState("")
  const [result, setResult] = useState("")
  const samples = sampler.hookSamples

  async function doHook() {
    setResult(await sampler.hook(path))
    refresh()
  }

  return (
    <NavigationStack>
      <List navigationTitle={`Hook (${samples.length})`} navigationBarTitleDisplayMode="inline">
        <Section header={<Text>添加 Hook</Text>} footer={<Text>输入函数路径，例如 window.sign 或 window.a.b.sign。Hook 后回页面操作触发目标函数。</Text>}>
          <TextField
            title="函数路径"
            value={path}
            onChanged={setPath}
            prompt="window.sign"
          />
          <TapButton label="添加 Hook" onTap={doHook} />
          {result ? <Text font="caption" foregroundColor="systemGreen">{result}</Text> : null}
        </Section>

        <Section header={<Text>已 Hook</Text>}>
          {sampler.hookedPaths.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无</Text>
          ) : (
            sampler.hookedPaths.map((p) => (
              <Text key={p} font="caption" foregroundColor="systemBlue">{p}</Text>
            ))
          )}
        </Section>

        <Section header={<Text>采样记录（最新 50 条）</Text>}>
          {samples.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无采样。</Text>
          ) : (
            samples.slice(-50).reverse().map((s, i) => (
              <VStack key={`${s.ts}-${s.path}-${i}`} spacing={3}>
                <HStack spacing={8}>
                  <Text font="caption" foregroundColor="systemBlue">{s.path}</Text>
                  <Spacer />
                  <Text font="caption" foregroundColor="tertiaryLabel">{timeStr(s.ts)}</Text>
                </HStack>
                <Text font="caption" foregroundColor="secondaryLabel">args: {s.args.join(" ｜ ")}</Text>
                <Text font="caption" foregroundColor="secondaryLabel">ret: {s.ret}</Text>
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
  const [exportMsg, setExportMsg] = useState("")

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

  async function doExport() {
    const evidence = await sampler.buildEvidence()
    const path = FileManager.documentsDirectory + "/jsrv-evidence-" + Date.now() + ".json"
    FileManager.writeAsStringSync(path, JSON.stringify(evidence, null, 2))
    setExportMsg("已导出：" + path)
    refresh()
    await QuickLook.previewURLs([path])
  }

  return (
    <NavigationStack>
      <List navigationTitle="分析" navigationBarTitleDisplayMode="inline">
        <Section header={<Text>已加载脚本</Text>}>
          <TapButton label="刷新脚本列表" onTap={refreshScripts} />
          {sampler.scripts.length === 0 ? (
            <Text font="caption" foregroundColor="secondaryLabel">暂无脚本，先打开页面再刷新。</Text>
          ) : (
            sampler.scripts.map((url) => (
              <VStack key={url} spacing={2} onTapGesture={() => viewScript(url)}>
                <Text font="caption" foregroundColor={url === scriptUrl ? "systemBlue" : "label"}>{host(url)}{pathOf(url)}</Text>
              </VStack>
            ))
          )}
        </Section>

        {scriptContent ? (
          <Section header={<Text>脚本源码（前 5KB 预览）</Text>}>
            <Text font="caption" foregroundColor="secondaryLabel">{scriptUrl}</Text>
            <Text font="caption">{scriptContent.slice(0, 5000)}</Text>
          </Section>
        ) : null}

        <Section header={<Text>控制台</Text>} footer={<Text>执行任意 JS，支持语句；结果自动 JSON 化。</Text>}>
          <TextField
            title="JS 代码"
            value={code}
            onChanged={setCode}
            prompt="document.title"
          />
          <TapButton label="执行" onTap={doEval} />
          {evalResult ? <Text font="caption" foregroundColor="systemGreen">{evalResult.slice(0, 2000)}</Text> : null}
        </Section>

        <Section header={<Text>导出证据</Text>}>
          <TapButton
            label="导出 JSON 并预览"
            color="systemGreen"
            onTap={doExport}
          />
          {exportMsg ? <Text font="caption" foregroundColor="secondaryLabel">{exportMsg}</Text> : null}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ── Root ────────────────────────────────────────────────────

function RootView() {
  const selection = useObservable<number>(0)
  const [, setRefresh] = useState(0)
  function refresh() {
    setRefresh((r) => r + 1)
  }
  useEffect(() => {
    sampler.onChange = refresh
    return () => {
      sampler.onChange = undefined
    }
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
