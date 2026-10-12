/*
小红书去水印（图片 + 视频）

笔记页 __INITIAL_STATE__ 里：
- imageList[].url 是 sns-webpic-qc.xhscdn.com/...!h5_1080jpg，带水印（「小红书」logo 打在画面中间）。
  imageList[].fileId 才是原图 ID -> https://sns-img-qc.xhscdn.com/<fileId> 无水印。
- video.consumer.originVideoKey 是原片 key -> https://sns-video-qc.xhscdn.com/<key> 无水印 1080p。
  media.stream 的 masterUrl/backupUrls 是 720p 且烧了水印+昵称的转码流，码率低但带水印。
本脚本把响应体里这两类地址都换掉，Post Saver 这类工具照抓就是干净的。

CDN 选 qc 不选 bd：同一个文件，qc 实测 8-12MB/s、ttfb 0.1s，bd 只有 0.4-0.7MB/s、ttfb 1-4s，
用 bd 播原片会一直卡。

[rewrite_local]
^https?:\/\/www\.xiaohongshu\.com\/(?:discovery\/item|explore)\/.*$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/XiaohongshuVideo.js

[mitm]
hostname = www.xiaohongshu.com
*/
const KEY_RE = /"originVideoKey"\s*:\s*"([^"]+)"/;
const IMG_RE = /https?:(?:\\u002F|\/){2}sns-webpic[a-z0-9-]*\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>!]*![^"'\s<>]*/g;
const VIDEO_RE = /https?:(?:\\u002F|\/){2}(?:sns-video-[a-z0-9-]+|sns-bak-v[0-9]+)\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>]*?\.mp4[^"'\s<>]*/g;

const IMG_HOST = 'sns-img-qc.xhscdn.com';
const VID_HOST = 'sns-video-qc.xhscdn.com';

/* 原始文本里 URL 后面可能紧跟 \  \" 等 JSON 转义，反斜杠不能吞进替换结果 */
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
    out = out.replace(VIDEO_RE, function (s) {
      nVid++;
      return build(s, VID_HOST, key);
    });
  }

  if (!nImg && !nVid) return $done({});
  console.log('XHS 去水印: 图片 ' + nImg + ' 张, 视频 ' + nVid + ' 条');
  $done({ body: out });
}

main();
