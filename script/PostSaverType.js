/*
小红书视频 CDN 响应头修正

原片（sns-video-*.xhscdn.com/<originVideoKey>）有的对象被 CDN 标成
Content-Type: application/octet-stream，播放器拿它当"链接失效"处理，报
「视频不可用 视频链接可能已过期」。实测同一份文件在别的 key 上是 video/mp4，
能正常播 —— 差别只在响应头。

这里只动 octet-stream 的响应，webp 封面、mp4 转码流一律不碰。

[rewrite_local]
^https?:\/\/sns-video-[a-z0-9-]+\.xhscdn\.com\/.*$ url script-response-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/PostSaverType.js

[mitm]
hostname = sns-video-qc.xhscdn.com, sns-video-hw.xhscdn.com, sns-video-bd.xhscdn.com
*/
(function () {
  var res = typeof $response !== 'undefined' ? $response : null;
  if (!res || !res.headers) return $done({});
  var h = res.headers;
  var ct = h['Content-Type'] || h['content-type'] || '';
  if (!/octet-stream/i.test(ct)) return $done({});
  var out = {};
  for (var k in h) if (k.toLowerCase() !== 'content-type') out[k] = h[k];
  out['Content-Type'] = 'video/mp4';
  console.log('XHS 修正视频 Content-Type');
  $done({ headers: out });
})();
