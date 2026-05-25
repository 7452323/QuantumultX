#!/usr/bin/env node
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const execFileAsync = promisify(execFile);
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 标签翻译远程地址（GitHub），自动拉取最新翻译
const TAG_URL = "https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/tags.json";
const ACTRESS_URL = "https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/actress.json";

let tagMap = {};
async function loadTagMap() {
  try {
    const { stdout } = await execFileAsync("curl", ["-sSL", "--max-time", "10", TAG_URL]);
    const data = JSON.parse(stdout);
    if (data && typeof data === "object") {
      tagMap = data;
      try { writeFileSync(join(__dirname, "tags.json"), stdout, "utf-8"); } catch {}
      return;
    }
  } catch {}
  try {
    const raw = readFileSync(join(__dirname, "tags.json"), "utf-8");
    tagMap = JSON.parse(raw);
  } catch {
    tagMap = {};
  }
}

function t(text) {
  return tagMap[text] || text;
}

// 演员翻译
let actressMap = {};
async function loadActressMap() {
  try {
    const { stdout } = await execFileAsync("curl", ["-sSL", "--max-time", "10", ACTRESS_URL]);
    const data = JSON.parse(stdout);
    if (data && typeof data === "object") {
      actressMap = data;
      try { writeFileSync(join(__dirname, "actress.json"), stdout, "utf-8"); } catch {}
      return;
    }
  } catch {}
  try {
    const raw = readFileSync(join(__dirname, "actress.json"), "utf-8");
    actressMap = JSON.parse(raw);
  } catch {
    actressMap = {};
  }
}

// 日文/繁体汉字 → 简体汉字 映射
const charMap = {
  "亜":"亚","愛":"爱","壓":"压","奧":"奥","櫻":"樱","醫":"医","榮":"荣",
  "曖":"暧","靄":"霭","暗":"暗","闇":"暗","驛":"驿","穩":"稳",
  "悅":"悦","園":"园","艷":"艳","圓":"圆","緣":"缘","鬱":"郁",
  "畫":"画","會":"会","壞":"坏","懷":"怀","樂":"乐","滿":"满",
  "廣":"广","擴":"扩","擴":"扩","歸":"归","擊":"击","雞":"鸡",
  "氣":"气","齊":"齐","繼":"继","獸":"兽","變":"变","黨":"党",
  "數":"数","樹":"树","對":"对","發":"发","當":"当","點":"点",
  "東":"东","體":"体","臺":"台","寶":"宝","實":"实","時":"时",
  "書":"书","術":"术","讀":"读","豐":"丰","風":"风","飛":"飞",
  "關":"关","國":"国","過":"过","開":"开","門":"门","間":"间",
  "關":"关","觀":"观","館":"馆","學":"学","會":"会","興":"兴",
  "進":"进","盡":"尽","經":"经","輕":"轻","權":"权","勸":"劝",
  "區":"区","確":"确","讓":"让","熱":"热","認":"认","聲":"声",
  "勝":"胜","勢":"势","傷":"伤","賞":"赏","準":"准","澤":"泽",
  "濱":"滨","濟":"济","灣":"湾","瀧":"泷","瀨":"濑","瀏":"浏",
  "為":"为","萬":"万","無":"无","衛":"卫","溫":"温","穩":"稳",
  "灣":"湾","雲":"云","應":"应","業":"业","藝":"艺","藥":"药",
  "優":"优","郵":"邮","遊":"游","猶":"犹","與":"与","語":"语",
  "運":"运","詠":"咏","圍":"围","偉":"伟","偽":"伪","維":"维",
  "歐":"欧","澱":"淀","鬱":"郁","願":"愿","裝":"装","狀":"状",
  "張":"张","長":"长","兒":"儿","寫":"写","謝":"谢","鄉":"乡",
  "價":"价","條":"条","調":"调","談":"谈","難":"难","惱":"恼",
  "腦":"脑","內":"内","納":"纳","練":"练","煉":"炼","連":"连",
  "勞":"劳","亂":"乱","禮":"礼","麗":"丽","歷":"历","勵":"励",
  "兩":"两","靈":"灵","齡":"龄","領":"领","嶺":"岭","錄":"录",
  "慮":"虑","侶":"侣","綠":"绿","戀":"恋","淚":"泪","類":"类",
  "龍":"龙","蘭":"兰","藍":"蓝","覽":"览","臘":"腊",
  "髙":"高","海":"海","渕":"渊","澤":"泽","綾":"绫","遙":"遥",
  "裡":"里","凜":"凛","祐":"佑","祐":"佑","祥":"祥","涼":"凉",
  "濱":"滨","邊":"边","遲":"迟","遲":"迟","鎌":"镰","毎":"每",
  "渋":"涩","辺":"边","桜":"樱","楽":"乐","国":"国","経":"经",
  "軽":"轻","転":"转","働":"働","広":"广","拡":"扩","満":"满",
  "沢":"泽","浜":"滨","瀬":"濑","縄":"绳","継":"继","続":"续",
  "鉄":"铁","銭":"钱","長":"长","門":"门","間":"间","関":"关",
  "険":"险","検":"检","験":"验","騒":"骚","髪":"发","覧":"览",
  "覚":"觉","学":"学","発":"发","髪":"发","捗":"","歩":"步",
  "渓":"溪","径":"径","恵":"惠","掲":"揭","携":"携","暦":"历",
  "枠":"框","畑":"田","畠":"田","辻":"辻","込":"入",
}

