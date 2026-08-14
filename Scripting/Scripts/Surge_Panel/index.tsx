import {
  AreaChart,
  Button,
  Divider,
  fetch,
  Form,
  HStack,
  Label,
  List,
  Navigation,
  NavigationStack,
  Section,
  Script,
  Spacer,
  Text,
  TabView,
  TextField,
  Toggle,
  VStack,
  WebView,
  useEffect,
  useRef,
  useState,
} from "scripting"

type Config = {
  apiBase: string
  apiKey: string
  refreshSeconds: number
  allowInsecure: boolean
}

type CounterMap = Record<string, number>

type CoreSnapshot = {
  timestamp: number
  source: "metrics" | "traffic"
  uptime: number
  memory: number
  activeRequests: number
  dnsCacheEntries: number
  activeBans: number
  policyIn: CounterMap
  policyOut: CounterMap
  interfaceIn: CounterMap
  interfaceOut: CounterMap
  build: Record<string, string>
}

type TrafficRow = {
  name: string
  download: number
  upload: number
  total: number
}

type PolicyNode = {
  name: string
  latency: number
}

type PolicyGroup = {
  name: string
  type: string
  selected: string
  optionCount: number
  policies: string[]
  nodes: PolicyNode[]
  latency: number
}

type HistoryPoint = {
  t: number
  memory: number
  download: number
  upload: number
  active: number
}

type PanelModel = {
  connected: boolean
  error: string
  updatedAt: number
  source: string
  mode: string
  uptime: number
  memory: number
  downloadSpeed: number
  uploadSpeed: number
  activeRequests: number
  dnsCacheEntries: number
  activeBans: number
  virtualIPs: number
  failedRequests: number
  rejectedRequests: number
  temporaryRules: number
  nodes: TrafficRow[]
  interfaces: TrafficRow[]
  groups: PolicyGroup[]
  history: HistoryPoint[]
  engine: { version: string; build: string; system: string }
  config: Config
}

type Metric = { name: string; labels: Record<string, string>; value: number }

const APP_VERSION = "1.5.1"
const CONFIG_KEY = "surge-panel.config.v1"
const HISTORY_KEY = "surge-panel.history.v1"
const HISTORY_INTERVAL_MS = 60_000
const HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000
const DEFAULT_CONFIG: Config = {
  apiBase: "http://127.0.0.1:6171",
  apiKey: "",
  refreshSeconds: 5,
  allowInsecure: false,
}

function normalizeBaseURL(value: string): string {
  return value.trim().replace(/\/+$/, "")
}

function normalizeRefreshSeconds(value: unknown): number {
  const options = [5, 10, 15, 20, 25, 30]
  const seconds = Number(value || 5)
  return options.reduce((best, option) => Math.abs(option - seconds) < Math.abs(best - seconds) ? option : best, 5)
}

function normalizeConfig(value: Partial<Config> | null): Config {
  return {
    apiBase: normalizeBaseURL(value?.apiBase || DEFAULT_CONFIG.apiBase),
    apiKey: String(value?.apiKey || ""),
    refreshSeconds: normalizeRefreshSeconds(value?.refreshSeconds),
    allowInsecure: Boolean(value?.allowInsecure) || /^http:\/\/(127\.0\.0\.1|localhost)(?::\d+)?$/i.test(normalizeBaseURL(value?.apiBase || DEFAULT_CONFIG.apiBase)),
  }
}

function loadConfig(): Config | null {
  const saved = Storage.get<Partial<Config>>(CONFIG_KEY)
  if (!saved) return null
  const apiKey = Keychain.get(CONFIG_KEY) || ""
  return normalizeConfig({ ...saved, apiKey })
}

function saveConfig(config: Config): void {
  Storage.set(CONFIG_KEY, {
    apiBase: config.apiBase,
    refreshSeconds: config.refreshSeconds,
    allowInsecure: config.allowInsecure,
  })
  Keychain.set(CONFIG_KEY, config.apiKey)
}

function loadHistory(): HistoryPoint[] {
  const saved = Storage.get<HistoryPoint[]>(HISTORY_KEY)
  return Array.isArray(saved) ? saved : []
}

function saveHistory(history: HistoryPoint[]): void {
  Storage.set(HISTORY_KEY, history)
}

async function apiText(config: Config, path: string, method = "GET", body?: string, timeout = 10): Promise<string> {
  const separator = path.includes("?") ? "&" : "?"
  const authenticatedPath = `${path}${separator}x-key=${encodeURIComponent(config.apiKey)}`
  const response = await fetch(config.apiBase + authenticatedPath, {
    method,
    headers: {
      "X-Key": config.apiKey,
      Accept: "*/*",
      "Cache-Control": "no-cache",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body,
    timeout,
    allowInsecureRequest: config.allowInsecure,
    debugLabel: "Surge Panel",
  })
  if (!response.ok) throw new Error(`HTTP ${response.status} · ${path}`)
  return response.text()
}

async function apiJSON(config: Config, path: string, method = "GET", body?: string): Promise<unknown> {
  const text = await apiText(config, path, method, body)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`接口未返回 JSON · ${path}`)
  }
}

async function testPolicyGroup(config: Config, groupName: string): Promise<unknown> {
  const text = await apiText(config, "/v1/policy_groups/test", "POST", JSON.stringify({ group_name: groupName }), 60)
  try { return JSON.parse(text) } catch { return null }
}

async function testPolicies(config: Config, policyNames: string[]): Promise<unknown> {
  const text = await apiText(config, "/v1/policies/test", "POST", JSON.stringify({
    policy_names: policyNames,
    url: "http://www.gstatic.com/generate_204",
  }), 60)
  try { return JSON.parse(text) } catch { return null }
}

async function safeJSON(config: Config, path: string): Promise<unknown | null> {
  try {
    return await apiJSON(config, path)
  } catch {
    return null
  }
}

async function captureCore(config: Config): Promise<CoreSnapshot> {
  try {
    const metrics = parsePrometheus(await apiText(config, "/v1/metrics"))
    if (!metrics.some(item => ["surgeuptimeseconds", "surgeuptimesecond"].includes(normalizeKey(item.name)))) {
      throw new Error("当前版本没有返回 Surge Metrics")
    }
    return coreFromMetrics(metrics)
  } catch (metricsError) {
    try {
      return coreFromTraffic(await apiJSON(config, "/v1/traffic"))
    } catch {
      throw metricsError
    }
  }
}

async function fetchDetails(config: Config): Promise<Record<string, unknown | null>> {
  const [outbound, recent, dns, rules, groups, testResults, benchmarkResults, policies] = await Promise.all([
    safeJSON(config, "/v1/outbound"),
    safeJSON(config, "/v1/requests/recent"),
    safeJSON(config, "/v1/dns"),
    safeJSON(config, "/v1/rules"),
    safeJSON(config, "/v1/policy_groups"),
    safeJSON(config, "/v1/policy_groups/test_results"),
    safeJSON(config, "/v1/policies/benchmark_results"),
    safeJSON(config, "/v1/policies"),
  ])
  return { outbound, recent, dns, rules, groups, testResults, benchmarkResults, policies }
}

function parsePrometheus(text: string): Metric[] {
  const output: Metric[] = []
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue
    const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{(.*)\})?\s+([^\s]+)$/)
    const value = Number(match?.[3])
    if (!match || !Number.isFinite(value)) continue
    output.push({ name: match[1], labels: parseLabels(match[2] || ""), value })
  }
  return output
}

