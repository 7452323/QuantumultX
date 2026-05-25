#!/usr/bin/env node
// JAV 番号查询 - javdb.com
// Usage: node av.mjs /av SONE-763
// 自动拉取标签翻译和演员名繁简转换

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// 繁體→簡體轉換（lazy load）
let _t2s = null;
async function t2s(text) {
  if (!_t2s) {
    const OpenCC = await import('opencc-js');
    _t2s = OpenCC.default.Converter({ from: 'hk', to: 'cn' });
  }
  return _t2s(text);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const TAG_URL = 'https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/tags.json';
const ACTRESS_URL = 'https://raw.githubusercontent.com/7452323/QuantumultX/main/Javdb/actress.json';

// 标签翻译
let tagMap = {};
function loadTagMap() {
  try {
    const out = execSync(`curl -sSL --max-time 10 "${TAG_URL}"`, { encoding: 'utf-8', timeout: 15000 });
    const data = JSON.parse(out);
    if (data && typeof data === 'object') {
      tagMap = data;
      try { writeFileSync(join(__dirname, 'tags.json'), out, 'utf-8'); } catch {}
      return;
    }
  } catch {}
  try {
    if (existsSync(join(__dirname, 'tags.json'))) {
      tagMap = JSON.parse(readFileSync(join(__dirname, 'tags.json'), 'utf-8'));
    }
  } catch { tagMap = {}; }
}

function t(text) { return tagMap[text] || text; }

// 演员翻译
let actressMap = {};
function loadActressMap() {
  try {
    const out = execSync(`curl -sSL --max-time 10 "${ACTRESS_URL}"`, { encoding: 'utf-8', timeout: 15000 });
    const data = JSON.parse(out);
    if (data && typeof data === 'object') {
      actressMap = data;
      try { writeFileSync(join(__dirname, 'actress.json'), out, 'utf-8'); } catch {}
      return;
    }
  } catch {}
  try {
    if (existsSync(join(__dirname, 'actress.json'))) {
      actressMap = JSON.parse(readFileSync(join(__dirname, 'actress.json'), 'utf-8'));
    }
  } catch { actressMap = {}; }
}

// 繁简转换
const charMap = {
  "亞":"亚","愛":"爱","壓":"压","奧":"奥","櫻":"樱","醫":"医","榮":"荣",
  "曖":"暧","靄":"霭","暗":"暗","闇":"暗","驛":"驿","穩":"稳",
  "悅":"悦","園":"园","艷":"艳","圓":"圆","緣":"缘","鬱":"郁",
  "畫":"画","會":"会","壞":"坏","懷":"怀","樂":"乐","滿":"满",
  "廣":"广","擴":"扩","歸":"归","擊":"击","雞":"鸡",
  "氣":"气","齊":"齐","繼":"继","獸":"兽","變":"变","黨":"党",
  "數":"数","樹":"树","對":"对","發":"发","當":"当","點":"点",
  "東":"东","體":"体","臺":"台","寶":"宝","實":"实","時":"时",
  "書":"书","術":"术","讀":"读","豐":"丰","風":"风","飛":"飞",
  "關":"关","國":"国","過":"过","開":"开","門":"门","間":"间",
  "觀":"观","館":"馆","學":"学","興":"兴",
  "進":"进","盡":"尽","經":"经","輕":"轻","權":"权","勸":"劝",
  "區":"区","確":"确","讓":"让","熱":"热","認":"认","聲":"声",
  "勝":"胜","勢":"势","傷":"伤","賞":"赏","準":"准","澤":"泽",
  "濱":"滨","濟":"济","灣":"湾","瀧":"泷","瀨":"濑","瀏":"浏",
  "為":"为","萬":"万","無":"无","衛":"卫","溫":"温",
  "雲":"云","應":"应","業":"业","藝":"艺","藥":"药",
  "優":"优","郵":"邮","遊":"游","猶":"犹","與":"与","語":"语",
  "運":"运","詠":"咏","圍":"围","偉":"伟","偽":"伪","維":"维",
  "歐":"欧","澱":"淀","願":"愿","裝":"装","狀":"状",
  "張":"张","長":"长","兒":"儿","寫":"写","謝":"谢","鄉":"乡",
  "價":"价","條":"条","調":"调","談":"谈","難":"难","惱":"恼",
  "腦":"脑","內":"内","納":"纳","練":"练","煉":"炼","連":"连",
  "勞":"劳","亂":"乱","禮":"礼","麗":"丽","歷":"历","勵":"励",
  "兩":"两","靈":"灵","齡":"龄","領":"领","嶺":"岭","錄":"录",
  "慮":"虑","侶":"侣","綠":"绿","戀":"恋","淚":"泪","類":"类",
  "龍":"龙","蘭":"兰","藍":"蓝","覽":"览","臘":"腊",
  "髙":"高","海":"海","渕":"渊","澤":"泽","綾":"绫","遙":"遥",
  "裡":"里","凜":"凛","祐":"佑","祐":"佑","祥":"祥","涼":"凉",
  "鎌":"镰","毎":"每","渋":"涩","辺":"边","桜":"樱","楽":"乐",
  "国":"国","経":"经","軽":"轻","転":"转","働":"働",
  "広":"广","拡":"扩","満":"满","沢":"泽","浜":"滨","瀬":"濑",
  "縄":"绳","継":"继","続":"续","鉄":"铁","銭":"钱",
  "険":"险","検":"检","験":"验","騒":"骚","髪":"发","覧":"览",
  "覚":"觉","発":"发","捗":"","歩":"步","渓":"溪","径":"径",
  "恵":"惠","掲":"揭","携":"携","暦":"历","枠":"框",
  "畑":"田","畠":"田","辻":"辻","込":"入",
};

function translateActress(name) {
  if (actressMap[name]) return actressMap[name];
  let r = '';
  for (const ch of name) r += charMap[ch] || ch;
  return r;
}

function normalizeCode(raw) {
  const input = String(raw ?? '').trim().toUpperCase().replace(/^\/AV\s*/i, '');
  if (!input) return '';
  const m = input.replace(/\s+/g, '').match(/^([A-Z]{2,10})-?(\d{2,6})$/);
  if (!m) return input;
  return `${m[1]}-${m[2]}`;
}

function strip(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/[♀♂]/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
}

function curl(url) {
  return execSync(`curl -sSL --max-time 20 -A '${UA}' -H 'Accept-Language: zh-CN,zh;q=0.9' '${url}'`, {
    encoding: 'utf-8', timeout: 25000,
  });
}

function pick(re, html) {
  const m = re.exec(html);
  return m ? strip(m[1]) : '';
}

function stars(score) {
  const n = parseFloat(score);
  if (!n) return '';
  const full = Math.round(n);
  return '★'.repeat(Math.min(full, 5)) + '☆'.repeat(Math.max(5 - full, 0));
}

async function searchAndDetail(code) {
  const page = curl(`https://javdb.com/search?q=${encodeURIComponent(code)}&f=all`);

  // 匹配结果
  const itemRe = /<a href="(\/v\/[^"]+)" class="box"[^>]*title="([^"]+)"[\s\S]*?<strong>([^<]+)<\/strong>[\s\S]*?<\/a>/gi;
  let item = null;
  let m;
  while ((m = itemRe.exec(page)) !== null) {
    const title = m[2];
    const codeInTitle = strip(m[3]);
    const compact = codeInTitle.toUpperCase().replace(/[\s-]/g, '');
    if (compact.includes(code.replace(/-/g, ''))) {
      item = { href: m[1], title };
      break;
    }
  }
  if (!item) return null;

  const html = curl(`https://javdb.com${item.href}`);

  // 面板信息
  const panelRe = /<div class="panel-block[^"]*">\s*<strong>([^<]+)<\/strong>[\s\S]*?<\/div>/g;
  const info = {};
  while ((m = panelRe.exec(html)) !== null) {
    const label = m[1].replace(':', '').trim();
    const content = m[0].replace(/<strong>[^<]+<\/strong>/, '');
    const raw = strip(content);
    if (!raw) continue;

    if (/日期/.test(label)) info.date = raw;
    else if (/時長|时长/.test(label)) info.duration = raw;
    else if (/導演/.test(label)) info.director = raw;
    else if (/片商/.test(label)) info.maker = raw;
    else if (/系列/.test(label)) info.series = raw;
    else if (/評分/.test(label)) {
      const scoreM = raw.match(/([\d.]+)分/);
      info.rating = scoreM ? stars(scoreM[1]) : '';
      const cntM = raw.match(/由(\d+)人評價/);
      info.reviewCount = cntM ? cntM[1] + '人評價' : '';
    }
  }

  // 演员
  const actorsChunk = /演員:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i.exec(html)?.[1] || '';
  const actors = [...actorsChunk.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map(x => strip(x[1])).slice(0, 8);

  // 标签
  const tagsChunk = /類別:<\/strong>[\s\S]*?<span class="value">([\s\S]*?)<\/span>/i.exec(html)?.[1] || '';
  const tags = [...tagsChunk.matchAll(/<a[^>]*>([^<]+)<\/a>/gi)].map(x => strip(x[1])).slice(0, 10);

  // 想看人数
  const wantRe = /想看[^]*?<\/form>/i.exec(html)?.[0] || '';
  const wantM = wantRe.match(/>(\d+)</);
  const wantCount = wantM ? wantM[1] + '人想看' : '';

  // 封面
  const coverRaw = pick(/<img[^>]*src="([^"]+)"[^>]*class="video-cover"/i, html)
    || pick(/<img[^>]*class="video-cover"[^>]*src="([^"]+)"/i, html)
    || (item ? `https://c0.jdbstatic.com/covers/${item.href.replace('/v/', '').slice(0, 2).toLowerCase()}/${item.href.replace('/v/', '')}.jpg` : '');

  return {
    code,
    title: item.title,
    director: info.director || '',
    maker: info.maker || '',
    date: info.date || '',
    duration: info.duration || '',
    rating: info.rating || '',
    reviewCount: info.reviewCount || '',
    wantCount: wantCount || '',
    actors: actors.map(translateActress),
    tags: tags.map(t),
    series: info.series || '',
    detailUrl: `https://javdb.com${item.href}`,
    coverImage: coverRaw,
  };
}

