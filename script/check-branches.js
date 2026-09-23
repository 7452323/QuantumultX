/* 检查「规则里拦截的 URL」是否都有 Soul.js 的分支接住
   静态提取 has("...") 字面量，逐条比对，避免拦了不改的空转。
   用法: node script/check-branches.js   (仓库根目录) */
const fs = require('fs');
const p = (f) => fs.readFileSync(f, 'utf8');

const js = p('script/Soul.js');
/* 提取正文里（注释块之后）所有 has("literal") 的字面量 */
const bodyStart = js.indexOf('*/') + 2;
const code = js.slice(bodyStart);
const lits = [...new Set([...code.matchAll(/has\("([^"]+)"\)/g)].map((m) => m[1]))];

/* 规则里拦截的 URL（与 check-rules.js 保持一致） */
const SHOULD = [
  'https://api-chat.soulapp.cn/chat/limitInfo',
  'https://api-chat.soulapp.cn/snapchat/url',
  'https://api-chat.soulapp.cn/privilege/bubble/status/simple',
  'https://api-chat.soulapp.cn/chat/aigc/preCheckConfig',
  'https://api-user.soulapp.cn/v6/planet/config',
  'https://api-user.soulapp.cn/user/homepage/metrics',
  'https://api-user.soulapp.cn/user/homepage/liked/metric',
  'https://api-user.soulapp.cn/user/queryInvisibleSetting',
  'https://api-user.soulapp.cn/robot/call/remainTimesAndSpeedCards',
  'https://api-user.soulapp.cn/avatar/user/popover',
  'https://api-a.soulapp.cn/meet/see/me/v2',
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

let orphan = 0;
for (const u of SHOULD) {
  const hit = lits.filter((L) => u.indexOf(L) !== -1);
  if (!hit.length) { console.log(`✗ 规则拦了但脚本无分支: ${u}`); orphan++; }
  else console.log(`✓ ${hit.join(' | ').padEnd(42)} ${u.replace(/^https:\/\//, '')}`);
}
console.log('\n' + (orphan ? `✗ ${orphan} 个 URL 被规则拦截但脚本不处理（空转）` : '✓ 所有被拦截的 URL 都有脚本分支处理'));
console.log(`脚本共 ${lits.length} 个 has() 判定字面量`);
