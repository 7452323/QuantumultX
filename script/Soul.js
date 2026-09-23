/*
[rewrite_local]
^https:\/\/api-chat\.soulapp\.cn\/(chat\/limitInfo|snapchat\/url|privilege\/bubble\/status\/simple|chat\/aigc\/preCheckConfig) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-user\.soulapp\.cn\/(v6\/planet\/config|user\/homepage\/metrics|user\/homepage\/liked\/metric|user\/queryInvisibleSetting|robot\/call\/remainTimesAndSpeedCards|avatar\/user\/popover) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-a\.soulapp\.cn\/(html\/settlement\/meet\/see\/me|meet\/(see\/me|mine\/see|match\/list|uncover\/list)|loveBell\/queryMatchSpeedupConf|videoMatch\/getConfig|soulreal\/post\/highlight\/quota) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/api-pay\.soulapp\.cn\/(privilege\/supervip\/status|vip\/(meet\/userInfo|show\/info|rights\/avatar\/qryMyAvatarRights)|show\/superVIP\/detail\/v2|meet\/my\/count) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/post\.soulapp\.cn\/(v\d\/rec\/square\/header\/tabs|homepage\/tabs\/v2|v1\/post\/highLight\/recommend\/quota|v\d\/post\/(homepage|recommended)(\?|$)) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
^https:\/\/chat-live\.soulapp\.cn\/(chatroom\/(chatClassifyRoomList|getRoomTagInfo)|live\/queryFollowRoomList|square\/relation\/guideUserList) url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/Soul.js
[mitm]
hostname = api-chat.soulapp.cn, api-user.soulapp.cn, api-a.soulapp.cn, api-pay.soulapp.cn, post.soulapp.cn, chat-live.soulapp.cn
*/

