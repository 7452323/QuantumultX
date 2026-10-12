/*
图片去水印：只拦 Post Saver 自己的下载请求，页面显示的请求一律放过

- 显示：页面要 56KB 的 !h5_1080jpg（带水印但快）→ 不动，多图/实况图才显示得出来
- 保存：Post Saver 用自己的 UA 下载 → 302 到 sns-img-bd 的全分辨率无水印原图

小红书只提供「全分辨率原图」这一种无水印形态（实测 3MB），
没有小尺寸无水印版，所以不能拿它去喂页面显示。
*/
const UA_RE = /PostSaver/i;
const IMG_RE = /^https?:\/\/sns-webpic[a-z0-9\-]*\.xhscdn\.com\/(?:[^/?#]+\/)+([^/!?#]+)!h5_1080(?:jpg|webp)(?:\?.*)?$/;

const ua = ($request.headers && ($request.headers['User-Agent'] || $request.headers['user-agent'])) || '';
if (!UA_RE.test(ua)) return $done({});

const m = $request.url.match(IMG_RE);
if (!m) return $done({});

const loc = 'https://sns-img-bd.xhscdn.com/' + m[1];
const isQX = typeof $task !== 'undefined';
console.log('XHS 图片去水印: ' + m[1]);
if (isQX) $done({ status: 302, headers: { Location: loc } });
else $done({ response: { status: 302, headers: { Location: loc } } });
