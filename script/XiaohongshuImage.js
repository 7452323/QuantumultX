/*
小红书图片去水印 —— 302 到 sns-img-bd 的无水印原图

App 的界面显示和保存下载都打 sns-webpic-qc.xhscdn.com，用 priority 头区分：
  界面显示 → priority: u=3, i（WebKit 增量加载）→ 取缩小版（?imageView2/2/w/1080），照样无水印
  保存下载 → priority: u=3                    → 取全分辨率原图
HAR 实测：带 i 那组有个 fileId 被重试 15 次（界面反复加载）；不带 i 那组 22 张图各一次、
01:56:15 一秒内 18 张（批量保存），两个信号完全对齐。

sns-img-bd 也吃 imageView2 缩放参数（实测 328843B → 119143B，1080×2230，vision 确认无水印），
所以界面不必退回带水印的 56KB 缩略图 —— 这就是「软件里看到的图带水印」的成因。

302 目标必须保留 <日期>/<hash>/ 之后的整条尾巴：
  sns-webpic-qc/<日期>/<hash>/<fileId>!h5_1080jpg                 → sns-img-bd/<fileId>
  sns-webpic-qc/<日期>/<hash>/notes_pre_post/<fileId>!h5_1080jpg  → sns-img-bd/notes_pre_post/<fileId>

notes_pre_post/ 前缀不能剥——剥了就 404：多图里混的这种图会退回带水印小图，单图直接空白。
子目录形态不吃 imageView2（168580B → 324672B，反而更大），所以只对无子目录的加缩放参数。
*/
const IMG_RE = /^https?:\/\/sns-webpic[a-z0-9\-]*\.xhscdn\.com\/[^/?#]+\/[^/?#]+\/(.+?)!h5_1080(?:jpg|webp)(?:\?.*)?$/;

const m = $request.url.match(IMG_RE);
if (!m) return $done({});

const pri = String(($request.headers && ($request.headers['priority'] || $request.headers['Priority'])) || '').toLowerCase();
const isDisplay = /(?:^|[,\s])i\s*$/.test(pri);

let loc = 'https://sns-img-bd.xhscdn.com/' + m[1];
if (isDisplay && m[1].indexOf('/') === -1) loc += '?imageView2/2/w/1080';
const isQX = typeof $task !== 'undefined';
console.log('XHS 图片去水印: ' + m[1]);
if (isQX) $done({ status: 302, headers: { Location: loc } });
else $done({ response: { status: 302, headers: { Location: loc } } });