function parseLabels(source: string): Record<string, string> {
  const labels: Record<string, string> = {}
  const regex = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"])*)"/g
  for (let match; (match = regex.exec(source));) {
    labels[match[1]] = match[2].replace(/\\n/g, "\n").replace(/\\"/g, '"').replace(/\\\\/g, "\\")
  }
  return labels
}

function metricValue(metrics: Metric[], names: string | string[], fallback = 0): number {
  const accepted = Array.isArray(names) ? names : [names]
  const normalized = accepted.map(normalizeKey)
  return metrics.find(item => normalized.includes(normalizeKey(item.name)))?.value ?? fallback
}

function labeledMetric(metrics: Metric[], names: string | string[], label: string): CounterMap {
  const accepted = Array.isArray(names) ? names : [names]
  return metrics.reduce<CounterMap>((output, row) => {
    if (accepted.some(name => normalizeKey(name) === normalizeKey(row.name))) output[String(row.labels[label] || row.labels.name || "未知")] = row.value
    return output
  }, {})
}

function directionalMetric(metrics: Metric[], scope: "interface" | "policy", direction: "in" | "out"): CounterMap {
  const label = scope
  const legacy = normalizeKey(`surge_${scope}_${direction}_bytes_total`)
  const genericNames = [`surge_${scope}_bytes_total`, `surge${scope}_bytes_total`, `surge_${scope}_bytestotal`].map(normalizeKey)
  const aliases = direction === "in" ? ["in", "download", "received", "rx"] : ["out", "upload", "sent", "tx"]
  return metrics.reduce<CounterMap>((output, row) => {
    const rowDirection = String(row.labels.direction || row.labels.type || "").toLowerCase()
    const rowName = normalizeKey(row.name)
    if (rowName === legacy || (genericNames.includes(rowName) && aliases.includes(rowDirection))) {
      const key = String(row.labels[label] || row.labels.name || row.labels.policy || row.labels.interface || "未知")
      output[key] = Number(row.value || 0)
    }
    return output
  }, {})
}

function coreFromMetrics(metrics: Metric[]): CoreSnapshot {
  const build = metrics.find(item => item.name === "surge_build_info")
  return {
    timestamp: Date.now(), source: "metrics",
    uptime: metricValue(metrics, ["surge_uptime_seconds", "surgeuptime_seconds"]),
    memory: metricValue(metrics, ["surge_memory_bytes", "surgememorybytes"]),
    activeRequests: metricValue(metrics, ["surge_active_requests", "surge_in_flight_requests"]),
    dnsCacheEntries: metricValue(metrics, ["surge_dns_cache_entries", "surge_dns_cache_size"]),
    activeBans: metricValue(metrics, ["surge_active_bans", "surge_unauthorized_access_bans"]),
    policyIn: directionalMetric(metrics, "policy", "in"),
    policyOut: directionalMetric(metrics, "policy", "out"),
    interfaceIn: directionalMetric(metrics, "interface", "in"),
    interfaceOut: directionalMetric(metrics, "interface", "out"),
    build: build?.labels || {},
  }
}

function coreFromTraffic(traffic: unknown): CoreSnapshot {
  const root = traffic as Record<string, unknown>
  const uptimeRaw = deepNumber(root, ["uptime", "uptimeseconds", "runningtime", "elapsed"])
  const startTime = deepNumber(root, ["starttime", "startedat", "starttimestamp"])
  const uptime = uptimeRaw || (startTime ? Math.max(0, (Date.now() - (startTime > 100000000000 ? startTime : startTime * 1000)) / 1000) : 0)
  return {
    timestamp: Date.now(), source: "traffic", uptime,
    memory: deepNumber(root, ["memorybytes", "memoryusage", "memory", "physicalmemory"]),
    activeRequests: deepNumber(root, ["activerequests", "activeconnections", "currentconnections"]),
    dnsCacheEntries: deepNumber(root, ["dnscacheentries", "dnscachecount"]), activeBans: 0,
    policyIn: {}, policyOut: {},
    interfaceIn: { total: deepNumber(root, ["bytesin", "downloadbytes", "inboundbytes", "receivedbytes"]) },
    interfaceOut: { total: deepNumber(root, ["bytesout", "uploadbytes", "outboundbytes", "sentbytes"]) },
    build: {},
  }
}

function deepNumber(root: unknown, names: string[]): number {
  const wanted = names.map(normalizeKey)
  const visited = new Set<object>()
  const visit = (value: unknown, depth: number): number => {
    if (!value || typeof value !== "object" || depth > 7 || visited.has(value)) return 0
    visited.add(value)
    for (const [key, child] of Object.entries(value)) {
      if (wanted.includes(normalizeKey(key)) && Number.isFinite(Number(child))) return Number(child)
      const nested = visit(child, depth + 1)
      if (nested) return nested
    }
    return 0
  }
  return visit(root, 0)
}

function normalizeKey(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/g, "") }
function totalCounter(values: CounterMap): number { return Object.values(values).reduce((sum, value) => sum + value, 0) }

function deriveSpeed(previous: CoreSnapshot | null, current: CoreSnapshot): { download: number; upload: number } {
  if (!previous || current.timestamp <= previous.timestamp || (previous.uptime && current.uptime < previous.uptime)) return { download: 0, upload: 0 }
  const elapsed = Math.max(0.25, (current.timestamp - previous.timestamp) / 1000)
  const beforeIn = totalCounter(previous.policyIn) || totalCounter(previous.interfaceIn)
  const beforeOut = totalCounter(previous.policyOut) || totalCounter(previous.interfaceOut)
  const nowIn = totalCounter(current.policyIn) || totalCounter(current.interfaceIn)
  const nowOut = totalCounter(current.policyOut) || totalCounter(current.interfaceOut)
  return { download: Math.max(0, (nowIn - beforeIn) / elapsed), upload: Math.max(0, (nowOut - beforeOut) / elapsed) }
}

function buildTrafficRows(inbound: CounterMap, outbound: CounterMap): TrafficRow[] {
  const names = new Set([...Object.keys(inbound), ...Object.keys(outbound)])
  return [...names].map(name => {
    const download = Number(inbound[name] || 0)
    const upload = Number(outbound[name] || 0)
    return { name, download, upload, total: download + upload }
  }).filter(item => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 30)
}

function extractArray(root: unknown, keys: string[]): Record<string, unknown>[] {
  if (Array.isArray(root)) return root.filter(isRecord)
  if (!isRecord(root)) return []
  for (const key of keys) {
    const candidate = root[key]
    if (Array.isArray(candidate)) return candidate.filter(isRecord)
  }
  for (const value of Object.values(root)) if (Array.isArray(value)) return value.filter(isRecord)
  return []
}

function isRecord(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value) }

function hasMeaningfulError(error: unknown): boolean {
  if (!error) return false
  if (typeof error === "string") return !["", "none", "null", "nil", "no error", "success", "0"].includes(error.trim().toLowerCase())
  if (Array.isArray(error)) return error.length > 0
  return typeof error === "object" ? Object.keys(error).length > 0 : Boolean(error)
}

function countVirtualIPs(dns: unknown): number {
  const text = JSON.stringify(dns || {})
  const ipv4 = text.match(/198\.(?:18|19)\.(?:\d{1,3})\.(?:\d{1,3})/g) || []
  const ipv6 = text.match(/fd00:6152:[0-9a-f:]+/gi) || []
  return new Set([...ipv4, ...ipv6]).size
}

function collectLatencies(root: unknown): CounterMap {
  const output: CounterMap = {}
  const visited = new Set<object>()
  const add = (name: unknown, value: unknown): void => {
    const match = String(value ?? "").match(/-?\d+(?:\.\d+)?/)
    const delay = match ? Number(match[0]) : Number.NaN
    const key = String(name || "").trim()
    if (key && Number.isFinite(delay) && delay > 0) output[key] = delay
  }
  const visit = (value: unknown, parent = "", depth = 0): void => {
    if (value == null || depth > 7) return
    if (typeof value === "number" || (typeof value === "string" && /\d/.test(value))) { add(parent, value); return }
    if (Array.isArray(value)) { value.forEach(item => visit(item, parent, depth + 1)); return }
    if (!isRecord(value) || visited.has(value)) return
    visited.add(value)
    const name = String(value.policy || value.name || value.policyName || value.policy_name || value.proxy || value.node || parent)
    const delay = value.delay ?? value.latency ?? value.rtt ?? value.score ?? value.result ?? value.responseTime ?? value.response_time ?? value.time ?? value.ms
    if (delay != null) add(name, delay)
    Object.entries(value).forEach(([key, child]) => {
      if (typeof child === "number" || (typeof child === "string" && /\d/.test(child))) add(key, child)
      else visit(child, key, depth + 1)
    })
  }
  visit(root)
  return output
}

