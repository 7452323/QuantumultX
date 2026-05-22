#!/usr/bin/env node

const { execSync } = require('child_process');

const code = (process.argv[2] || '').toUpperCase().trim();
if (!code) { console.error('❌ 请提供番号'); process.exit(1); }

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function curl(url) {
  return execSync(`curl -sL "${url}" -A "${UA}" --max-time 15`, { encoding: 'utf-8', timeout: 20000 });
}

function extract(html, before, after) {
  const i = html.indexOf(before);
  if (i === -1) return null;
  const s = i + before.length;
  const e = html.indexOf(after, s);
  return e === -1 ? null : html.slice(s, e).replace(/<[^>]+>/g, '').trim();
}

function toSimple(t) {
  if (!t) return t;
  try { return execSync(`python3 -c "from opencc import OpenCC; c=OpenCC('t2s'); print(c.convert('''${t.replace(/'/g,"\\'")}'''),end='')"`, { encoding:'utf-8',timeout:5000 }).trim(); }
  catch { return t; }
}

function translate(t) {
  if (!t) return t;
  try {
    const e = t.replace(/'/g,"\\'").replace(/"/g,'\\"').replace(/\n/g,' ');
    const r = execSync(`python3 -c "
from googletrans import Translator; tr=Translator()
print(tr.translate('''${e}''',src='ja',dest='zh-cn').text,end='')"`, { encoding:'utf-8',timeout:10000 });
    return r.trim() || t;
  } catch { return toSimple(t); }
}

try {
  const html = curl(`https://javdb.com/search?q=${encodeURIComponent(code)}&f=all`);
  const m = html.match(/href="(\/v\/[a-zA-Z0-9]+)"\s+class="box"/);
  if (!m) { console.log(JSON.stringify({ error: `未找到 "${code}"` })); process.exit(0); }

  const vid = m[1].replace('/v/','');
  const dUrl = `https://javdb.com${m[1]}`;
  const d = curl(dUrl);
  const idM = d.match(/<strong>([A-Z0-9]+-[0-9]+)\s*<\/strong>/);
  const javId = idM ? idM[1] : code;
  const title = translate(extract(d,'<strong class="current-title">','</strong>') || '无标题');
  const scM = d.match(/評分:<\/strong>[^<]*<[^>]*>[\s\S]*?([0-9.]+)分/);
  const sc = scM ? scM[1]+'分' : '暂无';
  const date = toSimple(extract(d,'<strong>日期:</strong>','</span>')?.replace(/&nbsp;/g,'').trim()) || '未知';
  const dur = toSimple(extract(d,'<strong>時長:</strong>','</span>')?.replace(/&nbsp;/g,'').trim()) || '未知';
  const actors = [];
  const aSec = (d.split('<strong>演員:</strong>')[1] || '').split('<strong>')[0] || '';
  let r;
  const aR = /<a href="\/actors\/[^"]+">([^<]+)<\/a>/g;
  while ((r = aR.exec(aSec))) actors.push(toSimple(r[1].trim()));
  const tags = [];
  const tSec = (d.split('<strong>類別:</strong>')[1] || '').split('</span>')[0] || '';
  const tR = /<a href="\/tags[^"]*">([^<]+)<\/a>/g;
  while ((r = tR.exec(tSec))) tags.push(toSimple(r[1].trim()));

  const result = {
    code: javId, title, score: sc, date, duration: dur,
    actors, tags: tags.slice(0,15),
    cover_url: `https://c0.jdbstatic.com/covers/${vid.substring(0,2)}/${vid}.jpg`,
    detail_url: dUrl, success: true
  };
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.log(JSON.stringify({ error: `出错: ${err.message}` }));
}
