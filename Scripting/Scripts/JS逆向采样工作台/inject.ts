// inject.ts v3.0 — 注入到页面上下文的逆向工具箱
// 五个模块：BASE（Hook核心）、PROBE（全局探针）、RESPONSE（流量拦截）、
//          SOURCE（源码分析）、FORENSICS（取证转储）
// 所有代码通过 WebViewController.evaluateJavaScript 执行，需显式 return

declare global {
  interface Window {
    __jsrvInstalled?: boolean
    __jsrvRespInstalled?: boolean
    __jsrvLog: (path: string, args: IArguments | any[], ret: any, extra?: Record<string, any>) => void
    __jsrvHookPath: (path: string, opts?: HookOptions) => string
    __jsrvProbeGlobal: () => ProbeResult[]
    __jsrvHookClass: (className: string, methods: string[]) => ClassHookResult
    __jsrvBeautify: (code: string) => string
    __jsrvSearchAll: (pattern: string, flags?: string) => SearchResult
    __jsrvDumpStorage: () => StorageDump
    __jsrvDumpGlobals: () => GlobalEntry[]
  }
}

interface HookOptions {
  condition?: string  // JS expression, args as `a0`, `a1`..., e.g. "a0 > 100"
  beforeOnly?: boolean  // log before call only
}
type ProbeResult = { path: string; type: string; category: string; native: boolean }
type ClassHookResult = { className: string; hooked: string[]; errors: string[] }
type SearchResult = { totalScripts: number; results: { src: string; idx: number; match: string; context: string }[] }
type StorageDump = { localStorage: Record<string,string>; sessionStorage: Record<string,string> }
type GlobalEntry = { key: string; type: string; value?: string; keys?: string[]; len?: number }

// ══════════════════════════════════════════════════════════════
// 模块 1: INJECT_BASE — Hook 核心（堆栈追踪 + 计时 + 条件过滤）
// ══════════════════════════════════════════════════════════════

export const INJECT_BASE = `(function () {
  if (window.__jsrvInstalled) { return "already-installed" }
  window.__jsrvInstalled = true

  function summarize(v, maxLen) {
    maxLen = maxLen || 600
    try {
      if (v === undefined) return "undefined"
      if (v === null) return "null"
      var t = typeof v
      if (t === "function") return "[function]"
      if (t === "string") return '"' + String(v).slice(0, maxLen) + '"'
      if (t === "number" || t === "boolean" || t === "bigint") return String(v)
      if (v instanceof Error) return "[Error:" + v.message.slice(0,100) + "]"
      if (v instanceof Promise) return "[Promise]"
      if (Array.isArray(v)) {
        try { return JSON.stringify(v).slice(0, maxLen) } catch(e) { return "[Array("+v.length+")]" }
      }
      try { return JSON.stringify(v).slice(0, maxLen) } catch(e) { return String(v).slice(0,maxLen) }
    } catch(e) { return String(v) }
  }

  window.__jsrvLog = function (path, args, ret, extra) {
    try {
      var argList = []
      if (args && typeof args.length === "number") {
        for (var i = 0; i < args.length && i < 10; i++) argList.push(summarize(args[i]))
      }
      var msg = { kind:"call", path:path, args:argList, ret:summarize(ret), ts:Date.now() }
      if (extra && typeof extra === "object") {
        if (extra.error !== undefined) msg.error = summarize(extra.error)
        if (extra.async) msg.async = true
        if (extra.duration !== undefined) msg.duration = extra.duration
      }
      // 堆栈追踪
      try {
        var stack = new Error().stack
        if (stack) msg.stack = stack.split("\\n").slice(2, 8).join("\\n").slice(0, 600)
      } catch(e) {}
      window.webkit.messageHandlers.jsrvHook.postMessage(msg)
    } catch(e) {}
  }

  // resolvePath: "a.b.c" → window.a.b.c
  function resolvePath(path) {
    var clean = path.replace(/^window\\./, "")
    var parts = clean.split(".")
    var obj = window
    for (var i = 0; i < parts.length; i++) {
      if (obj === null || obj === undefined) return null
      obj = obj[parts[i]]
    }
    return obj
  }

  window.__jsrvHookPath = function (path, opts) {
    opts = opts || {}
    try {
      var clean = path.replace(/^window\\./, "")
      var parts = clean.split(".")
      if (parts.length < 1) return "invalid-path"
      var obj = window
      for (var i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) return "not-found:" + clean
        obj = obj[parts[i]]
      }
      var fn = obj[parts[parts.length - 1]]
      if (typeof fn !== "function") return "not-a-function:" + clean
      if (fn.__jsrvHooked) return "already-hooked"

      var original = fn
      var wrapped = function () {
        // 条件过滤
        if (opts.condition) {
          try {
            var cjs = "(function(a0,a1,a2,a3,a4){return (" + opts.condition + ")})"
            var condFn = eval(cjs)
            var a = arguments
            if (!condFn(a[0],a[1],a[2],a[3],a[4])) { return original.apply(this, arguments) }
          } catch(e) {}
        }
        var start = performance.now()
        if (opts.beforeOnly) {
          window.__jsrvLog(clean, arguments, undefined, { beforeOnly: true })
          var ret = original.apply(this, arguments)
          return ret
        }
        try {
          var ret = original.apply(this, arguments)
          var dur = performance.now() - start
          if (ret && typeof ret.then === "function") {
            return ret.then(function(v) {
              window.__jsrvLog(clean, arguments, v, { async:true, duration:dur })
              return v
            }, function(e) {
              window.__jsrvLog(clean, arguments, undefined, { async:true, duration:dur, error:e })
              throw e
            })
          }
          window.__jsrvLog(clean, arguments, ret, { duration:dur })
          return ret
        } catch(e) {
          window.__jsrvLog(clean, arguments, undefined, { error:e, duration:performance.now()-start })
          throw e
        }
      }
      wrapped.__jsrvHooked = true
      wrapped.__jsrvOriginal = original
      obj[parts[parts.length - 1]] = wrapped
      return "hooked:" + clean
    } catch(e) { return "error:" + e.message }
  }

  return "ready"
})()`