function resultEntries(value: unknown): Array<[string, unknown]> {
  if (Array.isArray(value)) return value.flatMap(item => {
    if (isRecord(item)) {
      const name = String(item.name ?? item.policy ?? item.policyName ?? item.policy_name ?? item.server ?? item.title ?? "")
      if (name) return [[name, item] as [string, unknown]]
    }
    return resultEntries(item)
  })
  if (!isRecord(value)) return []
  if (isRecord(value.data)) return Object.entries(value.data)
  const results = value.results ?? value.policies ?? value.items ?? value.result ?? value.scores
  if (Array.isArray(results)) return results.flatMap(item => resultEntries(item))
  if (isRecord(results)) return Object.entries(results)
  return Object.entries(value)
}

function readPolicyDelay(value: unknown): number {
  if (typeof value === "number") return value >= 0 ? value : 0
  if (typeof value === "string") {
    const match = value.match(/-?\d+(?:\.\d+)?/)
    const number = match ? Number(match[0]) : Number.NaN
    return Number.isFinite(number) && number >= 0 ? number : 0
  }
  if (!isRecord(value) || value.testing === 1 || value.testing === true) return 0
  if (typeof value.lastTestScoreInMS === "number") {
    if (value.lastTestDate === 0 && value.lastTestScoreInMS === 0 && !value.lastTestErrorMessage) return 0
    if (value.lastTestScoreInMS >= 0) return value.lastTestScoreInMS
  }
  const nested = value.testResult ?? value.lastTestResult ?? value.lastTest ?? value.benchmark
  const nestedDelay = readPolicyDelay(nested)
  if (nestedDelay > 0) return nestedDelay
  for (const key of ["delay", "latency", "rtt", "tcp", "receive", "time", "duration", "value", "latestDelay", "lastDelay", "lastTestScore", "score", "testScore", "available"]) {
    const delay = readPolicyDelay(value[key])
    if (delay > 0) return delay
  }
  return 0
}

function policyDelay(testResults: unknown, groupName: string, policyName: string, option?: unknown): number {
  const roots = Array.isArray(testResults) ? testResults : [testResults]
  for (const root of roots) {
    if (!isRecord(root)) continue
    const groupResults = root[groupName] ?? root[encodeURIComponent(groupName)]
    const lineHash = isRecord(option) ? String(option.lineHash || "") : ""
    for (const source of [groupResults, root]) {
      const entries = new Map(resultEntries(source))
      const result = entries.get(policyName) ?? (lineHash ? entries.get(lineHash) : undefined)
      const delay = readPolicyDelay(result)
      if (delay > 0) return delay
    }
  }
  return readPolicyDelay(option)
}

function normalizeGroups(raw: unknown, testResults: unknown, policiesRaw: unknown): PolicyGroup[] {
  const latency = collectLatencies(testResults)
  const seen = new Set<string>()
  const groups: PolicyGroup[] = []
  const namesFrom = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.map(item => String(isRecord(item) ? (item.name || item.policy || item.policyName || item.policy_name || item.proxy || item.title || item.id || "") : item).trim()).filter(Boolean)
  }
  const addGroup = (nameValue: unknown, optionsValue: unknown, selectedValue: unknown, typeValue = "策略组"): void => {
    const name = String(nameValue || "").trim()
    if (!name || seen.has(name)) return
    const options = Array.isArray(optionsValue) ? optionsValue : []
    const policies = namesFrom(options)
    const selected = String(selectedValue || "").trim()
    if (!policies.length && !selected) return
    seen.add(name)
    groups.push({
      name,
      type: String(typeValue || "策略组"),
      selected: selected || "自动选择",
      optionCount: policies.length,
      policies,
      nodes: policies.map((policy, index) => ({ name: policy, latency: policyDelay(testResults, name, policy, options[index]) || Number(latency[policy] || 0) })),
      latency: policyDelay(testResults, name, selected) || Number(latency[selected] || latency[name] || 0),
    })
  }
  const addValue = (value: unknown, fallback = ""): void => {
    if (Array.isArray(value)) {
      addGroup(fallback, value, "", "策略组")
      return
    }
    if (!isRecord(value)) {
      if (fallback && typeof value === "string") addGroup(fallback, [], value, "策略组")
      return
    }
    const name = value.name || value.groupName || value.group || fallback
    const options = value.policies || value.options || value.available || value.members || value.proxies || value.children
    const selected = value.selected || value.selection || value.current || value.policy || value.now || value.default
    addGroup(String(name || ""), options, selected, String(value.type || value.groupType || value.kind || "策略组"))
  }
  if (Array.isArray(raw)) raw.forEach(item => addValue(item))
  else if (isRecord(raw)) {
    const list = raw.groups || raw.policyGroups || raw.policy_groups || raw.items || raw.data
    if (Array.isArray(list)) list.forEach(item => addValue(item))
    Object.entries(raw).forEach(([key, value]) => addValue(value, key))
  }
  if (!groups.length) {
    const list = extractArray(policiesRaw, ["policies", "items", "data"])
    if (list.length) groups.push({ name: "可用策略", type: "策略", selected: "", optionCount: list.length, policies: namesFrom(list), nodes: namesFrom(list).map(name => ({ name, latency: Number(latency[name] || 0) })), latency: 0 })
  }
  return groups.slice(0, 40)
}

function updateHistory(history: HistoryPoint[], current: CoreSnapshot, speed: { download: number; upload: number }): HistoryPoint[] {
  const cutoff = Date.now() - HISTORY_RETENTION_MS
  const next = history.filter(point => point.t >= cutoff)
  const last = next[next.length - 1]
  if (!last || current.timestamp - last.t >= HISTORY_INTERVAL_MS) {
    next.push({ t: current.timestamp, memory: current.memory, download: speed.download, upload: speed.upload, active: current.activeRequests })
  }
  return next.slice(-1440)
}

function buildModel(current: CoreSnapshot, previous: CoreSnapshot | null, details: Record<string, unknown | null>, history: HistoryPoint[], config: Config): PanelModel {
  const speed = deriveSpeed(previous, current)
  const nextHistory = updateHistory(history, current, speed)
  const recent = extractArray(details.recent, ["requests", "recent", "records", "items", "data"])
  const rules = extractArray(details.rules, ["rules", "items", "data"])
  const failed = recent.filter(item => item.failed === true || item.success === false || hasMeaningfulError(item.error || item.errorMessage || item.failedReason)).length
  const rejected = recent.filter(item => String(item.policyName || item.policy || item.outbound || "").toUpperCase().includes("REJECT")).length
  const temporaryRules = rules.filter(item => item.temporary === true || item.isTemporary === true || /temporary|临时/i.test(String(item.type || item.source || ""))).length
  const outbound = isRecord(details.outbound) ? details.outbound : {}
  return {
    connected: true, error: "", updatedAt: current.timestamp, source: current.source, mode: String(outbound.mode || "rule").toLowerCase(),
    uptime: current.uptime, memory: current.memory, downloadSpeed: speed.download, uploadSpeed: speed.upload,
    activeRequests: current.activeRequests, dnsCacheEntries: current.dnsCacheEntries, activeBans: current.activeBans,
    virtualIPs: countVirtualIPs(details.dns), failedRequests: failed, rejectedRequests: rejected, temporaryRules,
    nodes: buildTrafficRows(current.policyIn, current.policyOut), interfaces: buildTrafficRows(current.interfaceIn, current.interfaceOut),
    groups: normalizeGroups(details.groups, [details.testResults, details.benchmarkResults], details.policies), history: nextHistory,
    engine: { version: current.build.version || "-", build: current.build.build || "-", system: current.build.system || "iOS" }, config,
  }
}

function offlineModel(config: Config, error: unknown, history: HistoryPoint[]): PanelModel {
  return {
    connected: false, error: readableError(error), updatedAt: Date.now(), source: "offline", mode: "rule", uptime: 0, memory: 0,
    downloadSpeed: 0, uploadSpeed: 0, activeRequests: 0, dnsCacheEntries: 0, activeBans: 0, virtualIPs: 0,
    failedRequests: 0, rejectedRequests: 0, temporaryRules: 0, nodes: [], interfaces: [], groups: [], history,
    engine: { version: "-", build: "-", system: "iOS" }, config,
  }
}

