/*
小红书视频 CDN 响应头修正

原片（sns-video-*.xhscdn.com/<originVideoKey>）有的对象被 CDN 标成
Content-Type: application/octet-stream，播放器拿它当"链接失效"处理，报
「视频不可用 视频链接可能已过期」。实测同一份文件在别的 key 上是 video/mp4，
能正常播 —— 差别只在响应头。

这里只动"原片"这一类响应：
- 只认 octet-stream（webp 封面、mp4 转码流本来就有正确类型）
- 路径带图片后缀或 /frame/ 的一律放过（宁可漏改，绝不能把图当视频改）

[rewrite_local]
^https?:\/\/sns-video-[a-z0-9-]+\.xhscdn\.com\/.*$ url script-response-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/PostSaverType.js

[mitm]
hostname = sns-video-qc.xhscdn.com, sns-video-hw.xhscdn.com, sns-video-bd.xhscdn.com
*/
(function () {
  var res = typeof $response !== 'undefined' ? $response : null;
  if (!res || !res.headers) return $done({});

  /* 图片一律不碰：路径带图片后缀 / /frame/ / !变体后缀 的直接放过 */
  var url = (typeof $request !== 'undefined' && $request.url) ? $request.url : '';
  if (/\/frame\//.test(url) || url.indexOf('!') >= 0) return $done({});
  if (/\.(webp|jpg|jpeg|png|gif|heic|avif|bmp|svg)(\?|#|$)/i.test(url)) return $done({});

  var h = res.headers;
  var ct = h['Content-Type'] || h['content-type'] || '';
  if (!/octet-stream/i.test(ct)) return $done({});
  var out = {};
  for (var k in h) if (k.toLowerCase() !== 'content-type') out[k] = h[k];
  out['Content-Type'] = 'video/mp4';
  console.log('XHS 修正视频 Content-Type');
  $done({ headers: out });
})();
