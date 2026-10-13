/* Instagram 受限内容修复：embed 被判 invalid 时，先用登录会话重取，再用主站 og 兜底重建 */
const SESSION = '';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const code = (url.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/) || [])[1] || '';

if (!/instagram\.com\/.*\/embed\//.test(url) || !code || body.indexOf('EmbeddedMediaImage') > -1) {
    $done({});
} else {
    withSession();
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

function ok(html) {
    $done({
        response: {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
            body: html
        }
    });
}

function withSession() {
    if (!SESSION) return fallback();
    get({ url: url, headers: { 'User-Agent': UA, 'Cookie': 'sessionid=' + SESSION } }, function (html) {
        if (html && html.indexOf('EmbeddedMediaImage') > -1) return ok(html);
        fallback();
    });
}

function fallback() {
    const page = url.replace(/\/embed\/.*$/, '/');
    get({ url: page, headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } }, function (html) {
        if (!html) return $done({});
        const img = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1] || '';
        if (!img) return $done({});
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
        ok(out);
    });
}
