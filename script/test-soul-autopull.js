/*
  Soul.js 全自动拉「谁看过我」自检
  用 mock 的三平台环境跑真脚本，验证：
  1) 服务端挖空时脚本会自己发一条带正确 cs 的 /meet/see/me/v2
  2) cs 与独立实现(golden 常量)一致
  3) 拿到真人后直接替换响应
  4) 服务端已给真人时不多发一次请求
  node script/test-soul-autopull.js
*/
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "Soul.js"), "utf8");
const AT = "1a0cb7524d2";
const FIXED_MS = parseInt(AT, 16);
/* 脱敏 header 下由独立实现算出的 golden cs */
const GOLDEN = "02802a3a60af5006ec7b07b61f07880c07b2";
const UA = "Soul_New/6.37.0 (iPhone; iOS 27.0; Scale/3.00; CFNetwork; iPhone17,3) SoulBegin-iOS-6.37.0-WIFI-SoulEnd";
const BI = '["1a0cb7524d2","--","Apple","iOS","27.0","27.0","iPhone 16","3","393*852","AppStore","WiFi","zh"]';

const HEADERS = {
  "user-agent": UA, aid: "10000001", at: AT, av: "6.37.0",
  di: "00000000-0000-0000-0000-000000000000", sdi: "00000000000000000000000000000000",
  tk: "TESTTOKEN", os: "iOS", srs: "web",
};
const EMPTY = { code: 10001, message: "success", data: { superUser: false, allViewerCount: 483, list: [{ buttonType: 4, viewCount: 1 }, { buttonType: 4, viewCount: 2 }] } };
const FULL = { code: 10001, message: "success", data: { superUser: false, allViewerCount: 483, list: [{ userIdEcpt: "AAA", user: { signature: "夜怀山海" }, avatarName: "n" }] } };
/* 服务端「成功但没用」的匿名暗卡：有 list 但一条 userIdEcpt 都没有 —— 点进头像必空白 */
const STUB = { code: 10001, message: "success", data: { superUser: true, allViewerCount: 100, list: [{ buttonType: 4, viewCount: 1, user: null }, { buttonType: 4, viewCount: 2, user: null }] } };

let pass = 0, fail = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; console.log((ok ? "  ✓ " : "  ✗ ") + msg); };

function run(responseBody, opts) {
  opts = opts || {};
  const got = { fetch: null, done: null, notes: [] };
  class FakeDate extends Date { static now() { return FIXED_MS; } }
  const sandbox = {
    console: { log() { } },
    Date: FakeDate,
    JSON, Math, Array, Object, String, Number, Boolean, parseInt, parseFloat, encodeURIComponent, decodeURIComponent, Error, RegExp,
    $request: { url: "https://api-a.soulapp.cn/meet/see/me/v2?bi=" + encodeURIComponent(BI) + "&bik=32243&limit=20&pageId=MHomeMyTrack_Main&sortType=1", headers: HEADERS, method: "GET" },
    $response: { body: typeof responseBody === "string" ? responseBody : JSON.stringify(responseBody) },
    $prefs: { valueForKey: () => opts.cache || null, setValueForKey: () => true },
    $notify: (t, s) => got.notes.push(t + "|" + s),
    $done: (x) => { got.done = x; },
    $task: {
      fetch: (o) => {
        got.fetch = o;
        if (opts.fetchFail) return Promise.reject(new Error("net"));
        if (opts.fetchHang) return new Promise(() => { });
        return Promise.resolve({ body: JSON.stringify(opts.pullBody || FULL) });
      },
    },
  };
  if (opts.setTimeout) sandbox.setTimeout = opts.setTimeout;
  if (opts.argument !== undefined) sandbox.$argument = opts.argument;
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  got.sandbox = sandbox;
  return got;
}

/* 读回脚本里的参数解析结果：[ARG键, NOTIFY, 星球页保留, 派对频道保留] */
function argState(argument) {
  const s = run(FULL, { argument });
  return JSON.parse(vm.runInContext("JSON.stringify([Object.keys(ARG),NOTIFY,PLANET_KEEP,ROOMTAG_KEEP])", s.sandbox));
}

console.log("[1] 服务端挖空 → 自动自签重放");
{
  const g = run(EMPTY);
  chk(!!g.fetch, "发出了自签请求");
  const h = (g.fetch && g.fetch.headers) || {};
  chk(h.cs === GOLDEN, "cs = golden (" + h.cs + ")");
  chk(h.at === AT, "at 已刷新为当前毫秒");
  chk(/^https:\/\/api-a\.soulapp\.cn\/meet\/see\/me\/v2\?/.test((g.fetch && g.fetch.url) || ""), "URL 指回 see/me/v2");
  chk((g.fetch && g.fetch.url || "").indexOf("pageId=MHomeMyTrack_Main") > 0, "pageId 正确");
  chk((g.fetch && g.fetch.url || "").indexOf(AT) > 0, "bi[0] 与 at 同步");
  chk(h["content-length"] === undefined, "GET 不带 content-length");
}