// ══════════════════════════════════════════════════════════════
// 模块 2: INJECT_PROBE — 全局探针 + 类/原型/构造器 Hook
// ══════════════════════════════════════════════════════════════

export const INJECT_PROBE = `(function () {
  if (window.__jsrvProbeInstalled) { return "already-installed" }
  window.__jsrvProbeInstalled = true

  // ── 全局函数扫描 ────────────────────────────────────────
  window.__jsrvProbeGlobal = function () {
    var results = []
    var seen = new Set()
    var count = 0

    function categorize(name) {
      var n = name.toLowerCase()
      if (/sign|encrypt|decrypt|aes|rsa|md5|sha256|sha1|sha|crypto|hash|hmac|pkcs|ecdsa|ecdh|ed25519|curve/.test(n))
        return "crypto"
      if (/fetch|xhr|ajax|request|http|websocket|ws|send|post|get|api|rpc/.test(n))
        return "network"
      if (/encode|decode|base64|btoa|atob|hex|utf8|stringify|parse|serialize|deserialize/.test(n))
        return "encoding"
      if (/token|key|secret|auth|session|user|login|logout|signin|permission|role/.test(n))
        return "auth"
      if (/storage|getitem|setitem|cookie|cache|db|store|save|load|persist/.test(n))
        return "storage"
      if (/log|debug|console|error|warn|trace|info/.test(n))
        return "debug"
      return "other"
    }

    function walk(obj, path, depth) {
      if (count > 800 || depth > 4 || !obj || seen.has(obj)) return
      seen.add(obj)
      try {
        var keys = Object.getOwnPropertyNames(obj)
        for (var i = 0; i < keys.length && count < 800; i++) {
          var k = keys[i]
          if (k.indexOf("__jsrv") === 0 || k.length > 50) continue
          var full = path ? path + "." + k : k
          if (full.length > 80) continue
          try {
            var v = obj[k]
            var t = typeof v
            if (t === "function") {
              var native = Function.prototype.toString.call(v).indexOf("[native code]") >= 0
              results.push({ path:full, type:"function", category:categorize(full), native:native })
              count++
            } else if (t === "object" && v !== null) {
              if (depth < 3) results.push({ path:full, type:"object", category:"container", native:false })
              if (depth < 4) walk(v, full, depth + 1)
            }
          } catch(e) {}
        }
      } catch(e) {}
    }

    walk(window, "", 0)

    // 扫描常见构造函数原型
    var protos = [
      { name:"XMLHttpRequest", obj:XMLHttpRequest },
      { name:"WebSocket", obj: typeof WebSocket !== "undefined" ? WebSocket : null },
      { name:"Worker", obj: typeof Worker !== "undefined" ? Worker : null },
    ]
    for (var pi = 0; pi < protos.length; pi++) {
      var p = protos[pi]
      if (!p.obj || !p.obj.prototype) continue
      walk(p.obj.prototype, p.name + ".prototype", 0)
    }

    return results
  }

  // ── 类原型 Hook ──────────────────────────────────────────
  window.__jsrvHookClass = function (className, methods) {
    var result = { className:className, hooked:[], errors:[] }
    var proto
    try {
      var cls = eval(className)
      proto = cls && cls.prototype
    } catch(e) {
      result.errors.push(className + " not found")
      return result
    }
    if (!proto) { result.errors.push("no prototype"); return result }
    for (var i = 0; i < methods.length; i++) {
      var m = methods[i]
      var path = className + ".prototype." + m
      try {
        if (typeof proto[m] !== "function") { result.errors.push(m + " not a function"); continue }
        if (proto[m].__jsrvHooked) { result.hooked.push(path + " (already)"); continue }
        var original = proto[m]
        var wrapped = function () {
          var ret = original.apply(this, arguments)
          window.__jsrvLog(path, arguments, ret)
          return ret
        }
        wrapped.__jsrvHooked = true
        wrapped.__jsrvOriginal = original
        proto[m] = wrapped
        result.hooked.push(path)
      } catch(e) {
        result.errors.push(m + ":" + e.message)
      }
    }
    return result
  }

  return "ready"
})()`

