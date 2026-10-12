/*

[rewrite_local]
^https?:\/\/sns-video-[a-z0-9-]+\.xhscdn\.com\/.*$ url script-response-header https://raw.githubusercontent.com/7452323/QuantumultX/main/script/XiaohongshuVideoType.js

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
