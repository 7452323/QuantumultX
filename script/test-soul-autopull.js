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
        return Promise.resolve({ body: JSON.stringify(FULL) });
      },
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return got;
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
    console.log("\n" + pass + " passed, " + fail + " failed");
    process.exit(fail ? 1 : 0);
  }, 30);
});
