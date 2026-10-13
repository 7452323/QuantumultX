/* X 敏感推文修复：syndication 返回 TweetTombstone 时重建响应体 */
const SYND_RE = /^https:\/\/cdn\.syndication\.twimg\.com\/tweet-result/;
const UA = 'PostSaver/17 CFNetwork/3896.100.1.2.1 Darwin/27.0.0';
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const SRC = ['https://api.fxtwitter.com/status/', 'https://api.vxtwitter.com/status/'];

const url = ($request && $request.url) || '';
const body = ($response && typeof $response.body === 'string') ? $response.body : '';
const id = (url.match(/[?&]id=(\d+)/) || [])[1] || '';

if (!SYND_RE.test(url) || !id || (body && body.indexOf('TweetTombstone') < 0)) {
    $done({});
} else {
    rebuild(id, 0);
}

function arg(name) {
    if (typeof $argument !== 'undefined' && $argument && $argument[name]) return $argument[name];
    try { if (typeof $persistentStore !== 'undefined') { const v = $persistentStore.read(name); if (v) return v; } } catch (e) {}
    try { if (typeof $prefs !== 'undefined') { const v = $prefs.valueForKey(name); if (v) return v; } } catch (e) {}
    return '';
}

function notify(sub, msg) {
    try {
        if (typeof $notification !== 'undefined' && $notification.post) $notification.post('X 敏感推文修复', sub, msg);
        else if (typeof $notify !== 'undefined') $notify('X 敏感推文修复', sub, msg);
    } catch (e) {}
}

function get(req, cb) {
    if (typeof $httpClient !== 'undefined') {
        $httpClient.get(req, function (e, r, d) { cb(e ? null : d); });
    } else if (typeof $task !== 'undefined') {
        $task.fetch(req).then(function (r) { cb(r.body); }, function () { cb(null); });
    } else { cb(null); }
}

function rebuild(id, i) {
    if (i >= SRC.length) return scrape(id);
    get({ url: SRC[i] + id, headers: { 'User-Agent': UA, 'Accept': 'application/json' } }, function (txt) {
        if (!txt) return rebuild(id, i + 1);
        let t = null;
        try {
            const j = JSON.parse(txt);
            t = j.tweet || (j.media_extended ? j : null);
        } catch (e) {}
        if (!t) return rebuild(id, i + 1);
        try {
            $done({ body: build(t, id) });
            notify('已替换', t.text || '', '媒体 ' + (((t.media || {}).all) || t.media_extended || []).length + ' 项');
        } catch (e) { notify('拼装失败', String(e).slice(0, 120), ''); $done({}); }
    });
}

function scrape(id) {
    const cookie = arg('X_COOKIE');
    if (!cookie) { notify('取数据失败', '第三方源不可达，且未配置 X_COOKIE'); return $done({}); }
    get({ url: 'https://x.com/i/status/' + id, headers: { 'User-Agent': BROWSER, 'Cookie': cookie, 'Accept-Language': 'en-US,en;q=0.9' } }, function (html) {
        if (!html) { notify('取数据失败', 'X 页面也拉不到，检查 X_COOKIE 是否有效'); return $done({}); }
        const pick = function (re) { const m = html.match(re); return m ? m[1].replace(/&amp;/g, '&') : ''; };
        const ogv = pick(/<meta property="og:video(?::secure_url|:url)?" content="([^"]+)"/);
        const ogi = pick(/<meta property="og:image" content="([^"]+)"/);
        const ogd = pick(/<meta property="og:description" content="([^"]*)"/);
        const vids = [];
        const re1 = /"url"\s*:\s*"((?:[^"\\]|\\.)+?\.mp4[^"]*)"/g;
        const re2 = /"((?:[^"\\]|\\.)+?\.m3u8[^"]*)"/g;
        let m;
        while ((m = re1.exec(html))) vids.push(m[1].replace(/\\/g, '').replace(/&amp;/g, '&'));
        while ((m = re2.exec(html))) vids.push(m[1].replace(/\\/g, '').replace(/&amp;/g, '&'));
        if (ogv && vids.indexOf(ogv) < 0) vids.unshift(ogv);
        if (!vids.length && !ogi) { notify('页面未含媒体', 'Cookie 可能没权限看这条', ''); return $done({}); }
        const all = [];
        if (vids.length) all.push({ type: 'video', url: vids[0], formats: vids.map(function (u) { return { url: u, container: u.indexOf('.m3u8') > -1 ? 'm3u8' : 'mp4' }; }) });
        if (ogi && ogi.indexOf('profile_images') < 0) all.push({ type: 'photo', url: ogi });
        $done({ body: build({ id: id, text: ogd, media: { all: all } }, id) });
        notify('已用 Cookie 重建', ogd.slice(0, 60), '媒体 ' + all.length + ' 项');
    });
}

function build(t, id) {
    const raw = ((t.media || {}).all) || t.media_extended || [];
    const all = raw.map(function (m) {
        if (m.type === 'image' || m.type === 'photo') {
            return { type: 'photo', url: m.url, width: (m.size || {}).width || m.width || 0, height: (m.size || {}).height || m.height || 0 };
        }
        return {
            type: m.type === 'gif' ? 'animated_gif' : 'video',
            url: m.url, thumbnail_url: m.thumbnail_url,
            width: (m.size || {}).width || m.width || 0, height: (m.size || {}).height || m.height || 0,
            duration: m.duration, formats: m.formats
        };
    });
    const mediaDetails = all.map(function (m) {
        const w = m.width || 0, h = m.height || 0;
        const base = {
            media_url_https: m.thumbnail_url || m.url,
            original_info: { width: w, height: h },
            sizes: { large: { w: w, h: h, resize: 'fit' } },
            type: m.type
        };
        if (m.type === 'photo') { base.media_url_https = m.url; return base; }
        const fmts = m.formats || [{ url: m.url, container: 'mp4' }];
        let a = w, b = h;
        while (b) { const x = a % b; a = b; b = x; }
        const g = a || 1;
        base.video_info = {
            aspect_ratio: [Math.round(w / g) || 16, Math.round(h / g) || 9],
            duration_millis: Math.round((m.duration || 0) * 1000),
            variants: fmts.map(function (f) {
                return { url: f.url, bitrate: f.bitrate || 0, content_type: f.container === 'm3u8' ? 'application/x-mpegURL' : 'video/mp4' };
            })
        };
        return base;
    });
    const au = t.author || t.user || {};
    const out = {
        __typename: 'Tweet',
        id_str: String(t.id || t.id_str || id),
        text: t.text || '',
        display_text_range: ((t.raw_text || {}).display_text_range) || [0, (t.text || '').length],
        created_at: t.created_at || '',
        lang: t.lang || 'en',
        possibly_sensitive: !!t.possibly_sensitive,
        favorite_count: t.likes || t.favorite_count || 0,
        conversation_count: t.replies || 0,
        user: {
            id_str: String(au.id || au.id_str || ''),
            name: au.name || '',
            screen_name: au.screen_name || '',
            profile_image_url_https: au.avatar_url || au.profile_image_url_https || '',
            verified: !!((au.verification || {}).verified || au.verified)
        },
        mediaDetails: mediaDetails,
        photos: all.filter(function (m) { return m.type === 'photo'; }).map(function (m) {
            return { url: m.url, width: m.width, height: m.height };
        })
    };
    return JSON.stringify(out);
}
