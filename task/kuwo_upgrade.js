/*
 * 酷我音乐 升级脚本 v1.0
 * 功能：每日升级任务（签到、听歌10分钟、听小说10分钟、发布评论、看创意视频x5）
 * 
 * Cookie 获取：
 * 抓 integralapi.kuwo.cn 请求，从 Cookie 取 userid@websid
 * 
 * 环境变量：
 * KUWO_COOKIE = userid@websid （多账号用 & 分隔）
 * 
 * BoxJs: https://raw.githubusercontent.com/General74110/Scripts/master/boxjs/General.json
 * 
 * 定时：建议每天 8:00 执行一次
 */

const $ = new Env('酷我音乐(升级)');

const logs = 0;
const isNode = typeof process !== "undefined" && process.env;

if (isNode) {
    const dotenv = require('dotenv');
    dotenv.config();
}

let accounts = $.getdata('Kuwo_cookies') || ($.isNode() ? process.env.KUWO_COOKIE : '');
let accountArr = accounts.split(/[&]/).map(a => a.trim());

if (!accountArr.length || !accounts || !accounts.includes('@')) {
    $.msg($.name, '', '⚠️ 未检测到有效 Cookie，请先获取！');
    $.done();
}

const kw_headers = {
    'Origin': 'https://h5app.kuwo.cn',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Sec-Fetch-Mode': 'cors',
    'Accept': 'application/json, text/plain, */*',
    'Host': 'integralapi.kuwo.cn',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
    'Sec-Fetch-Site': 'same-site',
    'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1',
    'Sec-Fetch-Dest': 'empty',
    'Accept-Language': 'zh-CN,zh-Hans;q=0.9'
};

!(async () => {
    $.log(`检测到 ${accountArr.length} 个有效账户`);
    for (let i = 0; i < accountArr.length; i++) {
        const ID = accountArr[i];
        if (!ID.includes('@')) continue;
        const [loginUid, loginSid] = ID.split('@');
        const nickname = await getNickname(loginUid);
        const displayName = nickname || `用户${i + 1}`;
        if (!nickname) {
            $.msg($.name, '', `⚠️ 【${displayName}】Cookie 已失效`);
            continue;
        }
        let notifyMsg = [`【এ${displayName}এ】`];
        $.log(`开始执行 - ${displayName}`);

        const tasks = await getTaskList(loginUid, loginSid);
        if (!tasks) {
            notifyMsg.push('❌ 获取任务列表失败');
            sendMsg(notifyMsg);
            continue;
        }

        await doSign(loginUid, loginSid, tasks, notifyMsg);
        await doMusic(loginUid, loginSid, notifyMsg);
        await doNovel(loginUid, loginSid, notifyMsg);
        await doComment(loginUid, loginSid, notifyMsg);
        await doAdvert(loginUid, loginSid, tasks, notifyMsg);
        await checkRank(loginUid, loginSid, notifyMsg);
        sendMsg(notifyMsg);
    }
})().catch(e => $.logErr(e)).finally(() => $.done());

function sendMsg(arr) {
    const msg = arr.join('\n');
    if (isNode) {
        try { require('./sendNotify').sendNotify($.name, msg); } catch {}
    } else { $.msg($.name, '', msg); }
}

function getNickname(uid) {
    return new Promise(r => {
        $.get({url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`, headers: kw_headers}, (e, resp, d) => {
            try { r(JSON.parse(d).data?.nickname || ''); } catch { r(''); }
        });
    });
}

function getTaskList(uid, sid) {
    return new Promise(r => {
        $.get({url: `https://integralapi.kuwo.cn/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`, headers: kw_headers}, (e, resp, d) => {
            try {
                const o = JSON.parse(d);
                r(o.code === 200 && o.success ? o.data : null);
            } catch { r(null); }
        });
    });
}

function doSign(uid, sid, tasks, msg) {
    return new Promise(r => {
        const t = tasks?.find(x => x.taskType === 'sign');
        if (!t) { msg.push('⚠️ 未找到签到任务'); r(); return; }
        if (t.status === 1) { msg.push('🟢 每日签到: 今日已签到'); r(); return; }
        $.get({url: `https://integralapi.kuwo.cn/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`, headers: kw_headers}, (e, resp, d) => {
            try {
                const o = JSON.parse(d);
                if (o.code === 200) msg.push('🎉 每日签到: 成功');
                else if (o.msg?.includes('签到')) msg.push(`🟢 每日签到: ${o.msg}`);
                else msg.push(`⚠️ 每日签到: ${o.msg || '失败'}`);
            } catch { msg.push('❌ 每日签到: 请求失败'); }
            r();
        });
    });
}

