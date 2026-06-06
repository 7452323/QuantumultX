/*
书香门第(txtnovel.vip)自动签到 — Surge/QX 通用版

[rewrite_local]
^http:\/\/www\.txtnovel\.vip url script-request-header txtnovel_checkin.js

[task_local]
0 9 * * * txtnovel_checkin.js, tag=书香门第签到, enabled=true

[mitm]
hostname = www.txtnovel.vip

Cookie 采集：访问 txtnovel.vip 任意页面自动保存 Cookie
Cookie KEY: txtnovel_cookie
多账号用 & 分隔
*/

const $ = new Env('书香门第签到');

const KEY = 'txtnovel_cookie';
const SEP = '&';
const HOST = 'http://www.txtnovel.vip';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

!(async () => {
  if (typeof $request !== 'undefined') {
    const url = $request.url || '';
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (url.includes('txtnovel.vip') && cookie) {
      // 保留关键 cookie 字段：auth, saltkey, sid
      const auth = cookie.match(/dLJe_2132_auth=([^;]+)/);
      const saltkey = cookie.match(/dLJe_2132_saltkey=([^;]+)/);
      const sid = cookie.match(/dLJe_2132_sid=([^;]+)/);
      if (auth || (saltkey && sid)) {
        let saveCookie = '';
        if (auth) saveCookie = `dLJe_2132_auth=${auth[1]}`;
        if (saltkey) saveCookie += `; dLJe_2132_saltkey=${saltkey[1]}`;
        if (sid) saveCookie += `; dLJe_2132_sid=${sid[1]}`;
        saveCookie = saveCookie.replace(/^; /, '');

        let list = ($.getdata(KEY) || '').split(SEP).filter(Boolean);
        // 去重：只要 auth 部分相同就算同一个账号
        const authVal = auth ? auth[1] : '';
        const exists = list.some(c => authVal && c.includes(authVal));
        if (!exists && saveCookie) {
          list.push(saveCookie);
          $.setdata(list.join(SEP), KEY);
        }
        $.msg($.name, `✅ Cookie 已保存 (${list.length} 个账号)`, '');
      }
    }
    $.done();
    return;
  }

  const raw = $.getdata(KEY);
  if (!raw) {
    $.msg($.name, '⚠️ 没 Cookie', '请先打开 txtnovel.vip 触发采集');
    $.done();
    return;
  }

  const accounts = raw.split(SEP).map(a => a.trim()).filter(Boolean);
  $.log(`检测到 ${accounts.length} 个账户`);

  for (const cookie of accounts) {
    // 签到
    await doSign(cookie);
  }

  $.done();
})().catch(e => { $.logErr(e); $.done(); });

async function doSign(cookie) {
  // 1. 先访问首页获取 formhash
  const homeRes = await httpGet(`${HOST}/`);
  const html = typeof homeRes.body === 'string' ? homeRes.body : '';
  const fm = html.match(/formhash=([a-z0-9]+)/i);
  if (!fm) {
    // 可能已登录带了 auth，但页面没显示 formhash，直接试签到
    $.log('❌ 未找到 formhash，尝试直接签到');
    const res = await httpGet(`${HOST}/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1`);
    const text = res.body || '';
    if (/签到成功|恭喜你/.test(text)) $.log('✅ 签到成功');
    else if (/已经签到|今日已签/.test(text)) $.log('✅ 今日已签到');
    else $.log('❌ 签到失败: Cookie 可能失效');
    return;
  }

  const formhash = fm[1];

  // 2. 执行签到
  const signRes = await httpGet(`${HOST}/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1&formhash=${formhash}`);
  const txt = signRes.body || '';
  if (/签到成功|恭喜你/.test(txt)) {
    $.log('✅ 签到成功');
  } else if (/已经签到|今日已签/.test(txt)) {
    $.log('✅ 今日已签到');
  } else {
    // 带 formhash 的签到 Post
    const postRes = await httpPost(`${HOST}/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=1&inajax=1`, {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cookie': cookie,
      'User-Agent': UA,
      'Referer': HOST + '/'
    }, `formhash=${formhash}&signsubmit=yes`);
    const postTxt = postRes.body || '';
    if (/签到成功|恭喜你/.test(postTxt)) {
      $.log('✅ 签到成功');
    } else if (/已经签到|今日已签/.test(postTxt)) {
      $.log('✅ 今日已签到');
    } else if (/请先登录/.test(postTxt)) {
      $.log('❌ Cookie 失效');
    } else {
      $.log(`❌ 签到失败: ${postTxt.substring(0, 100)}`);
    }
  }
}

function tryParse(str) { try { return JSON.parse(str); } catch { return null; } }

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const opts = { url: url.indexOf('://') === -1 ? HOST + url : url, headers: { 'User-Agent': UA } };
    if (typeof $task !== 'undefined')
      $task.fetch(opts).then(r => resolve({ status: r.statusCode, body: r.body })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.get(opts, (err, resp, body) => { if (err) reject(err); else resolve({ status: resp.status || resp.statusCode, body }); });
    else reject(new Error('不支持的平台'));
  });
}

function httpPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = { url, headers, body };
    if (typeof $task !== 'undefined')
      $task.fetch({ ...opts, method: 'POST' }).then(r => resolve({ status: r.statusCode, body: r.body })).catch(e => reject(e));
    else if (typeof $httpClient !== 'undefined')
      $httpClient.post(opts, (err, resp, body) => { if (err) reject(err); else resolve({ status: resp.status || resp.statusCode, body }); });
    else reject(new Error('不支持的平台'));
  });
}

function Env(name, opts) {
  class _env {
    constructor(n, o) { this.name = n; this.data = null; this.logs = []; this.startTime = Date.now(); this.log(`🔔 ${this.name}, 开始!`); }
    getEnv() {
      if (typeof $task !== 'undefined') return 'Quantumult X';
      if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
      if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
      if (typeof $loon !== 'undefined') return 'Loon';
      if (typeof $rocket !== 'undefined') return 'Shadowrocket';
      if (typeof module !== 'undefined' && module.exports) return 'Node.js';
      return 'Unknown';
    }
    getdata(k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return $prefs.valueForKey(k) || '';
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.read(k) || '';
        case 'Node.js': return this.data && this.data[k] || process.env[k] || '';
        default: return '';
      }
    }
    setdata(v, k) {
      switch (this.getEnv()) {
        case 'Quantumult X': return $prefs.setValueForKey(v, k);
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.write(v, k);
        case 'Node.js': this.data = this.data || {}; this.data[k] = v; return true;
        default: return false;
      }
    }
    log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
    logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
    msg(t, s, c) {
      switch (this.getEnv()) {
        case 'Quantumult X': $notify(t, s||'', c||''); break;
        case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $notification.post(t, s||'', c||''); break;
        case 'Node.js': console.log(`${t}: ${s} - ${c}`); break;
      }
    }
    done() {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
      this.log(`结束! ${elapsed}s`);
      this.msg(this.name, `${elapsed}s`, this.logs.filter(l => l.includes('❌')).length > 0 ? '失败' : '成功');
      switch (this.getEnv()) {
        case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $done(); break;
        case 'Node.js': process.exit(0); break;
      }
    }
  }
  return new _env(name, opts);
}
