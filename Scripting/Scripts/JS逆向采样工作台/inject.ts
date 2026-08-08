// 注入到页面上下文的 JavaScript 模板。
// 注意：所有代码都会通过 WebViewController.evaluateJavaScript 执行，
// 因此必须显式使用 `return` 才能把结果带回原生侧。
// v2.0: +Promise Hook +异常记录 +fetch/XHR 响应拦截 +script 标签枚举

// ── 基础 Hook 设施 ──────────────────────────────────────────
// 提供三个全局函数：
//   window.__jsrvLog(path, args, ret, extra?) — 采样回传（messageHandlers.jsrvHook）
//   window.__jsrvHookPath(path)              — 包裹 window 路径下的函数
//   window.__jsrvHookProp(obj, prop)         — 包裹任意对象的单个属性
export const INJECT_BASE = `(function () {
  if (window.__jsrvInstalled) { return "already-installed" }
  window.__jsrvInstalled = true

  function summarize(v, maxLen) {
    maxLen = maxLen || 800
    try {
      if (v === undefined) return "undefined"
      if (v === null) return "null"
      var t = typeof v
      if (t === "function") return "[function]"
      if (t === "string") return '"' + String(v).slice(0, maxLen) + '"'
      if (t === "number" || t === "boolean") return String(v)
      if (t === "bigint") return String(v) + "n"
      if (v instanceof Error) return "[Error: " + v.message + "]"
      if (v instanceof Promise) return "[Promise]"
      if (Array.isArray(v)) {
        try { var s = JSON.stringify(v); return s ? s.slice(0, maxLen) : "[Array]" }
        catch (e) { return "[Array(" + v.length + ")]" }
      }
      try { var s = JSON.stringify(v); return s ? s.slice(0, maxLen) : String(v) }
      catch (e) { return String(v) }
    } catch (e) { return String(v) }
  }

  window.__jsrvLog = function (path, args, ret, extra) {
    try {
      var argList = []
      if (args && typeof args.length === "number") {
        for (var i = 0; i < args.length && i < 10; i++) argList.push(summarize(args[i]))
      }
      var msg = { kind: "call", path: path, args: argList, ret: summarize(ret), ts: Date.now() }
      if (extra && typeof extra === "object") {
        if (extra.error !== undefined) msg.error = summarize(extra.error)
        if (extra.async) msg.async = true
      }
      window.webkit.messageHandlers.jsrvHook.postMessage(msg)
    } catch (e) {}
  }

  window.__jsrvHookPath = function (path) {
    try {
      var clean = path.replace(/^window\\./, "")
      var parts = clean.split(".")
      if (parts.length < 1) return "invalid-path: " + path
      var obj = window
      for (var i = 0; i < parts.length - 1; i++) {
        if (obj[parts[i]] === undefined) return "not-found: " + clean
        obj = obj[parts[i]]
      }
      var fn = obj[parts[parts.length - 1]]
      if (typeof fn !== "function") return "not-a-function: " + clean
      if (fn.__jsrvHooked) return "already-hooked: " + clean

      var original = fn
      var wrapped = function () {
        try {
          var ret = original.apply(this, arguments)
          // Promise 返回值：.then() 后再 log 真实结果
          if (ret && typeof ret.then === "function") {
            return ret.then(function (v) {
              window.__jsrvLog(clean, arguments, v, { async: true })
              return v
            }, function (e) {
              window.__jsrvLog(clean, arguments, undefined, { async: true, error: e })
              throw e
            })
          }
          window.__jsrvLog(clean, arguments, ret)
          return ret
        } catch (e) {
          window.__jsrvLog(clean, arguments, undefined, { error: e })
          throw e
        }
      }
      wrapped.__jsrvHooked = true
      wrapped.__jsrvOriginal = original
      obj[parts[parts.length - 1]] = wrapped
      return "hooked: " + clean
    } catch (e) { return "error: " + e.message }
  }

  return "ready"
})()`