// ══════════════════════════════════════════════════════════════
// 模块 3: INJECT_RESPONSE_TRACKING — 流量拦截（fetch/XHR/WebSocket）
// ══════════════════════════════════════════════════════════════

export const INJECT_RESPONSE_TRACKING = `(function () {
  if (window.__jsrvRespInstalled) { return "already-installed" }
  window.__jsrvRespInstalled = true

  function post(data) {
    try {
      window.webkit.messageHandlers.jsrvHook.postMessage(
        Object.assign({ kind:"response", ts:Date.now() }, data)
      )
    } catch(e) {}
  }

  // Hook fetch
  var _fetch = window.fetch
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || ""
    var method = (init && init.method) || "GET"
    var start = Date.now()
    return _fetch.call(this, input, init).then(function (resp) {
      var clone = resp.clone()
      var meta = { url:url, method:method, status:clone.status, statusText:clone.statusText, duration:Date.now()-start }
      var headers = {}
      if (clone.headers && typeof clone.headers.forEach === "function") {
        clone.headers.forEach(function (v,k) { headers[k]=v })
      }
      meta.headers = headers
      clone.text().then(function (body) {
        meta.body = body.slice(0, 5000)
        post(meta)
      }).catch(function () {
        post(meta)
      })
      return resp
    }, function (err) {
      post({ url:url, method:method, status:0, statusText:"NetworkError", body:err.message, duration:Date.now()-start })
      throw err
    })
  }

  // Hook XMLHttpRequest
  var XHR = XMLHttpRequest, _open = XHR.prototype.open, _send = XHR.prototype.send
  XHR.prototype.open = function (method, url) {
    this.__jsrv = { method:method, url:url, ts:Date.now() }
    return _open.apply(this, arguments)
  }
  XHR.prototype.send = function () {
    var self = this
    function onEnd() {
      if (!self.__jsrv) return
      var meta = { url:self.__jsrv.url, method:self.__jsrv.method, status:self.status,
        statusText:self.statusText, duration:Date.now()-self.__jsrv.ts }
      try {
        if (self.responseType === "" || self.responseType === "text") meta.body = (self.responseText || "").slice(0, 5000)
      } catch(e) {}
      try {
        var h = self.getAllResponseHeaders()
        if (h) { var headers = {}; h.split("\\n").forEach(function(l){ var m=l.match(/^([^:]+):\\s*(.*)/); if(m)headers[m[1]]=m[2] }); meta.headers=headers }
      } catch(e) {}
      post(meta)
    }
    self.addEventListener("load", onEnd)
    self.addEventListener("error", function () {
      if (!self.__jsrv) return
      post({ url:self.__jsrv.url, method:self.__jsrv.method, status:0, statusText:"NetworkError", duration:Date.now()-self.__jsrv.ts })
    })
    return _send.apply(this, arguments)
  }

  // Hook WebSocket
  if (typeof WebSocket !== "undefined") {
    var _WS = window.WebSocket
    window.WebSocket = function (url, protocols) {
      var ws = new _WS(url, protocols)
      ws.__jsrvURL = url
      // Hook send
      var _wsSend = ws.send
      ws.send = function (data) {
        post({ kind:"ws_send", url:url, body:String(data||"").slice(0,2000) })
        return _wsSend.call(this, data)
      }
      // Hook onmessage via addEventListener
      var _ael = ws.addEventListener
      ws.addEventListener = function (type, handler) {
        if (type === "message") {
          return _ael.call(this, type, function (e) {
            post({ kind:"ws_message", url:url, body:String(e.data||"").slice(0,2000) })
            return handler.call(this, e)
          })
        }
        return _ael.apply(this, arguments)
      }
      return ws
    }
    window.WebSocket.prototype = _WS.prototype
  }

  return "ready"
})()`

