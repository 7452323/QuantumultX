/* Instagram 受限内容修复：embed 被判 invalid 时，先用登录会话重取，再用主站 og 兜底重建 */
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const SESSION_FALLBACK = '';

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const code = (url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || '';

if (!/instagram\.com\/.*\/embed\//.test(url) || !code || body.indexOf('EmbeddedMediaImage') > -1) {
    $done({});
} else {
    withSession();
}

function arg(name) {
    if (typeof $argument !== 'undefined' && $argument && $argument[name]) return $argument[name];
    try { if (typeof $persistentStore !== 'undefined') { const v = $persistentStore.read(name); if (v) return v; } } catch (e) {}
    try { if (typeof $prefs !== 'undefined') { const v = $prefs.valueForKey(name); if (v) return v; } } catch (e) {}
    if (name === 'IG_SESSION') return SESSION_FALLBACK;
    return '';
}

function notify(sub, msg) {
    try {
        if (typeof $notification !== 'undefined' && $notification.post) $notification.post('Instagram 受限内容修复', sub, msg);
        else if (typeof $notify !== 'undefined') $notify('Instagram 受限内容修复', sub, msg);
    } catch (e) {}
}

function shortcodeToId(c) {
    let n = 0n;
    for (let i = 0; i < c.length; i++) n = n * 64n + BigInt(ALPHA.indexOf(c[i]));
    return n.toString();
}

function get(req, cb) {
    if (typeof $httpClient !== 'undefined') {
        $httpClient.get(req, function (e, r, d) { cb(e ? null : d, r); });
    } else if (typeof $task !== 'undefined') {
        $task.fetch(req).then(function (r) { cb(r.body, r); }, function () { cb(null, null); });
    } else { cb(null, null); }
}

function withSession() {
    const session = arg('IG_SESSION');
    if (!session) { notify('未配置会话', '只能取到封面图，视频需填 IG_SESSION'); return fallback(); }
    get({ url: url, headers: { 'User-Agent': UA, 'Cookie': 'sessionid=' + session } }, function (html) {
        if (html && html.indexOf('EmbeddedMediaImage') > -1) {
            notify('已用登录会话取回', code, '');
            return $done({ body: html });
        }
        notify('会话无效', 'sessionid 可能已过期', '退回封面图');
        fallback();
    });
}

function fallback() {
    const page = url.replace(/\/embed\/.*$/, '/');
    get({ url: page, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } }, function (html) {
        if (!html) return $done({});
        const img = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
        if (!img) { notify('兜底也失败', '主站未返回 og:image', ''); return $done({}); }
        const desc = (html.match(/<meta property="og:description" content="([^"]*)"/) || [])[1] || '';
        const cap = desc.replace(/^[^:]*:\s*/, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#x([0-9a-f]+);/gi, function (m, h) {
            return String.fromCharCode(parseInt(h, 16));
        }).replace(/<[^>]*>/g, '');
        const media = {
            __typename: 'GraphImage',
            id: shortcodeToId(code),
            shortcode: code,
            is_video: false,
            display_url: img,
            display_resources: [{ src: img, config_width: 1080, config_height: 1350 }],
            edge_media_to_caption: { edges: [{ node: { text: cap } }] }
        };
        const ctx = { context: { type: 'GraphImage', shortcode: code, copyright_blocked: false }, gql_data: { shortcode_media: media } };
        const out = '<!DOCTYPE html><html><head><meta property="og:image" content="' + img + '"></head><body>' +
            '<img class="EmbeddedMediaImage" src="' + img + '">' +
            '<div class="CaptionComments"><span>' + cap + '</span></div>' +
            '<script>require([["PolarisEmbedSimple","init",[],[{"isRichEmbed":true,"contextJSON":' +
            JSON.stringify(JSON.stringify(ctx)) + '}]]]);</script></body></html>';
        $done({ body: out });
    });
}
