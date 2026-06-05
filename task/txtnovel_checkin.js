/*
书香门第(txtnovel.vip)自动签到
环境变量: TXTNOVEL_COOKIE（多账号用换行或&分隔）
变量格式: cookie1&cookie2 或 每行一个

[task_local]
0 9 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/txtnovel_checkin.js, tag=书香门第签到, enabled=true

[rewrite_local]
^http:\/\/www\.txtnovel\.vip\/plugin\.php\?id=dsu_paulsign url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/txtnovel_checkin.js

[MITM]
hostname = www.txtnovel.vip
*/

const $ = new Env("书香门第签到");
const COOKIE_KEY = 'txtnovel_checkin_cookie';

!(async () => {
    // rewrite 模式：抓 Cookie
    if (typeof $request != "undefined") {
        await captureCookie();
        return;
    }

    // task 模式：执行签到
    const cookies = getCookies();
    if (!cookies || cookies.length === 0) {
        $.msg($.name, '⛔️ 未设置Cookie', '请设置 TXTNOVEL_COOKIE 环境变量');
        return;
    }

    let succ = 0, fail = 0;
    const msgs = [];
    for (let i = 0; i < cookies.length; i++) {
        $.log(`📱 账号${i + 1} 开始签到...`);
        try {
            const result = await doSign(cookies[i]);
            msgs.push(`账号${i + 1}: ${result}`);
            if (result.includes('✅')) succ++;
            else fail++;
        } catch (e) {
            $.logErr(e);
            msgs.push(`账号${i + 1}: ❌ ${e.message}`);
            fail++;
        }
        if (i < cookies.length - 1) await $.wait(2000);
    }

    $.msg($.name, `成功 ${succ} / 失败 ${fail}`, msgs.join('\n'));
})().catch(e => $.logErr(e)).finally(() => $.done());

// ── 抓 Cookie ──
async function captureCookie() {
    if ($request.method === 'OPTIONS') return;
    const raw = $request.headers || {};
    const cookie = raw['Cookie'] || raw['cookie'] || '';
    if (!cookie) {
        $.log('⛔️ 未抓到 Cookie');
        return;
    }
    $.setdata(cookie, COOKIE_KEY);
    $.msg($.name, '✅ Cookie 抓取成功', cookie.slice(0, 50) + '...');
}

// ── 获取 Cookie 列表 ──
function getCookies() {
    // 优先环境变量
    const env = process.env.TXTNOVEL_COOKIE || '';
    if (env) return env.split(/[&\n]/).filter(Boolean);
    // 其次持久化存储
    const stored = $.getdata(COOKIE_KEY);
    return stored ? [stored] : [];
}

// ── 执行签到 ──
async function doSign(cookie) {
    const signPageUrl = 'http://www.txtnovel.vip/plugin.php?id=dsu_paulsign:sign&mobile=yes';
    const signPostUrl = 'http://www.txtnovel.vip/plugin.php?id=dsu_paulsign:sign&operation=qiandao&infloat=0&inajax=0&mobile=yes';

    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2.1 Mobile/15E148 Safari/604.1';

    // Step 1: 获取 formhash
    const pageHtml = await http(signPageUrl, 'GET', {
        'Host': 'www.txtnovel.vip',
        'Cookie': cookie,
        'User-Agent': ua,
        'Accept': 'text/html,*/*',
        'Referer': 'http://www.txtnovel.vip/',
    });

    const match = pageHtml.match(/name="formhash"\s+value="([^"]+)"/);
    if (!match) {
        if (/请先登录|需要登录/.test(pageHtml)) return '❌ Cookie失效';
        return '❌ 未获取到formhash';
    }
    const formhash = match[1];
    $.log(`✅ formhash: ${formhash}`);

    // Step 2: 签到
    const postData = `formhash=${formhash}&qdxq=kx&qdmode=1&todaysay=`;
    const resp = await http(signPostUrl, 'POST', {
        'Host': 'www.txtnovel.vip',
        'Cookie': cookie,
        'User-Agent': ua,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'http://www.txtnovel.vip',
        'Referer': signPageUrl,
        'Accept': 'text/html,*/*',
    }, postData);

    // Step 3: 解析结果
    if (/签到成功|恭喜你签到成功/.test(resp)) return '✅ 签到成功';
    if (/已经签到|今日已签/.test(resp)) return '✅ 今日已签到';
    if (/请先登录|需要登录/.test(resp)) return '❌ Cookie失效';
    if (/验证码/.test(resp)) return '❌ 需要验证码';
    return '⚠️ 未知返回';
}