// ══════════════════════════════════════════════════════════════
// 模块 4: INJECT_SOURCE — 美化 + 跨脚本搜索
// ══════════════════════════════════════════════════════════════

export const INJECT_SOURCE = `(function () {
  if (window.__jsrvSourceInstalled) { return "already-installed" }
  window.__jsrvSourceInstalled = true

  // ── JS 美化器 ────────────────────────────────────────────
  window.__jsrvBeautify = function (code) {
    if (!code) return ""
    var out = "", indent = 0, IND = "  "
    var inStr = false, strCh = "", inComment = false
    var i = 0
    function peek(n) { return i+n < code.length ? code[i+n] : "" }

    while (i < code.length) {
      var c = code[i], nc = peek(1)

      if (!inComment) {
        // 字符串处理
        if (!inStr && (c === '"' || c === "'" || c === '\\\`')) { inStr = true; strCh = c; out += c; i++; continue }
        if (inStr && c === strCh && code[i-1] !== "\\\\") { inStr = false; strCh = ""; out += c; i++; continue }

        if (!inStr) {
          // 注释
          if (c === "/" && nc === "/") { out += "//"; i+=2; while(i<code.length&&code[i]!=='\\n'){out+=code[i];i++}; continue }
          if (c === "/" && nc === "*") { inComment=true; out+="/*"; i+=2; continue }

          // 结构
          if (c === "{") { out += " {\\n" + IND.repeat(++indent); i++; if(code[i]===' '||code[i]==='\\n')i++; continue }
          if (c === "}") { indent=Math.max(0,indent-1); out += "\\n" + IND.repeat(indent) + "}"; i++; if(code[i]===';')i++; if(code[i]===' '||code[i]==='\\n')i++; continue }
          if (c === ";") { out += ";\\n" + IND.repeat(indent); i++; while(i<code.length&&(code[i]===' '||code[i]==='\\n'))i++; continue }
        }
      } else {
        if (c === "*" && nc === "/") { inComment=false; out+="*/\\n"+IND.repeat(indent); i+=2; continue }
      }

      out += c; i++
    }
    return out
  }

  // ── 跨脚本搜索 ───────────────────────────────────────────
  window.__jsrvSearchAll = function (pattern, flags) {
    var re
    try { re = new RegExp(pattern, flags || "gi") } catch(e) { return { error: e.message, results:[], totalScripts:0 } }
    var results = []
    // 同时搜内联和外部脚本
    var nodes = document.querySelectorAll("script")
    for (var si = 0; si < nodes.length && results.length < 300; si++) {
      var s = nodes[si]
      var text = s.textContent || ""
      if (text.length === 0) continue
      var src = s.src || "(inline#" + si + ")"
      // 截断 URL 用于显示
      if (src.length > 80) { try { src = new URL(src).pathname } catch(e) { src = src.slice(-60) } }
      re.lastIndex = 0
      var match
      while ((match = re.exec(text)) !== null && results.length < 300) {
        var ctxStart = Math.max(0, match.index - 50)
        var ctxEnd = Math.min(text.length, match.index + match[0].length + 70)
        results.push({
          src: src,
          idx: match.index,
          match: match[0],
          context: text.slice(ctxStart, ctxEnd).replace(/\\s+/g, " ").trim()
        })
      }
    }
    return { results:results, totalScripts:nodes.length }
  }

  return "ready"
})()`