// ── 响应拦截（hook fetch + XMLHttpRequest）─────────────────
// 在页面就绪后单独安装，捕获原生侧 shouldAllowRequest 看不到的响应数据。
export const INJECT_RESPONSE_TRACKING = `(function () {
  if (window.__jsrvRespInstalled) { return "already-installed" }
  window.__jsrvRespInstalled = true

  function postResp(data) {
    try {
      window.webkit.messageHandlers.jsrvHook.postMessage({
        kind: "response",
        url: data.url,
        status: data.status,
        statusText: data.statusText || "",
        headers: data.headers || {},
        body: (data.body || "").slice(0, 3000),
        method: data.method || "GET",
        ts: Date.now()
      })
    } catch (e) {}
  }

  // Hook fetch
  var _fetch = window.fetch
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || ""
    var method = (init && init.method) || "GET"
    return _fetch.call(this, input, init).then(function (resp) {
      var clone = resp.clone()
      var meta = { url: url, method: method, status: clone.status, statusText: clone.statusText }
      var headers = {}
      if (clone.headers && typeof clone.headers.forEach === "function") {
        clone.headers.forEach(function (v, k) { headers[k] = v })
      }
      meta.headers = headers
      clone.text().then(function (body) { meta.body = body; postResp(meta) }).catch(function () { postResp(meta) })
      return resp
    }, function (err) {
      postResp({ url: url, method: method, status: 0, statusText: "NetworkError", body: err.message })
      throw err
    })
  }

  // Hook XMLHttpRequest
  var XHR = XMLHttpRequest
  var _open = XHR.prototype.open
  var _send = XHR.prototype.send
  XHR.prototype.open = function (method, url) {
    this.__jsrv = { method: method, url: url }
    return _open.apply(this, arguments)
  }
  XHR.prototype.send = function () {
    var self = this
    if (self.__jsrv) {
      self.addEventListener("load", function () {
        var meta = { url: self.__jsrv.url, method: self.__jsrv.method, status: self.status, statusText: self.statusText }
        try { meta.body = self.responseText ? self.responseText.slice(0, 3000) : "" } catch (e) {}
        try {
          var h = self.getAllResponseHeaders()
          if (h) {
            var headers = {}
            h.split("\\n").forEach(function (line) {
              var m = line.match(/^([^:]+):\\s*(.*)/)
              if (m) headers[m[1]] = m[2]
            })
            meta.headers = headers
          }
        } catch (e) {}
        postResp(meta)
      })
      self.addEventListener("error", function () {
        postResp({ url: self.__jsrv.url, method: self.__jsrv.method, status: 0, statusText: "NetworkError" })
      })
    }
    return _send.apply(this, arguments)
  }

  return "ready"
})()`

// ── 脚本枚举（增强版：resource entries + script 标签去重）──
export function listScriptsJS(): string {
  return `(function () {
    var urls = [], seen = {}
    function add(u) {
      if (u && u.indexOf(".js") >= 0 && !seen[u]) { seen[u] = true; urls.push(u) }
    }
    try {
      var entries = performance.getEntriesByType("resource")
      for (var i = 0; i < entries.length; i++) add(entries[i].name)
    } catch (e) {}
    try {
      var scripts = document.querySelectorAll("script[src]")
      for (var i = 0; i < scripts.length; i++) add(scripts[i].src)
    } catch (e) {}
    return urls.slice(0, 300)
  })()`
}

// ── fetch 脚本源码 ──────────────────────────────────────────
export function fetchScriptJS(url: string, limit = 300000): string {
  return `(async function () {
    try {
      var r = await fetch(${JSON.stringify(url)}, { credentials: "include" })
      var t = await r.text()
      return { url: ${JSON.stringify(url)}, status: r.status, length: t.length, content: t.slice(0, ${limit}) }
    } catch (e) {
      return { url: ${JSON.stringify(url)}, error: e.message }
    }
  })()`
}

// ── 执行用户 JS ─────────────────────────────────────────────
export function evalUserJS(code: string): string {
  return `(async function () {
    try {
      return await eval(${JSON.stringify(code)})
    } catch (e) {
      return "ERROR: " + e.message
    }
  })()`
}