// ── HTTP 兼容层 ──
function http(url, method, headers, body) {
    return new Promise((resolve, reject) => {
        const opts = { url, headers, method };
        if (body) opts.body = body;

        if (typeof $task !== 'undefined') {
            $task.fetch(opts).then(r => resolve(r.body), e => reject(e));
        } else if (typeof $httpClient !== 'undefined') {
            const cb = (err, resp, data) => err ? reject(err) : resolve(data);
            method === 'GET' ? $httpClient.get(opts, cb) : $httpClient.post(opts, cb);
        } else {
            const mod = url.startsWith('https') ? require('https') : require('http');
            const parsed = new URL(url);
            const req = mod.request({
                hostname: parsed.hostname,
                path: parsed.pathname + parsed.search,
                method,
                headers
            }, resp => {
                let d = '';
                resp.on('data', c => d += c);
                resp.on('end', () => resolve(d));
            });
            req.on('error', reject);
            if (body) req.write(body);
            req.end();
        }
    });
}

// ── Env 通用框架 ──
function Env(t, e) {
    return new class {
        constructor(t, e) {
            this.name = t;
            this.data = null;
            this.logs = [];
            this.startTime = Date.now();
            this.log(`🔔 ${this.name}, 开始!`);
        }

        getEnv() {
            if (typeof $environment !== 'undefined' && $environment['surge-version']) return 'Surge';
            if (typeof $environment !== 'undefined' && $environment['stash-version']) return 'Stash';
            if (typeof module !== 'undefined' && module.exports) return 'Node.js';
            if (typeof $task !== 'undefined') return 'Quantumult X';
            if (typeof $loon !== 'undefined') return 'Loon';
            if (typeof $rocket !== 'undefined') return 'Shadowrocket';
        }

        isNode() { return this.getEnv() === 'Node.js'; }
        isQuanX() { return this.getEnv() === 'Quantumult X'; }
        isSurge() { return this.getEnv() === 'Surge'; }
        isLoon() { return this.getEnv() === 'Loon'; }

        getdata(key) {
            switch (this.getEnv()) {
                case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    return $persistentStore.read(key) || '';
                case 'Quantumult X':
                    return $prefs.valueForKey(key) || '';
                case 'Node.js':
                    return this.data && this.data[key] || '';
                default: return '';
            }
        }

        setdata(val, key) {
            switch (this.getEnv()) {
                case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    return $persistentStore.write(val, key);
                case 'Quantumult X':
                    return $prefs.setValueForKey(val, key);
                case 'Node.js':
                    this.data = this.data || {};
                    this.data[key] = val;
                    return true;
                default: return false;
            }
        }

        log(msg) { console.log(msg); this.logs.push(msg); }
        logErr(e) { this.log(`❌ ${e.message || e}`); if (e.stack) this.log(e.stack); }
        wait(ms) { return new Promise(r => setTimeout(r, ms)); }

        msg(title, subtitle, content) {
            switch (this.getEnv()) {
                case 'Quantumult X': $notify(title, subtitle || '', content || ''); break;
                case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    $notification.post(title, subtitle || '', content || ''); break;
                case 'Node.js': console.log(`${title}: ${subtitle} - ${content}`); break;
            }
        }

        done() {
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
            this.log(`结束! ${elapsed}s`);
            switch (this.getEnv()) {
                case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket':
                    $done({}); break;
                case 'Node.js': process.exit(0); break;
            }
        }
    }(t, e);
}