// ══════════════════════════════════════════════════════════════
// 模块 5: INJECT_FORENSICS — 存储转储 + 全局变量审查
// ══════════════════════════════════════════════════════════════

export const INJECT_FORENSICS = `(function () {
  if (window.__jsrvForensicsInstalled) { return "already-installed" }
  window.__jsrvForensicsInstalled = true

  window.__jsrvDumpStorage = function () {
    var result = { localStorage:{}, sessionStorage:{} }
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i)
        result.localStorage[k] = (localStorage.getItem(k) || "").slice(0, 500)
      }
    } catch(e) { result.localStorage._error = e.message }
    try {
      for (var i = 0; i < sessionStorage.length; i++) {
        var k = sessionStorage.key(i)
        result.sessionStorage[k] = (sessionStorage.getItem(k) || "").slice(0, 500)
      }
    } catch(e) { result.sessionStorage._error = e.message }
    return result
  }

  window.__jsrvDumpGlobals = function () {
    var results = []
    var skip = ["window","self","top","document","location","navigator","screen","history",
      "localStorage","sessionStorage","crypto","performance","console","fetch","alert","confirm",
      "prompt","open","close","postMessage","blur","focus","print","scroll","resizeTo"]
    var keys = Object.getOwnPropertyNames(window).sort()
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]
      if (k.indexOf("__jsrv") === 0 || skip.indexOf(k) >= 0) continue
      try {
        var v = window[k]
        var t = typeof v
        if (t === "function") continue
        if (t === "object" && v !== null) {
          if (Array.isArray(v)) results.push({ key:k, type:"array", len:v.length })
          else {
            try {
              var ownKeys = Object.keys(v).slice(0, 6)
              results.push({ key:k, type:"object", keys:ownKeys })
            } catch(e) { results.push({ key:k, type:"object" }) }
          }
        } else if (t !== "undefined") {
          results.push({ key:k, type:t, value:String(v).slice(0, 200) })
        }
      } catch(e) { results.push({ key:k, type:"error", value:e.message }) }
    }
    return results
  }

  return "ready"
})()`

// ══════════════════════════════════════════════════════════════
// 辅助：脚本枚举 / 源码提取 / 用户 JS 执行
// ══════════════════════════════════════════════════════════════

export function listScriptsJS(): string {
  return `(function () {
    var urls = [], seen = {}
    function add(u) {
      if (u && !seen[u]) { seen[u]=true; urls.push(u) }
    }
    try {
      var entries = performance.getEntriesByType("resource")
      for (var i = 0; i < entries.length; i++) add(entries[i].name)
    } catch(e) {}
    try {
      var scripts = document.querySelectorAll("script[src]")
      for (var i = 0; i < scripts.length; i++) add(scripts[i].src)
    } catch(e) {}
    return urls.slice(0, 300)
  })()`
}

export function fetchScriptJS(url: string, limit = 300000): string {
  return `(async function () {
    try {
      var r = await fetch(${JSON.stringify(url)}, { credentials: "include" })
      var t = await r.text()
      return { url:${JSON.stringify(url)}, status:r.status, length:t.length, content:t.slice(0,${limit}) }
    } catch(e) { return { url:${JSON.stringify(url)}, error:e.message } }
  })()`
}

export function evalUserJS(code: string): string {
  return `(async function () {
    try { return await eval(${JSON.stringify(code)}) }
    catch(e) { return "ERROR:" + e.message }
  })()`
}