function readableError(error: unknown): string {
  const message = String(error instanceof Error ? error.message : error || "无法连接 Surge Core")
  if (/401|403|unauthor/i.test(message)) return "API 密钥不正确，Surge 拒绝了访问。"
  if (/timed?\s*out|timeout/i.test(message)) return "连接 Surge Core 超时，请确认 HTTP API 已启用。"
  if (/network|offline|hostname|server|connect/i.test(message)) return "无法连接 Surge Core，请检查 API 地址、Surge 是否启动以及本地网络权限。"
  return message
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum
}

function formatBytes(value: number, suffix = ""): string {
  let number = Math.max(0, Number(value || 0))
  const units = ["B", "KB", "MB", "GB", "TB"]
  let index = 0
  while (number >= 1024 && index < units.length - 1) { number /= 1024; index += 1 }
  const digits = index === 0 || number >= 100 ? 0 : number >= 10 ? 1 : 2
  return `${number.toFixed(digits)} ${units[index]}${suffix}`
}

function formatUptime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds || 0))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  return days ? `${days}d ${hours}h` : hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

function modeName(mode: string): string {
  return mode === "direct" ? "直连模式" : mode === "proxy" ? "全局代理" : "规则模式"
}

function timestamp(value: number): string {
  return new Date(value).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
}

function SetupView({ initial, onSave }: { initial: Config; onSave: (config: Config) => void }) {
  const [apiBase, setApiBase] = useState(initial.apiBase)
  const [apiKey, setApiKey] = useState(initial.apiKey)
  const [refresh, setRefresh] = useState(String(initial.refreshSeconds))
  const [allowInsecure, setAllowInsecure] = useState(initial.allowInsecure)
  const [error, setError] = useState("")

  const save = () => {
    const next = normalizeConfig({ apiBase, apiKey, refreshSeconds: Number(refresh), allowInsecure })
    if (!/^https?:\/\//i.test(next.apiBase) || !next.apiKey) {
      setError("请填写 HTTP/HTTPS 地址及 Surge HTTP API 密钥。")
      return
    }
    saveConfig(next)
    onSave(next)
  }

  return <NavigationStack><Form>
    <Section title="Surge HTTP API">
      <TextField title="API 地址" value={apiBase} onChanged={setApiBase} prompt="http://127.0.0.1:6171" />
      <TextField title="API 密钥" value={apiKey} onChanged={setApiKey} />
      <TextField title="刷新间隔（2-60 秒）" value={refresh} onChanged={setRefresh} />
      <Toggle title="允许 HTTP 连接" value={allowInsecure} onChanged={setAllowInsecure} />
    </Section>
    <Section title="安全说明"><Text>密钥保存在 iOS 钥匙串；建议 Surge HTTP API 仅监听 127.0.0.1。</Text></Section>
    {error ? <Section><Text>{error}</Text></Section> : null}
    <Section><Button title="保存并连接" systemImage="checkmark" action={save} /></Section>
  </Form></NavigationStack>
}

function valueRow(label: string, value: string) {
  return <HStack><Text>{label}</Text><Spacer /><Text>{value}</Text></HStack>
}

function Header({ title, subtitle, action }: { title: string; subtitle: string; action?: () => void }) {
  return <Section title={title}><HStack><Text>{subtitle}</Text><Spacer />{action ? <Button title="刷新" systemImage="arrow.clockwise" action={action} /> : null}</HStack></Section>
}

function MetricGrid({ model }: { model: PanelModel }) {
  return <Section title="实时状态">
    <HStack><VStack alignment="leading"><Text>内存</Text><Text>{formatBytes(model.memory)}</Text><Text>Surge 进程</Text></VStack><Spacer /><VStack alignment="leading"><Text>运行时长</Text><Text>{formatUptime(model.uptime)}</Text><Text>自 {model.engine.system} 启动</Text></VStack></HStack>
    <Divider />
    <HStack><VStack alignment="leading"><Text>实时下载</Text><Text>{formatBytes(model.downloadSpeed, "/s")}</Text><Text>全部接口</Text></VStack><Spacer /><VStack alignment="leading"><Text>活动连接</Text><Text>{String(Math.round(model.activeRequests))}</Text><Text>失败 {model.failedRequests} · 拒绝 {model.rejectedRequests}</Text></VStack></HStack>
  </Section>
}

function OverviewPage({ model, refresh, isRefreshing }: { model: PanelModel; refresh: () => void; isRefreshing: boolean }) {
  const marks = model.history.map(point => ({ label: new Date(point.t), value: point.memory / 1048576, interpolationMethod: "linear" as const }))
  return <List tabItem={<Label title="总览" systemImage="square.grid.2x2" />}>
    <Header title="Surge Panel" subtitle={model.connected ? `更新于 ${timestamp(model.updatedAt)} · ${modeName(model.mode)}` : model.error} action={refresh} />
    <MetricGrid model={model} />
    <Section title="内存占用">
      <HStack><Text>{marks.length ? `${marks.at(-1)?.value.toFixed(1)} MB` : "等待采样"}</Text><Spacer /><Text>{isRefreshing ? "刷新中" : `${marks.length} 点`}</Text></HStack>
      {marks.length > 1 ? <AreaChart marks={marks} frame={{ height: 190 }} chartLegend="hidden" /> : <Text>运行一分钟后开始记录趋势</Text>}
    </Section>
    <Section title="引擎健康">
      <HStack><VStack><Text>{Math.round(model.dnsCacheEntries)}</Text><Text>DNS 缓存</Text></VStack><Spacer /><VStack><Text>{model.virtualIPs}</Text><Text>虚拟 IP</Text></VStack><Spacer /><VStack><Text>{model.temporaryRules}</Text><Text>临时规则</Text></VStack><Spacer /><VStack><Text>{Math.round(model.activeBans)}</Text><Text>封禁</Text></VStack></HStack>
    </Section>
  </List>
}

function PoliciesPage({ model }: { model: PanelModel }) {
  return <List tabItem={<Label title="策略" systemImage="point.3.connected.trianglepath.dotted" />}>
    <Header title="策略" subtitle="当前模式与策略组选择" />
    <Section title="出站模式">{valueRow(modeName(model.mode), model.connected ? "Core 在线" : "Core 离线")}</Section>
    <Section title="策略组">
      {model.groups.length ? model.groups.map(group => <VStack key={group.name} alignment="leading"><HStack><Text>{group.name}</Text><Spacer /><Text>{group.type}</Text></HStack><HStack><Text>{group.selected}</Text><Spacer /><Text>{group.latency ? `${Math.round(group.latency)} ms` : `${group.optionCount} 个选项`}</Text></HStack></VStack>) : <Text>当前接口未返回策略组详情</Text>}
    </Section>
  </List>
}

function isDirectTraffic(row: TrafficRow): boolean {
  return /(^|\s)DIRECT(?:$|[-_\s])|直连/i.test(row.name)
}

function TrafficPage({ model }: { model: PanelModel }) {
  const [expanded, setExpanded] = useState(false)
  const rows = model.nodes.length ? model.nodes : model.interfaces
  const totals = rows.reduce((result, row) => ({ download: result.download + row.download, upload: result.upload + row.upload }), { download: 0, upload: 0 })
  const split = rows.reduce((result, row) => { result[isDirectTraffic(row) ? "direct" : "proxy"] += row.total; return result }, { direct: 0, proxy: 0 })
  const grandTotal = split.direct + split.proxy
  const visible = expanded ? rows : rows.slice(0, 8)
  return <List tabItem={<Label title="流量" systemImage="chart.bar" />}>
    <Header title="流量" subtitle="本次 Surge Core 运行以来" />
    <Section title="累计流量">
      <HStack><VStack alignment="leading"><Text>下载</Text><Text>{formatBytes(totals.download)}</Text><Text>当前 {formatBytes(model.downloadSpeed, "/s")}</Text></VStack><Spacer /><VStack alignment="leading"><Text>上传</Text><Text>{formatBytes(totals.upload)}</Text><Text>当前 {formatBytes(model.uploadSpeed, "/s")}</Text></VStack></HStack>
    </Section>
    <Section title="全球流量"><Text>{rows.length ? `已统计 ${rows.length} 个节点 · ${formatBytes(grandTotal)}` : "等待 Surge 返回节点流量"}</Text><Text>节点地区按名称与旗帜识别，原生页面保留地区统计，路线地图由 WebView 版提供。</Text></Section>
    <Section title="本次分流总览">
      {valueRow("直连", `${formatBytes(split.direct)} · ${grandTotal ? Math.round(split.direct / grandTotal * 100) : 0}%`)}
      {valueRow("代理", `${formatBytes(split.proxy)} · ${grandTotal ? Math.round(split.proxy / grandTotal * 100) : 0}%`)}
    </Section>
    <Section title="节点流量排行">
      {visible.length ? visible.map((row, index) => <VStack key={row.name} alignment="leading"><HStack><Text>{index + 1}. {row.name}</Text><Spacer /><Text>{formatBytes(row.total)}</Text></HStack><Text>下载 {formatBytes(row.download)} · 上传 {formatBytes(row.upload)} · {grandTotal ? (row.total / grandTotal * 100).toFixed(1) : 0}%</Text></VStack>) : <Text>暂无节点流量数据</Text>}
      {rows.length > 8 ? <Button title={expanded ? "收起节点" : `显示全部 ${rows.length} 个节点`} systemImage={expanded ? "chevron.up" : "chevron.down"} action={() => setExpanded(!expanded)} /> : null}
    </Section>
  </List>
}

