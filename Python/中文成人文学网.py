# https://blog.xbookcn.net — 中文成人文学网 下载器 v3.0
# Cloudflare防护 → 通过Web Archive获取
# 适用: iOS Python IDE

import urllib.request, re, time, os, random

H = {"User-Agent":"Mozilla/5.0 (iPhone; CPU iPhone OS 18_0) AppleWebKit/605.1.15"}
A = "https://web.archive.org/web/2025/https://blog.xbookcn.net"

def fetch(url, to=30):
    for a in range(3):
        try:
            r=urllib.request.Request(url,headers=H)
            return urllib.request.urlopen(r,timeout=to).read().decode("utf-8","replace")
        except Exception as e:
            print(f"  ⚠️ {a+1}/3: {str(e)[:50]}")
            if a<2: time.sleep(3)
    return None

def clean(t):
    for p,s in [(r'<script[^>]*>.*?</script>',''),(r'<style[^>]*>.*?</style>',''),
                (r'<br\s*/?>','\n'),(r'<p[^>]*>','\n'),(r'</?p>',''),
                (r'<div[^>]*>','\n'),(r'</div>',''),(r'<[^>]+>','')]:
        t=re.sub(p,s,t,flags=re.DOTALL)
    for a,b in [('&nbsp;',' '),('&lt;','<'),('&gt;','>'),('&amp;','&')]: t=t.replace(a,b)
    t=re.sub(r'&[a-z]+;','',t); t=re.sub(r'\n{3,}','\n\n',t)
    return t.strip()

def get_all(max_pg=500):
    all_posts, seen = [], set()
    next_url, pn = A + "/?m=1&max-results=100", 0

    while next_url and pn < max_pg:
        print(f"📄 第{pn+1}页...", end=" ")
        html = fetch(next_url, 30)
        if not html: print("❌"); break

        found=0
        for m in re.finditer(r'<h3[^>]*class="post-title[^"]*"[^>]*>(.*?)</h3>', html, re.DOTALL):
            block=m.group(1)
            hm=re.search(r'href="([^"]+)"[^>]*>\s*([^<]+)\s*<', block)
            if hm:
                u=hm.group(1).strip(); t=hm.group(2).strip()
                # 跳过目录页链接
                if '/2000/01/' in u: continue
                if t in seen: continue
                seen.add(t)
                if not u.startswith('http'): u = "https://web.archive.org" + u
                all_posts.append((t,u)); found+=1

        print(f"✅ +{found} 累计{len(all_posts)}")

        next_url=None
        for p in [r'blog-pager-older-link[^>]*>.*?href="([^"]+)"',
                  r'id="blog-pager-older-link"[^>]*>.*?href="([^"]+)"']:
            m=re.search(p, html, re.DOTALL)
            if m:
                u=m.group(1).strip()
                if not u.startswith('http'): u="https://web.archive.org"+u
                if not u.startswith('http'): u=A[:A.rfind('/')]+u
                next_url=u; break

        if not next_url: print("📄 已到尾页"); break
        pn+=1; time.sleep(random.uniform(2,4))
    return all_posts

def extract_text(url):
    print(f"🔍 {url[:65]}...", end=" ")
    html=fetch(url,30)
    if not html: print("❌"); return "提取失败"
    for pat in [r'<div[^>]*class="[^"]*post-body[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
                r'<div[^>]*class="[^"]*post-body[^"]*"[^>]*>(.*?)</div>\s*</div>',
                r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>']:
        m=re.search(pat, html, re.DOTALL)
        if m:
            t=clean(m.group(1))
            if len(re.findall(r'[\u4e00-\u9fff]',t))>50: print(f"✅ {len(t)}字"); return t
    print("❌"); return "正文提取失败"

def main():
    print("="*50)
    print("  中文成人文学网 下载器 v3.0")
    print("  来源: https://blog.xbookcn.net")
    print("  ⚠️ Cloudflare防护 → Web Archive")
    print("="*50)
    book=input("\n📖 书名: ").strip()
    if not book: print("❌ 不能为空"); return
    
    print(f"\n📚 扫描归档(稍候,每页~100篇)...")
    all_posts=get_all()
    
    matched=[(t,u) for t,u in all_posts if book.lower() in t.lower()]
    if not matched:
        print(f"\n❌ '{book}' 未找到(共扫描{len(all_posts)}篇)")
        return
    
    print(f"\n📊 找到{len(matched)}篇")
    fp=os.path.join(os.path.expanduser("~/Documents"), re.sub(r'[\\/:*?"<>|]','',book).strip()+".txt")
    ok=0
    with open(fp,"w",encoding="utf-8") as f:
        for i,(t,u) in enumerate(matched,1):
            print(f"📖 [{i}/{len(matched)}] {t[:35]}...")
            c=extract_text(u)
            if not c.startswith("正文提取失败") and len(c)>100:
                f.write(f"\n\n=== {t} ===\n\n{c}\n"); ok+=1
            time.sleep(random.uniform(1,2))
    print(f"\n🎉 {ok}/{len(matched)}篇\n📁 {fp}")

if __name__=="__main__":
    main()
