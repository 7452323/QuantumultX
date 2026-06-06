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
const CheckinFramework = require('./Frameworks/checkin.js');
const app = new CheckinFramework('kuwo_upgrade');

const API = 'https://integralapi.kuwo.cn';
const kw_headers = {
  'Origin': 'https://h5app.kuwo.cn',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
  'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
};

app.setConfig({
  name: '酷我音乐(升级)',
  storageKey: 'kuwo_upgrade',
  cookiePattern: /([^@]+@[^@]+)/,
  accountSeparator: '&',
  dedupPattern: /^(\d+)@/,
  cookieTrigger: 'userBase',
  notifyTitle: '酷我音乐(升级)'
});

if (app.isRequest) {
  if ($request.url.includes('userBase')) {
    const cookie = $request.headers['Cookie'] || $request.headers['cookie'] || '';
    if (cookie) {
      const uid = cookie.match(/userid=(\d+)/);
      const sid = cookie.match(/websid=(\d+)/);
      if (uid && sid) {
        app.collectCookie(uid[1] + '@' + sid[1]);
      }
    }
  }
  $done();
}

(async () => {
  const accounts = app.getAccounts();
  if (!accounts.length) { app.msg(app.name, '⚠️ 未获取到Cookie', '请先登录酷我音乐'); app.done(); return; }

  app.log(`检测到 ${accounts.length} 个账户`);
  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;

    const nickname = await (async () => {
      const res = await app.http({ url: `${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`, headers: kw_headers });
      try { return JSON.parse(res.body).data?.nickname; } catch { return ''; }
    })();
    const name = nickname || uid;
    if (!nickname) { app.log(`[${name}] Cookie 已失效`); continue; }
    app.log(`\n[${name}]`);

    const tasks = await (async () => {
      const res = await app.http({ url: `${API}/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`, headers: kw_headers });
      try { return JSON.parse(res.body)?.data; } catch { return null; }
    })();
    if (!tasks) { app.log(`${name}: 获取任务列表失败`); continue; }

    // 签到
    const signTask = tasks.find(x => x.taskType === 'sign');
    if (signTask && signTask.status !== 1) {
      const r = await app.http({ url: `${API}/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`, headers: kw_headers });
      const j = JSON.parse(r.body);
      app.log(`签到: ${j.code === 200 ? '成功' : j.msg || '失败'}`);
    } else { app.log('签到: 今日已签到'); }

    // 听歌、小说、评论
    const taskTypes = ['mobile', 'novel', 'comment'];
    const golds = { mobile: 18, novel: 18, comment: 10 };
    const taskNames = { mobile: '听歌10分钟', novel: '听小说10分钟', comment: '发布评论' };
    for (const tt of taskTypes) {
      const r = await app.http({ url: `${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=${tt}&goldNum=${golds[tt]}`, headers: kw_headers });
      const j = JSON.parse(r.body);
      app.log(`${taskNames[tt]}: ${j.code === 200 ? '成功' : j.data?.description || j.msg || '失败'}`);
    }

    // 看创意视频
    const advTask = tasks.find(x => x.taskType === 'advert');
    const remain = (advTask?.total || 5) - (advTask?.finishCount || 0);
    if (remain > 0) {
      let ok = 0;
      for (let i = 0; i < remain; i++) {
        const r = await app.http({ url: `${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`, headers: kw_headers });
        const j = JSON.parse(r.body);
        if (j.code === 200) ok++;
        await app.wait(2000);
      }
      app.log(`看创意视频: ${ok}/${remain}`);
    } else { app.log('看创意视频: 今日已完成'); }

    // 等级
    const rank = await app.http({ url: `${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`, headers: kw_headers });
    try { const j = JSON.parse(rank.body); if (j.code === 200) app.log(`Lv.${j.data.rank} 成长值:${j.data.score}`); } catch {}
  }
  app.done();
})();
