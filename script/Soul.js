/*
 * Soul 去广告 + 私聊限制解除 + 阅后即焚抓图 + 谁看过我/会员解锁 —— 三平台统一版 v1.2.0
 * Build 2026-09-23  (v1.2.0 谁看过我：服务端把 user/uid/userIdEcpt 全置 null，改标记只能拆提示拆不出数据，
 *                    改为缓存「会员页那条不设防的 /meet/mine/see」再回填我的足迹页;
 *                    v1.1.0 新增：谁看过我 superUser 解锁 + 超星会员标记;
 *                    v1.0.1 修复 official/scene/module 全量拦截打死 MHomeMyTrack_Main)
 * 字段依据 2026-09-23 真机抓包 (iPhone16 / iOS27 / Soul 27.0) 校准。
 *
 * ── 来源 ──────────────────────────────────────────────
 * 抄自 ishowshu/qx（作者：树先生 / 怎么肥事 / 奶思）
 *   https://github.com/ishowshu/qx
 *   · rewrite/soul.snippet   2026-09-19  QX 重写规则（本仓库转成 Soul.conf）
 *   · script/soul_qx.js      2026-08-29  私聊限制解除 · 阅后即焚抓图
 *   · script/soul.js         2026-05-27  去广告 · 星球/派对/广场入口精简
 * 本仓库版本做了三平台统一 + 容错兜底，未识别 URL 一律原样放行。
 *
 * ── 平台差异 ──────────────────────────────────────────
 * QX    : 建议直接用 script/Soul.conf（reject + jsonjq 原生处理，更省电），
 *         本脚本在 QX 只需挂 /chat/limitInfo 与 /snapchat/url 两条。
 * Surge : 无 jq 语法，[URL Rewrite] 之外的所有 body 类接口都走本脚本。
 * Loon  : 同 Surge。
 *
 * ── QX 引用 ───────────────────────────────────────────
 * [rewrite_local]
 * ^https:\/\/api-chat\.soulapp\.cn\/chat\/limitInfo url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
 * ^https:\/\/api-chat\.soulapp\.cn\/snapchat\/url url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
 * ^https:\/\/api-a\.soulapp\.cn\/(html\/settlement\/)?meet\/(see\/me|mine\/see|queryInvisibleCount) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
 * ^https:\/\/api-pay\.soulapp\.cn\/(privilege\/supervip\/status|vip\/meet\/userInfo|show\/superVIP\/detail\/v2) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
 *
 * [mitm]
 * hostname = api-chat.soulapp.cn, api-a.soulapp.cn, api-pay.soulapp.cn
 */

/* ── 参数 ──────────────────────────────────────────────
 * Loon   : [Argument] 对象参数 → $argument 为 Object
 * Surge  : #!arguments 占位符替换 → $argument 为 String "k=v,k=v"
 * QX     : 不支持参数 → $argument 不存在，全部走默认值
 * 三种形态都在这里统一成对象。 */
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

const url = ($request && $request.url) || "";
let body = ($response && $response.body) || "";

const has = (s) => url.indexOf(s) !== -1;
const keepList = (s) => s.split(",").map((x) => x.trim()).filter(Boolean);

/* ── 三平台存储 / HTTP 适配 ───────────────────────────
 * 谁看过我：服务端按账号真实会员态过滤 user/uid/userIdEcpt（全 null），
 * 客户端改标记只能拆掉「需会员」提示，拆不出服务端没下发的数据。
 * 唯一不设防的是「会员购买页」那条 /meet/mine/see（真机抓包返 100 条真人），
 * 所以：见到它就缓存，进我的足迹页时回填。 */
const VKEY = "soul_viewer_cache";
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
  /* 服务端把 uncoverSecretUserList 给成 null，客户端就把整个列表当「未揭秘」
   * 渲染成模糊头像；把已回填的人塞进去，让它认为这些人已揭秘。 */
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
/* 缓存为空时的兜底：带客户端原始请求头主动拉一次会员页那条接口。
 * 注意 S 的 cs/at 可能与 URL 绑定，失败就原样放行，不影响客户端。 */