function doMusic(uid, sid, msg) {
    return new Promise(r => {
        $.get({url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=mobile&goldNum=18`, headers: kw_headers}, (e, resp, d) => {
            try {
                const o = JSON.parse(d);
                if (o.code === 200 && o.success) msg.push('🎉 听歌10分钟: 成功');
                else if (o.data?.description === '今天已完成任务') msg.push('🟢 听歌10分钟: 今日已完成');
                else msg.push(`⚠️ 听歌10分钟: ${o.msg || '失败'}`);
            } catch { msg.push('❌ 听歌10分钟: 请求失败'); }
            r();
        });
    });
}

function doNovel(uid, sid, msg) {
    return new Promise(r => {
        $.get({url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=novel&goldNum=18`, headers: kw_headers}, (e, resp, d) => {
            try {
                const o = JSON.parse(d);
                if (o.code === 200 && o.success) msg.push('🎉 听小说10分钟: 成功');
                else if (o.data?.description === '今天已完成任务') msg.push('🟢 听小说10分钟: 今日已完成');
                else msg.push(`⚠️ 听小说10分钟: ${o.msg || '失败'}`);
            } catch { msg.push('❌ 听小说10分钟: 请求失败'); }
            r();
        });
    });
}

function doComment(uid, sid, msg) {
    return new Promise(r => {
        $.get({url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=comment&goldNum=10`, headers: kw_headers}, (e, resp, d) => {
            try {
                const o = JSON.parse(d);
                if (o.code === 200 && o.success) msg.push('🎉 发布评论: 成功');
                else if (o.data?.description === '今天已完成任务') msg.push('🟢 发布评论: 今日已完成');
                else msg.push(`⚠️ 发布评论: ${o.msg || '失败'}`);
            } catch { msg.push('❌ 发布评论: 请求失败'); }
            r();
        });
    });
}

async function doAdvert(uid, sid, tasks, msg) {
    const t = tasks?.find(x => x.taskType === 'advert');
    if (!t) { msg.push('⚠️ 未找到创意视频任务'); return; }
    const remain = (t.total || 1) - (t.finishCount || 0);
    if (remain <= 0) { msg.push('🟢 看创意视频: 今日已完成'); return; }
    let ok = 0;
    for (let i = 0; i < remain; i++) {
        try {
            const r = await new Promise(r2 => {
                $.get({url: `https://integralapi.kuwo.cn/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`, headers: kw_headers}, (e, resp, d) => {
                    try { r2(JSON.parse(d).code === 200); } catch { r2(false); }
                });
            });
            if (r) ok++;
        } catch {}
        await $.wait(2000);
    }
    if (ok > 0) msg.push(`🎉 看创意视频: 成功 ${ok}/${remain} 次`);
}

function checkRank(uid, sid, msg) {
    return new Promise(r => {
        $.get({url: `https://integralapi.kuwo.cn/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`, headers: kw_headers}, (e, resp, d) => {
            try {
                const o = JSON.parse(d);
                if (o.code === 200) msg.push(`📊 Lv.${o.data.rank} | 成长值: ${o.data.score}`);
            } catch {}
            r();
        });
    });
}