function translateActress(name) {
  // 先查表
  if (actressMap[name]) return actressMap[name];
  // 没查到，做繁简转换
  let result = "";
  for (const ch of name) {
    result += charMap[ch] || ch;
  }
  return result;
}

function normalizeCode(raw) {
  const input = String(raw ?? "").trim().toUpperCase();
  if (!input) return "";
  const m = input.replace(/\s+/g, "").match(/^([A-Z]{2,10})-?(\d{2,6})$/);
  if (!m) return input;
  return `${m[1]}-${m[2]}`;
}

async function fetchHtml(url) {
  const { stdout } = await execFileAsync("curl", [
    "-sSL", "--max-time", "20", "-A", UA,
    "-H", "Accept-Language: zh-CN,zh;q=0.9", url,
  ]);
  return String(stdout || "");
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pick(pattern, html) {
  const m = pattern.exec(html);
  return m ? stripTags(m[1]) : "";
}

async function searchAndDetail(code) {
  const searchUrl = `https://javdb.com/search?q=${encodeURIComponent(code)}&f=all`;
  const page = await fetchHtml(searchUrl);

  const itemRegex = /<a href="(\/v\/[^\"]+)" class="box"[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?<\/a>/gi;
  let item = null;
  let m;
  while ((m = itemRegex.exec(page)) !== null) {
    const href = m[1];
    const title = stripTags(m[2]);
    const compact = title.toUpperCase().replace(/[\s-]/g, "");
    if (compact.includes(code.replace(/-/g, ""))) {
      item = { href, title };
      break;
    }
  }

  if (!item) return null;

  const detailUrl = `https://javdb.com${item.href}`;
  const html = await fetchHtml(detailUrl);

  const score = pick(/<span class="score">[\s\S]*?<span class="value">([^<]+)<\/span>/i, html);
  const director = pick(/導演:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i, html);
  const maker = pick(/片商:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i, html);
  const series = pick(/系列:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i, html);
  const date = pick(/日期:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i, html);

  const actorsChunk = /演員:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i.exec(html)?.[1] || "";
  const tagsChunk = /類別:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i.exec(html)?.[1] || "";
  const actors = [...actorsChunk.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((x) => stripTags(x[1])).slice(0, 8);
  const tags = [...tagsChunk.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map((x) => stripTags(x[1])).slice(0, 10);

  const previewRaw = pick(/id="preview-video"[\s\S]*?<source[^>]*src="([^\"]+)"/i, html);
  const previewVideo = previewRaw
    ? previewRaw.startsWith("http") ? previewRaw : `https:${previewRaw}`
    : "";

  const coverRaw =
    pick(/<img[^>]*src="([^\"]+)"[^>]*class="video-cover"/i, html) ||
    pick(/<img[^>]*class="video-cover"[^>]*src="([^\"]+)"/i, html);
  const coverImage = coverRaw || "";

  return {
    code, title: item.title, score, director, maker, series, date,
    actors: actors.map(translateActress), tags: tags.map(t), detailUrl, previewVideo, coverImage,
  };
}

async function main() {
  await loadTagMap();
  await loadActressMap();

  let raw = process.argv.slice(2).join(" ");
  raw = raw.replace(/^\/av\s*/i, "").trim();
  const code = normalizeCode(raw);

  if (!code) {
    console.log("用法: node av.mjs /av SONE-763");
    return;
  }

  try {
    const movie = await searchAndDetail(code);
    if (!movie) {
      console.log(`未找到番号: ${code}`);
      return;
    }

    const scoreNum = parseFloat(movie.score);
    let stars = "-";
    if (!isNaN(scoreNum)) {
      const full = Math.round(scoreNum / 2);
      stars = "★".repeat(Math.min(full, 5)) + "☆".repeat(Math.max(5 - full, 0));
    }

    const lines = [
      `🎬 ${movie.code}`, ``,
      `标题: ${movie.title || "-"}`,
      `导演: ${movie.director || "-"}`,
      `片商: ${movie.maker || "-"}`,
      `日期: ${movie.date || "-"}`,
      `评分: ${stars}`,
      `演员: ${movie.actors?.length ? movie.actors.join("、") : "-"}`,
      `标签: ${movie.tags?.length ? movie.tags.join("、") : "-"}`,
      `播放: ${movie.detailUrl}`,
      `封面: ${movie.coverImage || "无"}`,
    ];

    console.log(lines.join("\n"));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`查询失败: ${msg}`);
    process.exitCode = 1;
  }
}

await main();