/*
  参数解析
  Surge: argument="通知={{{通知}}},星球页保留={{{星球页保留}}}"
  Loon : {通知=${notify},星球页保留=${planetKeep}}  数组形态也要吃下
  中文名优先，旧英文名继续兼容；未替换的 {{{占位符}}} 当没填，走默认值。
*/
function parseArgs(raw) {
  if (raw === undefined || raw === null || raw === "") return {};
  if (Array.isArray(raw)) return parseArgs(raw.join(","));
  if (typeof raw === "object") return raw;
  const out = {};
  const s = String(raw).replace(/\n/g, ",");
  /* 只在「逗号 + 下一个参数名」处切分，值里的逗号（入口清单）留给值自己 */
  s.split(/,(?=\s*[A-Za-z_\u4e00-\u9fa5][\w\u4e00-\u9fa5]*\s*[=:])/).forEach((p) => {
    const t = p.trim();
    if (!t) return;
    let i = t.indexOf("=");
    if (i < 0) i = t.indexOf(":");
    if (i <= 0) return;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}
const RAW_ARG = typeof $argument !== "undefined" ? $argument : null;
const ARG = parseArgs(RAW_ARG);
const ARG_NAMED = Object.keys(ARG).length > 0;

/*
  Loon 插件只支持位置传参，约定固定顺序：0 通知 / 1 星球页保留 / 2 派对频道保留。
  有具名参数（Surge 的 {{{通知}}}）时优先用具名，位置参数只在没有具名时才兜底。
*/
/* Surge 参数不能留空默认值，「一个都不保留」用 -- 表示 */
const ARG_SENTINEL = ["--", "-", "none", "null", "无", "空"];
function goodArg(v) {
  if (v === undefined || v === null) return "";
  const s = String(v).trim();
  if (!s) return "";
  if (/^\{+.*\}+$/.test(s)) return "";                              /* 占位符没被替换 */
  if (ARG_SENTINEL.indexOf(s.toLowerCase()) >= 0) return "";        /* 空值哨兵 */
  return s;
}
function argOf(names, pos) {
  for (let i = 0; i < names.length; i++) {
    const s = goodArg(ARG[names[i]]);
    if (s) return s;
  }
  if (!ARG_NAMED && Array.isArray(RAW_ARG) && pos !== undefined) return goodArg(RAW_ARG[pos]);
  return "";
}
function flagOf(names, pos, dft) {
  const s = argOf(names, pos).toLowerCase();
  if (!s) return dft;
  if (["true", "1", "on", "yes", "是", "开", "开启"].indexOf(s) >= 0) return true;
  if (["false", "0", "off", "no", "否", "关", "关闭"].indexOf(s) >= 0) return false;
  return dft;
}
const NOTIFY = flagOf(["通知", "notify"], 0, true);                 /* 抓到阅后即焚图片时弹通知 */
const PLANET_KEEP = argOf(["星球页保留", "planetKeep"], 1);          /* 星球页要保留的入口 */
const ROOMTAG_KEEP = argOf(["派对频道保留", "roomTagKeep"], 2);      /* 派对频道要保留的频道 */

const url = ($request && $request.url) || "";
let body = ($response && $response.body) || "";

const has = (s) => url.indexOf(s) !== -1;
const keepList = (s) => String(s || "").split(/[,\s|、;；]+/).map((x) => x.trim()).filter(Boolean);

/*
  三平台存储 / HTTP 适配
  谁看过我（/meet/see/me/v2）：服务端会下发 user 列表，但 userId 置 null，
  只给 userIdEcpt。有时整批挖空，所以留一份同接口缓存兜底。
*/
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
/*
  cs 签名 —— 逆向 cn.soulapp.android.soulpower.SoulPowerful.l() → libsoulpower.so h()@0xf2d94
  sec = at/1000；两段置换表取 ASCII 数字串，out[i]=src[digit-1]
  buf = 0280 | MD5(头名升序拼接+"SoulPowerful") 与 perm("%08x"(sec)) 交错 | 07b6 | MD5(url+perm2+"kG@yGB9") | 07b2
*/
const CS_TA = "42765183", CS_TB = "25387164";
const CS_HDR = ["user-agent", "aid", "at", "av", "di", "sdi", "tk"];
const CS_T10 = 0x07, CS_T11 = 0xb6, CS_T16 = 0x07, CS_T17 = 0xb2;

function csBytes(s) {
  const b = [];
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) b.push(c);
    else if (c < 0x800) b.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else b.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return b;
}
function csMd5(str) {
  const rl = (n, c) => (n << c) | (n >>> (32 - c));
  const au = (x, y) => { const l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); };
  const cmn = (q, a, b, x, s, t) => au(rl(au(au(a, q), au(x, t)), s), b);
  const ff = (a, b, c, d, x, s, t) => cmn((b & c) | (~b & d), a, b, x, s, t);
  const gg = (a, b, c, d, x, s, t) => cmn((b & d) | (c & ~d), a, b, x, s, t);
  const hh = (a, b, c, d, x, s, t) => cmn(b ^ c ^ d, a, b, x, s, t);
  const ii = (a, b, c, d, x, s, t) => cmn(c ^ (b | ~d), a, b, x, s, t);
  const by = csBytes(str), n = by.length, bl = n * 8;
  by.push(0x80);
  while (by.length % 64 !== 56) by.push(0);
  const lo = bl >>> 0, hi = Math.floor(n / 536870912) >>> 0;
  for (let i = 0; i < 4; i++) by.push((lo >>> (i * 8)) & 255);
  for (let i = 0; i < 4; i++) by.push((hi >>> (i * 8)) & 255);
  let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
  const x = new Array(16);
  for (let i = 0; i < by.length; i += 64) {
    for (let j = 0; j < 16; j++) x[j] = by[i + j * 4] | (by[i + j * 4 + 1] << 8) | (by[i + j * 4 + 2] << 16) | (by[i + j * 4 + 3] << 24);
    const oa = a, ob = b, oc = c, od = d;
    a = ff(a, b, c, d, x[0], 7, -680876936); d = ff(d, a, b, c, x[1], 12, -389564586);
    c = ff(c, d, a, b, x[2], 17, 606105819); b = ff(b, c, d, a, x[3], 22, -1044525330);
    a = ff(a, b, c, d, x[4], 7, -176418897); d = ff(d, a, b, c, x[5], 12, 1200080426);
    c = ff(c, d, a, b, x[6], 17, -1473231341); b = ff(b, c, d, a, x[7], 22, -45705983);
    a = ff(a, b, c, d, x[8], 7, 1770035416); d = ff(d, a, b, c, x[9], 12, -1958414417);
    c = ff(c, d, a, b, x[10], 17, -42063); b = ff(b, c, d, a, x[11], 22, -1990404162);
    a = ff(a, b, c, d, x[12], 7, 1804603682); d = ff(d, a, b, c, x[13], 12, -40341101);
    c = ff(c, d, a, b, x[14], 17, -1502002290); b = ff(b, c, d, a, x[15], 22, 1236535329);
    a = gg(a, b, c, d, x[1], 5, -165796510); d = gg(d, a, b, c, x[6], 9, -1069501632);
    c = gg(c, d, a, b, x[11], 14, 643717713); b = gg(b, c, d, a, x[0], 20, -373897302);
    a = gg(a, b, c, d, x[5], 5, -701558691); d = gg(d, a, b, c, x[10], 9, 38016083);
    c = gg(c, d, a, b, x[15], 14, -660478335); b = gg(b, c, d, a, x[4], 20, -405537848);
    a = gg(a, b, c, d, x[9], 5, 568446438); d = gg(d, a, b, c, x[14], 9, -1019803690);
    c = gg(c, d, a, b, x[3], 14, -187363961); b = gg(b, c, d, a, x[8], 20, 1163531501);
    a = gg(a, b, c, d, x[13], 5, -1444681467); d = gg(d, a, b, c, x[2], 9, -51403784);
    c = gg(c, d, a, b, x[7], 14, 1735328473); b = gg(b, c, d, a, x[12], 20, -1926607734);
    a = hh(a, b, c, d, x[5], 4, -378558); d = hh(d, a, b, c, x[8], 11, -2022574463);
    c = hh(c, d, a, b, x[11], 16, 1839030562); b = hh(b, c, d, a, x[14], 23, -35309556);
    a = hh(a, b, c, d, x[1], 4, -1530992060); d = hh(d, a, b, c, x[4], 11, 1272893353);
    c = hh(c, d, a, b, x[7], 16, -155497632); b = hh(b, c, d, a, x[10], 23, -1094730640);
    a = hh(a, b, c, d, x[13], 4, 681279174); d = hh(d, a, b, c, x[0], 11, -358537222);
    c = hh(c, d, a, b, x[3], 16, -722521979); b = hh(b, c, d, a, x[6], 23, 76029189);
    a = hh(a, b, c, d, x[9], 4, -640364487); d = hh(d, a, b, c, x[12], 11, -421815835);
    c = hh(c, d, a, b, x[15], 16, 530742520); b = hh(b, c, d, a, x[2], 23, -995338651);
    a = ii(a, b, c, d, x[0], 6, -198630844); d = ii(d, a, b, c, x[7], 10, 1126891415);
    c = ii(c, d, a, b, x[14], 15, -1416354905); b = ii(b, c, d, a, x[5], 21, -57434055);
    a = ii(a, b, c, d, x[12], 6, 1700485571); d = ii(d, a, b, c, x[3], 10, -1894986606);
    c = ii(c, d, a, b, x[10], 15, -1051523); b = ii(b, c, d, a, x[1], 21, -2054922799);
    a = ii(a, b, c, d, x[8], 6, 1873313359); d = ii(d, a, b, c, x[15], 10, -30611744);
    c = ii(c, d, a, b, x[6], 15, -1560198380); b = ii(b, c, d, a, x[13], 21, 1309151649);
    a = ii(a, b, c, d, x[4], 6, -145523070); d = ii(d, a, b, c, x[11], 10, -1120210379);
    c = ii(c, d, a, b, x[2], 15, 718787259); b = ii(b, c, d, a, x[9], 21, -343485551);
    a = au(a, oa); b = au(b, ob); c = au(c, oc); d = au(d, od);
  }
  const out = [];
  [a, b, c, d].forEach((v) => { for (let k = 0; k < 4; k++) out.push((v >>> (k * 8)) & 255); });
  return out;
}
function csPerm(s, table) {
  let o = "";
  for (let i = 0; i < table.length; i++) o += s.charAt(table.charCodeAt(i) - 0x31);
  return o;
}
function csDec(s) {
  try { return decodeURIComponent(String(s).replace(/\+/g, " ")); } catch (e) { return String(s); }
}
/* pairs: [[k,v],...] 已解码；返回 36 字符 cs */
function soulCs(path, pairs, headers, atHex) {
  const ms = parseInt(atHex, 16);
  const sec = Math.floor(ms / 1000) >>> 0;
  const s1 = ("0000000" + sec.toString(16)).slice(-8);
  const ha = csPerm(s1, CS_TA), hb = csPerm(s1, CS_TB);
  let hdr = "";
  for (let i = 0; i < CS_HDR.length; i++) {
    const k = CS_HDR[i];
    if (headers[k] !== undefined && headers[k] !== null) hdr += String(headers[k]);
  }
  const m = csMd5(hdr + "SoulPowerful");
  const ps = pairs.slice().sort((p, q) => (p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0));
  const qs = ps.map((p) => p[0] + "=" + p[1]).join("&");
  const hbHex = ("0000000" + parseInt(hb, 16).toString(16)).slice(-8);
  const b = csMd5(path + (qs ? "?" + qs : "") + hbHex + "kG@yGB9");
  const buf = [
    0x02, 0x80, m[0], parseInt(ha.substr(0, 2), 16), m[1], parseInt(ha.substr(2, 2), 16),
    m[2], parseInt(ha.substr(4, 2), 16), m[3], parseInt(ha.substr(6, 2), 16),
    CS_T10, CS_T11, b[0], b[1], b[2], b[3], CS_T16, CS_T17,
  ];
  return buf.map((v) => { const t = (v & 255).toString(16); return t.length < 2 ? "0" + t : t; }).join("");
}

