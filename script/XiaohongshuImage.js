/*
小红书图片去水印 —— 302 到 sns-img-bd 的无水印原图

页面显示（InAppBrowserView 的 WKWebView）走 sns-na-i6.xhscdn.com，
Post Saver 保存下载走 sns-webpic-qc.xhscdn.com。

但 Post Saver 自己也会用 webpic 给界面加载图，必须区分，否则界面跟着一起变慢：
  WKWebView 显示  → priority: u=3, i  + accept-language: zh-CN（系统语言）→ 要 56KB 缩略图
  App 保存下载     → priority: u=3     + accept-language: en-US（App 的 en）→ 要无水印原图
HAR 实测：40 次带 i 全是 zh-CN，22 次不带 i 全是 en-US，完全对齐。
无脑全 302 的话，界面每张图从 56KB 变 398KB，重复加载下流量放大 4.8 倍（16.3MB vs 3.4MB）。

302 目标必须保留 <日期>/<hash>/ 之后的整条尾巴：
  sns-webpic-qc/<日期>/<hash>/<fileId>!h5_1080jpg                 → sns-img-bd/<fileId>
  sns-webpic-qc/<日期>/<hash>/notes_pre_post/<fileId>!h5_1080jpg  → sns-img-bd/notes_pre_post/<fileId>

notes_pre_post/ 前缀不能剥——剥了就 404：多图里混的这种图会退回带水印小图，单图直接空白。
*/
const IMG_RE = /^https?:\/\/sns-webpic[a-z0-9\-]*\.xhscdn\.com\/[^/?#]+\/[^/?#]+\/(.+?)!h5_1080(?:jpg|webp)(?:\?.*)?$/;

/* WebKit 增量图片加载（界面显示）带独立的 i 标记，放过去拿 56KB 缩略图 */
const pri = String(($request.headers && ($request.headers['priority'] || $request.headers['Priority'])) || '').toLowerCase();
if (/(?:^|[,\s])i\s*$/.test(pri)) return $done({});

const m = $request.url.match(IMG_RE);
if (!m) return $done({});

const loc = 'https://sns-img-bd.xhscdn.com/' + m[1];
const isQX = typeof $task !== 'undefined';
console.log('XHS 图片去水印: ' + m[1]);
if (isQX) $done({ status: 302, headers: { Location: loc } });
else $done({ response: { status: 302, headers: { Location: loc } } });
