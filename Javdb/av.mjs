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
    actors, tags: tags.map(t), detailUrl, previewVideo, coverImage,
  };
}

async function main() {
  await loadTagMap();

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