/* 三平台 GET */
function csHttpGet(u, headers, cb) {
  let fired = false;
  const once = (e, d) => { if (!fired) { fired = true; cb(e, d); } };
  /* 自签请求挂住会让整页空白，必须限时兜底 */
  const timer = typeof setTimeout === "function" ? setTimeout(() => once(new Error("timeout")), CS_TIMEOUT) : null;
  const fin = (e, d) => { if (timer) clearTimeout(timer); once(e, d); };
  try {
    if (typeof $task !== "undefined" && $task.fetch) {
      $task.fetch({ url: u, method: "GET", headers: headers }).then((r) => fin(null, r.body), (e) => fin(e));
      return;
    }
    if (typeof $httpClient !== "undefined" && $httpClient.get) {
      $httpClient.get({ url: u, headers: headers }, (err, resp, data) => fin(err, data));
      return;
    }
  } catch (e) { fin(e); return; }
  fin(new Error("no http client"));
}

/*
  全自动拉「谁看过我」：服务端这次没给真身份时，脚本自己用正确 cs 重新签一次请求，
  拿到真人列表后直接替换响应，用户不用再点「揭晓缘分」。
*/
function pullViewers(obj, done) {
  const src = ($request && $request.headers) || {};
  const hdrs = {};
  Object.keys(src).forEach((k) => { hdrs[String(k).toLowerCase()] = src[k]; });
  const atHex = Date.now().toString(16);
  let biJson = null;
  try {
    const mm = url.match(/[?&]bi=([^&]*)/);
    if (mm) {
      const arr = JSON.parse(csDec(mm[1]));
      if (Array.isArray(arr) && arr.length) {
        arr[0] = atHex;          // bi[0] 与 at 同步刷新
        biJson = JSON.stringify(arr);
      }
    }
  } catch (e) { }
  if (!biJson) { done(null); return; }
  const pairs = [["bi", biJson], ["bik", "32243"], ["limit", "20"], ["pageId", "MHomeMyTrack_Main"], ["sortType", "1"]];
  hdrs["at"] = atHex;
  hdrs["cs"] = soulCs("/meet/see/me/v2", pairs, hdrs, atHex);
  delete hdrs["content-length"];
  const sendQs = pairs.map((p) => p[0] + "=" + encodeURIComponent(p[1])).join("&");
  csHttpGet("https://api-a.soulapp.cn/meet/see/me/v2?" + sendQs, hdrs, (err, data) => {
    if (err || !data) { done(null); return; }
    let fresh = null;
    try { fresh = JSON.parse(data); } catch (e) { }
    if (!fresh || !fresh.data) { done(null); return; }
    /*
    服务端这次可能只给匿名暗卡(buttonType:4，没有 userIdEcpt，点不进人)。
    这种「成功但没用」的响应绝不能拿去覆盖调用方已经填好的缓存真名单，
    否则列表会退化成匿名行 —— 点进头像就是空白。
    */
    const ppl = harvestUsers(fresh.data).filter((x) => x.user);
    if (!ppl.length) { done(null); return; }
    fresh.data.superUser = true;
    fresh.data.uncoverSecretCount = 999;
    saveViewerCache(ppl, null);
    done(fresh);
  });
}

