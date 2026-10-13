/* IG 受限内容修复：embed 被判 invalid 时改拉主站页 SSR 数据重建 */
const DESK_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const IG_COOKIE_FALLBACK = '';

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const code = (url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || '';
const broken = !body || body.indexOf('utm_campaign=invalid') > -1 || body.indexOf('EmbeddedMediaImage') < 0;

if (!/instagram\.com\/.*\/embed\//.test(url) || !code || !broken) {
    $done({});
} else {
    mainPage();
}

function arg(name) {
    if (typeof $argument !== 'undefined' && $argument && $argument[name]) return $argument[name];
    try { if (typeof $persistentStore !== 'undefined') { const v = $persistentStore.read(name); if (v) return v; } } catch (e) {}
    try { if (typeof $prefs !== 'undefined') { const v = $prefs.valueForKey(name); if (v) return v; } } catch (e) {}
    return '';
}

function notify(sub, msg) {
    try {
        if (typeof $notification !== 'undefined' && $notification.post) $notification.post('IG 受限内容修复', sub, msg);
        else if (typeof $notify !== 'undefined') $notify('IG 受限内容修复', sub, msg);
    } catch (e) {}
}

function get(req, cb) {
    if (typeof $httpClient !== 'undefined') {
        $httpClient.get(req, function (e, r, d) { cb(e ? null : d); });
    } else if (typeof $task !== 'undefined') {
        $task.fetch(req).then(function (r) { cb(r.body); }, function () { cb(null); });
    } else { cb(null); }
}

function unesc(s) {
    return s.replace(/\\u0025/g, '%').replace(/\\u0026/g, '&').replace(/\\u003D/g, '=')
        .replace(/\\u003C/g, '<').replace(/\\u003E/g, '>').replace(/\\\//g, '/').replace(/&amp;/g, '&')
        .replace(/&#x([0-9a-f]+);/gi, function (m, h) { return String.fromCharCode(parseInt(h, 16)); })
        .replace(/&#(\d+);/g, function (m, d) { return String.fromCharCode(parseInt(d, 10)); })
        .replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function cleanCap(s) {
    if (!s) return '';
    return unesc(s).replace(/\\n/g, '\n').replace(/\\"/g, '"')
        .replace(/^\d+\s*likes?,\s*\d+\s*comments?\s*-\s*/i, '')
        .replace(/^\d+\s*[^,]*,\s*\d{4}\s*$/, '').trim();
}

function mainPage() {
    const hdrs = {
        'User-Agent': DESK_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none',
        'upgrade-insecure-requests': '1'
    };
    const ck = arg('IG_COOKIE');
    if (ck) hdrs['Cookie'] = ck;
    tryPath(['/reel/', '/p/', '/tv/'], 0, hdrs);
}

function tryPath(paths, i, hdrs) {
    if (i >= paths.length) {
        notify('取数据失败', '主站页没吐 SSR（多半是 IP 被限流），退回封面图');
        return thumbOnly();
    }
    get({ url: 'https://www.instagram.com' + paths[i] + code + '/', headers: hdrs }, function (html) {
        if (!html) return tryPath(paths, i + 1, hdrs);
        const m = parse(html);
        if (!m) return tryPath(paths, i + 1, hdrs);
        $done({ body: embed(m) });
        notify('已重建', '@' + m.owner + ' ' + (m.video ? '视频 ' + m.w + 'x' + m.h : '图片'),
            m.video ? m.video.slice(0, 70) : m.image.slice(0, 70));
    });
}

function parse(html) {
    const grab = function (re) { const x = html.match(re); return x ? unesc(x[1]) : ''; };
    let image = grab(/<meta[^>]*og:image[^>]*content="([^"]+)"/);
    if (!image) image = grab(/"display_url":"((?:[^"\\]|\\.)+?)"/);
    if (!image) image = grab(/"image_versions2":\{"candidates":\[\{"width":\d+,"height":\d+,"url":"((?:[^"\\]|\\.)+?)"/);
    if (!image) return null;

    let video = '', bestW = 0;
    const i = html.indexOf('"video_versions"');
    if (i > -1) {
        const seg = html.slice(i, i + 9000);
        const re = /"url":"((?:[^"\\]|\\.)+?)"/g;
        let m;
        while ((m = re.exec(seg))) {
            const u = unesc(m[1]);
            if (u.indexOf('.mp4') < 0) continue;
            const w = parseInt((u.match(/\/(\d+)x(\d+)\//) || [])[1] || '0', 10);
            if (w >= bestW) { bestW = w; video = u; }
        }
    }
    let caption = '';
    const cm = html.match(/"edge_media_to_caption":\{"edges":\[\{"node":\{"text":"((?:[^"\\]|\\.)+?)"/);
    if (cm) caption = cleanCap(cm[1]);
    if (!caption) caption = cleanCap(grab(/<meta[^>]*og:description[^>]*content="([^"]*)"/));
    return {
        owner: grab(/"owner":\{"id":"\d+","username":"([^"]+)"/) || grab(/"username":"([^"]+)"/),
        image: image, video: video,
        dur: parseFloat(grab(/"video_duration":([0-9.]+)/)) || 0,
        w: parseInt(grab(/"dimensions":\{"height":\d+,"width":(\d+)\}/), 10) || 720,
        h: parseInt(grab(/"dimensions":\{"height":(\d+)/), 10) || 1280,
        type: (video ? 'GraphVideo' : 'GraphImage'),
        caption: caption
    };
}

function shortcodeToId(c) {
    let n = 0n;
    for (let i = 0; i < c.length; i++) n = n * 64n + BigInt(ALPHA.indexOf(c[i]));
    return n.toString();
}

function embed(d) {
    const sm = {
        __typename: d.type,
        id: shortcodeToId(code),
        shortcode: code,
        is_video: !!d.video,
        display_url: d.image,
        display_resources: [
            { src: d.image, config_width: d.w, config_height: d.h },
            { src: d.image, config_width: 640, config_height: Math.round(640 * d.h / (d.w || 1)) },
            { src: d.image, config_width: 480, config_height: Math.round(480 * d.h / (d.w || 1)) }
        ],
        thumbnail_src: d.image,
        dimensions: { height: d.h, width: d.w },
        owner: { username: d.owner, is_verified: false },
        edge_media_to_caption: { edges: [{ node: { text: d.caption } }] },
        edge_media_to_comment: { count: 0 },
        edge_liked_by: { count: 0 },
        accessibility_caption: null,
        product_type: 'clips'
    };
    if (d.video) {
        sm.video_url = d.video;
        sm.video_duration = d.dur;
        sm.video_view_count = 0;
    }
    return shell(sm, d, d.image);
}

function thumbOnly() {
    const page = url.replace(/\/embed\/.*$/, '/');
    get({ url: page, headers: { 'User-Agent': DESK_UA, 'sec-fetch-site': 'none', 'Accept-Language': 'zh-CN,zh-Hans;q=0.9' } }, function (html) {
        if (!html) { notify('兜底失败', '主站也拉不到', ''); return $done({}); }
        const img = (html.match(/<meta[^>]*og:image[^>]*content="([^"]+)"/) || [])[1] || '';
        if (!img) { notify('兜底失败', '主站没给 og:image', ''); return $done({}); }
        const desc = (html.match(/<meta[^>]*og:description[^>]*content="([^"]*)"/) || [])[1] || '';
        const cap = cleanCap(desc);
        const d = { owner: '', image: img, video: '', dur: 0, w: 1080, h: 1350, type: 'GraphImage', caption: cap };
        $done({ body: embed(d) });
    });
}

function shell(sm, d, img) {
    const ctx = { context: { type: d.type, shortcode: code, copyright_blocked: false }, gql_data: { shortcode_media: sm } };
    const rid = Math.random().toString(36).slice(2, 12);
    const link = 'https://www.instagram.com/reel/' + code + '/?utm_source=ig_embed&ig_rid=' + rid;
    const cap = (d.caption || '').replace(/</g, '&lt;');
    return '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<meta property="og:image" content="' + img + '">'
        + '<meta property="og:description" content="' + (d.caption || '').slice(0, 200).replace(/"/g, '') + '">'
        + '</head><body><div class="EmbeddedMedia">'
        + '<div class="EmbeddedMediaImageContainer"><a href="' + link + '" data-ios-link="media?id=' + code + '&utm_source=ig_embed&ig_rid=' + rid + '" data-log-event="mediaClick" target="_blank">'
        + '<img class="EmbeddedMediaImage" alt="Instagram post shared by &#064;' + d.owner + '" src="' + img + '"></a></div>'
        + '<div class="Caption">' + cap + '</div>'
        + '<div class="CaptionComments"><a class="CaptionCommentsExpand" href="' + link + '" target="_blank">View all comments</a></div>'
        + '</div><script>require([["PolarisEmbedSimple","init",[],[{"isRichEmbed":true,"isSidecar":false,"isGuideEmbed":false,"isProfileEmbed":false,"contextJSON":'
        + JSON.stringify(JSON.stringify(ctx)) + '}]]]);</script></body></html>';
}
