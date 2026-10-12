/*
小红书视频去水印

笔记页 __INITIAL_STATE__ 里 video.consumer.originVideoKey 是原片 key，
media.stream 的 masterUrl/backupUrls 是 720p 且烧了「小红书」水印+昵称的转码流。
Post Saver 这类工具直接抓 masterUrl 下载，所以存下来带水印。
本脚本把响应体里所有 .mp4 链接换成 https://sns-video-bd.xhscdn.com/<originVideoKey>
（1080p 原片）。图片不用管：Post Saver 本来就按 fileId 取 sns-img-bd 原图。

[rewrite_local]
^https?:\/\/www\.xiaohongshu\.com\/(?:discovery\/item|explore)\/.*$ url script-response-body https://raw.githubusercontent.com/7452323/QuantumultX/main/script/XiaohongshuVideo.js

[mitm]
hostname = www.xiaohongshu.com
*/
const KEY_RE = /"originVideoKey"\s*:\s*"([^"]+)"/;
const VIDEO_RE = /https?:(?:\\u002F|\/){2}(?:sns-video-[a-z0-9-]+|sns-bak-v[0-9]+)\.xhscdn\.com(?:\\u002F|\/)[^"'\s<>]*?\.mp4[^"'\s<>]*/g;

function main() {
  const body = $response && $response.body;
  if (!body || typeof body !== 'string') return $done({});

  const m = body.match(KEY_RE);
  if (!m) return $done({});

  const key = m[1];
  const plain = 'https://sns-video-bd.xhscdn.com/' + key;
  const esc = 'https:\\u002F\\u002Fsns-video-bd.xhscdn.com\\u002F' + key;

  let n = 0;
  const out = body.replace(VIDEO_RE, function (s) {
    // 原始文本里 URL 后面可能紧跟 \  \" 等 JSON 转义，反斜杠不能吞进替换结果
    const trimmed = s.replace(/\\+$/, '');
    const trail = s.slice(trimmed.length);
    n++;
    return (trimmed.indexOf('\\u002F') >= 0 ? esc : plain) + trail;
  });
  if (!n) return $done({});

  console.log('XHS 视频去水印: 替换 ' + n + ' 条 -> ' + plain);
  $done({ body: out });
}

main();
