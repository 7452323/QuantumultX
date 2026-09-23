/*
[rewrite_local]
^https:\/\/api-chat\.soulapp\.cn\/chat\/limitInfo url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-chat\.soulapp\.cn\/snapchat\/url url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-a\.soulapp\.cn\/(html\/settlement\/)?meet\/(see\/me|mine\/see|queryInvisibleCount) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-pay\.soulapp\.cn\/(privilege\/supervip\/status|vip\/meet\/userInfo|show\/superVIP\/detail\/v2) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-a\.soulapp\.cn\/meet\/mine\/see url script-request-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
[mitm]
hostname = api-chat.soulapp.cn, api-a.soulapp.cn, api-pay.soulapp.cn, api-user.soulapp.cn, post.soulapp.cn
*/

function parseArgs(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  const out = {};
  String(raw).split(",").forEach((p) => {
    const i = p.indexOf("=");
    if (i < 0) return;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}
const ARG = parseArgs(typeof $argument !== "undefined" ? $argument : null);
const flag = (k, dft) => {
  const v = ARG[k];
  if (v === undefined || v === null || v === "") return dft;
  return v === true || v === "true" || v === 1 || v === "1";
};
const NOTIFY = flag("notify", true);        // 阅后即焚抓到图片时弹通知
const PLANET_KEEP = ARG.planetKeep || "";   // 星球页保留入口，逗号分隔: soulMatch,voiceMatch,partyMatch,masked,maskedMatch,planet
const ROOMTAG_KEEP = ARG.roomTagKeep || ""; // 派对频道保留，逗号分隔: hot,all,emotion,personal,play,interest,argue,story,chat,heart

/*
  请求阶段（Surge/Loon http-request、QX script-request-header）：
  会员页那条 /meet/mine/see 的 URL + 请求头（含 cs 签名）存下来。
  cs 实测可复用（同 cs 连调 5 次全成功），且只绑「接口+参数」，所以这套头能反复拿去拉真人。
  之后每次进访客页，响应脚本就用这套头主动拉一次最新数据。
*/
const url = ($request && $request.url) || "";
let body = ($response && $response.body) || "";

const has = (s) => url.indexOf(s) !== -1;
const keepList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

/*
  三平台存储 / HTTP 适配
  谁看过我：服务端按账号真实会员态过滤 user/uid/userIdEcpt（全 null），
  客户端改标记只能拆掉「需会员」提示，拆不出服务端没下发的数据。
  唯一不设防的是「会员购买页」那条 /meet/mine/see（真机抓包返 100 条真人），
  所以：见到它就缓存，进我的足迹页时回填。
*/
const VKEY = "soul_viewer_cache";
const MKEY = "soul_mine_see_req";
const store = {
  get(k) {
    try {
      if (typeof $prefs !== "undefined" && $prefs.valueForKey) return $prefs.valueForKey(k);
      if (typeof $persistentStore !== "undefined" && $persistentStore.read) return $persistentStore.read(k);
    } catch (e) { }
    return null;
  },
  set(k, v) {
    try {
      if (typeof $prefs !== "undefined" && $prefs.setValueForKey) return $prefs.setValueForKey(v, k);
      if (typeof $persistentStore !== "undefined" && $persistentStore.write) return $persistentStore.write(v, k);
    } catch (e) { }
    return null;
  },
};
const __isRequest = typeof $response === "undefined";
if (__isRequest) {
  try {
    if (($request.url || "").indexOf("/meet/mine/see") !== -1) {
      store.set(MKEY, JSON.stringify({ u: $request.url, h: $request.headers || {} }));
    }
  } catch (e) { }
  $done({});
} else {
const qs = (k) => {
  const m = url.match(new RegExp("[?&]" + k + "=([^&]*)"));
  return m ? m[1] : "";
};
function httpGet(u, headers) {
  return new Promise((resolve, reject) => {
    try {
      if (typeof $task !== "undefined" && $task.fetch) {
        $task.fetch({ url: u, headers }).then((r) => resolve(r.body)).catch(reject);
      } else if (typeof $httpClient !== "undefined") {
        $httpClient.get({ url: u, headers }, (err, resp, data) => (err ? reject(err) : resolve(data)));
      } else reject(new Error("no http client"));
    } catch (e) { reject(e); }
  });
}
function notify(title, sub, content) {
  try {
    if (typeof $notify !== "undefined" && $notify) { $notify(title, sub, content); return; }
    if (typeof $notification !== "undefined" && $notification.post) { $notification.post(title, sub, content); return; }
  } catch (e) { }
}
function fillViewers(obj, list) {
  if (!obj || !obj.data || !Array.isArray(list) || !list.length) return;
  obj.data.list = list;
  if (!(obj.data.allViewerCount > 0)) obj.data.allViewerCount = list.length;
  /*
  服务端把 uncoverSecretUserList 给成 null，客户端就把整个列表当「未揭秘」
  渲染成模糊头像；把已回填的人塞进去，让它认为这些人已揭秘。
*/
  if (!Array.isArray(obj.data.uncoverSecretUserList) || !obj.data.uncoverSecretUserList.length) {
    obj.data.uncoverSecretUserList = list;
  }
  if (obj.data.uncoverSecretCount == null || obj.data.uncoverSecretCount <= 0) {
    obj.data.uncoverSecretCount = 999;
  }
}
function readViewerCache() {
  const raw = store.get(VKEY);
  if (!raw) return null;
  try {
    const c = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!c || !Array.isArray(c.list) || !c.list.length) return null;
    if (Date.now() - (c.t || 0) > 12 * 3600 * 1000) return null;
    return c;
  } catch (e) { return null; }
}
function saveViewerCache(list, metric) {
  try { store.set(VKEY, JSON.stringify({ t: Date.now(), list: list, metric: metric || null })); } catch (e) { }
}
/*
  缓存为空时的兜底：带客户端原始请求头主动拉一次会员页那条接口。
  注意 S 的 cs/at 可能与 URL 绑定，失败就原样放行，不影响客户端。
*/
function fetchViewers(obj) {
  /*
    用「会员页那次请求」的原样 URL + 请求头去拉。
    cs 只绑接口+参数（实测换 cs 必挂、同 cs 连调 5 次全成功），
    所以必须原样复用会员页那套，不能用当前足迹页的。
  */
  let saved = null;
  try {
    const raw = store.get(MKEY);
    saved = raw ? (typeof raw === "string" ? JSON.parse(raw) : raw) : null;
  } catch (e) { }
  let u, hdr;
  if (saved && saved.u) {
    u = saved.u;
    hdr = saved.h || {};
  } else {
    const src = ($request && $request.headers) || {};
    hdr = {};
    ["tk", "slb", "sdi", "di", "aid", "av", "avc", "os", "srs", "cs",
      "user-agent", "User-Agent", "accept-language", "Accept-Language"].forEach((k) => {
        if (src[k] != null) hdr[k] = src[k];
      });
    u = "https://api-a.soulapp.cn/meet/mine/see?bi=" + qs("bi") + "&bik=" + (qs("bik") || "32243") +
      "&limit=100&pageId=MSoulMember_PayNew&sortType=1";
  }
  return httpGet(u, hdr).then((t) => {
    const j = JSON.parse(t);
    const real = (j && j.data && Array.isArray(j.data.userList)) ? j.data.userList.filter((x) => x && x.user) : [];
    if (real.length) {
      fillViewers(obj, real);
      saveViewerCache(real, j.data.meSeeMetricResp);
      if (NOTIFY) notify("Soul 谁看过我", "✅ 已拉最新 " + real.length + " 条", saved ? "用会员页那套头" : "用当前页头(可能被拒)");
    } else {
      if (NOTIFY) notify("Soul 谁看过我", "⚠️ 拉取被拒 code=" + (j && j.code),
        saved ? "存的是会员页那套头但仍被拒，估计签名过期了，进一次会员页刷新" : "还没存到会员页的头，进一次会员页(我的→超星/会员)再回来");
    }
    return JSON.stringify(obj);
  }).catch((err) => {
    if (NOTIFY) notify("Soul 谁看过我", "❌ 拉取异常", String(err).slice(0, 120));
    return JSON.stringify(obj);
  });
}
let pending = null;


try {
  /*
  1. 私聊限制解除（核心）
  服务端在 /chat/limitInfo 下发「需先送礼才能私聊」的限流参数，
  抹掉提示文案与剩余次数并把 limit 置 false，客户端即认为无限制。
*/
  if (has("/chat/limitInfo")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      ["subMsg", "extMsg", "abValue", "freeEquityStatus", "msg", "remainFreeCount", "type"]
        .forEach((k) => { delete obj.data[k]; });
      obj.data.limit = false;
    }
    body = JSON.stringify(obj);
  }

  /*
  2. 阅后即焚抓图
  上游只做通知，响应原样回传（图片在客户端仍按阅后即焚处理，但地址已拿到）。
*/
  else if (has("/snapchat/url")) {
    const obj = JSON.parse(body);
    const imageUrl = obj && obj.data && obj.data.url;
    if (NOTIFY && imageUrl && typeof imageUrl === "string") {
      if (typeof $notify !== "undefined") {
        $notify("Soul 阅后即焚", "点击查看 / 保存图片", imageUrl, { "open-url": imageUrl, "media-url": imageUrl });
      } else if (typeof $notification !== "undefined") {
        $notification.post("Soul 阅后即焚", "点击查看 / 保存图片", imageUrl, { openUrl: imageUrl, mediaUrl: imageUrl });
      }
    }
    /* 原样回传，不修改 body */
    body = null;
  }

  /*
  3. 星球页（v6/planet/config）
  隐藏红点与红包入口，按 argument 过滤核心卡片；未传参则全部隐藏（同上游默认）。
*/
  else if (has("/v6/planet/config") || has("/planet/config")) {
    const obj = JSON.parse(body);
    const map = { soulMatch: 1, voiceMatch: 2, partyMatch: 3, masked: 4, maskedMatch: 9, planet: 10 };
    const keep = keepList(PLANET_KEEP).map((k) => map[k]).filter((v) => v !== undefined);
    if (obj && obj.data) {
      obj.data.showRedMind = false;
      obj.data.showLuckyBag = false;
      if (obj.data.chatRoomInfo) obj.data.chatRoomInfo.showChatRoom = false;
      if (Array.isArray(obj.data.coreCards)) {
        obj.data.coreCards = obj.data.coreCards.filter((c) => keep.includes(c.sortId));
        obj.data.coreCards.forEach((card) => {
          card.showLuckyBag = false;
          card.showRedMind = false;
          card.style = 1;
          delete card.bgImg;
          delete card.iconUrl;
        });
      }
    }
    body = JSON.stringify(obj);
  }

  /* 4. 派对列表中间横幅广告 */
  else if (has("/chatroom/chatClassifyRoomList")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.positionContentRespList = [];
    body = JSON.stringify(obj);
  }

  /* 5. 广场头部 tab 精简 */
  else if (has("/square/header/tabs")) {
    const obj = JSON.parse(body);
    if (Array.isArray(obj.data)) {
      obj.data.forEach((c) => { c.unreadFlag = 0; });
      obj.data = obj.data.filter((i) => i.pageId === "PostSquare_Recommend");
    }
    body = JSON.stringify(obj);
  }

  /* 6. 我的页面数据（metrics） */
  else if (has("/homepage/metrics")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.recentViewNum = 0;
      obj.data.showTipsCard = false;
      obj.data.showMetric = false;
      obj.data.hasHomePageLiked = false;
      const m = obj.data.homePageLikedMetric;
      if (m) {
        m.addNum = 0;
        m.likedTotalNum = 0;
        m.hasShowHistoryDynamic = false;
      }
    }
    body = JSON.stringify(obj);
  }

  /* 7. 关注 tab 推荐 / 猜你喜欢 */
  else if (has("relation/guideUserList")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.userDTOList = [];
    body = JSON.stringify(obj);
  } else if (has("/live/queryFollowRoomList")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.recUserFeedList = [];
    body = JSON.stringify(obj);
  }

  /* 8. 我的页面 tab */
  else if (has("/homepage/tabs/v2")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.selectedTagPool = {};
      if (Array.isArray(obj.data.headTabDTOList)) {
        obj.data.headTabDTOList = obj.data.headTabDTOList.filter((t) => t.tabCode !== "STAR_TRAILS");
      }
    }
    body = JSON.stringify(obj);
  }

  /* 9. 派对频道列表 */
  else if (has("/chatroom/getRoomTagInfo")) {
    const obj = JSON.parse(body);
    const map = { hot: 11, all: 0, emotion: 43, personal: 44, play: 12, interest: 10, argue: 6, story: 5, chat: 4, heart: 2 };
    const keep = keepList(ROOMTAG_KEEP).map((k) => map[k]).filter((v) => v !== undefined);
    if (obj && obj.data && Array.isArray(obj.data.res)) {
      obj.data.res = obj.data.res.filter((t) => keep.includes(t.id));
      obj.data.res.forEach((c) => { if (c.iconConfig != null) c.iconConfig = null; });
    }
    body = JSON.stringify(obj);
  }

  /* 10. 谁看过我：会员页预览（服务端不设防）→ 顺手存缓存 */
  /*
  第二轮抓包新增：服务端下发「非会员值」的权益位
  这些接口都返回真实结构，但值是未开通态，客户端据此隐藏功能。
*/
  /* 「谁看过我」计数上限：非会员 viewUserCountConfigLimit=200，放开 */
  else if (has("/meet/my/count")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.viewUserCountConfigLimit = 99999;
      obj.data.oneUserViewCount = Math.max(obj.data.oneUserViewCount || 0, 99999);
    }
    body = JSON.stringify(obj);
  }
  /* 免费换头像次数：非会员 avatarFreeTimes=0 */
  else if (has("qryMyAvatarRights")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.avatarFreeTimes = 999;
      obj.data.inPhoton = true;
    }
    body = JSON.stringify(obj);
  }
  /* 会员展示信息：非会员 vipShowModel=null */
  else if (has("/vip/show/info")) {
    const obj = JSON.parse(body);
    if (obj && obj.data && !obj.data.vipShowModel) {
      obj.data.vipShowModel = {
        superVIP: true,
        wasVip: true,
        vipLevel: 9,
        expireTime: "2099-12-31 23:59:59",
        remainDay: 9999,
      };
    }
    body = JSON.stringify(obj);
  }
  /* 聊天气泡权益：非会员 has=false */
  else if (has("privilege/bubble/status/simple")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.has = true;
      obj.data.isDynamicBubble = true;
      obj.data.aggPictureCount = Math.max(obj.data.aggPictureCount || 0, 9);
    }
    body = JSON.stringify(obj);
  }
  /* 缘分匹配加速：非会员 currentSpeed=30 */
  else if (has("queryMatchSpeedupConf")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.currentSpeed = 9999;
      obj.data.speedupCount = 9999;
      obj.data.isSpeedup = true;
    }
    body = JSON.stringify(obj);
  }
  /* 「谁喜欢我」计数：非会员不给历史 */
  else if (has("homepage/liked/metric")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.hasShowHistoryDynamic = true;
      if (!obj.data.likedTotalNum) obj.data.likedTotalNum = 0;
    }
    body = JSON.stringify(obj);
  }
  /*
  第三轮抓包新增
  隐身设置：非会员直接返回 {"superVip":false}，这是隐身功能的开关。
*/
  else if (has("queryInvisibleSetting")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.superVip = true;
    body = JSON.stringify(obj);
  }
  /* 机器人陪伴匹配次数：非会员 sumTimes/remainTimes/freeRemains=3、加速卡=0 */
  else if (has("remainTimesAndSpeedCards")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.sumTimes = 9999;
      obj.data.remainTimes = 9999;
      obj.data.freeRemains = 9999;
      obj.data.todayTimes = Math.max(obj.data.todayTimes || 0, 9999);
      obj.data.packetTimes = Math.max(obj.data.packetTimes || 0, 9999);
      obj.data.remainSpeedCards = 9999;
      obj.data.benefitStatus = 1;
    }
    body = JSON.stringify(obj);
  }
  /* 头像位 / 头像博物馆：非会员 avatarCount=1 */
  else if (has("avatar/user/popover")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.avatarCount = Math.max(obj.data.avatarCount || 0, 99);
      obj.data.hasMuseum = true;
    }
    body = JSON.stringify(obj);
  }
  /*
  第四轮：服务端下发的功能配额/开关（真实限制值）
  原则：只改服务端下发的「限制值/开关值」，不改服务端挖空的数据。
*/
  /* 视频匹配：通话时长限制、免费次数、高清、AI、露脸屏蔽 */
  else if (has("videoMatch/getConfig")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      const d = obj.data;
      if (d.videoMatchConfig) {
        d.videoMatchConfig.maleFreeTimes = 9999;
        d.videoMatchConfig.femaleFreeTimes = 9999;
        d.videoMatchConfig.timeMinutesLimit = 9999;   /* 每次通话时长上限(原 4 分钟) */
        d.videoMatchConfig.maskFreePreviewSeconds = 9999;
        d.videoMatchConfig.endPageCountDownSeconds = 9999;
      }
      if (d.availableSituation) {
        d.availableSituation.freeTimesRemain = 9999;
        d.availableSituation.soulMatchLimit = false;
      }
      if (d.renewalInfo) d.renewalInfo.remainTimes = 9999;
      d.limitStatus = 0;
      d.highQualitySwitch = true;
      d.aiSwitch = true;
      d.bareShieldOpenState = false;
      d.showVideoMatchRecord = true;
      d.showNewcomerGuide = false;
      d.emptyHeartCallTime = 99999;
      d.fullHeartCallTime = 99999;
      d.needCollect = false;
      if (typeof d.remainingCount === "number") d.remainingCount = 9999;
    }
    body = JSON.stringify(obj);
  }
  /* 瞬间高亮推荐配额：非会员 remainedQuota=0、canRecommend=false */
  else if (has("highLight/recommend/quota")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.remainedQuota = 9999;
      obj.data.canRecommend = true;
      obj.data.isJuror = true;
    }
    body = JSON.stringify(obj);
  }
  /* 高亮配额：total/remained=0 */
  else if (has("highlight/quota")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.total = 9999;
      obj.data.remained = 9999;
    }
    body = JSON.stringify(obj);
  }
  /* AIGC 聊天预检：sessionLimit=30(一轮会话上限)、短内容/雷区词拦截 */
  else if (has("aigc/preCheckConfig")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.sessionLimit = 99999;
      obj.data.notInputSwitch = false;
      obj.data.notInputTime = 99999;
      obj.data.shortContentSwitch = false;
      obj.data.mineFieldSwitch = false;
      obj.data.unfriendlySwitch = false;
      obj.data.characterSwitch = false;
    }
    body = JSON.stringify(obj);
  }
  /* 瞬间列表里的会员标 + 点赞特效每日上限 */
  else if (has("/v5/post/homepage") || has("/v6/post/recommended")) {
    const obj = JSON.parse(body);
    const fix = (o) => {
      if (!o || typeof o !== "object") return;
      if ("superVIP" in o) o.superVIP = true;
      if ("superstar" in o) o.superstar = true;
      if ("praiseEffectDailyLimit" in o) o.praiseEffectDailyLimit = 9999;
      if ("avatarGuideFlag" in o) o.avatarGuideFlag = false;
    };
    fix(obj.data);
    /* 列表项里嵌套的发布者对象 */
    const walk = (n, depth) => {
      if (!n || typeof n !== "object" || depth > 4) return;
      if (Array.isArray(n)) { n.forEach((x) => walk(x, depth + 1)); return; }
      fix(n);
      Object.keys(n).forEach((k) => {
        if (n[k] && typeof n[k] === "object") walk(n[k], depth + 1);
      });
    };
    walk(obj.data, 0);
    body = JSON.stringify(obj);
  }
  else if (has("/meet/mine/see")) {
    const obj = JSON.parse(body);
    /*
      顺手把这次请求的 URL+头存下来。响应脚本里同样能读到 $request.headers，
      所以不依赖请求阶段那两条规则，只要进过一次会员页就能拿到可复用的 cs。
    */
    try {
      if ($request && $request.url) store.set(MKEY, JSON.stringify({ u: $request.url, h: $request.headers || {} }));
    } catch (e) { }
    if (obj && obj.data) {
      obj.data.superUser = true;
      if (obj.data.meSeeMetricResp) obj.data.meSeeMetricResp.invisibleCount = 9999;
      const real = Array.isArray(obj.data.userList) ? obj.data.userList.filter((x) => x && x.user) : [];
      if (real.length) {
        saveViewerCache(real, obj.data.meSeeMetricResp);
        if (NOTIFY) notify("Soul 谁看过我", "✅ 已抓取 " + real.length + " 条真人", "现在去「我的足迹」就能看到");
      }
    }
    body = JSON.stringify(obj);
  }

  /*
  10b. 我的足迹 / 谁看过我：回填真人
  服务端把 list[].user / uid / userIdEcpt 全置 null，只留「访问16次/摩羯座」烟雾弹。
  有缓存就回填，没缓存就主动拉一次，失败原样放行。
*/
  else if (has("see/me")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.superUser = true;
      obj.data.uncoverSecretCount = 999;
      const hasReal = Array.isArray(obj.data.list) && obj.data.list.some((x) => x && x.user);
      const c = readViewerCache();
      if (c) fillViewers(obj, c.list);   // 先用缓存顶上，等主动拉取回来再覆盖
      if (hasReal) {
        if (NOTIFY) notify("Soul 谁看过我", "🎉 服务端直出真人 " + obj.data.list.length + " 条", "无需拉取");
      } else {
        if (typeof $task !== "undefined" || typeof $httpClient !== "undefined") {
          pending = fetchViewers(obj);
        } else if (NOTIFY) {
          notify("Soul 谁看过我", "⚠️ 无 http 客户端", "平台不支持主动拉取");
        }
      }
    }
    body = JSON.stringify(obj);
  }

  /* 11b. 缘分匹配列表 */
  else if (has("/meet/match/list")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.superUser = true;
    body = JSON.stringify(obj);
  }

  /* 12. 超级会员状态（我的相遇 / 谁看过我 权益位） */
  else if (has("/privilege/supervip/status")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.superVIP = true;
      obj.data.showSuperVIP = true;
      obj.data.hasMyMeet = true;
      obj.data.hasFlyPackage = true;
      obj.data.hasAiSocialVip = true;
      if (!(obj.data.remainDay > 0)) obj.data.remainDay = 9999;
      if (obj.data.leftDay == null) obj.data.leftDay = 9999;
    }
    body = JSON.stringify(obj);
  }

  /* 13. 会员信息卡 */
  else if (has("/vip/meet/userInfo")) {
    const obj = JSON.parse(body);
    const s0 = obj && obj.data && obj.data.superStarDTO;
    if (s0) {
      s0.superVIP = true;
      s0.showSuperVIP = true;
      s0.wasVip = true;
      s0.leftDay = 9999;
      s0.validTime = 4102415999000;
      s0.lastVipExpireTime = 4102415999000;
    }
    const d0 = obj && obj.data;
    if (d0 && d0.flyPackageDTO) d0.flyPackageDTO.hasFlyPackage = true;
    if (d0 && d0.flyPackageShowDTO) d0.flyPackageShowDTO.result = true;
    if (d0 && d0.aiSocialDto) d0.aiSocialDto.hasAiSocial = true;
    if (d0 && d0.aiSocialShowDTO) d0.aiSocialShowDTO.result = true;
    body = JSON.stringify(obj);
  }

  /* 14. 超星详情页 */
  else if (has("/show/superVIP/detail/v2")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.superVIP = true;
      obj.data.superUser = true;
      obj.data.wasVip = true;
      if (obj.data.leftDay == null) obj.data.leftDay = 9999;
      if (obj.data.validTime == null) obj.data.validTime = 4102415999000;
    }
    body = JSON.stringify(obj);
  }

  /* 未命中：原样放行 */
  else {
    body = null;
  }
} catch (e) {
  console.log("Soul error: " + e);
  body = null;
}

if (pending) {
  pending.then((b) => $done({ body: b })).catch(() => $done(body === null || body === undefined ? {} : { body }));
} else if (body === null || body === undefined) {
  $done({});
} else {
  $done({ body });
}
}
