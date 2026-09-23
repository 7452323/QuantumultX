/*
  模块参数自检
  Surge: #!arguments 声明 与 {{{占位符}}} 一一对应，且每项都要有非空默认值
  Loon : [Argument] 声明 与 ${变量} 对得上，且每项都要有中文 tag（界面显示名）
  QX   : 不支持传参，不能出现占位符
  node script/check-args.js
*/
const fs = require("fs");
const path = require("path");

let pass = 0, fail = 0;
const chk = (ok, msg) => { ok ? pass++ : fail++; console.log((ok ? "  ✓ " : "  ✗ ") + msg); };
const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === ".git" ? [] : walk(p);
    return e.name.endsWith(".sgmodule") ? [p] : [];
  });
}

/* ---- Surge：全仓 .sgmodule ---- */
const advisory = [];
walk(ROOT).map((p) => path.relative(ROOT, p)).sort().forEach((f) => {
  const t = read(f);
  const declLine = (t.match(/^#!arguments\s*=\s*(.*)$/m) || [])[1] || "";
  const used = [...new Set([...t.matchAll(/\{\{\{([^}]+)\}\}\}/g)].map((m) => m[1].trim()))];
  if (!declLine && !used.length) return;
  console.log("[Surge] " + f);
  chk(!!declLine, "有 #!arguments 声明（正文引用 " + used.length + " 个占位符）");
  const items = declLine.split(",").map((s) => s.trim()).filter(Boolean);
  const names = items.map((s) => s.split(":")[0].trim());
  chk(names.length > 0 && names.every(Boolean), "声明参数：" + names.join(" / "));
  /* 冒号后必须跟非空默认值。写「名字:」→ Surge 报「参数声明格式错误」；写「名字=值」或裸名字「名字」→ 报 value not found 并拒绝加载 */
  items.forEach((item) => {
    const i = item.indexOf(":");
    chk(i > 0, "参数「" + item + "」用冒号带默认值");
    if (i > 0) chk(item.slice(i + 1).trim().length > 0, "参数 " + item.slice(0, i).trim() + " 的默认值非空");
  });
  names.forEach((n) => {
    chk(/^[\w\u4e00-\u9fa5]+$/.test(n), "参数名合法 " + n);
    chk(used.indexOf(n) >= 0, "参数 " + n + " 有被正文引用");
    if (!/[\u4e00-\u9fa5]/.test(n)) advisory.push(f + " → " + n);
  });
  used.forEach((u) => chk(names.indexOf(u) >= 0, "占位符 {{{" + u + "}}} 有声明"));
  const descLine = (t.match(/^#!arguments-desc\s*=\s*(.*)$/m) || [])[1] || "";
  if (descLine) names.forEach((n) => chk(descLine.indexOf(n) >= 0, "参数 " + n + " 有说明"));
});

/* ---- Loon：所有带 [Argument] 的插件 ---- */
fs.readdirSync(path.join(ROOT, "loon")).filter((n) => /\.(plugin|lpx)$/.test(n)).map((n) => "loon/" + n)
  .filter((f) => /\[Argument\]/.test(read(f))).sort().forEach((f) => {
  console.log("[Loon] " + f);
  const t = read(f);
  const blk = (t.match(/\[Argument\]([\s\S]*?)\n\[/) || [])[1] || "";
  chk(!!blk, "有 [Argument] 段");
  const vars = [];
  blk.split("\n").map((l) => l.trim()).filter((l) => l && l[0] !== "#").forEach((l) => {
    const m = l.match(/^([A-Za-z_]\w*)\s*=\s*(.*)$/);
    if (!m) return;
    vars.push(m[1]);
    chk(/\btag\s*=\s*\S/.test(m[2]), m[1] + " 有 tag（界面显示名）");
    chk(/[\u4e00-\u9fa5]/.test((m[2].match(/\btag\s*=\s*([^,]+)/) || [])[1] || ""), m[1] + " 的 tag 是中文");
    chk(/\bdesc\s*=\s*\S/.test(m[2]), m[1] + " 有 desc 说明");
    chk(/^(switch|input|select)\b/.test(m[2]), m[1] + " 类型合法");
  });
  const usedAll = [...new Set([...t.matchAll(/\$\{([A-Za-z_]\w*)\}|\{([A-Za-z_]\w*)\}/g)].map((m) => m[1] || m[2]))];
  usedAll.filter((v) => v !== "url").forEach((v) => chk(vars.indexOf(v) >= 0, "${" + v + "} 有声明"));
  /* 位置传参必须每条脚本行一致，否则脚本按 0/1/2 取不到值 */
  const calls = [...t.matchAll(/script\("[^"]+",\s*\{(.*?)\}\)\s*with/g)].map((m) => m[1].replace(/\s/g, ""));
  if (calls.length) {
    chk(new Set(calls).size === 1, "所有 script 行传参顺序一致：" + (calls[0] || ""));
    chk(calls[0].split(",").length === vars.length, "位置参数个数与声明一致");
  } else {
    console.log("  · 该插件不用位置传参写法，跳过位置参数检查");
  }
});

/* ---- QX ---- */
console.log("[QX] script/Soul.conf");
{
  const t = read("script/Soul.conf");
  chk(t.indexOf("{{{") < 0, "QX 不支持传参，没有残留占位符");
  chk(/script-response-body/.test(t), "脚本行存在");
}

/* ---- 模块 argument 键必须被脚本真的读走（传了但脚本不读 = 参数摆设） ---- */
console.log("[Script] 模块 argument 键 ↔ 脚本引用");
walk(ROOT).map((p) => path.relative(ROOT, p)).sort().forEach((f) => {
  read(f).split("\n").forEach((line) => {
    if (/^\s*#/.test(line)) return;
    const sp = line.match(/script-path=(\S+?)(?:\?|,|$)/);
    if (!sp) return;
    const pairs = [...line.matchAll(/([A-Za-z_]\w*)=\{\{\{([^}]+)\}\}\}/g)];
    if (!pairs.length) return;
    const local = sp[1].split("/main/")[1] || "";
    if (!local || !fs.existsSync(path.join(ROOT, local))) { chk(false, f + " 指向的脚本不存在：" + local); return; }
    const js = read(local);
    pairs.forEach((m) => chk(js.indexOf(m[1]) >= 0, f + " 传 " + m[1] + "（" + m[2] + "）→ " + local + " 读得到"));
  });
});

if (advisory.length) console.log("\n[建议] 以下参数名不是中文：\n  " + advisory.join("\n  "));
console.log("\n" + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
