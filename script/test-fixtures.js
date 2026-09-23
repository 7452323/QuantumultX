/* 端到端测试：把抓包真实响应喂给 Soul.js，验证改写结果
   用法: node script/test-fixtures.js   (仓库根目录) */
const fs = require('fs');
const vm = require('vm');

const SRC = fs.readFileSync('script/Soul.js', 'utf8');
const meta = JSON.parse(fs.readFileSync('/tmp/soul_fixtures/_meta.json', 'utf8'));

function run(url, body, arg) {
  let out = null; let doneCount = 0; const notes = [];
  const ctx = {
    $request: { url, headers: {} },
    $response: { body, headers: {} },
    $done: (o) => { doneCount++; if (o) out = o; },
    $notify: (t, s, b) => notes.push([t, s, b]),
    $prefs: { valueForKey: () => null, setValueForKey: () => {} },
    console,
  };
  if (arg !== undefined) ctx.$argument = arg;
  vm.createContext(ctx);
  try { vm.runInContext(SRC, ctx); } catch (e) { return { err: String(e) }; }
  return { out, doneCount, notes };
}

const diff = (a, b, path, acc) => {
  if (acc.length > 6) return acc;
  if (a === b) return acc;
  const ta = a === null ? 'null' : typeof a;
  const tb = b === null ? 'null' : typeof b;
  if (ta !== tb || ta !== 'object') {
    const sa = JSON.stringify(a); const sb = JSON.stringify(b);
    acc.push(`${path}: ${sa && sa.length > 40 ? sa.slice(0, 40) + '…' : sa}  ->  ${sb && sb.length > 40 ? sb.slice(0, 40) + '…' : sb}`);
    return acc;
  }
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) diff(a ? a[k] : undefined, b ? b[k] : undefined, path ? `${path}.${k}` : k, acc);
  return acc;
};

let fails = 0;
for (const [name, m] of Object.entries(meta).sort()) {
  const body = fs.readFileSync('/tmp/soul_fixtures/' + m.file, 'utf8');
  const r = run(m.url, body);
  if (r.err) { console.log(`✗ ${name}: 抛异常 ${r.err}`); fails++; continue; }
  if (r.doneCount !== 1) { console.log(`⚠ ${name}: $done 被调用 ${r.doneCount} 次`); fails++; }
  if (!r.out) { console.log(`✗ ${name}: 脚本未调用 $done`); fails++; continue; }
  if (r.out.body === undefined) { console.log(`✓ ${name}  [未命中分支 → $done({}) 原样放行]`); continue; }
  let before; let after;
  try { before = JSON.parse(body); } catch (e) { console.log(`✗ ${name}: 原 body 非 JSON`); fails++; continue; }
  try { after = JSON.parse(r.out.body); } catch (e) { console.log(`✗ ${name}: 输出 body 不是合法 JSON!`); fails++; continue; }
  const d = diff(before, after, '', []);
  const extra = d.length ? `${d.length}${d.length > 6 ? '+' : ''} 处改动` : '未改动(放行)';
  console.log(`✓ ${name}  [${extra}]${r.notes.length ? ' 通知:' + r.notes.length : ''}`);
  d.slice(0, 6).forEach((x) => console.log('      ' + x));
}
console.log('\n' + (fails ? `✗ ${fails} 项失败` : `✓ 全部 ${Object.keys(meta).length} 个 fixture 通过（无异常/无非法 JSON/无重复 $done）`));
