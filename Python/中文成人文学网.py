# https://blog.xbookcn.net — 中文成人文学网 下载器 v3.0
# 适用: iOS Python IDE
# 使用 requests + 伪装浏览器Headers
# 自动随机延迟防封

import re, time, os, random

# ── 请求配置 ──────────────────────────────────────────
try:
    import requests
    HAS_REQUESTS = True
except:
    HAS_REQUESTS = False

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",
    "Referer": "https://blog.xbookcn.net/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

BASE = "https://blog.xbookcn.net"


def fetch(url, to=15):
    """带重试的HTTP请求"""
    for a in range(3):
        try:
            if HAS_REQUESTS:
                r = requests.get(url, headers=HEADERS, timeout=to)
                if r.status_code == 200:
                    return r.text
                print(f"  ⚠️ HTTP {r.status_code}")
            else:
                # urllib后备
                import urllib.request
                req = urllib.request.Request(url, headers=HEADERS)
                return urllib.request.urlopen(req, timeout=to).read().decode("utf-8", "replace")
        except Exception as e:
            print(f"  ⚠️ {a+1}/3: {str(e)[:50]}")
            if a < 2:
                time.sleep(random.uniform(2, 4))
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


# ── 核心功能 ──────────────────────────────────────────

def get_all(max_pg=500):
    """遍历Blogger文章列表"""
    all_posts, seen = [], set()
    next_url, pn = BASE + "/?m=1&max-results=100", 0

    while next_url and pn < max_pg:
        print(f"📄 第{pn+1}页...", end=" ")
        html = fetch(next_url)
        if not html:
            print("❌ 获取失败")
            break

        found = 0
        for m in re.finditer(
            r'<h3[^>]*class="post-title[^"]*"[^>]*>(.*?)</h3>', html, re.DOTALL
        ):
            hm = re.search(r'href="([^"]+)"[^>]*>\s*([^<]+)\s*<', m.group(1))
            if hm:
                u, t = hm.group(1).strip(), hm.group(2).strip()
                if '/2000/01/' in u:
                    continue  # 跳过目录页
                if t in seen:
                    continue
                seen.add(t)
                all_posts.append((t, u))
                found += 1

        print(f"✅ +{found} 累计{len(all_posts)}")

        # 翻页: 找Older Posts链接
        next_url = None
        for p in [
            r'blog-pager-older-link[^>]*>.*?href="([^"]+)"',
            r'id="blog-pager-older-link"[^>]*>.*?href="([^"]+)"',
        ]:
            m = re.search(p, html, re.DOTALL)
            if m:
                next_url = m.group(1).strip()
                break

        if not next_url:
            print("📄 已到尾页")
            break

        pn += 1
        # ⏱ 随机延迟1-3秒
        delay = random.uniform(1, 3)
        print(f"  💤 等待{delay:.1f}秒...")
        time.sleep(delay)

    return all_posts


def extract_text(url):
    print(f"🔍 {url[:65]}...", end=" ")
    html = fetch(url)
    if not html:
        print("❌")
        return "提取失败"

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

    print("❌")
    return "正文提取失败"


def main():
    print("=" * 50)
    print("  中文成人文学网 下载器 v3.0")
    print(f"  {BASE}")
    if not HAS_REQUESTS:
        print("  ⚠️ 建议: pip install requests")
    print("=" * 50)

    book = input("\n📖 书名: ").strip()
    if not book:
        print("❌ 不能为空")
        return

    print(f"\n📚 扫描归档(稍候)...")
    all_posts = get_all()

    matched = [(t, u) for t, u in all_posts if book.lower() in t.lower()]
    if not matched:
        print(f"\n❌ '{book}' 未找到(扫描{len(all_posts)}篇)")
        # 显示前20篇标题供参考
        print("  首页文章:")
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
                print(f"  ✅ 已保存")
            else:
                print(f"  ⚠️ 跳过")
            time.sleep(random.uniform(1, 2))

    print(f"\n🎉 {ok}/{len(matched)}篇\n📁 {fp}")


if __name__ == "__main__":
    main()
