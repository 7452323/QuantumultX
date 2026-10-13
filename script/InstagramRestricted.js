/* IG 受限内容修复：App 拿到的 embed 被判 invalid 时，改用 IG web GraphQL 重建 */
let ARGS = null;

const GQL = 'https://www.instagram.com/graphql/query';
const HOME = 'https://www.instagram.com/';
const DOC_ID = '27128499623469141';
const DESK_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const code = (url.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || '';
const broken = !body || body.indexOf('utm_campaign=invalid') > -1 || body.indexOf('EmbeddedMediaImage') < 0;

if (!/instagram\.com\/.*\/embed\//.test(url) || !code || !broken) {
    $done({});
} else {
    run();
}

function arg(name) {
    if (ARGS === null) {
        ARGS = {};
        const a = (typeof $argument !== 'undefined') ? $argument : '';
        if (a && typeof a === 'object') { ARGS = a; }
        else if (typeof a === 'string' && a) {
            const t = a.trim();
            if (t.charAt(0) === '{') { try { ARGS = JSON.parse(t); } catch (e) {} }
            if (!Object.keys(ARGS).length) a.split('&').forEach(function (kv) {
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
    return '';
}

/* 会话值容错：只填值 / sessionid=xxx / 整条 cookie 串 都认。
   整串时把每一对都并进去 —— csrftoken 必须和 sessionid 同源，否则 IG 判 CSRF 不匹配 */
function mergeSession(jar, raw) {
    raw = String(raw || '').trim();
    if (!raw) return jar;
    if (raw.indexOf('=') > -1) {
        raw.split(/;\s*/).forEach(function (p) {
            const i = p.indexOf('=');
            if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
        });
        if (jar.sessionid) return jar;
    }
    if (raw) jar.sessionid = raw;
    return jar;
}

function notify(sub, msg) {
    try {
        if (typeof $notification !== 'undefined' && $notification.post) $notification.post('IG 受限内容修复', sub, msg || '');
        else if (typeof $notify !== 'undefined') $notify('IG 受限内容修复', sub, msg || '');
    } catch (e) {}
}

function get(req, cb) {
    if (typeof $httpClient !== 'undefined') {
        $httpClient.get(req, function (e, r, d) { cb(e ? null : d, r, d); });
    } else if (typeof $task !== 'undefined') {
        $task.fetch(req).then(function (r) { cb(r.body, r, r.body); }, function () { cb(null); });
    } else { cb(null); }
}

function post(req, cb) {
    if (typeof $httpClient !== 'undefined') {
        $httpClient.post(req, function (e, r, d) { cb(e, r, e ? null : d); });
    } else if (typeof $task !== 'undefined') {
        $task.fetch({ url: req.url, method: 'POST', headers: req.headers, body: req.body })
            .then(function (r) { cb(null, r, r.body); }, function (e) { cb(e, null, null); });
    } else { cb('no http', null, null); }
}

/* App 自己请求带的 cookie + 用户填的会话 */
function reqCookie() {
    const jar = {};
    const raw = ($request && $request.headers && ($request.headers.Cookie || $request.headers.cookie)) || '';
    String(raw).split(/;\s*/).forEach(function (p) {
        const i = p.indexOf('=');
        if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
    const c = arg('IG_COOKIE');
    if (c) String(c).split(/;\s*/).forEach(function (p) {
        const i = p.indexOf('=');
        if (i > 0) jar[p.slice(0, i).trim()] = p.slice(i + 1).trim();
    });
    const s = mergeSession(jar, arg('IG_SESSION'));
    return s;
}

function cookieStr(jar) {
    return Object.keys(jar).map(function (k) { return k + '=' + jar[k]; }).join('; ');
}

function run() {
    const jar = reqCookie();
    if (jar.csrftoken) return gql(jar);
    /* 必须带着会话 cookie 去取 csrftoken —— 否则拿到的 token 和 sessionid 不同源 */
    get({ url: HOME, headers: { 'User-Agent': DESK_UA, 'Accept': 'text/html,application/xhtml+xml', 'Cookie': cookieStr(jar) } }, function (html, resp) {
        const setc = (resp && resp.headers && (resp.headers['Set-Cookie'] || resp.headers['set-cookie'])) || '';
        const m = String(setc).match(/csrftoken=([^;]+)/);
        if (m) jar.csrftoken = m[1];
        if (!jar.csrftoken && html) {
            const m2 = String(html).match(/csrftoken["']?\s*[:=]\s*["']([A-Za-z0-9_-]{10,})/);
            if (m2) jar.csrftoken = m2[1];
        }
        gql(jar);
    });
}

function gql(jar) {
    const hdrs = {
        'User-Agent': DESK_UA,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.8',
        'Referer': 'https://www.instagram.com/',
        'X-IG-App-ID': '936619743392459',
        'Cookie': cookieStr(jar)
    };
    if (jar.csrftoken) hdrs['x-csrftoken'] = jar.csrftoken;
    const vars = '{"shortcode":"' + code + '","__relay_internal__pv__PolarisAIGMMediaWebLabelEnabledrelayprovider":false}';
    const payload = 'variables=' + encodeURIComponent(vars) + '&doc_id=' + DOC_ID + '&server_timestamps=true';
    post({ url: GQL, headers: hdrs, body: payload }, function (err, resp, data) {
        let item = null, perr = '';
        try { item = JSON.parse(data).data.xdt_api__v1__media__shortcode__web_info.items[0]; } catch (e) { perr = String(e).slice(0, 60); }
        if (!item) {
            const st = (resp && resp.status) || (resp && resp.statusCode) || '?';
            const snip = String(data || err || perr || '').replace(/\s+/g, ' ').slice(0, 90);
            if (!jar.sessionid) return notify('需要登录会话', 'HTTP ' + st + ' — 此帖 IG 拒绝匿名访问，请填 IG_SESSION');
            return notify('取数据失败', 'HTTP ' + st + ' | 有 sessionid 但被拒：' + snip);
        }
        const vid = pickVid(item.video_versions);
        const img = bigImg(item);
        const w = item.original_width || 1080, h = item.original_height || 1350;
        const owner = (item.user || {}).username || '';
        const cap = ((item.caption || {}).text) || '';
        const sm = {
            __typename: vid ? 'GraphVideo' : (item.carousel_media ? 'GraphSidecar' : 'GraphImage'),
            id: String(item.pk || item.id || ''),
            shortcode: code,
            is_video: !!vid,
            display_url: img,
            display_resources: (function () {
                const c = (item.image_versions2 || {}).candidates || [];
                return c.length ? c.map(function (x) { return { src: x.url, config_width: x.width, config_height: x.height }; })
                    : [{ src: img, config_width: w, config_height: h }];
            })(),
            thumbnail_src: img,
            dimensions: { height: h, width: w },
            owner: { username: owner, is_verified: false },
            edge_media_to_caption: { edges: [{ node: { text: cap } }] },
            edge_media_to_comment: { count: item.comment_count || 0 },
            edge_liked_by: { count: item.like_count || 0 },
            accessibility_caption: item.accessibility_caption || null,
            product_type: item.product_type || 'clips'
        };
        if (vid) {
            sm.video_url = vid;
            sm.video_duration = Math.round((item.video_duration || 0) * 1000);
            sm.video_view_count = item.view_count || 0;
        }
        const ctx = { context: { type: sm.__typename, shortcode: code, copyright_blocked: false }, gql_data: { shortcode_media: sm } };
        const rid = Math.random().toString(36).slice(2, 12);
        const link = 'https://www.instagram.com/reel/' + code + '/?utm_source=ig_embed&ig_rid=' + rid;
        $done({ body: '<!DOCTYPE html><html><head><meta charset="utf-8">'
            + '<meta property="og:image" content="' + esc(img) + '">'
            + '<meta property="og:description" content="' + esc(cap).slice(0, 200) + '">'
            + '</head><body><div class="EmbeddedMedia">'
            + '<div class="EmbeddedMediaImageContainer"><a href="' + link + '" data-ios-link="media?id=' + code + '&utm_source=ig_embed&ig_rid=' + rid + '" data-log-event="mediaClick" target="_blank">'
            + '<img class="EmbeddedMediaImage" alt="Instagram post shared by &#064;' + esc(owner) + '" src="' + esc(img) + '"></a></div>'
            + '<div class="Caption">' + esc(cap) + '</div>'
            + '<div class="CaptionComments"><a class="CaptionCommentsExpand" href="' + link + '" target="_blank">View all comments</a></div>'
            + '</div><script>require([["PolarisEmbedSimple","init",[],[{"isRichEmbed":true,"isSidecar":false,"isGuideEmbed":false,"isProfileEmbed":false,"contextJSON":'
            + JSON.stringify(JSON.stringify(ctx)) + '}]]]);</script></body></html>' });
        notify('已重建', '@' + owner + (vid ? ' 视频 ' + w + 'x' + h : ' 图片'), vid ? vid.slice(0, 70) : img.slice(0, 70));
    });
}

/* 挑最大分辨率封面：默认那套最大只有 640，是糊图根因 */
function bigImg(item) {
    const c = (item.image_versions2 || {}).candidates || [];
    let best = '', bestPx = -1;
    for (let i = 0; i < c.length; i++) {
        const w = c[i].width || 0, h = c[i].height || 0;
        if (w * h > bestPx) { bestPx = w * h; best = c[i].url || ''; }
    }
    return best || item.display_uri || '';
}

/* 挑可播 mp4：优先 type 101，排除 DASH 分片 */
function pickVid(list) {
    if (!list || !list.length) return '';
    let best = '', score = -1;
    for (let i = 0; i < list.length; i++) {
        const v = list[i] || {}, u = String(v.url || '');
        if (u.indexOf('.mp4') < 0) continue;
        if (u.indexOf('dashinit') > -1 || u.indexOf('bytestart') > -1 || u.indexOf('byteend') > -1) continue;
        const s = (v.width || 0) + (v.type === 101 ? 100000 : 0);
        if (s > score) { score = s; best = u; }
    }
    return best;
}

function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