async function main() {
  loadTagMap();
  loadActressMap();

  let raw = process.argv.slice(2).join(' ');
  const code = normalizeCode(raw);

  if (!code) {
    console.log('用法: node av.mjs /av SONE-763');
    process.exit(1);
  }

  try {
    const movie = await searchAndDetail(code);
    if (!movie) {
      console.log(`未找到番号: ${code}`);
      return;
    }

    const lines = [
      `🎬 ${await t2s(movie.code)}`,
      '',
      `标题: ${await t2s(movie.title || '-')}`,
      `导演: ${await t2s(movie.director || '-')}`,
      `片商: ${await t2s(movie.maker || '-')}`,
      `日期: ${movie.date || '-'}`,
      `片长: ${movie.duration || '-'}`,
      `评分: ${movie.rating || '-'}`,
    ];
    if (movie.reviewCount) lines.push(`评价: ${movie.reviewCount}`);
    if (movie.wantCount) lines.push(`想看: ${movie.wantCount}`);
    const actorsJoined = movie.actors.length ? (await Promise.all(movie.actors.map(a => t2s(a)))).join('、') : '-';
    lines.push(`演员: ${actorsJoined}`);
    if (movie.series) lines.push(`系列: ${await t2s(movie.series)}`);
    const tagsJoined = movie.tags.length ? (await Promise.all(movie.tags.map(t => t2s(t)))).join('、') : '-';
    lines.push(`标签: ${tagsJoined}`);
    lines.push(`封面: [查看封面](${movie.coverImage || '无'})`);
    lines.push(`播放: [打开页面](${movie.detailUrl})`);

    console.log(lines.join('\n'));
  } catch (err) {
    console.log(`查询失败: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

await main();