function fmtTime(t) {
  const d = new Date(t);
  const p = (n) => (n < 10 ? "0" + n : "" + n);
  return d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate() + " " +
    p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}
function notify(title, sub, content) {
  try {
    if (typeof $notify !== "undefined" && $notify) { $notify(title, sub, content); return; }
    if (typeof $notification !== "undefined" && $notification.post) { $notification.post(title, sub, content); return; }
  } catch (e) { }
}
/* 递归捞出响应里所有"像用户"的节点(揭晓/访客接口结构不固定，靠这个兜住) */
function harvestUsers(node, out) {
  out = out || [];
  if (!node) return out;
  if (Array.isArray(node)) {
    node.forEach((x) => harvestUsers(x, out));
    return out;
  }
  if (typeof node !== "object") return out;
  const hit = node.userIdEcpt && (node.user || node.signature || node.avatarName);
  if (hit && !out.some((x) => x.userIdEcpt === node.userIdEcpt)) out.push(node);
  Object.keys(node).forEach((k) => {
    if (node[k] && typeof node[k] === "object") harvestUsers(node[k], out);
  });
  return out;
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
    if (!c || c.v !== 2) return null;   // 旧版本缓存里存的是「我看过谁」的人，作废
    if (!Array.isArray(c.list) || !c.list.length) return null;
    if (Date.now() - (c.t || 0) > 12 * 3600 * 1000) return null;
    return c;
  } catch (e) { return null; }
}
function saveViewerCache(list, metric) {
  try { store.set(VKEY, JSON.stringify({ v: 2, t: Date.now(), list: list, metric: metric || null })); } catch (e) { }
}

