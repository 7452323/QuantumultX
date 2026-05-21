# https://blog.xbookcn.net — 中文成人文学网 下载器 v3.0
# iOS板 直连版（通过Blogger标准翻页遍历）
# 适用于 iOS Python IDE

import urllib.request, re, time, os, random, json

H = {"User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
     "Accept":"text/html", "Accept-Language":"zh-CN,zh;q=0.9"}

def fetch(url, timeout=25):
    for a in range(3):
        try:
            r = urllib.request.Request(url, headers=H)
            return urllib.request.urlopen(r, timeout=timeout).read().decode("utf-8","replace")
        except Exception as e:
            print(f"  ⚠️ {a+1}/3: {str(e)[:50]}")
            if a<2: time.sleep(random.uniform(2,4))
    return None

def clean(t):
    for p,s in [(r'<script[^>]*>.*?</script>',''), (r'<style[^>]*>.*?</style>',''), 
                (r'<br\s*/?>','\n'), (r'<p[^>]*>','\n'), (r'</?p>',''), 
                (r'<div[^>]*>','\n'), (r'</div>',''), (r'<[^>]+>','')]:
        t = re.sub(p, s, t, flags=re.DOTALL)
    for a,b in [('&nbsp;',' '),('&lt;','<'),('&gt;','>'),('&amp;','&')]: t=t.replace(a,b)
    t = re.sub(r'&[a-z]+;', '', t)
    t = re.sub(r'\n{3,}', '\n\n', t)
    return t.strip()

def get_all_posts(max_pg=500):
    """遍历Blogger归档，获取所有文章"""
    all_posts, seen = [], set()
    base = "https://blog.xbookcn.net"
    next_url, pn = base + "/?m=1&max-results=100", 0

    while next_url and pn < max_pg:
        print(f"📄 第{pn+1}页...", end=" ")
        html = fetch(next_url, timeout=30)
        if not html: print("❌"); break

        # 尝试多种文章标题模式
        found = 0
        for pat, flg in [
            (r'<h3[^>]*class="[^"]*post-title[^"]*"[^>]*>.*?<a\s+href="([^"]+)"[^>]*>([^<]+)</a>', re.DOTALL),
            (r'<h2[^>]*class="[^"]*title[^"]*"[^>]*>.*?<a\s+href="([^"]+)"[^>]*>([^<]+)</a>', re.DOTALL),
            (r'entry-title[^>]*>.*?<a\s+href="([^"]+)"[^>]*>([^<]+)</a>', re.DOTALL),
            (r'<a\s+href="(https?://blog\.xbookcn\.net/20[0-9][0-9]/[^"]+)"[^>]*>([^<]+)</a>', 0),
        ]:
            for u,t in re.findall(pat, html, flg):
                t=t.strip()
                if t and len(t)>2 and t not in seen:
                    seen.add(t)
                    # 确保URL带m=1
                    if "m=1" not in u: u += ("&m=1" if "?" in u else "?m=1")
                    all_posts.append((t,u))
                    found+=1

        print(f"✅ +{found} 累计{len(all_posts)}")

        # 翻页：找Older Posts链接
        next_url = None
        for p in [r'class="blog-pager-older-link"[^>]*>.*?<a\s+href="([^"]+)"',
                  r'id="blog-pager-older-link"[^>]*>.*?<a\s+href="([^"]+)"',
                  r'"olderLink"[^>]*href="([^"]+)"',
                  r'class="pager-older-link"[^>]*href="([^"]+)"']:
            m = re.search(p, html, re.DOTALL)
            if m:
                u=m.group(1).strip()
                if "m=1" not in u: u+=("&m=1" if "?" in u else "?m=1")
                next_url = u
                break

        if not next_url:
            print("📄 已到尾页"); break
        pn+=1
        time.sleep(random.uniform(1.5,3))

    return all_posts

def extract_text(url):
    print(f"🔍 {url[:60]}...", end=" ")
    html=fetch(url,30)
    if not html: print("❌"); return "提取失败"
    for pat in [r'<div[^>]*class="[^"]*post-body[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
                r'<div[^>]*class="[^"]*post-body[^"]*"[^>]*>(.*?)</div>\s*</div>',
                r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
                r'<article[^>]*>(.*?)</article>']:
        m = re.search(pat, html, re.DOTALL)
        if m:
            t=clean(m.group(1))
            if len(re.findall(r'[\u4e00-\u9fff]',t))>50:
                print(f"✅ {len(t)}字"); return t
    print("❌"); return "正文提取失败"

def main():
    print("="*50)
    print("  中文成人文学网 下载器 v3.0")
    print("  来源: https://blog.xbookcn.net")
    print("  支持: iOS Python IDE")
    print("="*50)
    book = input("\n📖 书名: ").strip()
    if not book: print("❌ 不能为空"); return

    print(f"\n📚 扫描归档(请稍候)...")
    all_posts = get_all_posts()
    
    matched = [(t,u) for t,u in all_posts if book.lower() in t.lower()]
    if not matched:
        print(f"\n❌ '{book}' 未找到(共扫描{len(all_posts)}篇)")
        return

    print(f"\n📊 找到{len(matched)}篇")
    fp = os.path.join(os.path.expanduser("~/Documents"),
                      re.sub(r'[\\/:*?"<>|]','',book).strip()+".txt")
    ok=0
    with open(fp,"w",encoding="utf-8") as f:
        for i,(t,u) in enumerate(matched,1):
            print(f"📖 [{i}/{len(matched)}] {t[:35]}...")
            c = extract_text(u)
            if not c.startswith("正文提取失败") and len(c)>100:
                f.write(f"\n\n=== {t} ===\n\n{c}\n"); ok+=1
            time.sleep(random.uniform(1,2))
    print(f"\n🎉 完成: {ok}/{len(matched)}篇\n📁 {fp}")

if __name__=="__main__":
    main()
