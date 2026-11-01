/*
------------------------------------------
@Author: 7452323
@Description: 书香门第（txtnovel.vip）Discuz 论坛签到 —— checkin-template 框架版
@Update: 2026.11.01
------------------------------------------

# Surge
[Script]
书香门第签到 = type=cron,cronexp="30 0 * * *",wake-system=1,timeout=60,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sxmd.js,script-update-interval=86400
书香门第Cookie = type=http-request,pattern=^http:\/\/www\.txtnovel\.vip\/,requires-body=0,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sxmd.js,script-update-interval=86400

[MITM]
hostname = www.txtnovel.vip

# Quantumult X
[task_local]
30 0 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sxmd.js, tag=书香门第签到, enabled=true

[rewrite_local]
^http:\/\/www\.txtnovel\.vip\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/sxmd.js

[MITM]
hostname = www.txtnovel.vip

存储键：sxmd_data（Cookie，多账号用 & 或换行分隔） / sxmd_ua（抓 Cookie 时一并存的 UA）
可选参数：enable_cookie=0 关闭抓取；debug=1 打印 HTTP 明细
------------------------------------------
*/

const ENV_NAME = '书香门第签到'
const CK_NAME = 'sxmd_data'
const UA_KEY = 'sxmd_ua'
const BASE_URL = 'http://www.txtnovel.vip'
const SIGN_PAGE = '/plugin.php?id=dsu_paulsign:sign'
const SIGN_POST = '/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=0&inajax=0&mobile=yes'
const UA_DEFAULT = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'

// ============ Env.js 精简版（接口与 chavyleung 原版兼容） ============
function Env(name) {
  // ⚠️ 不要靠 $environment['surge-version'] 判环境：http-request 上下文里不一定拿得到
  //    用能力探测（有没有 $persistentStore / $task）最稳
  const hasPS = typeof $persistentStore !== 'undefined'
  const hasTask = typeof $task !== 'undefined'
  const env = hasPS ? 'Surge' : (hasTask ? 'QuanX' : 'Unknown')
  const surgeFamily = hasPS
  const self = {
    env, name, startTime: Date.now(),
    isSurge: () => env === 'Surge',
    isQuanX: () => env === 'QuanX',
    isNode: () => env === 'Node.js',
    log: (...a) => console.log(...a),
    logErr: (e) => console.log('[ERROR] ' + ((e && e.message) || e)),
    error: (...a) => console.log('[ERROR]', ...a),
    msg: (t, s, b) => {
      if (surgeFamily) $notification.post(t || '', s || '', b || '')
      else if (env === 'QuanX') $notify(t || '', s || '', b || '')
      else console.log(t, s, b)
    },
    getdata: (k) => surgeFamily ? $persistentStore.read(k) : env === 'QuanX' ? $prefs.valueForKey(k) : null,
    setdata: (v, k) => surgeFamily ? $persistentStore.write(v, k) : env === 'QuanX' ? $prefs.setValueForKey(v, k) : false,
    toObj: (s, d = null) => { try { return JSON.parse(s) } catch (e) { return d } },
    toStr: (o) => { try { return JSON.stringify(o) } catch (e) { return '' } },
    request: (opt, method, cb) => {
      const o = typeof opt === 'string' ? { url: opt } : opt
      if (self.policy && !o.policy) o.policy = self.policy   // 需要固定出口时设 $.policy
      if (surgeFamily) {
        const fn = method === 'POST' ? $httpClient.post : $httpClient.get
        fn(o, (err, resp, body) => cb(err, { status: resp ? (resp.status || resp.statusCode) : 0, headers: (resp && resp.headers) || {} }, body || ''))
      } else if (env === 'QuanX') {
        $task.fetch(o).then((r) => cb(null, { status: r.statusCode, headers: r.headers || {} }, r.body || ''), (e) => cb(e))
      } else cb(new Error('unsupported env: ' + env))
    },
    get: (opt, cb) => self.request(opt, 'GET', cb),
    post: (opt, cb) => self.request(opt, 'POST', cb),
    done: () => { try { $done({}) } catch (e) { } },
  }
  return self
}

const $ = new Env(ENV_NAME)
// ⚠️ 不能写 const $argument = typeof $argument !== 'undefined' ? $argument : undefined
//    —— 会撞上 TDZ 自引用 ReferenceError，脚本一加载就死（0ms 无日志无输出）
const RAW_ARG = (typeof $argument !== 'undefined') ? $argument : undefined // eslint-disable-line

