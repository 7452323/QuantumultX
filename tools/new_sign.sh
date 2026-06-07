#!/usr/bin/env bash
# ==============================================================
# 签到脚本脚手架 — 7452323 框架 v1.0
# 用法: bash new_sign.sh <脚本名> <显示名>
# 示例: bash new_sign.sh example "示例签到"
# ==============================================================
set -e

NAME=$1
DISPLAY=$2
DIR="/root/framework_check/task"

if [ -z "$NAME" ] || [ -z "$DISPLAY" ]; then
  echo "用法: bash new_sign.sh <脚本文件名> <显示名>"
  echo "示例: bash new_sign.sh example 示例签到"
  exit 1
fi

JS_FILE="$DIR/${NAME}_checkin.js"
MOD_FILE="/root/framework_check/surge/script/${NAME}_checkin.sgmodule"

# ===== 生成 .js =====
cat > "$JS_FILE" << JSEOF
/*
${DISPLAY} — 7452323 签到框架
自动采集 Cookie + 定时签到

[rewrite_local]
^https?:\\/\\/example\\.com\\/api\\/ url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/${NAME}_checkin.js

[task_local]
0 10 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/${NAME}_checkin.js, tag=${DISPLAY}, enabled=true

[MITM]
hostname = example.com
*/

const \$ = new Env('${DISPLAY}');

// 参数解析
const ARG = typeof \$argument === 'string'
  ? Object.fromEntries(\$argument.split('&').map(p => { const i = p.indexOf('='); return i > 0 ? [p.slice(0,i), p.slice(i+1)] : []; }).filter(x => x.length))
  : {};
const ENABLE_COOKIE = ARG.enable_cookie !== '0';
const DEBUG = ARG.debug === '1';

const COOKIE_KEY = '${NAME}_cookie';
const BASE = '';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';

!(async () => {
  // === Cookie 采集 ===
  if (typeof \$request !== 'undefined') {
    if (!ENABLE_COOKIE) { \$.done(); return; }
    const cookie = \$request.headers['Cookie'] || \$request.headers['cookie'] || '';
    if (cookie) {
      \$.setdata(cookie, COOKIE_KEY);
      \$.msg(\$.name, '✅ Cookie 已保存', '');
    }
    \$.done();
    return;
  }

  // === 签到 ===
  const cookie = \$.getdata(COOKIE_KEY);
  if (!cookie) {
    \$.msg(\$.name, '',
      \`⚠️ 未获取到 Cookie\n\n请先访问触发采集\n\n🎯 失败\`);
    \$.done();
    return;
  }

  const headers = { 'User-Agent': UA, 'Cookie': cookie };

  // TODO: 实现你的签到逻辑
  // 参考: 1. GET 获取 formhash/token
  //       2. POST 执行签到
  //       3. 解析响应（JSON/HTML）

  let notifyBody;

  // 成功后：
  notifyBody = \`👤 用户\n\${$.ts()}  ✅ 签到成功\n💰 奖励信息\n\n🎯 已完成\`;

  // 失败后：
  // notifyBody = \`👤 用户\n\${$.ts()}  ❌ 签到失败\n💬 错误信息\n\n🎯 失败\`;

  \$.msg(\$.name, '', notifyBody);
  \$.done();
})().catch(e => { \$.logErr(e); \$.done(); });

// ========== 平台适配层 ==========
function Env(name) {
  class _env {
    constructor(n) {
      this.name = n; this.data = null; this.logs = []; this.startTime = Date.now();
      this.log(\`🔔 \${this.name}, 开始!\`);
    }
    getEnv() {
      if (typeof \$task !== 'undefined') return 'Quantumult X';
      if (typeof \$environment !== 'undefined' && \$environment['surge-version']) return 'Surge';
      if (typeof \$environment !== 'undefined' && \$environment['stash-version']) return 'Stash';
      if (typeof \$loon !== 'undefined') return 'Loon';
      if (typeof \$rocket !== 'undefined') return 'Shadowrocket';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      return 'Unknown';
    }
    getdata(k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return \$prefs.valueForKey(k) || '';
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return \$persistentStore.read(k) || '';
        case 'Node.js': return this.data && this.data[k] || process.env[k] || '';
        default: return '';
      }
    }
    setdata(v, k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return \$prefs.setValueForKey(v, k);
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return \$persistentStore.write(v, k);
        case 'Node.js': this.data = this.data || {}; this.data[k] = v; return true;
        default: return false;
      }
    }
    log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
    logErr(t) { this.log('', \`❗️\${this.name}, 错误!\`, t?.message || t); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    rwait(mn, mx) { return this.wait(mn + Math.floor(Math.random() * (mx - mn))); }
    ts() { const d = new Date(); return \`\${String(d.getHours()).padStart(2,'0')}:\${String(d.getMinutes()).padStart(2,'0')}\`; }
    tryParse(s) { try { return JSON.parse(s); } catch { return null; } }
    msg(t, s, c) {
      switch (this.getEnv()) {
        case 'Quantumult X': \$notify(t, s||'', c||''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: \$notification.post(t, s||'', c||''); break;
        case 'Node.js': console.log(\`\${t}: \${s} - \${c}\`); break;
      }
    }
    done() {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(\`结束! \${elapsed}s\`);
      switch (this.getEnv()) {
        case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: \$done(); break;
        case 'Node.js': process.exit(0); break;
      }
    }
  }
  return new _env(name);
}

function httpGet(url, hdrs) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: hdrs };
    if (typeof \$task !== 'undefined')
      \$task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(reject);
    else if (typeof \$httpClient !== 'undefined')
      \$httpClient.get(opts, (e, r, b) => e ? reject(e) : resolve({ status: r.status || r.statusCode, body: b }));
    else reject(new Error('不支持的平台'));
  });
}

function httpPost(url, hdrs, body) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers: hdrs, body, method: 'POST' };
    if (typeof \$task !== 'undefined')
      \$task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(reject);
    else if (typeof \$httpClient !== 'undefined')
      \$httpClient.post(opts, (e, r, b) => e ? reject(e) : resolve({ status: r.status || r.statusCode, body: b }));
    else reject(new Error('不支持的平台'));
  });
}
JSEOF

echo "✅ 生成: $JS_FILE"

# ===== 生成 .sgmodule =====
cat > "$MOD_FILE" << MODEOF
#!name=${DISPLAY}
#!desc=自动签到
#!author=7452323
#!category=签到
#!arguments=cron:0 10 * * *,enable_cookie:1,debug:0,hostname:example.com
#!arguments-desc=签到模块参数设置\n├ cron: 定时运行时间\n├ enable_cookie: Cookie采集开关(0关闭/1开启)\n├ debug: 调试模式(0关闭/1开启)\n└ hostname: MITM域名

[Script]
${NAME}_checkin = type=cron,cronexp="{{{cron}}}",wake-system=1,timeout=30,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/${NAME}_checkin.js,argument="enable_cookie={{{enable_cookie}}}&debug={{{debug}}}"
${NAME}_checkin_cookie = type=http-request,pattern=^https?:\/\/example\.com\/,script-path=https://raw.githubusercontent.com/7452323/QuantumultX/main/task/${NAME}_checkin.js,requires-body=1

[MITM]
hostname = %APPEND% {{{hostname}}}
MODEOF

echo "✅ 生成: $MOD_FILE"
echo ""
echo "下一步："
echo "1. 编辑 $JS_FILE 补全签到逻辑（搜索 TODO）"
echo "2. 编辑 $MOD_FILE 修改 pattern 和 hostname"
echo "3. git add && git commit && git push"