function NetworkPage({ model }: { model: PanelModel }) {
  return <List tabItem={<Label title="网络" systemImage="globe" />}>
    <Header title="网络" subtitle="Surge Core 接口统计" />
    <Section title="连接状态">{valueRow(model.connected ? "已连接" : "未连接", model.source === "metrics" ? "Metrics" : model.source === "traffic" ? "Traffic API" : "Offline")}</Section>
    <Section title="网络接口">
      {model.interfaces.length ? model.interfaces.map(row => <VStack key={row.name} alignment="leading"><HStack><Text>{row.name}</Text><Spacer /><Text>{formatBytes(row.total)}</Text></HStack><Text>↓ {formatBytes(row.download)}  ↑ {formatBytes(row.upload)}</Text></VStack>) : <Text>暂无网络接口统计</Text>}
    </Section>
    <Section title="Core 信息">{valueRow("平台", model.engine.system)}{valueRow("Surge 版本", model.engine.version)}{valueRow("Build", model.engine.build)}</Section>
  </List>
}

function SettingsPage({ config, model, onOpenSettings, clearHistory }: { config: Config; model: PanelModel; onOpenSettings: () => void; clearHistory: () => void }) {
  return <List tabItem={<Label title="设置" systemImage="gearshape" />}>
    <Header title="设置" subtitle="连接与采样配置" />
    <Section title="连接设置">
      {valueRow("API 地址", config.apiBase)}
      {valueRow("API 密钥", "••••••••")}
      {valueRow("刷新间隔", `${config.refreshSeconds} 秒`)}
      {valueRow("历史保留", "24 小时")}
      {valueRow("数据来源", model.source === "metrics" ? "Surge /v1/metrics" : model.source === "traffic" ? "Surge /v1/traffic" : "未连接")}
      {valueRow("面板版本", `V${APP_VERSION}`)}
    </Section>
    <Section><Button title="重新配置连接" systemImage="gearshape" action={onOpenSettings} /></Section>
    <Section><Button title="清除历史曲线" systemImage="trash" role="destructive" action={clearHistory} /></Section>
    <Section title="隐私"><Text>API 密钥保存在 iOS 钥匙串中，不会写进可视化页面。建议 Surge HTTP API 仅监听 127.0.0.1。</Text></Section>
  </List>
}

function webEscape(value: unknown): string {
  return String(value ?? "").replace(/[&<>\"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" }[character] || character))
}

function webJSON(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
}