let ASYNC = false;   /* 自签拉取挂起中，$done 交给回调 */
const CS_TIMEOUT = 4000;   /* 自签请求超时(ms)，超时就放行原响应，绝不让页面卡白 */

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
    if (obj && obj.data) {
      obj.data.superUser = true;
      if (obj.data.meSeeMetricResp) obj.data.meSeeMetricResp.invisibleCount = 9999;
    }
    /* 这里的人是「我看过谁」，与「谁看过我」是两批人，不能拿来互相填 */
    body = JSON.stringify(obj);
  }

  /*
  10b. 谁看过我 / 我的足迹
  服务端正常会下发 user 列表(只把 userId 置 null，用 userIdEcpt 代替)。
  偶尔整批挖空，这时用同接口的历史缓存兜底。
  注意：绝不拿 /meet/mine/see(我看过谁) 的人来填，那是另一批人。
*/
  else if (has("see/me")) {
    const obj = JSON.parse(body);
    let cached = null;
    let servedReal = false;
    if (obj && obj.data) {
      obj.data.superUser = true;
      obj.data.uncoverSecretCount = 999;
      /* 服务端会给本次访客(只有访问次数/星座等标签，没有 userIdEcpt，点不进人) */
      const served = Array.isArray(obj.data.list) ? obj.data.list : [];
      /* 能点进去的才算真资料（只认服务端原话，缓存补的不算，否则永远不刷新） */
      servedReal = served.some((x) => x && x.userIdEcpt);
      if (!servedReal) {
        /* 先用同接口缓存兜底，再自己带签名拉最新覆盖 */
        cached = readViewerCache();
        if (cached) fillViewers(obj, cached.list);
      }
    }
    body = JSON.stringify(obj);
    if (obj && obj.data && !servedReal) {
      /* 彻底全自动：本地自签重放，拿到真人直接替换响应，不用点「揭晓缘分」 */
      ASYNC = true;
      pullViewers(obj, (fresh) => {
        let out = body;
        if (fresh) {
          out = JSON.stringify(fresh);
          if (NOTIFY) notify("Soul 谁看过我列表", "✅最新 " + fmtTime(Date.now()), "");
        } else if (NOTIFY) {
          /* 自签失败、超时、或只拿到匿名暗卡 —— 一律保留原响应/缓存真名单 */
          notify("Soul 谁看过我列表", cached ? "⚠️未拿到真人，用缓存 " + fmtTime(cached.t) : "⚠️未拿到真人", "");
        }
        $done(out === null ? {} : { body: out });
      });
    } else if (NOTIFY) {
      notify("Soul 谁看过我列表", "✅下发 " + fmtTime(Date.now()), "");
    }
  }

  /*
  10c. 揭晓缘分（/meet/uncover/list）
  列表里每张访客卡都是 buttonType:4「揭晓缘分」，服务端此时只给标签不给身份。
  用户点揭晓时 App 才带正确签名请求这条接口，响应里才有真人 —— 抓到就存下来喂列表。
*/
  else if (has("/meet/uncover/list")) {
    const obj = JSON.parse(body);
    if (obj && obj.data) {
      obj.data.superUser = true;
      const ppl = harvestUsers(obj.data).filter((x) => x.user);
      if (ppl.length) saveViewerCache(ppl, null);
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

if (ASYNC) {
  /* 响应交给自签回调里的 $done */
} else if (body === null || body === undefined) {
  $done({});
} else {
  $done({ body });
}
