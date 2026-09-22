/*
 * Soul 去广告 + 私聊限制解除 + 阅后即焚抓图 —— 三平台统一版 v1.0.0
 * Build 2026-09-22
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
 *
 * [mitm]
 * hostname = api-chat.soulapp.cn
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

  /* ── 未命中：原样放行 ─────────────────────────────── */
  else {
    body = null;
  }
} catch (e) {
  console.log("Soul error: " + e);
  body = null;
}

if (body === null || body === undefined) {
  $done({});
} else {
  $done({ body });
}
