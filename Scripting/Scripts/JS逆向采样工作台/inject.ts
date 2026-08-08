// 注入到页面上下文的 JavaScript 模板。
// 注意：所有代码都会通过 WebViewController.evaluateJavaScript 执行，
// 因此必须显式使用 `return` 才能把结果带回原生侧。

// 一次性安装 hook 基础设施。
// 提供两个全局函数：
//   window.__jsrvHookPath(path)  —— 包裹 window 路径下的函数，记录参数/返回值
//   window.__jsrvLog(...)        —— 采样数据回传原生（messageHandlers.jsrvHook）
export const INJECT_BASE = `(function () {
  if (window.__jsrvInstalled) { return "already-installed" }
  window.__jsrvInstalled = true

  function summarize(v) {
    try {
      if (v === undefined) return "undefined"
      if (v === null) return "null"
      if (typeof v === "function") return "[function]"
      if (typeof v === "object") {
        var s = JSON.stringify(v)
        return s ? s.slice(0, 800) : String(v)
      }
      return String(v).slice(0, 800)
    } catch (e) {
      return String(v)
    }
  }

  window.__jsrvLog = function (path, args, ret) {
    try {
      var argList = []
      for (var i = 0; i < args.length && i < 10; i++) argList.push(summarize(args[i]))
      window.webkit.messageHandlers.jsrvHook.postMessage({
        kind: "call",
        path: path,
        args: argList,
        ret: summarize(ret),
        ts: Date.now()
      })
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
        var ret = original.apply(this, arguments)
        window.__jsrvLog(clean, arguments, ret)
        return ret
      }
      wrapped.__jsrvHooked = true
      obj[parts[parts.length - 1]] = wrapped
      return "hooked: " + clean
    } catch (e) {
      return "error: " + e.message
    }
  }

  return "ready"
})()`

// 枚举页面已加载的 JS 资源 URL（通过 Performance API）。
export function listScriptsJS(): string {
  return `(function () {
    var urls = []
    try {
      urls = performance.getEntriesByType("resource")
        .map(function (e) { return e.name })
        .filter(function (n) { return n.indexOf(".js") >= 0 })
    } catch (e) {}
    return urls.slice(0, 300)
  })()`
}

// 在页面上下文中 fetch 脚本源码（携带页面 Cookie，贴近真实请求）。
export function fetchScriptJS(url: string, limit = 300000): string {
  return `(async function () {
    try {
      var r = await fetch(${JSON.stringify(url)}, { credentials: "include" })
      var t = await r.text()
      return {
        url: ${JSON.stringify(url)},
        status: r.status,
        length: t.length,
        content: t.slice(0, ${limit})
      }
    } catch (e) {
      return { url: ${JSON.stringify(url)}, error: e.message }
    }
  })()`
}

// 执行用户输入的任意 JS（使用 eval，支持语句和表达式）。
export function evalUserJS(code: string): string {
  return `(async function () {
    try {
      return await eval(${JSON.stringify(code)})
    } catch (e) {
      return "ERROR: " + e.message
    }
  })()`
}
