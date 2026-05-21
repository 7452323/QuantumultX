# https://blog.xbookcn.net — 中文成人文学网 下载器 v3.0
# 适用: iOS Python IDE
# 轮换User-Agent + 随机延迟 + Cloudflare绕过

import re, time, os, random

# ── User-Agent 池 ────────────────────────────────────
UA_POOL = [
    # Chrome (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36",
    # Chrome (macOS)
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    # Safari (macOS)
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.2 Safari/605.1.15",
    # Edge (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0",
    # Firefox (Windows)
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:136.0) Gecko/20100101 Firefox/136.0",
    # iPhone Safari
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1",
]

# ── 请求库选择 ───────────────────────────────────────
# 优先级: curl_cffi > httpx(h2) > requests > urllib
HTTP2 = False
CURL = False

try:
    from curl_cffi import requests as curl_req
    CURL = True
    print("✅ 使用 curl_cffi (最佳浏览器伪装)")
except ImportError:
    try:
        import httpx
        HTTP2 = True
        print("✅ 使用 httpx (HTTP/2支持)")
    except ImportError:
        try:
            import requests as req_lib
            print("✅ 使用 requests")
        except ImportError:
            import urllib.request as urllib_req
            print("ℹ️ 使用 urllib (建议 pip install requests)")

BASE = "https://blog.xbookcn.net"


def fetch(url, to=15):
    """带重试 + UA轮换的HTTP请求"""
    for a in range(3):
        ua = random.choice(UA_POOL)
        headers = {
            "User-Agent": ua,
            "Referer": BASE + "/",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        try:
            if CURL:
                r = curl_req.get(url, headers=headers, timeout=to, impersonate="chrome135")
                if r.status_code == 200:
                    return r.text
            elif HTTP2:
                with httpx.Client(http2=True, headers=headers, timeout=to, follow_redirects=True) as client:
                    r = client.get(url)
                    if r.status_code == 200:
                        return r.text
            elif 'req_lib' in dir():
                r = req_lib.get(url, headers=headers, timeout=to)
                if r.status_code == 200:
                    return r.text
            else:
                req = urllib_req.Request(url, headers=headers)
                return urllib_req.urlopen(req, timeout=to).read().decode("utf-8", "replace")
        except Exception as e:
            err = str(e)[:60]
            if a < 2:
                wait = random.uniform(3, 6)
                print(f"  ⚠️ {a+1}/3 [{ua[:35]}...] {err} 等待{wait:.0f}s")
                time.sleep(wait)
            else:
                print(f"  ❌ {a+1}/3 失败: {err}")
    return None


def clean(t):
    for p, s in [
        (r'<script[^>]*>.*?</script>', ''),
        (r'<style[^>]*>.*?</style>', ''),
        (r'<br\s*/?>', '\n'),
        (r'<p[^>]*>', '\n'),
        (r'</?p>', ''),
        (r'<div[^>]*>', '\n'),
        (r'</div>', ''),
        (r'<[^>]+>', ''),
    ]:
        t = re.sub(p, s, t, flags=re.DOTALL)
    for a, b in [('&nbsp;', ' '), ('&lt;', '<'), ('&gt;', '>'), ('&amp;', '&')]:
        t = t.replace(a, b)
    t = re.sub(r'&[a-z]+;', '', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()


def get_all(max_pg=500):
    all_posts, seen = [], set()
    next_url, pn = BASE + "/?m=1&max-results=100", 0

    while next_url and pn < max_pg:
        print(f"📄 第{pn+1}页...", end=" ")
        html = fetch(next_url)
        if not html:
            print("❌"); break

        found = 0
        for m in re.finditer(r'<h3[^>]*class="post-title[^"]*"[^>]*>(.*?)</h3>', html, re.DOTALL):
            hm = re.search(r'href="([^"]+)"[^>]*>\s*([^<]+)\s*<', m.group(1))
            if hm:
                u, t = hm.group(1).strip(), hm.group(2).strip()
                if '/2000/01/' in u: continue
                if t in seen: continue
                seen.add(t)
                all_posts.append((t, u))
                found += 1

        print(f"✅ +{found} 累计{len(all_posts)}")

        next_url = None
        for p in [r'blog-pager-older-link[^>]*>.*?href="([^"]+)"',
                  r'id="blog-pager-older-link"[^>]*>.*?href="([^"]+)"']:
            m = re.search(p, html, re.DOTALL)
            if m:
                next_url = m.group(1).strip()
                break

        if not next_url:
            print("📄 已到尾页")
            break

        pn += 1
        delay = random.uniform(2, 5)
        print(f"  💤 {delay:.1f}s...")
        time.sleep(delay)

    return all_posts


def extract_text(url):
    print(f"🔍 {url[:65]}...", end=" ")
    html = fetch(url)
    if not html:
        print("❌"); return "提取失败"
    for pat in [
        r'<div[^>]*class="[^"]*post-body[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
        r'<div[^>]*class="[^"]*post-body[^"]*"[^>]*>(.*?)</div>\s*</div>',
        r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
    ]:
        m = re.search(pat, html, re.DOTALL)
        if m:
            t = clean(m.group(1))
            if len(re.findall(r'[\u4e00-\u9fff]', t)) > 50:
                print(f"✅ {len(t)}字")
                return t
    print("❌"); return "正文提取失败"


def main():
    print("=" * 50)
    print("  中文成人文学网 下载器 v3.0")
    print(f"  {BASE}")
    print(f"  库: {'curl_cffi' if CURL else 'httpx(h2)' if HTTP2 else 'requests' if 'req_lib' in dir() else 'urllib'}")
    print(f"  UA池: {len(UA_POOL)}个轮换")
    print("=" * 50)

    book = input("\n📖 书名: ").strip()
    if not book:
        print("❌ 不能为空")
        return

    print(f"\n📚 扫描归档...")
    all_posts = get_all()

    matched = [(t, u) for t, u in all_posts if book.lower() in t.lower()]
    if not matched:
        print(f"\n❌ '{book}' 未找到(扫描{len(all_posts)}篇)")
        print("  首页前20篇:")
        for t, _ in all_posts[:20]:
            print(f"    {t}")
        return

    print(f"\n📊 找到{len(matched)}篇")
    fp = os.path.join(
        os.path.expanduser("~/Documents"),
        re.sub(r'[\\/:*?"<>|]', '', book).strip() + ".txt",
    )
    ok = 0
    with open(fp, "w", encoding="utf-8") as f:
        for i, (t, u) in enumerate(matched, 1):
            print(f"📖 [{i}/{len(matched)}] {t[:35]}...", end=" ")
            c = extract_text(u)
            if not c.startswith("正文提取失败") and len(c) > 100:
                f.write(f"\n\n=== {t} ===\n\n{c}\n")
                ok += 1
            pass
            time.sleep(random.uniform(1.5, 3))

    print(f"\n🎉 {ok}/{len(matched)}篇\n📁 {fp}")


if __name__ == "__main__":
    main()