function fetchViewers(obj) {
  const src = ($request && $request.headers) || {};
  const hdr = {};
  ["tk", "slb", "sdi", "di", "aid", "av", "avc", "os", "srs", "cs",
    "user-agent", "User-Agent", "accept-language", "Accept-Language"].forEach((k) => {
      if (src[k] != null) hdr[k] = src[k];
    });
  const u = "https://api-a.soulapp.cn/meet/mine/see?bi=" + qs("bi") + "&bik=" + (qs("bik") || "32243") +
    "&limit=100&pageId=MSoulMember_PayNew&sortType=1";
  return httpGet(u, hdr).then((t) => {
    const j = JSON.parse(t);
    const real = (j && j.data && Array.isArray(j.data.userList)) ? j.data.userList.filter((x) => x && x.user) : [];
    if (real.length) {
      fillViewers(obj, real);
      saveViewerCache(real, j.data.meSeeMetricResp);
      if (NOTIFY) notify("Soul 谁看过我", "✅ 主动拉取成功 " + real.length + " 条", "已回填并缓存");
    } else {
      if (NOTIFY) notify("Soul 谁看过我", "⚠️ 主动拉取被拒", "code=" + (j && j.code) + " msg=" + (j && (j.message || j.msg)) + " 返回长度=" + String(t || "").length);
    }
    return JSON.stringify(obj);
  }).catch((err) => {
    if (NOTIFY) notify("Soul 谁看过我", "❌ 主动拉取异常", String(err).slice(0, 120));
    return JSON.stringify(obj);
  });
}
let pending = null;


try {
  /* ── 1. 私聊限制解除（核心）──────────────────────────
   * 服务端在 /chat/limitInfo 下发「需先送礼才能私聊」的限流参数，
   * 抹掉提示文案与剩余次数并把 limit 置 false，客户端即认为无限制。 */
  if (has("/chat/limitInfo")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      ["subMsg", "extMsg", "abValue", "freeEquityStatus", "msg", "remainFreeCount", "type"]
        .forEach((k) => { delete obj.data[k]; });
      obj.data.limit = false;
    }
    body = JSON.stringify(obj);
  }

  /* ── 2. 阅后即焚抓图 ────────────────────────────────
   * 上游只做通知，响应原样回传（图片在客户端仍按阅后即焚处理，但地址已拿到）。 */
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

  /* ── 3. 星球页（v6/planet/config）────────────────────
   * 隐藏红点与红包入口，按 argument 过滤核心卡片；未传参则全部隐藏（同上游默认）。 */
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

  /* ── 4. 派对列表中间横幅广告 ──────────────────────── */
  else if (has("/chatroom/chatClassifyRoomList")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.positionContentRespList = [];
    body = JSON.stringify(obj);
  }

  /* ── 5. 广场头部 tab 精简 ─────────────────────────── */
  else if (has("/square/header/tabs")) {
    const obj = JSON.parse(body);
    if (Array.isArray(obj.data)) {
      obj.data.forEach((c) => { c.unreadFlag = 0; });
      obj.data = obj.data.filter((i) => i.pageId === "PostSquare_Recommend");
    }
    body = JSON.stringify(obj);
  }

  /* ── 6. 我的页面数据（metrics）────────────────────── */
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

  /* ── 7. 关注 tab 推荐 / 猜你喜欢 ──────────────────── */
  else if (has("relation/guideUserList")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.userDTOList = [];
    body = JSON.stringify(obj);
  } else if (has("/live/queryFollowRoomList")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.recUserFeedList = [];
    body = JSON.stringify(obj);
  }

  /* ── 8. 我的页面 tab ─────────────────────────────── */
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

  /* ── 9. 派对频道列表 ─────────────────────────────── */
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

  /* ── 10. 谁看过我：会员页预览（服务端不设防）→ 顺手存缓存 ── */
  else if (has("/meet/mine/see")) {
    const obj = JSON.parse(body);
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

  /* ── 10b. 我的足迹 / 谁看过我：回填真人 ───────────────
   * 服务端把 list[].user / uid / userIdEcpt 全置 null，只留「访问16次/摩羯座」烟雾弹。
   * 有缓存就回填，没缓存就主动拉一次，失败原样放行。 */
  else if (has("see/me")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.superUser = true;
      obj.data.uncoverSecretCount = 999;
      const c = readViewerCache();
      if (c) {
        fillViewers(obj, c.list);
        if (NOTIFY) notify("Soul 谁看过我", "✅ 已回填 " + c.list.length + " 条", "缓存 " + new Date(c.t).toLocaleString());
      } else {
        if (NOTIFY) notify("Soul 谁看过我", "⚠️ 本地没缓存", "先去会员页(我的→超星/会员)刷一次，再回来");
        if (typeof $task !== "undefined" || typeof $httpClient !== "undefined") {
          pending = fetchViewers(obj);
        } else if (NOTIFY) {
          notify("Soul 谁看过我", "⚠️ 无 http 客户端", "平台不支持主动拉取");
        }
      }
    }
    body = JSON.stringify(obj);
  }

  /* ── 11b. 缘分匹配列表 ────────────────────────────── */
  else if (has("/meet/match/list")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) obj.data.superUser = true;
    body = JSON.stringify(obj);
  }

  /* ── 12. 超级会员状态（我的相遇 / 谁看过我 权益位） ── */
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

  /* ── 13. 会员信息卡 ───────────────────────────────── */
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

  /* ── 14. 超星详情页 ───────────────────────────────── */
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

  /* ── 未命中：原样放行 ─────────────────────────────── */
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
