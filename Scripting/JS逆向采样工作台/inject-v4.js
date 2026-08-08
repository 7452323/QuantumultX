// JSReverse inject v4 — 注入到 WebView 页面上下文
// 作为独立 JS 文件在运行时读取，避免 TS 模板字面量解析问题
(function () {
  if (window.__jsrvV4) return
  window.__jsrvV4 = 1

  // ── BASE: Hook 核心 ──
  ;(function () {
    if (window.__jsrvInstalled) return
    window.__jsrvInstalled = 1
    function s(v, m) { m = m || 500; if (v === undefined) return "undefined"; if (v === null) return "null"; var t = typeof v; if (t === "function") return "[function]"; if (t === "string") return JSON.stringify(v).slice(0, m); if (t === "number" || t === "boolean" || t === "bigint") return String(v); if (v instanceof Error) return "[Error:" + v.message.slice(0, 100) + "]"; if (v instanceof Promise) return "[Promise]"; if (Array.isArray(v)) { try { return JSON.stringify(v).slice(0, m) } catch (e) { return "[Array(" + v.length + ")]" } } try { return JSON.stringify(v).slice(0, m) } catch (e) { return String(v).slice(0, m) } }
    window.__jsrvLog = function (p, args, ret, ex) {
      try {
        var a = [], i
        if (args && typeof args.length === "number") for (i = 0; i < args.length && i < 10; i++)a.push(s(args[i]))
        var msg = { kind: "call", path: p, args: a, ret: s(ret), ts: Date.now() }
        if (ex) { if (ex.error !== undefined)msg.error = s(ex.error); if (ex.async)msg.async = 1; if (ex.duration !== undefined)msg.duration = ex.duration }
        try { var st = new Error().stack; if (st)msg.stack = st.split("\n").slice(2, 8).join("\n").slice(0, 600) } catch (e) { }
        window.webkit.messageHandlers.jsrvHook.postMessage(msg)
      } catch (e) { }
    }
    window.__jsrvHookPath = function (path, opts) {
      opts = opts || {}; var condFn = null
      try {
        var p = path.replace(/^window\./, "").split("."), o = window, i
        for (i = 0; i < p.length - 1; i++) { if (o[p[i]] === undefined)return "nf:" + path; o = o[p[i]] }
        var fn = o[p[p.length - 1]]
        if (typeof fn !== "function") return "naf:" + path
        if (fn.__jsrvHooked) return "already:" + path
        if (opts.condition) try { condFn = eval("(function(a0,a1,a2,a3,a4){return (" + opts.condition + ")})") } catch (e) { return "badcond:" + e.message }
        var orig = fn, clean = path.replace(/^window\./, "")
        var w = function () {
          if (condFn) { try { var a = arguments; if (!condFn(a[0], a[1], a[2], a[3], a[4]))return orig.apply(this, arguments) } catch (e) { } }
          var st = performance.now()
          try {
            var ret = orig.apply(this, arguments), dr = performance.now() - st
            if (ret && typeof ret.then === "function") {
              return ret.then(function (v) { window.__jsrvLog(clean, arguments, v, { async: 1, duration: dr }); return v },
                function (e) { window.__jsrvLog(clean, arguments, undefined, { async: 1, duration: dr, error: e }); throw e })
            }
            window.__jsrvLog(clean, arguments, ret, { duration: dr }); return ret
          } catch (e) { window.__jsrvLog(clean, arguments, undefined, { error: e, duration: performance.now() - st }); throw e }
        }
        w.__jsrvHooked = 1; w.__jsrvOrig = orig; o[p[p.length - 1]] = w; return "ok:" + clean
      } catch (e) { return "err:" + e.message }
    }
  })();

  // ── PROBE: 全局扫描 ──
  ;(function () {
    if (window.__jsrvProbeInstalled) return
    window.__jsrvProbeInstalled = 1
    function cat(s) { s = s.toLowerCase(); if (/sign|encrypt|decrypt|aes|rsa|md5|sha|hash|hmac|pkcs|ecdsa|ecdh|ed25519|curve|cipher/.test(s))return "crypto"; if (/fetch|xhr|ajax|request|http|websocket|ws|send|post|get|api|rpc/.test(s))return "network"; if (/encode|decode|base64|btoa|atob|hex|utf8|stringify|parse|serialize|deserialize/.test(s))return "encoding"; if (/token|key|secret|auth|session|user|login|logout|signin|permission|role/.test(s))return "auth"; if (/storage|getitem|setitem|cookie|cache|db|store|save|load|persist/.test(s))return "storage"; if (/log|debug|console|error|warn|trace|info/.test(s))return "debug"; return "other" }
    window.__jsrvProbeGlobal = function () { var res = [], seen = new Set(), cnt = 0; function walk(obj, path, d) { if (cnt > 600 || d > 4 || !obj || seen.has(obj))return; seen.add(obj); try { var keys = Object.getOwnPropertyNames(obj), i; for (i = 0; i < keys.length && cnt < 600; i++) { var k = keys[i]; if (k.indexOf("__jsrv") === 0 || k.length > 60)continue; var fp = path ? path + "." + k : k; if (fp.length > 90)continue; try { var v = obj[k], t = typeof v; if (t === "function") { res.push({ path: fp, type: "function", category: cat(fp), native: Function.prototype.toString.call(v).indexOf("[native code]") >= 0 }); cnt++ } else if (t === "object" && v !== null) { if (d < 4)walk(v, fp, d + 1) } } catch (e) { } } } catch (e) { } } walk(window, "", 0); return res }
    window.__jsrvProbeResults = function (raw) { var cats = {}, i; for (i = 0; i < raw.length; i++) { var c = raw[i].category; if (!cats[c])cats[c] = []; cats[c].push(raw[i]) } var r = []; for (var c in cats) { r.push({ category: c, count: cats[c].length, top20: cats[c].slice(0, 20).map(function (x) { return { path: x.path, native: x.native } }) }) } return r }
    window.__jsrvHookClass = function (cn, methods) { var r = { className: cn, hooked: [], errors: [] }, cls, proto, i; try { cls = eval(cn); proto = cls && cls.prototype } catch (e) { r.errors.push("notfound:" + cn); return r } if (!proto) { r.errors.push("noproto"); return r } for (i = 0; i < methods.length; i++) { var m = methods[i], fp = cn + ".prototype." + m; try { if (typeof proto[m] !== "function") { r.errors.push(m + ":notfn"); continue } if (proto[m].__jsrvHooked) { r.hooked.push(fp + "(old)"); continue } var orig = proto[m]; var w = function () { var ret = orig.apply(this, arguments); window.__jsrvLog(fp, arguments, ret); return ret }; w.__jsrvHooked = 1; w.__jsrvOrig = orig; proto[m] = w; r.hooked.push(fp) } catch (e) { r.errors.push(m + ":" + e.message) } } return r }
  })();

  // ── TRACKING: 流量拦截 ──
  ;(function () {
    if (window.__jsrvRespInstalled) return
    window.__jsrvRespInstalled = 1
    function post(d) { try { window.webkit.messageHandlers.jsrvHook.postMessage(Object.assign({ kind: "response", ts: Date.now() }, d)) } catch (e) { } }
    // fetch
    var _f = window.fetch
    window.fetch = function (input, init) { var url = typeof input === "string" ? input : (input && input.url) || ""; var method = (init && init.method) || "GET", st = Date.now(); return _f.call(this, input, init).then(function (r) { var c = r.clone(), m = { url: url, method: method, status: c.status, statusText: c.statusText, duration: Date.now() - st }; var h = {}; if (c.headers && typeof c.headers.forEach === "function") { c.headers.forEach(function (v, k) { h[k] = v }) }; m.headers = h; c.text().then(function (b) { m.body = b.slice(0, 5000); post(m) }, function () { post(m) }); return r }, function (e) { post({ url: url, method: method, status: 0, statusText: "NetworkError", body: e.message, duration: Date.now() - st }); throw e }) }
    // XHR
    var X = XMLHttpRequest, _o = X.prototype.open, _s = X.prototype.send
    X.prototype.open = function (m, u) { this.__jsrv = { method: m, url: u, ts: Date.now() }; return _o.apply(this, arguments) }
    X.prototype.send = function () { var self = this; function done() { if (!self.__jsrv)return; var m = { url: self.__jsrv.url, method: self.__jsrv.method, status: self.status, statusText: self.statusText, duration: Date.now() - self.__jsrv.ts }; try { if (self.responseType === "" || self.responseType === "text")m.body = (self.responseText || "").slice(0, 5000) } catch (e) { } try { var rh = self.getAllResponseHeaders(); if (rh) { var h = {}, ls = rh.split("\r\n"); for (var i = 0; i < ls.length; i++) { var kv = ls[i].match(/^([^:]+):\s*(.*)/); if (kv && kv[1] && kv[2])h[kv[1].trim()] = kv[2].trim() } m.headers = h } } catch (e) { } post(m) } self.addEventListener("load", done); self.addEventListener("error", function () { if (self.__jsrv)post({ url: self.__jsrv.url, method: self.__jsrv.method, status: 0, statusText: "NetworkError", duration: Date.now() - self.__jsrv.ts }) }); return _s.apply(this, arguments) }
    // WebSocket
    if (typeof WebSocket !== "undefined") { var _ws = window.WebSocket; window.WebSocket = function (url, protocols) { var ws; try { ws = new _ws(url, protocols) } catch (e) { throw e }try { var _send = ws.send; ws.send = function (d) { post({ kind: "ws_send", url: url, body: String(d || "").slice(0, 2000) }); return _send.call(this, d) }; var _ael = ws.addEventListener; ws.addEventListener = function (t, h) { if (t === "message")return _ael.call(this, t, function (e) { post({ kind: "ws_message", url: url, body: String(e.data || "").slice(0, 2000) }); return h.call(this, e) }); return _ael.apply(this, arguments) } } catch (e) { }return ws }; window.WebSocket.prototype = _ws.prototype; window.WebSocket.CLOSED = _ws.CLOSED; window.WebSocket.CLOSING = _ws.CLOSING; window.WebSocket.CONNECTING = _ws.CONNECTING; window.WebSocket.OPEN = _ws.OPEN }
  })();

  // ── SOURCE: 源码分析 ──
  ;(function () {
    if (window.__jsrvSourceInstalled) return
    window.__jsrvSourceInstalled = 1
    window.__jsrvBeautify = function (code) { if (!code)return ""; var out = "", indent = 0, IND = "  ", i = 0, len = code.length; var inStr = 0, strCh = "", inCom = 0; while (i < len) { var c = code[i], nc = i + 1 < len ? code[i + 1] : "", pc = i > 0 ? code[i - 1] : ""; if (inCom) { if (c === "*" && nc === "/") { inCom = 0; out += "*/"; i += 2; continue }; out += c; i++; continue } if (!inStr && c === "/" && nc === "/") { out += "//"; i += 2; while (i < len && code[i] !== "\n") { out += code[i]; i++ }; continue } if (!inStr && c === "/" && nc === "*") { out += "/*"; i += 2; inCom = 1; continue } if (c === "'" || c === "\x22" || c === "`") { if (!inStr) { inStr = 1; strCh = c } else if (inStr === 1 && c === strCh && pc !== "\x5c") { inStr = 0; strCh = "" } } if (!inStr) { if (c === "{") { out += "{\n" + IND.repeat(++indent); i++; while (i < len && (code[i] === " " || code[i] === "\n"))i++; continue } if (c === "}") { indent = Math.max(0, indent - 1); out += "\n" + IND.repeat(indent) + "}"; i++; while (i < len && (code[i] === " " || code[i] === "\n" || code[i] === "," || code[i] === ";"))i++; continue } if (c === ";" && indent > 0) { out += ";\n" + IND.repeat(indent); i++; while (i < len && code[i] === " ")i++; continue } } out += c; i++ } return out }
    window.__jsrvSearchAll = function (pattern, flags) { var re; try { re = new RegExp(pattern, flags || "gi") } catch (e) { return { error: e.message, results: [], totalScripts: 0 } } var res = [], scripts = document.querySelectorAll("script"), si, s, text, src, match; for (si = 0; si < scripts.length && res.length < 200; si++) { s = scripts[si]; text = s.textContent || ""; if (!text)continue; src = s.src || ("(inline#" + si + ")"); if (src.length > 60)try { src = (new URL(src)).pathname } catch (e) { src = src.slice(-60) }re.lastIndex = 0; while ((match = re.exec(text)) && res.length < 200) { var ctx = Math.max(0, match.index - 40), ctx2 = Math.min(text.length, match.index + match[0].length + 60); res.push({ src: src, idx: match.index, match: match[0], ctx: text.slice(ctx, ctx2) }) } } return { results: res, totalScripts: scripts.length } }
  })();

  // ── FORENSICS: 取证 ──
  ;(function () {
    if (window.__jsrvForensicsInstalled) return
    window.__jsrvForensicsInstalled = 1
    window.__jsrvDumpStorage = function () { var r = { localStorage: {}, sessionStorage: {} }, i, k; try { for (i = 0; i < localStorage.length; i++) { k = localStorage.key(i); r.localStorage[k] = (localStorage.getItem(k) || "").slice(0, 500) } } catch (e) { r.localStorage._err = e.message }try { for (i = 0; i < sessionStorage.length; i++) { k = sessionStorage.key(i); r.sessionStorage[k] = (sessionStorage.getItem(k) || "").slice(0, 500) } } catch (e) { r.sessionStorage._err = e.message }return r }
    window.__jsrvDumpGlobals = function () { var r = [], skip = { window: 1, self: 1, top: 1, document: 1, location: 1, navigator: 1, screen: 1, history: 1, localStorage: 1, sessionStorage: 1, crypto: 1, performance: 1, console: 1, fetch: 1, alert: 1, confirm: 1, prompt: 1, open: 1, close: 1, postMessage: 1, blur: 1, focus: 1, print: 1, scroll: 1, frames: 1, parent: 1, Intl: 1, JSON: 1, Math: 1, Date: 1, RegExp: 1, Object: 1, Array: 1, String: 1, Number: 1, Boolean: 1, Function: 1, Symbol: 1, Map: 1, Set: 1, WeakMap: 1, WeakSet: 1, Proxy: 1, Reflect: 1, Promise: 1, Error: 1, TypeError: 1, ArrayBuffer: 1, DataView: 1, Int8Array: 1, Uint8Array: 1, Int16Array: 1, Uint16Array: 1, Int32Array: 1, Uint32Array: 1, Float32Array: 1, Float64Array: 1 }; var keys = Object.getOwnPropertyNames(window).sort(), i, k, v, t; for (i = 0; i < keys.length; i++) { k = keys[i]; if (k.indexOf("__jsrv") === 0 || skip[k])continue; try { v = window[k]; t = typeof v; if (t === "function")continue; if (t === "object" && v !== null) { if (Array.isArray(v))r.push({ key: k, type: "array", len: v.length }); else try { r.push({ key: k, type: "object", keys: Object.keys(v || {}).slice(0, 6) }) } catch (e) { r.push({ key: k, type: "object" }) } } else if (t !== "undefined")r.push({ key: k, type: t, val: String(v).slice(0, 150) }) } catch (e) { } } return r }
  })();
})()