function buildPanelHTML(initial: PanelModel, config: Config): string {
  const state = webJSON({ ...initial, config })
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no"><style>
:root{--bg:#f7f5fb;--surface:#fff;--text:#17171b;--muted:#85838c;--line:#ebe9ef;--purple:#655bdc;--purpleFill:#eeeaff;--green:#3aa77b;--greenFill:#e7f5ef;--blue:#20a6c7;--yellow:#f0aa28}*{box-sizing:border-box}html,body{margin:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","PingFang SC",sans-serif}body{padding:env(safe-area-inset-top) 0 96px}.top{height:66px;padding:12px 20px 8px;display:flex;align-items:center;justify-content:space-between}.top button{width:36px;height:36px;padding:0;border-radius:50%;border:.5px solid rgba(30,27,40,.10);background:rgba(255,255,255,.68);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);box-shadow:0 3px 12px rgba(35,28,55,.10);color:#504d58;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .2s ease,transform .2s ease,box-shadow .2s ease;-webkit-tap-highlight-color:transparent}.top button:active{background:rgba(255,255,255,.92);transform:scale(.92);box-shadow:0 1px 5px rgba(35,28,55,.08)}.top button svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round}.top .min{color:var(--purple)}.top .refreshing svg{animation:spin .75s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.refreshSelect{border:0;background:transparent;color:var(--purple);font:inherit;font-weight:700;text-align:right;outline:0}.app{padding:0 20px;max-width:760px;margin:auto}.page{display:none}.page.active{display:block}.hero{padding:15px 12px 19px}.hero h1{font-size:36px;line-height:1;margin:0;font-weight:800;letter-spacing:-1.5px}.hero p{margin:9px 0 0;color:var(--muted);font-size:14px}.pill{float:right;margin-top:-27px;background:var(--greenFill);color:var(--green);padding:8px 11px;border-radius:20px;font-weight:700;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:18px;box-shadow:0 2px 8px #15101b08;margin-bottom:12px}.metric{min-height:132px}.label{color:#77757e;font-size:14px}.value{font-size:30px;font-weight:700;margin-top:7px;letter-spacing:-.5px}.unit{font-size:17px;font-weight:500}.foot{color:var(--green);font-size:12px;margin-top:7px}.sectionTitle{font-size:19px;font-weight:800;margin:0 0 11px}.chart{height:178px;padding:14px 11px}.chart svg{width:100%;height:138px}.health{display:grid;grid-template-columns:repeat(4,1fr);text-align:center;padding:15px 8px}.health b{color:var(--purple);font-size:24px}.health span{display:block;color:var(--muted);font-size:11px;margin-top:4px}.pageTitle{font-size:40px;font-weight:800;margin:28px 10px 7px;letter-spacing:-1.5px}.note{color:var(--muted);font-size:14px;margin:0 10px 21px}.row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--line)}.row:last-child{border-bottom:0}.row strong{font-size:14px}.row small{display:block;color:var(--muted);font-size:11px;margin-top:3px}.right{color:var(--muted);text-align:right}.bar{height:7px;background:#f0eff3;border-radius:8px;margin-top:8px;overflow:hidden}.fill{height:100%;background:var(--purple);border-radius:8px}.action{width:100%;border:0;border-radius:16px;background:var(--surface);padding:14px;font-size:14px;font-weight:700;margin:0 0 10px}.danger{color:#e55258;background:#fff0f0}.tabs{position:fixed;z-index:4;left:16px;right:16px;bottom:calc(12px + env(safe-area-inset-bottom));height:64px;background:#fffdfdF2;border:1px solid var(--line);border-radius:35px;display:grid;grid-template-columns:repeat(5,1fr);padding:5px;box-shadow:0 8px 26px #33245018;backdrop-filter:blur(22px)}.tab{border:0;background:transparent;border-radius:26px;color:#77757e;font-size:10px}.tab b{display:block;font-size:24px;line-height:28px;font-weight:400}.tab.active{background:var(--purpleFill);color:var(--purple)}@media(max-width:370px){.app{padding:0 14px}.hero h1{font-size:38px}.value{font-size:32px}.pageTitle{font-size:42px}}
.groupsHead{display:flex;align-items:center;justify-content:space-between;margin-bottom:11px}.groupsHead .sectionTitle{margin:0}.testGroups{width:32px;height:32px;padding:0;border:0;border-radius:10px;background:var(--purpleFill);color:var(--purple);font-size:18px;font-weight:700;line-height:1;cursor:pointer}.testGroups:active{transform:scale(.94)}.testGroups.testing{opacity:.55;animation:pulse .8s ease-in-out infinite}@keyframes pulse{50%{opacity:.25}}.groupGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.groupCard{min-width:0;padding:12px;border:1px solid var(--line);border-radius:10px;background:#fcfbff;box-shadow:0 1px 3px #15101b08;cursor:pointer}.groupCard:active{transform:scale(.98)}.groupCard .groupTitle{display:flex;align-items:baseline;justify-content:space-between;gap:6px}.groupCard .groupName{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px;font-weight:700}.groupCard .groupDelay{flex:0 0 auto;color:var(--purple);font-size:10px;font-weight:700}.groupCard .groupType{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px;color:var(--muted);font-size:10px}.groupCard .groupCurrent{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:9px;color:var(--text);font-size:12px;font-weight:650}.groupCard .groupMembers{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:5px;color:var(--muted);font-size:10px}.groupCard .groupMeta{display:block;margin-top:8px;color:var(--purple);font-size:10px;font-weight:700}.policyDetail{display:none;position:fixed;inset:0;z-index:50}.policyDetail.open{display:block}.policyBackdrop{position:absolute;inset:0;background:rgba(23,21,29,.18);backdrop-filter:blur(5px)}.policySheet{position:absolute;left:20px;right:20px;top:50%;max-height:calc(100% - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 56px);transform:translateY(-50%);padding:17px 14px 13px;border:1px solid var(--line);border-radius:18px;background:var(--surface);box-shadow:0 18px 50px rgba(0,0,0,.18);color:var(--text);overflow:auto}.policySheetHead{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 2px 16px}.policySheetHead h2{margin:0;font-size:22px;line-height:1.1}.policySheetHead p{margin:6px 0 0;color:var(--muted);font-size:12px}.policyNodes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.policyNode{min-width:0;min-height:112px;padding:13px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:0 1px 3px #15101b08;display:flex;flex-direction:column;justify-content:space-between}.policyNodeName{font-size:16px;font-weight:700;line-height:1.2;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}.policyNodeFoot{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:13px;color:var(--muted);font-size:11px}.policyNodeDelay{padding:4px 7px;border-radius:7px;background:var(--line);color:var(--muted);font-size:11px;font-weight:700;white-space:nowrap}.policyNodeDelay.ok{background:#44ba24;color:#fff}.policyNodeDelay.testing{background:var(--purpleFill);color:var(--purple)}.policyNodeDelay.failed{background:#ffe8e8;color:#d74747}.closePolicyDetail{width:100%;height:40px;margin-top:14px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:13px;font-weight:650}@media(prefers-color-scheme:dark){.policyBackdrop{background:rgba(0,0,0,.42)}.policySheet{background:var(--surface);box-shadow:0 18px 50px rgba(0,0,0,.48)}.policyNode{background:var(--bg);box-shadow:none}.policyNodeDelay{background:var(--line);color:var(--muted)}.policyNodeDelay.ok{background:#49a92f;color:#fff}.policyNodeDelay.failed{background:#512c32;color:#ff8d97}.closePolicyDetail{background:var(--bg)}}</style></head><body><header class="top"><button id="close" aria-label="关闭" title="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button><button id="topAction" class="min" aria-label="刷新" title="刷新"><svg id="topActionIcon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8 8 0 1 1-2.34-5.66M20 4v7h-7"/></svg></button></header><main class="app">
<section class="page active" data-page="overview"><div class="hero"><h1>Surge Panel</h1><p id="updated"></p><span class="pill" id="mode"></span></div><div class="grid"><div class="card metric"><div class="label">内存</div><div class="value" id="memory"></div><div class="foot">Surge 进程</div></div><div class="card metric"><div class="label">运行时长</div><div class="value" id="uptime"></div><div class="foot">自 iOS 启动</div></div><div class="card metric"><div class="label">实时下载</div><div class="value" id="download"></div><div class="foot">全部接口</div></div><div class="card metric"><div class="label">活动连接</div><div class="value" id="active"></div><div class="foot" id="failed"></div></div></div><div class="card chart"><div class="sectionTitle">内存占用 <span style="float:right;color:var(--purple);font-size:16px" id="chartValue"></span></div><div id="chart"></div></div><div class="card"><div class="sectionTitle">引擎健康</div><div class="health"><div><b id="dns"></b><span>DNS 缓存</span></div><div><b id="vip"></b><span>虚拟 IP</span></div><div><b id="temp"></b><span>临时规则</span></div><div><b id="ban"></b><span>封禁</span></div></div></div></section>
<section class="page" data-page="policies"><h2 class="pageTitle">策略</h2><p class="note">当前模式与策略组选择</p><div class="card"><div class="label">出站模式</div><div class="value" id="modeLarge"></div><div class="foot" id="online"></div></div><div class="card"><div class="groupsHead"><h3 class="sectionTitle">策略组</h3></div><div id="groups" class="groupGrid"></div></div></section><div id="policyDetail" class="policyDetail" aria-hidden="true"><div class="policyBackdrop" id="policyBackdrop"></div><section class="policySheet"><div class="policySheetHead"><div><h2 id="policyDetailName"></h2><p id="policyDetailSub"></p></div><button id="testGroups" class="testGroups" aria-label="测试当前策略组延迟" title="测试当前策略组">ϟ</button></div><div id="policyNodes" class="policyNodes"></div><button id="closePolicyDetail" class="closePolicyDetail">关闭</button></section></div>
<section class="page" data-page="traffic"><h2 class="pageTitle">流量</h2><p class="note">本次 Surge Core 运行以来</p><div class="grid"><div class="card metric"><div class="label">下载</div><div class="value" id="totalDown"></div><div class="foot" id="downRate"></div></div><div class="card metric"><div class="label">上传</div><div class="value" id="totalUp"></div><div class="foot" id="upRate"></div></div></div><div class="card"><h3 class="sectionTitle">全球流量</h3><p class="note" style="margin:0;font-size:13px" id="world"></p></div><div class="card"><h3 class="sectionTitle">本次分流总览</h3><div id="split"></div></div><div class="card"><h3 class="sectionTitle">节点流量排行</h3><div id="ranks"></div><button class="action" id="expand">显示全部节点</button></div></section>
<section class="page" data-page="network"><h2 class="pageTitle">网络</h2><p class="note">Surge Core 接口统计</p><div class="card"><div class="label">连接状态</div><div class="value" id="networkStatus"></div><div class="foot" id="source"></div></div><div class="card"><h3 class="sectionTitle">网络接口</h3><div id="interfaces"></div></div><div class="card"><h3 class="sectionTitle">Core 信息</h3><div id="core"></div></div></section>
<section class="page" data-page="settings"><h2 class="pageTitle">设置</h2><p class="note">连接与采样配置</p><div class="card" id="settings"></div><button class="action" id="reconfig">重新配置连接</button><button class="action danger" id="clear">清除历史曲线</button><p class="note" style="font-size:13px">API 密钥保存在 iOS 钥匙串中，不会被写进可视化页面。</p></section></main><nav class="tabs">${[["overview","▦","总览"],["policies","⌘","策略"],["traffic","▥","流量"],["network","◎","网络"],["settings","⚙","设置"]].map(item => `<button class="tab${item[0] === "overview" ? " active" : ""}" data-tab="${item[0]}"><b>${item[1]}</b>${item[2]}</button>`).join("")}</nav>
<script>let state=${state};let expanded=false;let activePolicyGroup='';const $=id=>document.getElementById(id);const bytes=(n,s='')=>{let u=['B','KB','MB','GB','TB'],i=0,v=Math.max(0,Number(n||0));while(v>=1024&&i<4){v/=1024;i++}return v.toFixed(i===0||v>=100?0:v>=10?1:2)+' '+u[i]+s};const mode=m=>m==='direct'?'直连模式':m==='proxy'?'全局代理':'规则模式';const uptime=s=>{let t=Math.floor(s||0),d=Math.floor(t/86400),h=Math.floor(t%86400/3600),m=Math.floor(t%3600/60);return d?d+'d '+h+'h':h?h+'h '+m+'m':m+'m'};function rows(){return state.nodes?.length?state.nodes:state.interfaces||[]}function renderChart(){let p=state.history||[],w=350,h=135;if(p.length<2){$('chart').innerHTML='<p class="note" style="margin:35px 0;text-align:center;font-size:13px">运行一分钟后开始记录趋势</p>';return}let max=Math.max(...p.map(x=>x.memory))/1048576,min=Math.min(...p.map(x=>x.memory))/1048576,range=Math.max(1,max-min),points=p.map((x,i)=>{let X=8+i/(p.length-1)*334,Y=125-(x.memory/1048576-min)/range*105;return [X,Y]}),line=points.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' '),area=line+' L '+points.at(-1)[0]+' 130 L 8 130 Z';$('chart').innerHTML='<svg viewBox="0 0 350 135"><path d="'+area+'" fill="#655bdc" opacity=".16"/><path d="'+line+'" fill="none" stroke="#655bdc" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="'+points.at(-1)[0]+'" cy="'+points.at(-1)[1]+'" r="4" fill="#655bdc"/></svg>'}function render(){let r=rows(),total=r.reduce((a,x)=>a+x.total,0),direct=r.filter(x=>/^DIRECT|直连/i.test(x.name)).reduce((a,x)=>a+x.total,0);$('updated').textContent=state.connected?'更新于 '+new Date(state.updatedAt).toLocaleTimeString('zh-CN',{hour12:false}):state.error;$('mode').textContent=mode(state.mode);$('memory').innerHTML=bytes(state.memory).replace(' ','<span class="unit"> ')+'</span>';$('uptime').textContent=uptime(state.uptime);$('download').textContent=bytes(state.downloadSpeed,'/s');$('active').textContent=Math.round(state.activeRequests||0);$('failed').textContent='失败率 '+Math.round((state.failedRequests||0)/Math.max(1,(state.activeRequests||0)+(state.failedRequests||0))*100)+'%（'+(state.failedRequests||0)+'）';$('chartValue').textContent=bytes(state.memory);$('dns').textContent=Math.round(state.dnsCacheEntries||0);$('vip').textContent=state.virtualIPs||0;$('temp').textContent=state.temporaryRules||0;$('ban').textContent=state.activeBans||0;$('modeLarge').textContent=mode(state.mode);$('online').textContent=state.connected?'Core 在线':'Core 离线';$('totalDown').textContent=bytes(r.reduce((a,x)=>a+x.download,0));$('totalUp').textContent=bytes(r.reduce((a,x)=>a+x.upload,0));$('downRate').textContent='当前 '+bytes(state.downloadSpeed,'/s');$('upRate').textContent='当前 '+bytes(state.uploadSpeed,'/s');$('world').textContent=r.length?'已统计 '+r.length+' 个节点 · '+bytes(total):'等待 Surge 返回节点流量';$('split').innerHTML='<div class="row"><strong>直连</strong><span class="right">'+bytes(direct)+' · '+(total?Math.round(direct/total*100):0)+'%</span></div><div class="bar"><div class="fill" style="width:'+(total?direct/total*100:0)+'%"></div></div><div class="row"><strong>代理</strong><span class="right">'+bytes(total-direct)+' · '+(total?Math.round((total-direct)/total*100):0)+'%</span></div><div class="bar"><div class="fill" style="width:'+(total?(total-direct)/total*100:0)+'%"></div></div>';$('groups').innerHTML=(state.groups||[]).map((g,i)=>'<article class="groupCard" data-group-index="'+i+'"><div class="groupTitle"><strong class="groupName">'+g.name+'</strong><span class="groupDelay">'+(g.latency?Math.round(g.latency)+' ms':'—')+'</span></div><span class="groupType">'+g.type+'</span><span class="groupCurrent">当前：'+(g.selected||'—')+'</span><span class="groupMembers">'+(g.policies||[]).slice(0,3).join(' · ')+((g.policies||[]).length>3?' · …':'')+'</span><span class="groupMeta">'+g.optionCount+' 个节点</span></article>').join('')||'<p class="note" style="grid-column:1/-1">当前接口未返回策略组详情</p>';document.querySelectorAll('.groupCard').forEach(card=>card.onclick=()=>openPolicyDetail(Number(card.dataset.groupIndex)));$('ranks').innerHTML=(expanded?r:r.slice(0,8)).map((x,i)=>'<div class="row"><span><strong>'+(i+1)+'. '+x.name+'</strong><small>↓ '+bytes(x.download)+'　↑ '+bytes(x.upload)+'</small></span><span class="right">'+bytes(x.total)+'<small>'+(total?(x.total/total*100).toFixed(1):0)+'%</small></span></div>').join('')||'<p class="note">暂无节点流量数据</p>';$('expand').style.display=r.length>8?'block':'none';$('expand').textContent=expanded?'收起节点':'显示全部 '+r.length+' 个节点';$('interfaces').innerHTML=(state.interfaces||[]).map(x=>'<div class="row"><span><strong>'+x.name+'</strong><small>↓ '+bytes(x.download)+'　↑ '+bytes(x.upload)+'</small></span><span class="right">'+bytes(x.total)+'</span></div>').join('')||'<p class="note">暂无网络接口统计</p>';$('networkStatus').textContent=state.connected?'已连接':'未连接';$('source').textContent=state.source==='metrics'?'Metrics':state.source;$('core').innerHTML='<div class="row"><strong>平台</strong><span class="right">'+state.engine.system+'</span></div><div class="row"><strong>Surge 版本</strong><span class="right">'+state.engine.version+'</span></div><div class="row"><strong>Build</strong><span class="right">'+state.engine.build+'</span></div>';$('settings').innerHTML='<div class="row"><strong>API 地址</strong><span class="right">'+state.config.apiBase+'</span></div><div class="row"><strong>API 密钥</strong><span class="right">••••••••</span></div><div class="row"><strong>刷新间隔</strong><select id="refreshSeconds" class="refreshSelect">'+[5,10,15,20,25,30].map(s=>'<option value="'+s+'"'+(state.config.refreshSeconds===s?' selected':'')+'>'+s+' 秒</option>').join('')+'</select></div><div class="row"><strong>历史保留</strong><span class="right">24 小时</span></div><div class="row"><strong>数据来源</strong><span class="right">Surge /v1/metrics</span></div><div class="row"><strong>面板版本</strong><span class="right">V1.5.1</span></div>';let refreshSelect=$('refreshSeconds');if(refreshSelect)refreshSelect.onchange=()=>window.webkit.messageHandlers.native.postMessage('refreshSeconds:'+refreshSelect.value);renderChart()}function setTopAction(page){let button=$('topAction'),icon=$('topActionIcon'),isSettings=page==='settings';button.classList.toggle('min',isSettings);button.classList.remove('refreshing');button.setAttribute('aria-label',isSettings?'收起':'刷新');button.title=isSettings?'收起':'刷新';icon.innerHTML=isSettings?'<path d="m6 9 6 6 6-6"/>':'<path d="M20 11a8 8 0 1 1-2.34-5.66M20 4v7h-7"/>'}render();setTopAction('overview');document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.dataset.page===b.dataset.tab));setTopAction(b.dataset.tab);scrollTo(0,0)});$('expand').onclick=()=>{expanded=!expanded;render()};$('clear').onclick=()=>window.webkit.messageHandlers.native.postMessage('clear');$('reconfig').onclick=()=>window.webkit.messageHandlers.native.postMessage('reconfig');$('close').onclick=()=>window.webkit.messageHandlers.native.postMessage('close');$('topAction').onclick=()=>{let isSettings=document.querySelector('.tab.active').dataset.tab==='settings';if(isSettings){window.webkit.messageHandlers.native.postMessage('minimize');return}$('topAction').classList.add('refreshing');window.webkit.messageHandlers.native.postMessage('refresh')};$('testGroups').onclick=e=>{e.stopPropagation();window.webkit.messageHandlers.native.postMessage('testGroups:'+activePolicyGroup)};$('closePolicyDetail').onclick=closePolicyDetail;$('policyBackdrop').onclick=closePolicyDetail;function openPolicyDetail(index){let g=(state.groups||[])[index];if(!g)return;activePolicyGroup=g.name;$('policyDetailName').textContent=g.name;$('policyDetailSub').textContent=(g.type||'策略组')+' · 当前 '+(g.selected||'—')+' · '+(g.optionCount||0)+' 个节点';$('policyNodes').innerHTML=(g.nodes||g.policies||[]).map(n=>{let node=typeof n==='string'?{name:n,latency:0}:n;return '<article class="policyNode"><strong class="policyNodeName">'+node.name+'</strong><div class="policyNodeFoot"><span>'+(node.name===g.selected?'当前节点':'节点')+'</span><span class="policyNodeDelay'+(node.latency?' ok':'')+'">'+(node.latency?Math.round(node.latency)+' ms':'未测速')+'</span></div></article>'}).join('')||'<p>当前策略组没有节点</p>';$('policyDetail').classList.add('open');$('policyDetail').setAttribute('aria-hidden','false')}function closePolicyDetail(){activePolicyGroup='';$('policyDetail').classList.remove('open');$('policyDetail').setAttribute('aria-hidden','true')}window.setPolicyTestLoading=v=>{$('testGroups').disabled=!!v;$('testGroups').classList.toggle('testing',!!v);document.querySelectorAll('.policyNodeDelay').forEach(x=>{if(v){x.className='policyNodeDelay testing';x.textContent='测速中'}})};window.showPolicyTestError=m=>{window.setPolicyTestLoading(false);document.querySelectorAll('.policyNodeDelay').forEach(x=>{if(x.textContent==='测速中'){x.className='policyNodeDelay failed';x.textContent='失败'}});$('testGroups').title=m};window.applyNativeUpdate=m=>{state=m;$('topAction').classList.remove('refreshing');render();if(activePolicyGroup){let i=(state.groups||[]).findIndex(g=>g.name===activePolicyGroup);if(i>=0)openPolicyDetail(i)}};</script></body></html>`
}

function Dashboard({ config, onOpenSettings, onChangeRefreshSeconds }: { config: Config; onOpenSettings: () => void; onChangeRefreshSeconds: (seconds: number) => void }) {
  const [model, setModel] = useState<PanelModel>(() => offlineModel(config, "正在读取 Surge Core…", loadHistory()))
  const previous = useRef<CoreSnapshot | null>(null)
  const refreshing = useRef(false)
  const policyTesting = useRef(false)
  const webView = useRef(new WebViewController())
  const webLoaded = useRef(false)
  const dismiss = Navigation.useDismiss()

  const refreshPolicyLatencies = async (groupName?: string) => {
    if (policyTesting.current) return
    policyTesting.current = true
    try {
      if (webLoaded.current) await webView.current.evaluateJavaScript("window.setPolicyTestLoading && window.setPolicyTestLoading(true)")
      const before = await fetchDetails(config)
      const groupsBefore = normalizeGroups(before.groups, [before.testResults, before.benchmarkResults], before.policies)
      if (!groupsBefore.length) throw new Error("没有可测速的策略组")
      const targets = groupName ? groupsBefore.filter(group => group.name === groupName) : groupsBefore
      if (!targets.length) throw new Error("找不到当前策略组")
      let testResponse: unknown = null
      for (const group of targets) testResponse = await testPolicyGroup(config, group.name)
      let groups: PolicyGroup[] = []
      let savedResults: unknown = null
      for (let attempt = 0; attempt < 12; attempt += 1) {
        if (attempt > 0) await new Promise<void>(resolve => setTimeout(() => resolve(), 500))
        const [groupsRaw, latestResults, benchmarks, policies] = await Promise.all([
          safeJSON(config, "/v1/policy_groups"),
          safeJSON(config, "/v1/policy_groups/test_results"),
          safeJSON(config, "/v1/policies/benchmark_results"),
          safeJSON(config, "/v1/policies"),
        ])
        savedResults = latestResults
        groups = normalizeGroups(groupsRaw, [testResponse, latestResults, benchmarks], policies)
        const current = groupName ? groups.find(group => group.name === groupName) : undefined
        if ((current?.nodes || []).some(node => node.latency > 0)) break
      }
      const currentAfterGroupTest = groupName ? groups.find(group => group.name === groupName) : undefined
      if (currentAfterGroupTest && !currentAfterGroupTest.nodes.some(node => node.latency > 0)) {
        const policyResponse = await testPolicies(config, currentAfterGroupTest.policies)
        const [groupsRaw, benchmarks] = await Promise.all([
          safeJSON(config, "/v1/policy_groups"),
          safeJSON(config, "/v1/policies/benchmark_results"),
        ])
        groups = normalizeGroups(groupsRaw, [testResponse, savedResults, benchmarks, policyResponse], null)
      }
      setModel(previousModel => {
        const next = { ...previousModel, groups, error: groups.length ? "" : previousModel.error }
        if (webLoaded.current) void webView.current.evaluateJavaScript(`window.applyNativeUpdate(${webJSON(next)})`)
        return next
      })
    } catch (error) {
      if (webLoaded.current) await webView.current.evaluateJavaScript(`window.showPolicyTestError && window.showPolicyTestError(${webJSON(readableError(error))})`)
    } finally {
      policyTesting.current = false
      if (webLoaded.current) await webView.current.evaluateJavaScript("window.setPolicyTestLoading && window.setPolicyTestLoading(false)")
    }
  }

  const refresh = async () => {
    if (refreshing.current || policyTesting.current) return
    refreshing.current = true
    try {
      const current = await captureCore(config)
      const details = await fetchDetails(config)
      const next = buildModel(current, previous.current, details, loadHistory(), config)
      saveHistory(next.history)
      previous.current = current
      setModel(next)
      if (webLoaded.current) await webView.current.evaluateJavaScript(`window.applyNativeUpdate(${webJSON(next)})`)
    } catch (error) {
      const next = offlineModel(config, error, loadHistory())
      setModel(next)
      if (webLoaded.current) await webView.current.evaluateJavaScript(`window.applyNativeUpdate(${webJSON(next)})`)
    } finally { refreshing.current = false }
  }

  useEffect(() => {
    Script.enableMinimize()
    const controller = webView.current
    let active = true
    let timer: number | undefined
    void (async () => {
      await controller.addScriptMessageHandler("native", (message?: string) => {
        if (message === "close") { dismiss(); return null }
        if (message === "minimize") { void Script.minimize(); return null }
        if (message === "refresh") { void refresh(); return null }
        if (message?.startsWith("refreshSeconds:")) { onChangeRefreshSeconds(normalizeRefreshSeconds(message.slice("refreshSeconds:".length))); return null }
        if (message === "clear") { Storage.remove(HISTORY_KEY); setModel(current => { const next = { ...current, history: [] }; if (webLoaded.current) void controller.evaluateJavaScript(`window.applyNativeUpdate(${webJSON(next)})`); return next }); return null }
        if (message === "reconfig") { onOpenSettings(); return null }
        if (message === "testGroups" || message?.startsWith("testGroups:")) { void refreshPolicyLatencies(message.slice("testGroups:".length) || undefined); return null }
        return null
      })
      await controller.loadHTML(buildPanelHTML(model, config))
      webLoaded.current = true
      const poll = async () => {
        await refresh()
        if (active) timer = setTimeout(() => { void poll() }, config.refreshSeconds * 1000)
      }
      await poll()
    })()
    return () => {
      active = false
      webLoaded.current = false
      if (timer != null) clearTimeout(timer)
      controller.dispose()
    }
  }, [config.apiBase, config.apiKey, config.refreshSeconds, config.allowInsecure])

  return <WebView controller={webView.current} ignoresSafeArea />
}

function App() {
  const [config, setConfig] = useState<Config | null>(loadConfig())
  return config ? <Dashboard config={config} onOpenSettings={() => setConfig(null)} onChangeRefreshSeconds={seconds => setConfig(current => {
      if (!current) return current
      const next = { ...current, refreshSeconds: normalizeRefreshSeconds(seconds) }
      saveConfig(next)
      return next
    })} /> : <SetupView initial={loadConfig() || DEFAULT_CONFIG} onSave={setConfig} />
}

async function run() {
  try {
    await Navigation.present({ element: <App />, modalPresentationStyle: "fullScreen" })
  } finally {
    Script.exit()
  }
}

void run()
