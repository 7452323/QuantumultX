/* 图片去水印：302 到 sns-img-bd 无水印原图。界面显示(priority 带 i)取缩小版，保存取全分辨率 */
const IMG_RE = /^https?:\/\/sns-webpic[a-z0-9\-]*\.xhscdn\.com\/[^/?#]+\/[^/?#]+\/(.+?)!h5_1080(?:jpg|webp)(?:\?.*)?$/;

const m = $request.url.match(IMG_RE);
if (!m) return $done({});

const pri = String(($request.headers && ($request.headers['priority'] || $request.headers['Priority'])) || '').toLowerCase();
const isDisplay = /(?:^|[,\s])i\s*$/.test(pri);

/* notes_pre_post/ 这类子目录不吃 imageView2，加参反而更大，只对无子目录的加 */
let loc = 'https://sns-img-bd.xhscdn.com/' + m[1];
if (isDisplay && m[1].indexOf('/') === -1) loc += '?imageView2/2/w/1080';

const isQX = typeof $task !== 'undefined';
console.log('XHS 图片去水印: ' + m[1]);
if (isQX) $done({ status: 302, headers: { Location: loc } });
else $done({ response: { status: 302, headers: { Location: loc } } });