function Env(t, s) {
    return new (class {
        constructor(t, s) {
            this.name = t; this.data = null; this.dataFile = 'box.dat';
            this.logs = []; this.isMute = false;
            this.startTime = new Date().getTime();
            this.http = { get: (u, c) => this.get(u, c), post: (u, c) => this.post(u, c) };
        }
        isNode() { return typeof module !== "undefined" && !!module.exports; }
        isQuanX() { return typeof $task !== "undefined"; }
        isSurge() { return typeof $environment !== "undefined" && $environment['surge-version']; }
        isLoon() { return typeof $loon !== "undefined"; }
        isShadowrocket() { return typeof $rocket !== "undefined"; }
        isStash() { return typeof $environment !== "undefined" && $environment['stash-version']; }
        getval(t) {
            if (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()) return $persistentStore.read(t);
            if (this.isQuanX()) return $prefs.valueForKey(t);
            if (this.isNode()) { this.data = this.loaddata(); return this.data[t]; }
            return this.data && this.data[t] || null;
        }
        setval(t, s) {
            if (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()) return $persistentStore.write(t, s);
            if (this.isQuanX()) return $prefs.setValueForKey(t, s);
            if (this.isNode()) { this.data = this.loaddata(); this.data[s] = t; this.writedata(); return true; }
            return this.data && this.data[s] || null;
        }
        loaddata() {
            if (!this.isNode()) return {};
            this.fs = require('fs'); this.path = require('path');
            const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile);
            const i = this.fs.existsSync(t), r = !i && this.fs.existsSync(e);
            if (!i && !r) return {};
            try { return JSON.parse(this.fs.readFileSync(i ? t : e)); } catch { return {}; }
        }
        writedata() {
            if (!this.isNode()) return;
            this.fs = this.fs || require('fs'); this.path = this.path || require('path');
            this.fs.writeFileSync(this.path.resolve(this.dataFile), JSON.stringify(this.data));
        }
        get(t, s = () => {}) {
            if (t.headers) { delete t.headers['Content-Type']; delete t.headers['Content-Length']; }
            if (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()) {
                $httpClient.get(t, (e, r, i) => { if (!e && r) { r.body = i; r.statusCode = r.status || r.statusCode; r.status = r.statusCode; } s(e, r, i); });
            } else if (this.isQuanX()) {
                $task.fetch(t).then(r => { const { statusCode: e, statusCode: i, headers: r2, body: o } = r; s(null, { status: e, statusCode: i, headers: r2, body: o }, o); }, e => s(e?.error || 'UndefinedError'));
            } else if (this.isNode()) {
                const e = require('iconv-lite');
                if (!this.got) { this.got = require('got'); this.cktough = require('tough-cookie'); this.ckjar = new this.cktough.CookieJar(); }
                this.got(t).then(r => { const { statusCode: i, statusCode: n, headers: o, rawBody: h } = r, a = e.decode(h, this.encoding); s(null, { status: i, statusCode: n, headers: o, rawBody: h, body: a }, a); }, t => { const { message: i, response: r } = t; s(i, r, r && e.decode(r.rawBody, this.encoding)); });
            }
        }
        post(t, s = () => {}) {
            const e = t.method ? t.method.toLowerCase() : 'post';
            if (t.body && t.headers && !t.headers['Content-Type']) t.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            if (t.headers) delete t.headers['Content-Length'];
            if (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()) {
                $httpClient[e](t, (e2, r, i) => { if (!e2 && r) { r.body = i; r.statusCode = r.status || r.statusCode; r.status = r.statusCode; } s(e2, r, i); });
            } else if (this.isQuanX()) {
                t.method = e;
                $task.fetch(t).then(r => { const { statusCode: e2, statusCode: i, headers: r2, body: o } = r; s(null, { status: e2, statusCode: i, headers: r2, body: o }, o); }, e2 => s(e2?.error || 'UndefinedError'));
            } else if (this.isNode()) {
                const i = require('iconv-lite');
                if (!this.got) { this.got = require('got'); this.cktough = require('tough-cookie'); this.ckjar = new this.cktough.CookieJar(); }
                const { url: r, ...o } = t;
                this.got[e](r, o).then(t2 => { const { statusCode: n, statusCode: o2, headers: h, rawBody: a } = t2, c = i.decode(a, this.encoding); s(null, { status: n, statusCode: o2, headers: h, rawBody: a, body: c }, c); }, t2 => { const { message: i2, response: r2 } = t2; s(i2, r2, r2 && i.decode(r2.rawBody, this.encoding)); });
            }
        }
        msg(s = this.name, e = '', i = '', r) {
            if (!this.isMute) {
                if (this.isSurge() || this.isShadowrocket() || this.isLoon() || this.isStash()) $notification.post(s, e, i, typeof r === 'object' ? r : undefined);
                else if (this.isQuanX()) $notify(s, e, i, typeof r === 'object' ? r : undefined);
            }
        }
        log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
        logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
        wait(t) { return new Promise(s => setTimeout(s, t)); }
        done(t = {}) {
            const s = new Date().getTime(), e = (s - this.startTime) / 1000;
            this.log('', `🔔${this.name}, 结束! 🕛 ${e} 秒`);
            if (this.isSurge() || this.isShadowrocket() || this.isQuanX() || this.isLoon() || this.isStash()) $done(t);
            else if (this.isNode()) process.exit(1);
        }
    })(t, s);
}
