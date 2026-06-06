/* 酷我音乐 升级签到
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

const framework = require('./Frameworks/checkin.js');
const app = new framework('kuwo_upgrade');

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

const API = 'https://integralapi.kuwo.cn';

app.setConfig({
  name: '酷我音乐(升级)',
  storageKey: 'kuwo_upgrade',
  cookiePattern: /([^@]+@[^@]+)/,
  accountSeparator: '&',
  dedupPattern: /^(\d+)@/,
  cookieTrigger: 'userBase',
  notifyTitle: '酷我音乐(升级)',
  checkin: {
    url: API,
    method: 'GET',
    headers: {
      'Origin': 'https://h5app.kuwo.cn',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
      'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
    }
  }
});

const kw_headers = {
  'Origin': 'https://h5app.kuwo.cn',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'application/json, text/plain, */*',
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
  'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
};

async function httpGet(url) {
  const res = await app.http({ url, headers: kw_headers, method: 'GET' });
  try { return JSON.parse(res.body); } catch { return null; }
}

async function getNickname(uid) {
  const res = await httpGet(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
  return res?.data?.nickname || '';
}

async function getTasks(uid, sid) {
  const res = await httpGet(`${API}/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
  return res?.data || null;
}

(async () => {
  const accounts = app.getAccounts();
  if (!accounts.length) { app.notify('⚠️ 未获取到Cookie'); app.done(); return; }
  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;
    const nickname = await getNickname(uid);
    const name = nickname || uid;
    app.log(`[${name}]`);

    const tasks = await getTasks(uid, sid);
    if (!tasks) { app.msg(app.name, `${name}`, '获取任务列表失败'); continue; }

    const t = tasks.find(x => x.taskType === 'sign');
    if (t && t.status !== 1) {
      const r = await httpGet(`${API}/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`);
      app.log(`签到: ${r?.code === 200 ? '成功' : r?.msg || '失败'}`);
    } else { app.log('签到: 今日已签到'); }

    const tasks2 = ['mobile', 'novel', 'comment'];
    const golds = { mobile: 18, novel: 18, comment: 10 };
    const names = { mobile: '听歌10分钟', novel: '听小说10分钟', comment: '发布评论' };
    for (const task of tasks2) {
      const r = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=${task}&goldNum=${golds[task]}`);
      if (r?.code === 200) app.log(`${names[task]}: 成功`);
      else app.log(`${names[task]}: ${r?.data?.description || r?.msg || '失败'}`);
    }

    const t3 = tasks.find(x => x.taskType === 'advert');
    const remain = (t3?.total || 5) - (t3?.finishCount || 0);
    if (remain > 0) {
      let ok = 0;
      for (let i = 0; i < remain; i++) {
        const r = await httpGet(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`);
        if (r?.code === 200) ok++;
        await app.wait(2000);
      }
      app.log(`看创意视频: ${ok}/${remain}`);
    } else { app.log('看创意视频: 今日已完成'); }

    const rank = await httpGet(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
    if (rank?.code === 200) app.log(`Lv.${rank.data.rank} 成长值:${rank.data.score}`);
  }
  app.done();
})();
