/*
小红书去水印（图片 + 视频）

笔记页里两处带水印的地址：
- imageList[].url = sns-webpic-qc.xhscdn.com/<日期>/<hash>/<fileId>!h5_1080jpg
  是 1080 缩图，中间压了「小红书」logo；imageList[].fileId 才是原图 ID。
- video.media.stream.*.masterUrl = sns-video-v3.xhscdn.com/stream/.../xxx.mp4?sign=...
  是 720p 转码流，烧了水印+昵称；video.consumer.originVideoKey 才是无水印原片 key。

本脚本把响应体里这两类地址换成无水印源，Post Saver 这类工具照抓就是干净的。

host 选择：
- 图片用 sns-img-bd，跟 Post Saver 自己抓封面用的同一台，兼容性最稳。
- 视频三台字节完全相同（md5 一致），但 bd 实测只有 0.4-2.5MB/s、qc/hw 20MB+/s，
  8.3MB 的原片喂不上就卡。所以 masterUrl 一律 qc，其余走 hw，都是 20MB+/s 那档。

[rewrite_local]
^https?:\/\/www\.xiaohongshu\.com\/(?:discovery\/item|explore)\/.*$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/XiaohongshuVideo.js

[mitm]
hostname = www.xiaohongshu.com
*/
const KEY_RE = /"originVideoKey"\s*:\s*"([^"]+)"/;
const IMG_RE = /https?:(?:\\u002F|\/){2}sns-webpic[a-z0-9-]*\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>!]*![^"'\s<>]*/g;
const VID_RE = /https?:(?:\\u002F|\/){2}(?:sns-video-[a-z0-9-]+|sns-bak-v[0-9]+)\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>]*?\.mp4[^"'\s<>]*/g;
const MASTER_RE = /("(?:masterUrl|master_url)"\s*:\s*")(https?:(?:\\u002F|\/){2}(?:sns-video-[a-z0-9-]+|sns-bak-v[0-9]+)\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>]*?\.mp4[^"'\s<>]*)/g;

const IMG_HOST = 'sns-img-bd.xhscdn.com';
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

  let nImg = 0;
  let out = body.replace(IMG_RE, function (s) {
    const token = s.replace(/\\u002F/g, '/').split('!')[0].split('/').pop();
    if (!token) return s;
    nImg++;
    return build(s, IMG_HOST, token);
  });

  let nVid = 0;
  const km = out.match(KEY_RE);
  if (km) {
    const key = km[1];
    /* masterUrl 先换成最快的 qc；换完就没有 .mp4 尾巴了，后面的兜底 pass 不会再碰它 */
    out = out.replace(MASTER_RE, function (_, pre, url) {
      return pre + build(url, FAST_HOST, key);
    });
    /* 其余（backupUrls 等）一律走同样快的 hw —— bd 实测只有 0.4-2.5MB/s，喂不动 8.3MB 原片 */
    out = out.replace(VID_RE, function (s) {
      return build(s, ALT_HOST, key);
    });
  }

  if (!nImg && !nVid) return $done({});
  console.log('XHS 去水印: 图片 ' + nImg + ' 张, 视频 ' + nVid + ' 条');
  $done({ body: out });
}

main();
