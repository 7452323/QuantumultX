/*
小红书图片去水印 —— 302 到 sns-img-bd 的无水印原图

页面显示走 sns-na-i6.xhscdn.com（App 自己的图床），Post Saver 下载走 sns-webpic-qc.xhscdn.com，
两者不同域，所以这里可以无差别重定向，不影响页面显示（HAR 实测 62/62 张图全是 PostSaver UA）。

302 目标必须保留 <日期>/<hash>/ 之后的整条尾巴：
  sns-webpic-qc/<日期>/<hash>/<fileId>!h5_1080jpg                 → sns-img-bd/<fileId>
  sns-webpic-qc/<日期>/<hash>/notes_pre_post/<fileId>!h5_1080jpg  → sns-img-bd/notes_pre_post/<fileId>

notes_pre_post/ 前缀不能剥——剥了就 404：多图里混的这种图会退回带水印小图，单图直接空白。
*/
const IMG_RE = /^https?:\/\/sns-webpic[a-z0-9\-]*\.xhscdn\.com\/[^/?#]+\/[^/?#]+\/(.+?)!h5_1080(?:jpg|webp)(?:\?.*)?$/;

const m = $request.url.match(IMG_RE);
if (!m) return $done({});

const loc = 'https://sns-img-bd.xhscdn.com/' + m[1];
const isQX = typeof $task !== 'undefined';
console.log('XHS 图片去水印: ' + m[1]);
if (isQX) $done({ status: 302, headers: { Location: loc } });
else $done({ response: { status: 302, headers: { Location: loc } } });
