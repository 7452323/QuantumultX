/* 用真实 URL 逐条测试三平台规则是否命中（真正的正则匹配，而非子串）
   同时做负面测试：不该被脚本接管的 URL 必须不命中。
   用法: node script/check-rules.js   (仓库根目录) */
const fs = require('fs');
const p = (f) => fs.readFileSync(f, 'utf8');

/* 应从 Soul.js 接管的 URL（含 query 变体） */
const SHOULD = [
  'https://api-chat.soulapp.cn/chat/limitInfo?uid=1',
  'https://api-chat.soulapp.cn/snapchat/url',
  'https://api-chat.soulapp.cn/privilege/bubble/status/simple',
  'https://api-chat.soulapp.cn/chat/aigc/preCheckConfig?type=1',
  'https://api-user.soulapp.cn/v6/planet/config',
  'https://api-user.soulapp.cn/user/homepage/metrics',
  'https://api-user.soulapp.cn/user/homepage/liked/metric',
  'https://api-user.soulapp.cn/user/queryInvisibleSetting',
  'https://api-user.soulapp.cn/robot/call/remainTimesAndSpeedCards',
  'https://api-user.soulapp.cn/avatar/user/popover',
  'https://api-a.soulapp.cn/meet/see/me/v2?limit=20',
  'https://api-a.soulapp.cn/html/settlement/meet/see/me',
  'https://api-a.soulapp.cn/meet/mine/see',
  'https://api-a.soulapp.cn/meet/match/list',
  'https://api-a.soulapp.cn/meet/uncover/list',
  'https://api-a.soulapp.cn/loveBell/queryMatchSpeedupConf',
  'https://api-a.soulapp.cn/videoMatch/getConfig',
  'https://api-a.soulapp.cn/soulreal/post/highlight/quota',
  'https://api-pay.soulapp.cn/privilege/supervip/status',
  'https://api-pay.soulapp.cn/vip/meet/userInfo',
  'https://api-pay.soulapp.cn/vip/show/info',
  'https://api-pay.soulapp.cn/vip/rights/avatar/qryMyAvatarRights',
  'https://api-pay.soulapp.cn/show/superVIP/detail/v2',
  'https://api-pay.soulapp.cn/meet/my/count',
  'https://post.soulapp.cn/v3/rec/square/header/tabs',
  'https://post.soulapp.cn/homepage/tabs/v2',
  'https://post.soulapp.cn/v1/post/highLight/recommend/quota',
  'https://post.soulapp.cn/v5/post/homepage',
  'https://post.soulapp.cn/v6/post/recommended',
  'https://chat-live.soulapp.cn/chatroom/chatClassifyRoomList',
  'https://chat-live.soulapp.cn/chatroom/getRoomTagInfo',
  'https://chat-live.soulapp.cn/live/queryFollowRoomList',
  'https://chat-live.soulapp.cn/square/relation/guideUserList',
];

/* 绝不能被 script 接管（reject 规则负责，或本就该放行） */
const SHOULD_NOT = [
  'https://post.soulapp.cn/v5/post/homepage/guide/card',
  'https://api-a.soulapp.cn/official/scene/module?pageId=MHomeMyTrack_Main',
  'https://api-user.soulapp.cn/user/info/extBySessionId',
  'https://api.soulapp.cn/soul-coin/total',
  'https://api-pay.soulapp.cn/vip/free/gift/fetch',
  'https://api-a.soulapp.cn/meet/uncover/secret/popup',
];

/* ---- 从各平台提取 script 规则的 pattern ---- */
function qxPatterns(txt) {
  return txt.split('\n')
    .filter((l) => /^\^https/.test(l) && l.includes('script-response-body'))
    .map((l) => l.split(' ')[0]);
}
function surgePatterns(txt) {
  return txt.split('\n')
    .filter((l) => l.includes('type=http-response'))
    .map((l) => (l.match(/pattern=([^,]+)/) || [])[1]).filter(Boolean);
}
function loonPatterns(txt) {
  return txt.split('\n')
    .filter((l) => l.includes('then script('))
    .map((l) => (l.match(/~= \/(.+)\/i then script\(/) || [])[1]).filter(Boolean);
}

const sets = {
  QX: qxPatterns(p('script/Soul.conf')),
  Surge: surgePatterns(p('surge/Soul.sgmodule')),
  Loon: loonPatterns(p('loon/Soul.plugin')),
  'Loon.lpx': loonPatterns(p('loon/Soul.lpx')),
};

let bad = 0;
for (const [name, pats] of Object.entries(sets)) {
  const res = pats.map((x) => { try { return new RegExp(x, 'i'); } catch (e) { return null; } });
  const invalid = pats.filter((x, i) => !res[i]);
  if (invalid.length) { console.log(`✗ ${name}: 非法正则 ${invalid.join(' | ')}`); bad++; }
  const miss = SHOULD.filter((u) => !res.some((r) => r && r.test(u)));
  const over = SHOULD_NOT.filter((u) => res.some((r) => r && r.test(u)));
  console.log(`${miss.length || over.length ? '✗' : '✓'} ${name}: ${pats.length} 条规则, 漏收 ${miss.length}, 误收 ${over.length}`);
  miss.forEach((u) => console.log(`     漏收: ${u}`));
  over.forEach((u) => console.log(`     误收: ${u}`));
  if (miss.length || over.length) bad++;
}
console.log('\n' + (bad ? `✗ ${bad} 处问题` : '✓ 四份配置全部规则命中正确'));