// ============ 参数 / 工具 ============
function argValue(key) {
  let v = ''
  if (typeof RAW_ARG === 'string' && RAW_ARG) {
    RAW_ARG.split(/[&,](?=[A-Za-z_][A-Za-z0-9_]*=)/).forEach((p) => {
      const i = p.indexOf('=')
      if (i > 0 && p.slice(0, i).trim() === key) v = p.slice(i + 1).trim()
    })
  } else if (RAW_ARG && typeof RAW_ARG === 'object') v = RAW_ARG[key] || ''
  try { v = decodeURIComponent(v) } catch (e) { }
  return v
}
const DEBUG = (argValue('debug') || $.getdata('is_debug') || '0') === '1'
const ENABLE_COOKIE = (argValue('enable_cookie') || '1') !== '0'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stripTags = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

// ============ Cookie 抓取（http-request 分支） ============
function captureCookie() {
  if (!ENABLE_COOKIE) return $.done()
  const h = $request.headers || {}
  const ck = h['Cookie'] || h['cookie'] || ''
  const ua = h['User-Agent'] || h['user-agent'] || ''
  $.log(`[capture] url=${$request.url} headerKeys=${Object.keys(h).length} ckLen=${ck.length} uaLen=${ua.length}`)
  // 诊断通道：把本次抓取情况写进 sxmd_dbg（便于远程排查）
  $.setdata($.toStr({
    at: new Date().toISOString(),
    url: $request.url,
    method: $request.method,
    keys: Object.keys(h),
    ckLen: ck.length,
    uaLen: ua.length,
  }), 'sxmd_dbg')
  if (ua) $.setdata(ua, UA_KEY)                 // UA 一起存：论坛风控与后续请求都靠它
  if (!ck) {
    $.log('[capture] no cookie header')
    $.msg(ENV_NAME, '❌ 采集失败', '未获取到 Cookie')
    return $.done()
  }
  if ($.getdata(CK_NAME) === ck) return $.done() // 没变化就不重复通知
  const ok = $.setdata(ck, CK_NAME)
  $.log(`[capture] saved=${ok} now=${($.getdata(CK_NAME) || '').length}`)
  $.msg(ENV_NAME, '✅ Cookie 已保存', '定时任务将自动签到')
  $.done()
}

// ============ 单账号 ============
class Account {
  constructor(raw, idx) {
    this.idx = idx
    this.cookie = String(raw || '').trim()
    this.ua = argValue(UA_KEY) || $.getdata(UA_KEY) || UA_DEFAULT
    this.name = ''
    this.uid = ''
  }
  baseHeaders(extra) {
    return Object.assign({
      'User-Agent': this.ua,
      Cookie: this.cookie,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9',
    }, extra || {})
  }
  req(path, opt) {
    const o = opt || {}
    return new Promise((resolve, reject) => {
      const cfg = { url: BASE_URL + path, headers: this.baseHeaders(o.headers) }
      if (o.body) cfg.body = o.body
      if (DEBUG) $.log(`[HTTP→] ${o.method || 'GET'} ${path}`)
      const fn = o.method === 'POST' ? $.post : $.get
      fn(cfg, (err, resp, body) => {
        if (err) return reject(new Error('网络错误: ' + ((err && err.message) || err)))
        if (DEBUG) $.log(`[HTTP←] ${resp.status} ${stripTags(body).slice(0, 200)}`)
        if (resp.status >= 400) return reject(new Error('HTTP ' + resp.status))
        resolve({ status: resp.status, headers: resp.headers, body: String(body || '') })
      })
    })
  }
  // 拉签到页：同时拿到 formhash / uid / 总金币 / 登录态
  async loadSignPage() {
    const r = await this.req(SIGN_PAGE)
    const b = r.body
    const fm = b.match(/name="formhash" value="([^"]+)"/)
    this.formhash = fm ? fm[1] : ''
    const um = b.match(/uid=(\d+)/)
    this.uid = um ? um[1] : ''
    this.pageBody = b
    this.loggedIn = /action=logout|href="[^"]*logging\.php\?action=logout/.test(b)
    const total = b.match(/总奖励[\s\S]{0,150}?<b[^>]*>(\d+)<\/b>/)
    this.pageTotal = total ? total[1] : ''
    const gained = b.match(/上次获得[\s\S]{0,80}?<b[^>]*>(\d+)<\/b>/)
    this.pageGained = gained ? gained[1] : ''
    return r
  }
  // login：判断 Cookie 是否有效（Discuz 登录态 = 页面出现退出链接）
  async login() {
    await this.loadSignPage()
    if (!this.loggedIn) return false
    if (this.uid && !this.name) {
      try {
        const p = await this.req(`/home.php?mod=space&uid=${this.uid}`)
        const t = p.body.match(/<title>([^<]+)<\/title>/)
        if (t) {
          const title = t[1]
          const i = title.indexOf('的')
          if (i > 0) this.name = title.slice(0, i).trim()
        }
      } catch (e) { }
    }
    this.name = this.name || (this.uid ? 'UID ' + this.uid : 'txtnovel')
    return true
  }
  // getPoint：总金币
  async getPoint() {
    const v = Number(this.pageTotal)
    return isNaN(v) ? null : v
  }
  // signin：提交签到
  async signin() {
    if (!this.formhash) return { ok: false, already: false, msg: '未取到 formhash（页面异常或需人机验证）' }
    const r = await this.req(SIGN_POST, {
      method: 'POST',
      headers: {
        Origin: BASE_URL,
        Referer: BASE_URL + SIGN_PAGE,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `formhash=${encodeURIComponent(this.formhash)}&qdxq=kx`,
    })
    const b = r.body
    const already = /已经签到|今日已经签到/.test(b)
    let total = this.pageTotal
    let gained = this.pageGained
    const rt = b.match(/总奖励[\s\S]{0,150}?<b[^>]*>(\d+)<\/b>/)
    if (rt) total = rt[1]
    const rg = b.match(/上次获得[\s\S]{0,80}?<b[^>]*>(\d+)<\/b>/)
    if (rg) gained = rg[1]
    this.pageTotal = total
    this.pageGained = gained
    if (already) return { ok: true, already: true, msg: '今日已签到', total, gained }
    if (/签到成功|恭喜/.test(b)) return { ok: true, already: false, msg: '签到成功', total, gained }
    return { ok: false, already: false, msg: stripTags(b).slice(0, 160) || ('HTTP ' + r.status), total, gained }
  }
}

