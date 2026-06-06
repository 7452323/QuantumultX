/*
 * 酷我音乐 升级签到
 * 功能：每日签到 + 听歌10分钟 + 听小说10分钟 + 发布评论 + 看创意视频x5
 * 
 * [rewrite_local]
 * ^https?:\/\/integralapi\.kuwo\.cn\/api\/v1\/online\/sign\/v1\/music\/userBase url script-request-header kuwo_upgrade.js
 * 
 * [task_local]
 * 30 8 * * * kuwo_upgrade.js, tag=酷我音乐(升级), enabled=true
 * 
 * [mitm]
 * hostname = integralapi.kuwo.cn
 */

const framework = require('./Frameworks/checkin.js');
const app = new framework('kuwo_upgrade');

const API = 'https://integralapi.kuwo.cn';

// 配置签到任务
app.setConfig({
  name: '酷我音乐(升级)',
  storageKey: 'kuwo_upgrade',
  cookiePattern: /(loginUid|loginSid)=([^&]+)/g,
  accountSeparator: '&',
  dedupPattern: /loginUid=(\d+)/,
  cookieTrigger: 'userBase',
  notifyTitle: '酷我音乐(升级)',
  headers: {
    'Origin': 'https://h5app.kuwo.cn',
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KWMusic/12.1.6.0 DeviceModel/iPhone17,3 NetType/WIFI kuwopage',
    'Referer': 'https://h5app.kuwo.cn/apps/user-system/index.html?MBOX_WEBCLOSE=1&hideBottomMargin=1&FULLHASARROW=1'
  }
});

// 获取昵称
async function getNickname(uid) {
  const res = await app.get(`${API}/api/v1/online/sign/v1/music/userBase?loginUid=${uid}`);
  return res?.data?.nickname || '';
}

// 获取任务列表
async function getTasks(uid, sid) {
  const res = await app.get(`${API}/openapi/v1/usersystem/taskList?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&version=12.1.6.0&src=kwplayer_ip_12.1.6.0_TJ.ipa`);
  return Array.isArray(res?.data) ? res.data : [];
}

// 查等级
async function checkRank(uid, sid) {
  const res = await app.get(`${API}/openapi/v1/usersystem/userRank?appUid=${uid}&loginUid=${uid}&loginSid=${sid}&type=1`);
  if (res?.code === 200) {
    app.log(`等级 Lv.${res.data.rank} 成长值 ${res.data.score}`);
  }
}

// 签到
async function doSign(uid, sid, tasks) {
  const t = tasks.find(x => x.taskType === 'sign');
  if (!t) { app.notify('签到','未找到签到任务'); return; }
  if (t.status === 1) { app.notify('签到','今日已签到'); return; }
  const res = await app.get(`${API}/api/v1/online/sign/normal/sign?loginUid=${uid}&loginSid=${sid}&source=kwplayer_ip_12.1.6.0_TJ.ipa&tmeapp=1&notrace=0&allpay=0&corp=kuwo&plat=ip&vipMode=0&newver=3`);
  if (res?.code === 200) app.notify('签到','成功');
  else app.notify('签到', res?.msg || '失败');
}

// 听歌
async function doMusic(uid, sid) {
  const res = await app.get(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=mobile&goldNum=18`);
  if (res?.code === 200) app.notify('听歌10分钟','成功');
  else app.notify('听歌10分钟', res?.data?.description || res?.msg || '失败');
}

// 听小说
async function doNovel(uid, sid) {
  const res = await app.get(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=novel&goldNum=18`);
  if (res?.code === 200) app.notify('听小说10分钟','成功');
  else app.notify('听小说10分钟', res?.data?.description || res?.msg || '失败');
}

// 评论
async function doComment(uid, sid) {
  const res = await app.get(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=comment&goldNum=10`);
  if (res?.code === 200) app.notify('发布评论','成功');
  else app.notify('发布评论', res?.data?.description || res?.msg || '失败');
}

// 看广告
async function doAdvert(uid, sid, tasks) {
  const t = tasks.find(x => x.taskType === 'advert');
  const total = t?.total || 5;
  const done = t?.finishCount || 0;
  const remain = total - done;
  if (remain <= 0) { app.notify('看创意视频','今日已完成'); return; }
  let ok = 0;
  for (let i = 0; i < remain; i++) {
    const res = await app.get(`${API}/api/v1/online/sign/v1/earningSignIn/everydaymusic/doListen?loginUid=${uid}&loginSid=${sid}&from=videoadver&goldNum=58`);
    if (res?.code === 200) ok++;
    await app.wait(2000);
  }
  app.notify('看创意视频', ok > 0 ? `成功 ${ok}/${remain} 次` : '失败');
}

// cookie 采集
if (app.isRequest) {
  app.done();
}

// 主任务
(async () => {
  const accounts = app.getAccounts();
  if (!accounts.length) {
    app.notify('⚠️ 未获取到Cookie，请先登录');
    app.done();
    return;
  }
  for (const acc of accounts) {
    const [uid, sid] = acc.split('@');
    if (!uid || !sid) continue;
    const nickname = await getNickname(uid);
    const name = nickname || uid;
    app.log(`\n===== ${name} =====`);
    app.notifyTitle = `酷我音乐(升级) - ${name}`;

    const tasks = await getTasks(uid, sid);
    if (!tasks.length) { app.notify('❌ 获取任务列表失败'); continue; }

    await doSign(uid, sid, tasks);
    await doMusic(uid, sid);
    await doNovel(uid, sid);
    await doComment(uid, sid);
    await doAdvert(uid, sid, tasks);
    await checkRank(uid, sid);
  }
  app.done();
})();
