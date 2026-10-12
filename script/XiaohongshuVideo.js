/*

[rewrite_local]
^https?:\/\/www\.xiaohongshu\.com\/(?:discovery\/item|explore)\/.*$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/XiaohongshuVideo.js

[mitm]
hostname = www.xiaohongshu.com
*/
const KEY_RE = /"originVideoKey"\s*:\s*"([^"]+)"/;
const VID_RE = /https?:(?:\\u002F|\/){2}(?:sns-video-[a-z0-9-]+|sns-bak-v[0-9]+)\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>]*?\.mp4[^"'\s<>]*/g;
const MASTER_RE = /("(?:masterUrl|master_url)"\s*:\s*")(https?:(?:\\u002F|\/){2}(?:sns-video-[a-z0-9-]+|sns-bak-v[0-9]+)\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>]*?\.mp4[^"'\s<>]*)/g;

const FAST_HOST = 'sns-video-qc.xhscdn.com';
const ALT_HOST = 'sns-video-hw.xhscdn.com';

/* 原文本里 URL 后可能紧跟 \ 等 JSON 转义，反斜杠不能吞进替换结果 */
/* 保留原 scheme + ?sign=..&t=.. —— 
   scheme：页面原本就是 http://，保持 http 让代理不用 MITM 也能改响应头；
   query：CDN 会忽略它（实测随便填都 200），但播放器可能校验"链接是否带签名" */
function build(match, host, token) {
  const trimmed = match.replace(/\\+$/, '');
  const trail = match.slice(trimmed.length);
  const q = trimmed.indexOf('?');
  const query = q >= 0 ? trimmed.slice(q) : '';
  const scheme = trimmed.indexOf('https:') === 0 ? 'https' : 'http';
  return (trimmed.indexOf('\\u002F') >= 0
    ? scheme + ':\\u002F\\u002F' + host + '\\u002F' + token
    : scheme + '://' + host + '/' + token) + query + trail;
}

/* 音轨、封面、图片一律不碰：换成视频原片会让播放器拿视频当音轨 → 没声音 */
const SKIP_RE = /(audio|music|\/frame\/|\.webp|\.jpe?g|\.png)/i;

function main() {
  const body = $response && $response.body;
  if (!body || typeof body !== 'string') return $done({});

  const km = body.match(KEY_RE);
  if (!km) return $done({});
  const key = km[1];

  let n = 0;
  /* masterUrl 先换成最快的 qc；换完就没有 .mp4 尾巴了，后面的兜底 pass 不会再碰它 */
  let out = body.replace(MASTER_RE, function (_, pre, url) {
    if (SKIP_RE.test(url)) return pre + url;
    n++;
    return pre + build(url, FAST_HOST, key);
  });
  /* 其余（backupUrls 等）一律走同样快的 hw —— bd 喂不动 8.3MB 原片 */
  out = out.replace(VID_RE, function (s) {
    if (SKIP_RE.test(s)) return s;
    n++;
    return build(s, ALT_HOST, key);
  });

  if (!n) return $done({});
  console.log('XHS 视频去水印: ' + n + ' 条');
  $done({ body: out });
}

main();