// ============ 主流程 ============
async function main() {
  const raw = argValue(CK_NAME) || $.getdata(CK_NAME) || ''
  const list = String(raw).split(/[\n&]/).map((s) => s.trim()).filter(Boolean)
  if (!list.length) {
    $.msg(ENV_NAME, '未配置 Cookie', '请在浏览器打开一次 www.txtnovel.vip（登录状态），脚本会自动抓取')
    return $.done()
  }

  const lines = []
  let okCount = 0
  for (let i = 0; i < list.length; i++) {
    const acc = new Account(list[i], i + 1)
    try {
      const alive = await acc.login()
      if (!alive) {
        lines.push(`账号${acc.idx} Cookie 已失效，请重新打开站点抓取`)
        continue
      }
      const before = await acc.getPoint()
      await sleep(400)
      const r = await acc.signin()
      await sleep(300)
      const after = r.total != null ? Number(r.total) : await acc.getPoint()
      if (r.ok) okCount++
      const delta = (before != null && after != null) ? after - before : (r.gained != null ? Number(r.gained) : null)
      const tail = (after != null ? ` 总金币:${after}` : '') + (delta != null && delta > 0 ? ` +${delta}` : '')
      lines.push(r.ok
        ? `「${acc.name}」${r.already ? '重复签到' : '签到成功'}${tail}`
        : `「${acc.name}」签到失败 ${r.msg}`)
    } catch (e) {
      lines.push(`账号${acc.idx} 异常: ${(e && e.message) || e}`)
    }
  }

  $.log('\n' + lines.join('\n'))
  $.msg(`${ENV_NAME} ${okCount}/${list.length}`, '', lines.join('\n'))
  $.done()
}

// ============ 入口 ============
// 诊断：记录本次实际运行环境（远程排查用，无副作用）
try {
  $persistentStore.write('typeofRequest=' + (typeof $request) +
    ' typeofDone=' + (typeof $done) +
    ' url=' + ((typeof $request !== 'undefined' && $request && $request.url) || '-') +
    ' at=' + new Date().toISOString(), 'sxmd_dbg2')
} catch (e) { }

if (typeof $request !== 'undefined' && $request) {
  captureCookie()
} else {
  main().catch((e) => {
    $.logErr(e)
    $.msg(ENV_NAME, '执行异常', String((e && e.message) || e))
    $.done()
  })
}
