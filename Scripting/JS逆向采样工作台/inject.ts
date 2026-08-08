// inject.ts v4.0 — 辅助函数 + 注入文件引用
// 主注入代码移到 inject-v4.js（独立 JS 文件）避免 TS 模板字面量解析问题

// FileManager 是 Scripting 全局对象
const FM = FileManager

// 运行时加载注入代码
export function loadInjectCode(): string {
  const base = FM.documentsDirectory
  const path = base + "/scripts/JS逆向采样工作台/inject-v4.js"
  try {
    return FM.readAsStringSync(path)
  } catch (e) {
    console.log("load inject-v4.js failed:", e)
    return ""
  }
}

// ── 辅助：脚本枚举 / 源码提取 / 用户 JS / 请求重放 ──────

export function listScriptsJS(): string {
  return `(function(){var u=[],s={};function a(x){if(x&&!s[x]){s[x]=1;u.push(x)}}
    try{var e=performance.getEntriesByType("resource");for(var i=0;i<e.length;i++)a(e[i].name)}catch(e){}
    try{var ss=document.querySelectorAll("script[src]");for(var i=0;i<ss.length;i++)a(ss[i].src)}catch(e){}
    return u.slice(0,300)})()`
}

export function fetchScriptJS(url: string, limit = 300000): string {
  return `(async function(){
    try{var r=await fetch(${JSON.stringify(url)},{credentials:"include"})
    var t=await r.text()
    return{url:${JSON.stringify(url)},status:r.status,length:t.length,content:t.slice(0,${limit})}}
    catch(e){return{url:${JSON.stringify(url)},error:e.message}}})()`
}

export function evalUserJS(code: string): string {
  return `(async function(){try{return await eval(${JSON.stringify(code)})}catch(e){return"ERR:"+e.message}})()`
}

export function replayRequestJS(url: string, method: string, headers: Record<string, string>, body?: string): string {
  const h = JSON.stringify(headers)
  const b = body ? JSON.stringify(body) : "undefined"
  return `(async function(){
    try{
      var opts={method:${JSON.stringify(method)},headers:${h},credentials:"include"}
      if(${b}!==undefined){opts.body=${b}}
      var r=await fetch(${JSON.stringify(url)},opts)
      var t=await r.text()
      return{url:${JSON.stringify(url)},status:r.status,statusText:r.statusText,body:t.slice(0,5000),length:t.length}
    }catch(e){return{url:${JSON.stringify(url)},error:e.message}}
  })()`
}