console.log("[2] 拿到真人 → 直接替换响应");
const p2 = new Promise((res) => {
  const g = run(EMPTY);
  setTimeout(() => {
    let d = null;
    try { d = JSON.parse(g.done.body); } catch (e) { }
    chk(!!d, "$done 带回了新 body");
    chk(d && d.data && d.data.list && d.data.list[0] && d.data.list[0].userIdEcpt === "AAA", "响应里是真实访客");
    chk(d && d.data.superUser === true && d.data.uncoverSecretCount === 999, "superUser/count 已补");
    chk(g.notes.some((n) => n.indexOf("✅最新") >= 0), "通知提示最新");
    res();
  }, 30);
});

p2.then(() => {
  console.log("[3] 服务端已给真人 → 不重复拉");
  const g3 = run(FULL);
  chk(!g3.fetch, "没有多余请求");
  chk(/AAA/.test(g3.done.body || ""), "原样下发真人");
  chk(g3.notes.some((n) => n.indexOf("✅下发") >= 0), "通知提示下发");

  console.log("[4] 自签失败 → 回落缓存");
  const cached = JSON.stringify({ v: 2, t: FIXED_MS, list: [{ userIdEcpt: "BBB", user: { signature: "x" } }] });
  const g4 = run(EMPTY, { fetchFail: true, cache: cached });
  setTimeout(() => {
    let d = null;
    try { d = JSON.parse(g4.done.body); } catch (e) { }
    chk(d && d.data && d.data.list && d.data.list[0] && d.data.list[0].userIdEcpt === "BBB", "回落缓存成功");
    chk(g4.notes.some((n) => n.indexOf("⚠️") >= 0), "通知提示失败");

    console.log("[5] 参数解析（Surge 具名 / Loon 位置 / 旧英文名 / 占位符未替换）");
    {
      const a = argState("通知=true,星球页保留=soulMatch,voiceMatch,partyMatch");
      chk(JSON.stringify(a[0]) === '["通知","星球页保留"]', "Surge 具名中文键解出 " + JSON.stringify(a[0]));
      chk(a[1] === true, "通知=true → NOTIFY true");
      chk(a[2] === "soulMatch,voiceMatch,partyMatch", "值里的逗号没被切断（" + a[2] + "）");

      const b = argState("通知:false,星球页保留:soulMatch");
      chk(b[1] === false, "冒号分隔 + false → NOTIFY false");

      const c = argState("notify=false,planetKeep=hot,all");
      chk(c[1] === false && c[2] === "hot,all", "旧英文名仍兼容（" + c[2] + "）");

      const d = argState(["true", "masked,planet", "hot,chat"]);
      chk(d[1] === true && d[2] === "masked,planet" && d[3] === "hot,chat", "Loon 位置参数按 0/1/2 对上");

      const e = argState("通知={{{通知}}}");
      chk(e[1] === true, "占位符没被替换时回落默认值");

      const f = argState(undefined);
      chk(f[1] === true && f[2] === "" && f[3] === "", "完全不给参数走默认（QX）");

      const g = argState("通知=true,星球页保留=--,派对频道保留=--");
      chk(g[2] === "" && g[3] === "", "Surge 默认值 -- 当作「一个都不保留」");

      const h = argState(["false", "--", "hot,chat"]);
      chk(h[1] === false && h[2] === "" && h[3] === "hot,chat", "Loon 位置参数里的哨兵也认");
    }

    console.log("[6] 自签只拿到匿名暗卡 → 不许覆盖缓存真名单（点头像空白的根因）");
    const cached2 = JSON.stringify({ v: 2, t: FIXED_MS, list: [{ userIdEcpt: "BBB", user: { signature: "x" } }] });
    const g6 = run(EMPTY, { cache: cached2, pullBody: STUB });
    setTimeout(() => {
      let d = null;
      try { d = JSON.parse(g6.done.body); } catch (e) { }
      chk(d && d.data.list[0] && d.data.list[0].userIdEcpt === "BBB", "缓存真名单没被暗卡顶掉");
      chk(g6.notes.some((n) => n.indexOf("未拿到真人") >= 0), "通知说明未拿到真人");
      chk(!g6.notes.some((n) => n.indexOf("✅最新") >= 0), "不谎报最新");

      console.log("[7] 只拿到暗卡且没缓存 → 放行原响应");
      const g7 = run(EMPTY, { pullBody: STUB });
      setTimeout(() => {
        let d = null;
        try { d = JSON.parse(g7.done.body); } catch (e) { }
        chk(d && d.data.list.length === 2 && !d.data.list[0].userIdEcpt, "保留服务端原响应，没有伪造身份");

        console.log("[8] 自签请求挂住 → 超时兜底，绝不能不出 $done");
        const g8 = run(EMPTY, { cache: cached2, fetchHang: true, setTimeout: (fn) => { fn(); return 0; } });
        setTimeout(() => {
          chk(!!g8.done, "超时后仍调用了 $done（否则页面白屏）");
          let d = null;
          try { d = JSON.parse((g8.done || {}).body); } catch (e) { }
          chk(d && d.data.list[0] && d.data.list[0].userIdEcpt === "BBB", "超时也保住了缓存真名单");

          console.log("\n" + pass + " passed, " + fail + " failed");
          process.exit(fail ? 1 : 0);
        }, 30);
      }, 30);
    }, 30);
  }, 30);
});
