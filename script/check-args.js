/*
  模块参数自检
  Surge: #!arguments 声明 与 {{{占位符}}} 必须一一对应
  Loon : [Argument] 声明 与 ${变量} 必须对得上，且每项都要有中文 tag（界面显示名）
  QX   : 不支持传参，不能出现占位符
  node script/check-args.js
*/
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; console.log((ok ? "  ✓ " : "  ✗ ") + msg); };
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

/* ---- Surge ---- */
console.log("[Surge] surge/Soul.sgmodule");
{
  const t = read("surge/Soul.sgmodule");
  const declLine = (t.match(/^#!arguments=(.*)$/m) || [])[1] || "";
  const descLine = (t.match(/^#!arguments-desc=(.*)$/m) || [])[1] || "";
  chk(!!declLine, "有 #!arguments 声明");
  const names = declLine.split(",").map((s) => s.split(":")[0].trim()).filter(Boolean);
  chk(names.length > 0, "声明参数：" + names.join(" / "));
  names.forEach((n) => chk(/^[\w\u4e00-\u9fa5]+$/.test(n), "参数名合法 " + n));
  /* 每个参数都必须有非空默认值：
     写成「名字:」→ 报「参数声明格式错误」；写成裸名字「名字」→ 用户没填时报「value ... is not found」模块加载失败 */
  declLine.split(",").map((s) => s.trim()).filter(Boolean).forEach((item) => {
    const i = item.indexOf(":");
    chk(i > 0, "参数 " + item + " 带默认值（裸名字会让 Surge 判未填、模块加载失败）");
    if (i > 0) chk(item.slice(i + 1).trim().length > 0, "参数 " + item.slice(0, i) + " 的默认值非空");
  });
  const used = [...new Set([...t.matchAll(/\{\{\{([^}]+)\}\}\}/g)].map((m) => m[1].trim()))];
  used.forEach((u) => chk(names.indexOf(u) >= 0, "占位符 {{{" + u + "}}} 有声明"));
  names.forEach((n) => chk(used.indexOf(n) >= 0, "参数 " + n + " 有被引用"));
  names.forEach((n) => chk(descLine.indexOf(n) >= 0, "参数 " + n + " 有说明"));
}

/* ---- Loon ---- */
["loon/Soul.plugin", "loon/Soul.lpx"].forEach((f) => {
  console.log("[Loon] " + f);
  const t = read(f);
  const blk = (t.match(/\[Argument\]([\s\S]*?)\n\[/) || [])[1] || "";
  chk(!!blk, "有 [Argument] 段");
  const rows = blk.split("\n").map((l) => l.trim()).filter((l) => l && l[0] !== "#");
  const vars = [];
  rows.forEach((l) => {
    const m = l.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/);
    if (!m) return;
    vars.push(m[1]);
    chk(/\btag\s*=\s*\S/.test(m[2]), m[1] + " 有中文 tag（界面显示名）");
    chk(/\bdesc\s*=\s*\S/.test(m[2]), m[1] + " 有 desc 说明");
    chk(/^(switch|input|select)\b/.test(m[2]), m[1] + " 类型合法");
  });
  const usedAll = [...new Set([...t.matchAll(/\$\{([A-Za-z_]\w*)\}/g)].map((m) => m[1]))];
  usedAll.filter((v) => v !== "url").forEach((v) => chk(vars.indexOf(v) >= 0, "${" + v + "} 有声明"));
  /* 位置传参必须每条脚本行一致，否则脚本按 0/1/2 取不到值 */
  const calls = [...t.matchAll(/script\("[^"]+",\s*\{(.*?)\}\)\s*with/g)].map((m) => m[1].replace(/\s/g, ""));
  chk(calls.length > 0, "解析到 " + calls.length + " 条 script 传参");
  chk(new Set(calls).size === 1, "所有 script 行传参顺序一致：" + (calls[0] || ""));
  chk((calls[0] || "").split(",").length === vars.length, "位置参数个数与声明一致");
});

/* ---- QX ---- */
console.log("[QX] script/Soul.conf");
{
  const t = read("script/Soul.conf");
  chk(t.indexOf("{{{") < 0, "QX 不支持传参，没有残留占位符");
  chk(/script-response-body/.test(t), "脚本行存在");
}

console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
