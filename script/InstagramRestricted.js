/* IG 受限内容修复：embed 被判 invalid（仅关注者可见等）时用登录会话重取 */
let ARGS = null;

const FB_UA = 'facebookexternalhit/1.1';
const DESK_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const IG_SESSION_FALLBACK = '';
const IG_COOKIE_FALLBACK = '';

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const code = (url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || '';
const broken = !body || body.indexOf('utm_campaign=invalid') > -1 || body.indexOf('EmbeddedMediaImage') < 0;

if (!/instagram\.com\/.*\/embed\//.test(url) || !code || !broken) {
    $done({});
} else {
    step1();
}

function arg(name) {
    if (ARGS === null) {
        ARGS = {};
        const a = (typeof $argument !== 'undefined') ? $argument : '';
        if (a && typeof a === 'object') { ARGS = a; }
        else if (typeof a === 'string' && a) {
            const t = a.trim();
            if (t.charAt(0) === '{') { try { ARGS = JSON.parse(t); } catch (e) {} }
            if (Object.keys(ARGS).length) { /* json 已解析 */ }
            else a.split('&').forEach(function (kv) {
                const i = kv.indexOf('=');
                if (i < 0) return;
                const k = decodeURIComponent(kv.slice(0, i));
                const v = decodeURIComponent(kv.slice(i + 1));
                if (k) ARGS[k] = v;
            });
        }
    }
    if (ARGS[name]) return ARGS[name];
    try { if (typeof $persistentStore !== 'undefined') { const v = $persistentStore.read(name); if (v) return v; } } catch (e) {}
    try { if (typeof $prefs !== 'undefined') { const v = $prefs.valueForKey(name); if (v) return v; } } catch (e) {}
    if (name === 'IG_SESSION') return IG_SESSION_FALLBACK;
    if (name === 'IG_COOKIE') return IG_COOKIE_FALLBACK;
    return '';
}

function cookie() {
    const c = arg('IG_COOKIE');
    if (c) return c;
    const s = arg('IG_SESSION');
    return s ? 'sessionid=' + s : '';
}

function notify(sub, msg) {
    try {
        if (typeof $notification !== 'undefined' && $notification.post) $notification.post('IG 受限内容修复', sub, msg || '');
        else if (typeof $notify !== 'undefined') $notify('IG 受限内容修复', sub, msg || '');
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

function parse(html) {
    const grab = function (re) { const x = html.match(re); return x ? unesc(x[1]) : ''; };
    let image = grab(/<meta[^>]*og:image[^>]*content="([^"]+)"/);
    if (!image) image = grab(/"display_url":"((?:[^"\\]|\\.)+?)"/);
    if (!image) image = grab(/"image_versions2":\{"candidates":\[\{"width":\d+,"height":\d+,"url":"((?:[^"\\]|\\.)+?)"/);
    if (!image) return null;

    let video = '';
    const i = html.indexOf('video_versions');
    if (i > -1) {
        const flat = html.slice(i, i + 30000)
            .replace(/\\\\\//g, '/').replace(/\\\//g, '/').replace(/\\"/g, '"').replace(/\\\\u0026/g, '&').replace(/\\u0026/g, '&');
        const s0 = flat.indexOf('[');
        if (s0 > -1) {
            let depth = 0, end = -1;
            for (let k = s0; k < flat.length; k++) {
                if (flat[k] === '[') depth++;
                else if (flat[k] === ']') { depth--; if (!depth) { end = k + 1; break; } }
            }
            if (end > 0) {
                const arr = flat.slice(s0, end);
                const re = /"type":(\d+),"url":"([^"]+)"/g;
                let m, bestW = -1;
                while ((m = re.exec(arr))) {
                    const u = m[2].replace(/&amp;/g, '&');
                    if (u.indexOf('.mp4') < 0) continue;
                    if (u.indexOf('dashinit') > -1 || u.indexOf('bytestart') > -1 || u.indexOf('byteend') > -1) continue;
                    const w = parseInt((u.match(/\/(\d+)x(\d+)\//) || [])[1] || '0', 10);
                    if (w > bestW) { bestW = w; video = u; }
                }
                if (!video) {
                    const re2 = /"url":"([^"]+\.mp4[^"]*)"/g;
                    while ((m = re2.exec(arr))) {
                        const u = m[1].replace(/&amp;/g, '&');
                        if (u.indexOf('dashinit') > -1 || u.indexOf('bytestart') > -1) continue;
                        video = u; break;
                    }
                }
            }
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

/* 1) 带登录会话重取同一个 embed —— 仅关注者可见的帖子只有这条路能出内容 */
function step1() {
    const ck = cookie();
    if (!ck) {
        notify('未配置会话', '仅关注者可见的帖子需要登录，请填 IG_SESSION');
        return step2();
    }
    get({ url: url, headers: { 'User-Agent': FB_UA, 'Cookie': ck, 'Accept-Language': 'zh-CN,zh-Hans;q=0.9' } }, function (html) {
        if (html && html.indexOf('EmbeddedMediaImage') > -1) {
            notify('已用登录会话取回', '@' + ((html.match(/shared by &#064;([A-Za-z0-9._]+)/) || [])[1] || ''));
            return $done({ body: html });
        }
        step2();
    });
}

/* 2) 带会话拉主站页，吃 SSR 数据 */
function step2() {
    const hdrs = {
        'User-Agent': DESK_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'none'
    };
    const ck = cookie();
    if (ck) hdrs['Cookie'] = ck;
    get({ url: 'https://www.instagram.com/reel/' + code + '/', headers: hdrs }, function (html) {
        if (!html) return step3();
        const m = parse(html);
        if (!m) return step3();
        $done({ body: shell(m, m.image) });
        notify('已重建', '@' + m.owner + ' ' + (m.video ? '视频 ' + m.w + 'x' + m.h : '图片'),
            m.video ? m.video.slice(0, 70) : m.image.slice(0, 70));
    });
}

/* 3) 只剩封面 */
function step3() {
    get({ url: 'https://www.instagram.com/reel/' + code + '/', headers: { 'User-Agent': DESK_UA, 'sec-fetch-site': 'none', 'Accept-Language': 'zh-CN,zh-Hans;q=0.9' } }, function (html) {
        const img = html ? ((html.match(/<meta[^>]*og:image[^>]*content="([^"]+)"/) || [])[1] || '') : '';
        if (!img) { notify('兜底失败', '主站没给 og:image，会话可能无效'); return $done({}); }
        const desc = (html.match(/<meta[^>]*og:description[^>]*content="([^"]*)"/) || [])[1] || '';
        $done({ body: shell({ owner: '', image: img, video: '', dur: 0, w: 1080, h: 1350, type: 'GraphImage', caption: cleanCap(desc) }, img) });
    });
}

function attr(u) { return String(u || '').replace(/&/g, '&amp;'); }

function shell(d, img) {
    const sm = {
        __typename: d.type,
        id: shortcodeToId(code),
        shortcode: code,
        is_video: !!d.video,
        display_url: img,
        display_resources: [
            { src: img, config_width: d.w, config_height: d.h },
            { src: img, config_width: 640, config_height: Math.round(640 * d.h / (d.w || 1)) },
            { src: img, config_width: 480, config_height: Math.round(480 * d.h / (d.w || 1)) }
        ],
        thumbnail_src: img,
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
    const ctx = { context: { type: d.type, shortcode: code, copyright_blocked: false }, gql_data: { shortcode_media: sm } };
    const rid = Math.random().toString(36).slice(2, 12);
    const link = 'https://www.instagram.com/reel/' + code + '/?utm_source=ig_embed&ig_rid=' + rid;
    const cap = (d.caption || '').replace(/</g, '&lt;');
    return '<!DOCTYPE html><html><head><meta charset="utf-8">'
        + '<meta property="og:image" content="' + attr(img) + '">'
        + '<meta property="og:description" content="' + (d.caption || '').slice(0, 200).replace(/"/g, '') + '">'
        + '</head><body><div class="EmbeddedMedia">'
        + '<div class="EmbeddedMediaImageContainer"><a href="' + link + '" data-ios-link="media?id=' + code + '&utm_source=ig_embed&ig_rid=' + rid + '" data-log-event="mediaClick" target="_blank">'
        + '<img class="EmbeddedMediaImage" alt="Instagram post shared by &#064;' + d.owner + '" src="' + attr(img) + '"></a></div>'
        + '<div class="Caption">' + cap + '</div>'
        + '<div class="CaptionComments"><a class="CaptionCommentsExpand" href="' + link + '" target="_blank">View all comments</a></div>'
        + '</div><script>require([["PolarisEmbedSimple","init",[],[{"isRichEmbed":true,"isSidecar":false,"isGuideEmbed":false,"isProfileEmbed":false,"contextJSON":'
        + JSON.stringify(JSON.stringify(ctx)) + '}]]]);</script></body></html>';
}
