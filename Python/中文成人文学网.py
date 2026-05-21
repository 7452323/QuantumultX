# https://blog.xbookcn.net 

# v2.0 — 网站已启用Cloudflare，通过Web Archive获取
# 适用于 iOS Python IDE

import urllib.request
import re, time, os, random, json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

def fetch(url, timeout=25):
    for a in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            return urllib.request.urlopen(req, timeout=timeout).read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  ⚠️ {a+1}/3: {str(e)[:50]}")
            if a < 2: time.sleep(random.uniform(2, 4))
    return None

def clean(text):
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<p[^>]*>', '\n', text)
    text = re.sub(r'</?p>', '', text)
    text = re.sub(r'<div[^>]*>', '\n', text); text = re.sub(r'</div>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    for a,b in [('&nbsp;',' '),('&lt;','<'),('&gt;','>'),('&amp;','&')]: text=text.replace(a,b)
    text = re.sub(r'&[a-z]+;', '', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

def get_all_posts(max_pages=200):
    all_posts, seen, base = [], set(), "https://web.archive.org/web/2025/https://blog.xbookcn.net"
    next_url, pn = base, 0
    while next_url and pn < max_pages:
        print(f"📄 第{pn+1}页...", end=" ")
        html = fetch(next_url, timeout=30)
        if not html: print("❌"); break
        found = 0
        for m in re.finditer(r'<h3[^>]*class="[^"]*post-title[^"]*"[^>]*>.*?<a\s+href="([^"]+)"[^>]*>([^<]+)</a>', html, re.DOTALL):
            t=m.group(2).strip()
            if t not in seen: seen.add(t); all_posts.append((t,m.group(1).strip())); found+=1
        print(f"✅ +{found} 累计{len(all_posts)}")
        next_url = None
        for p in [r'class="blog-pager-older-link"[^>]*>.*?<a\s+href="([^"]+)"', r'id="blog-pager-older-link"[^>]*>.*?<a\s+href="([^"]+)"']:
            m=re.search(p, html, re.DOTALL)
            if m: next_url=m.group(1).strip(); break
        if not next_url: print("📄 已到尾页"); break
        pn+=1; time.sleep(random.uniform(1.5,3))
    return all_posts

def extract_text(url):
    print(f"🔍 {url[:60]}...", end=" ")
    html = fetch(url, timeout=30)
    if not html: print("❌"); return "提取失败"
    for pat in [r'<div[^>]*class="[^"]*post-body[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>', r'<div[^>]*class="[^"]*post-body[^"]*"[^>]*>(.*?)</div>\s*</div>', r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>', r'<article[^>]*>(.*?)</article>']:
        m=re.search(pat, html, re.DOTALL)
        if m:
            t=clean(m.group(1))
            if len(re.findall(r'[\u4e00-\u9fff]',t))>50: print(f"✅ {len(t)}字"); return t
    print("❌ 提取失败"); return "正文提取失败"

def main():
    print("="*50)
    print("  中文成人文学网 下载器 v2.0")
    print("  https://blog.xbookcn.net")
    print("  ⚠️ Cloudflare防护,通过Web Archive获取")
    print("="*50)
    bookname = input("\n📖 书名: ").strip()
    if not bookname: print("❌ 书名不能为空"); return
    print(f"\n📚 扫描归档(稍等)...")
    all_posts = get_all_posts()
    matched = [(t,u) for t,u in all_posts if bookname.lower() in t.lower()]
    if not matched:
        print(f"\n❌ '{bookname}' 未找到(扫描{len(all_posts)}篇)")
        return
    print(f"\n📊 找到{len(matched)}篇")
    fp = os.path.join(os.path.expanduser("~/Documents"), re.sub(r'[\\/:*?"<>|]','',bookname).strip()+".txt")
    ok=0
    with open(fp,"w",encoding="utf-8") as f:
        for i,(t,u) in enumerate(matched,1):
            print(f"📖 [{i}/{len(matched)}] {t[:35]}...")
            c=extract_text(u)
            if not c.startswith("正文提取失败") and len(c)>100:
                f.write(f"\n\n=== {t} ===\n\n{c}\n"); ok+=1
            time.sleep(random.uniform(1,2))
    print(f"\n🎉 完成: {ok}/{len(matched)}篇\n📁 {fp}")

if __name__ == "__main__":
    main()
