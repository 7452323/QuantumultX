/* X/Twitter 敏感推文修复：syndication 返回 TweetTombstone 时改用 fxtwitter 重建 */
const SYND_RE = /^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result/;
const UA = 'PostSaver/17 CFNetwork/3896.100.1.2.1 Darwin/27.0.0';

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const id = (url.match(/[?&]id=(\d+)/) || [])[1] || '';

if (!SYND_RE.test(url) || !id || (body && body.indexOf('TweetTombstone') < 0)) {
    $done({});
} else {
    rebuild(id);
}

function rebuild(id) {
    const req = { url: 'https://api.fxtwitter.com/status/' + id, headers: { 'User-Agent': UA } };
    const finish = function (txt) {
        try {
            const t = (JSON.parse(txt) || {}).tweet;
            if (!t) return $done({});
            const all = ((t.media || {}).all) || [];
            const mediaDetails = all.map(function (m) {
                const w = m.width || 0, h = m.height || 0;
                const base = {
                    media_url_https: m.thumbnail_url || m.url,
                    original_info: { width: w, height: h },
                    sizes: { large: { w: w, h: h, resize: 'fit' } },
                    type: m.type || 'photo'
                };
                if (m.type === 'photo') { base.media_url_https = m.url; return base; }
                const fmts = m.formats || (m.variants || []).map(function (v) {
                    return { url: v.url, bitrate: v.bitrate, container: (v.content_type || '').indexOf('mpegURL') > -1 ? 'm3u8' : 'mp4' };
                });
                let a = w, b = h;
                while (b) { const t = a % b; a = b; b = t; }
                const g = a || 1;
                base.video_info = {
                    aspect_ratio: [Math.round(w / g), Math.round(h / g)],
                    duration_millis: Math.round((m.duration || 0) * 1000),
                    variants: fmts.map(function (f) {
                        return {
                            url: f.url,
                            bitrate: f.bitrate || 0,
                            content_type: f.container === 'm3u8' ? 'application/x-mpegURL' : 'video/mp4'
                        };
                    })
                };
                return base;
            });
            const out = {
                __typename: 'Tweet',
                id_str: String(t.id || id),
                text: t.text || '',
                display_text_range: ((t.raw_text || {}).display_text_range) || [0, (t.text || '').length],
                created_at: t.created_at || '',
                lang: t.lang || 'en',
                possibly_sensitive: !!t.possibly_sensitive,
                favorite_count: t.likes || 0,
                conversation_count: t.replies || 0,
                user: {
                    id_str: String((t.author || {}).id || ''),
                    name: (t.author || {}).name || '',
                    screen_name: (t.author || {}).screen_name || '',
                    profile_image_url_https: (t.author || {}).avatar_url || '',
                    verified: !!((((t.author || {}).verification) || {}).verified)
                },
                mediaDetails: mediaDetails,
                photos: all.filter(function (m) { return m.type === 'photo'; }).map(function (m) {
                    return { url: m.url, width: m.width, height: m.height };
                })
            };
            $done({
                response: {
                    status: 200,
                    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(out)
                }
            });
        } catch (e) { $done({}); }
    };
    if (typeof $httpClient !== 'undefined') {
        $httpClient.get(req, function (err, resp, data) {
            if (err || !data) return $done({});
            finish(data);
        });
    } else if (typeof $task !== 'undefined') {
        $task.fetch(req).then(function (r) { finish(r.body); }, function () { $done({}); });
    } else { $done({}); }
}
