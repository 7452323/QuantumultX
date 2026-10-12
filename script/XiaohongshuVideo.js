/*
小红书去水印 —— 视频部分（图片走 302 重定向，见模块文件）

笔记页里：
- video.media.stream.*.masterUrl = sns-video-v3.xhscdn.com/stream/.../xxx.mp4?sign=...
  是 720p 转码流，烧了水印+昵称；video.consumer.originVideoKey 才是无水印原片 key。

图片不能在这里改：imageList[].url 是 sns-webpic-qc/<日期>/<hash>/<fileId>!h5_1080jpg，
页面的 JS 依赖这个形态渲染，一旦换成 sns-img-bd/<fileId> 就整片空白。所以图片改用
URL Rewrite 302 在 HTTP 层重定向，页面体保持原样。

host 选择：三台视频 CDN 字节完全相同（md5 一致），但 bd 实测只有 0.4-2.5MB/s、
qc/hw 20MB+/s，8.3MB 的原片喂不上就卡。所以 masterUrl 一律 qc，其余走 hw。

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
function build(match, host, token) {
  const trimmed = match.replace(/\\+$/, '');
  const trail = match.slice(trimmed.length);
  return (trimmed.indexOf('\\u002F') >= 0
    ? 'https:\\u002F\\u002F' + host + '\\u002F' + token
    : 'https://' + host + '/' + token) + trail;
}

function main() {
  const body = $response && $response.body;
  if (!body || typeof body !== 'string') return $done({});

  const km = body.match(KEY_RE);
  if (!km) return $done({});
  const key = km[1];

  let n = 0;
  /* masterUrl 先换成最快的 qc；换完就没有 .mp4 尾巴了，后面的兜底 pass 不会再碰它 */
  let out = body.replace(MASTER_RE, function (_, pre, url) {
    n++;
    return pre + build(url, FAST_HOST, key);
  });
  /* 其余（backupUrls 等）一律走同样快的 hw —— bd 喂不动 8.3MB 原片 */
  out = out.replace(VID_RE, function (s) {
    n++;
    return build(s, ALT_HOST, key);
  });

  if (!n) return $done({});
  console.log('XHS 视频去水印: ' + n + ' 条');
  $done({ body: out });
}

main();
