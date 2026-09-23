/*
  模块参数解析真跑测试
  直接切出发布文件里的解析代码，在 vm 沙箱里喂各种 $argument 跑一遍。
  node script/test-arg-parse.js
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

let pass = 0, fail = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; console.log((ok ? "  ✓ " : "  ✗ ") + msg); };
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const cut = (src, a, b) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error("切不出代码段：" + a);
  return src.slice(i, j);
};
const run = (code, ctx, expr) =>
  vm.runInNewContext('const DEF_BASE = "https://re0.me";\n' + code + "\n;" + expr, Object.assign({ decodeURIComponent }, ctx));

/* ---- Hdhive：$argument 切分 + -- 哨兵 ---- */
{
  console.log("[Hdhive] task/Hdhive.js");
  const code = cut(read("task/Hdhive.js"), "/* 空值哨兵", "// ============ 工具");
  const get = (argument, saved) => run(code, {
    $argument: argument,
    $: { isNode: () => false, getdata: (k) => (saved || {})[k] || "" },
    process: { env: {} },
  }, "CONFIG.accounts");
  chk(get("re0_accounts=a#1&b#2") === "a#1&b#2", "多账号 a#1&b#2 不被 & 切碎");
  chk(get("re0_accounts=a#1") === "a#1", "单账号正常读出");
  chk(get("re0_accounts=--") === "", "-- 当作没填");
  chk(get("re0_accounts=", { re0_accounts: "x#1" }) === "x#1", "没填时回落到持久化存储");
  chk(get("re0_accounts=") === "", "两边都没有则空");
  chk(get("re0_accounts=a%231") === "a#1", "百分号编码会被解码");
}

/* ---- Readify：模块参数优先于存储 ---- */
{
  console.log("[Readify] task/Readify.js");
  const code = cut(read("task/Readify.js"), "const ckName", "// ============ chavyleung");
  const acc = (argument) => run(code, { $argument: argument }, "argAccount()");
  chk(acc("readify_accounts=a@b.com#p1|c@d.com#p2") === "a@b.com#p1|c@d.com#p2", "多账号 | 分隔完整读出");
  chk(acc("readify_accounts=--") === "", "-- 当作没填（回落到存储）");
  chk(acc("readify_accounts=") === "", "空值当作没填");
  chk(acc("") === "" && acc(undefined) === "", "没传 $argument 不报错");
  chk(acc("other=1&readify_accounts=a@b.com#p") === "a@b.com#p", "多参数里能挑出目标参数");
}

/* ---- 微信读书：$argument 优先于 getdata ---- */
{
  console.log("[Reading] task/Reading/weread_claim.js");
  const src = read("task/Reading/weread_claim.js");
  const code = cut(src, "function parseArgument", "function getHeaders");
  const get = (arg) => run(code, { $argument: arg }, "parseArgument(typeof $argument === 'string' ? $argument : '').prefer_coin");
  chk(get("prefer_coin=1") === "1", "读得到 prefer_coin=1");
  chk(get("prefer_coin=2") === "2", "读得到 prefer_coin=2");
  chk(get("capture_cookie=switch,true&prefer_coin=1") === "1", "多参数里能挑出目标参数");
  chk(get("") === undefined, "没传时不报错");
  chk(src.indexOf("parseArgument(typeof $argument") >= 0 && src.indexOf("argCoin || $.getdata(\"prefer_coin\")") >= 0,
    "代码里 $argument 的优先级高于 getdata");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
