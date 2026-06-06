/*
酷我音乐 升级签到
cron 30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwo_upgrade.js

脚本兼容: Surge, Quantumult X, Loon, Shadowrocket, Node.js

功能：每日签到 + 听歌10分钟 + 听小说10分钟 + 发布评论 + 看创意视频x5

Cookie 采集: 登录酷我音乐后抓 integralapi.kuwo.cn 请求，取 Cookie 中的 userid 和 websid
Cookie 格式: userid@websid（多账号用 & 分隔）
环境变量: KUWO_COOKIE

[rewrite_local]
^https?:\/\/integralapi\.kuwo\.cn\/api\/v1\/online\/sign\/v1\/music\/userBase url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwo_upgrade.js

[task_local]
30 8 * * * https://raw.githubusercontent.com/7452323/QuantumultX/main/task/kuwo_upgrade.js, tag=酷我音乐(升级), enabled=true

[MITM]
hostname = integralapi.kuwo.cn

⚠️ 免责声明:
1、此脚本仅用于学习研究，请于下载后24小时内删除。
2、使用本脚本所造成的一切后果由使用者自行承担。
*/
(function() {
  // ===================== 配置 =====================
  const APP_CONFIG = {
    name: '酷我音乐(升级)',
    storageKey: 'kuwo_upgrade',
    cookiePattern: /([^@]+@[^@]+)/,
    accountSeparator: '&',
    dedupPattern: /^(\d+)@/,
    cookieTrigger: 'userBase',
    notifyTitle: '酷我音乐(升级)',
    checkin: {
      url: 'https://integralapi.kuwo.cn',
      method: 'GET',
      headers: {
        'Origin': 'https://h5app.kuwo.cn',
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
        'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
      }
    }
  };

  const $ = new Env(APP_CONFIG.name);
  const API = 'https://integralapi.kuwo.cn';
  const logs = 0;
  let notifyMsg = [];

  const kw_headers = {
    'Origin': 'https://h5app.kuwo.cn',
    'Accept-Encoding': 'gzip, deflate, br',
    'Accept': 'application/json, text/plain, */*',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
    'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
  };

  // ===================== Cookie 采集 =====================
  if (typeof $request !== 'undefined') {
    if ($request.url.includes('userBase')) {
      const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
      if (cookie) {
        const uid = cookie.match(/userid=(\d+)/);
        const sid = cookie.match(/websid=(\d+)/);
        if (uid && sid) {
          const val = uid[1] + '@' + sid[1];
          let list = ($.getdata(APP_CONFIG.storageKey) || '').split('&').filter(Boolean);
          if (!list.includes(val)) {
            list.push(val);
            $.setdata(list.join('&'), APP_CONFIG.storageKey);
          }
          $.msg(APP_CONFIG.name, `Cookie 已保存 (${list.length} 个账号)`, '');
        }
      }
    }
    $done();
  }

  // ===================== 工具函数 =====================
  async function httpGet(url) {
    return new Promise(r => {
      if ($.isQuanX()) {
        $task.fetch({ url, headers: kw_headers }).then(resp => {
          try { r(JSON.parse(resp.body)); } catch { r(null); }
        }).catch(() => r(null));
      } else if ($.isSurge() || $.isLoon() || $.isShadowrocket() || $.isStash()) {
        $httpClient.get({ url, headers: kw_headers }, (e, resp, data) => {
          try { r(JSON.parse(data)); } catch { r(null); }
        });
      } else {
        const mod = require(url.startsWith('https') ? 'https' : 'http');
        const u = new URL(url);
        mod.get({ hostname: u.hostname, path: u.pathname + u.search, headers: kw_headers }, resp => {
          let d = '';
          resp.on('data', c => d += c);
          resp.on('end', () => { try { r(JSON.parse(d)); } catch { r(null); } });
        }).on('error', () => r(null));
      }
    });
  }

  async function getNickname(uid) {
    const res = await httpGet(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
    return res?.data?.nickname || '';
  }

  async function getTasks(uid, sid) {
    const res = await httpGet(`${API}/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
    return res?.data || null;
  }

  // ===================== 主流程 =====================
  !(async () => {
    const isNode = typeof process !== 'undefined' && process.env;
    let accounts = $.getdata(APP_CONFIG.storageKey) || (isNode ? process.env.KUWO_COOKIE : '') || '';
    let accountArr = accounts.split(/[&]/).map(a => a.trim()).filter(Boolean);

    if (!accountArr.length) {
      $.msg(APP_CONFIG.name, '⚠️ 未获取到Cookie', '请先登录酷我音乐');
      return;
    }

    $.log(`检测到 ${accountArr.length} 个账户`);
    for (let i = 0; i < accountArr.length; i++) {
      const ID = accountArr[i];
      if (!ID.includes('@')) continue;
      const [uid, sid] = ID.split('@');
      const nickname = await getNickname(uid);
      const name = nickname || `用户${i + 1}`;
      if (!nickname) {
        $.msg(APP_CONFIG.name, `⚠️ ${name}`, 'Cookie 已失效');
        continue;
      }
      notifyMsg = [`【${name}】`];
      $.log(`执行 - ${name}`);

      const tasks = await getTasks(uid, sid);
      if (!tasks) { notifyMsg.push('❌ 获取任务列表失败'); sendMsg(); continue; }

      // 签到
      const signTask = tasks.find(x => x.taskType === 'sign');
      if (signTask && signTask.status !== 1) {
        const r = await httpGet(`${API}/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`);
        notifyMsg.push(r?.code === 200 ? '🎉 每日签到: 成功' : `⚠️ 每日签到: ${r?.msg || '失败'}`);
      } else {
        notifyMsg.push('🟢 每日签到: 今日已签到');
      }

      // 听歌、小说、评论
      const tasks2 = ['mobile', 'novel', 'comment'];
      const golds = { mobile: 18, novel: 18, comment: 10 };
      const names = { mobile: '听歌10分钟', novel: '听小说10分钟', comment: '发布评论' };
      for (const task of tasks2) {
        const r = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=${task}&goldNum=${golds[task]}`);
        if (r?.code === 200) notifyMsg.push(`🎉 ${names[task]}: 成功`);
        else notifyMsg.push(`🟢 ${names[task]}: ${r?.data?.description || r?.msg || '失败'}`);
      }

      // 看创意视频
      const advertTask = tasks.find(x => x.taskType === 'advert');
      const remain = (advertTask?.total || 5) - (advertTask?.finishCount || 0);
      if (remain > 0) {
        let ok = 0;
        for (let i = 0; i < remain; i++) {
          const r = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`);
          if (r?.code === 200) ok++;
          await $.wait(2000);
        }
        notifyMsg.push(ok > 0 ? `🎉 看创意视频: 成功 ${ok}/${remain} 次` : '❌ 看创意视频: 失败');
      } else {
        notifyMsg.push('🟢 看创意视频: 今日已完成');
      }

      // 查询等级
      const rank = await httpGet(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
      if (rank?.code === 200) notifyMsg.push(`📊 Lv.${rank.data.rank} 成长值:${rank.data.score}`);

      sendMsg();
    }
  })().catch(e => $.logErr(e)).finally(() => $.done());

  function sendMsg() {
    const msg = notifyMsg.join('\n');
    if ($.isNode()) {
      try { require('./sendNotify').sendNotify(APP_CONFIG.name, msg); } catch {}
    } else { $.msg(APP_CONFIG.name, '', msg); }
  }

  // ===================== Env =====================
  function Env(name, opts) {
    return new (class {
      constructor(name, opts) {
        this.name = name;
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
        return 'Unknown';
      }
      isNode() { return this.getEnv() === 'Node.js'; }
      isQuanX() { return this.getEnv() === 'Quantumult X'; }
      isSurge() { return this.getEnv() === 'Surge'; }
      isLoon() { return this.getEnv() === 'Loon'; }
      isShadowrocket() { return this.getEnv() === 'Shadowrocket'; }
      isStash() { return this.getEnv() === 'Stash'; }
      getdata(key) {
        switch (this.getEnv()) {
          case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.read(key) || '';
          case 'Quantumult X': return $prefs.valueForKey(key) || '';
          case 'Node.js': return this.data && this.data[key] || process.env[key] || '';
          default: return '';
        }
      }
      setdata(val, key) {
        switch (this.getEnv()) {
          case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': return $persistentStore.write(val, key);
          case 'Quantumult X': return $prefs.setValueForKey(val, key);
          case 'Node.js': this.data = this.data || {}; this.data[key] = val; return true;
          default: return false;
        }
      }
      log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]); console.log(t.join('\n')); }
      logErr(t) { this.log('', `❗️${this.name}, 错误!`, t?.message || t); }
      wait(ms) { return new Promise(r => setTimeout(r, ms)); }
      msg(title, subtitle, content) {
        switch (this.getEnv()) {
          case 'Quantumult X': $notify(title, subtitle || '', content || ''); break;
          case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default:
            $notification.post(title, subtitle || '', content || ''); break;
          case 'Node.js': console.log(`${title}: ${subtitle} - ${content}`); break;
        }
      }
      done() {
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
        this.log(`结束! ${elapsed}s`);
        switch (this.getEnv()) {
          case 'Quantumult X': case 'Surge': case 'Loon': case 'Stash': case 'Shadowrocket': default: $done(); break;
          case 'Node.js': process.exit(0); break;
        }
      }
    })(name, opts);
  }
})();
