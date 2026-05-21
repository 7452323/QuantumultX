# https://book.xbookcn.net — 中文成人文学网 下载器 v3.0
# 自动遍历标签页子文章 + SSL兼容 + 实体解码

import requests, re, time, os, random, unicodedata, html, ssl
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from requests.adapters import HTTPAdapter
from bs4 import BeautifulSoup

class CusAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        try:
            ctx=ssl.create_default_context(); ctx.check_hostname=False; ctx.verify_mode=ssl.CERT_NONE
            kwargs['ssl_context']=ctx
        except: pass
        return super().init_poolmanager(*args,**kwargs)

s=requests.Session(); s.mount('https://',CusAdapter())
H={"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",
   "Referer":"https://book.xbookcn.net/","Accept":"text/html,*/*;q=0.8","Accept-Language":"en-US,en;q=0.9,zh-CN;q=0.8"}

def fetch(url,to=10):
    for a in range(3):
        try:
            r=s.get(url,headers=H,timeout=to,verify=False)
            if r.status_code==200: r.encoding=r.apparent_encoding; return r.text
        except Exception as e:
            print(f"  ⚠️ {a+1}/3: {str(e)[:55]}")
            if a<2: time.sleep(random.uniform(2,4))
    return None

def safe_fn(name,ext=".txt"):
    name=unicodedata.normalize("NFKD",name); name=re.sub(r"[^\w\s-]","",name).strip().replace(" ","_")
    return name+ext if name else "novel"+ext

def get_articles(label_url, depth=0):
    """递归从标签页提取所有真实文章链接"""
    if depth > 3: return []
    articles=[]
    for domain in ["book.xbookcn.net","blog.xbookcn.net"]:
        url=label_url.replace("book.xbookcn.net",domain)
        if depth == 0: print(f"📄 标签页: {url[:80]}...")
        html=fetch(url)
        if not html: continue
        soup=BeautifulSoup(html,"html.parser")
        sub_labels=[]
        for a in soup.find_all("a",href=True):
            h=a["href"]; t=a.get_text(strip=True)
            if not h or not t or len(t)<5 or len(t)>50: continue
            # 如果是子标签页，递归
            if "/search/label/" in h:
                if t not in [s[1] for s in sub_labels]:
                    sub_labels.append((t,h))
                continue
            # 真实文章URL
            if "xbookcn.net/20" in h or re.search(r'/20[0-9][0-9]/[0-9][0-9]/',h):
                if (t,h) not in articles:
                    articles.append((t,h))
        # 递归采集子标签
        if sub_labels:
            seen_labels=set()
            for st,su in sub_labels:
                if st in seen_labels: continue
                seen_labels.add(st)
                print(f"  📂 子标签: {st[:30]}...")
                subs=get_articles(su, depth+1)
                for item in subs:
                    if item not in articles:
                        articles.append(item)
        if articles: break
    if depth==0: print(f"  📊 共 {len(articles)} 篇文章")
    return articles

def extract_text(url):
    """提取文章正文"""
    print(f"🔍 {url[:70]}...")
    html=fetch(url)
    if not html: return "提取失败"
    soup=BeautifulSoup(html,"html.parser")
    div=soup.find("div",class_=re.compile(r"post-body"))
    if div:
        for t in div.find_all(["a","nav"]): t.decompose()
        raw=html.unescape(str(div)); text=re.sub(r'<[^>]+>','',raw)
        text=re.sub(r'\s+',' ',text).strip()
        cn=len(re.findall(r'[\u4e00-\u9fff]',text))
        if cn>10: print(f"  ✅ {cn}字"); return text
    candidates=[]
    for tag in soup.find_all(["div","article","section"]):
        raw=html.unescape(str(tag)); raw=re.sub(r'<[^>]+>','',raw)
        cn=len(re.findall(r'[\u4e00-\u9fff]',raw))
        if cn>50: candidates.append((cn,raw))
    if candidates:
        candidates.sort(reverse=True)
        print(f"  ⚠️ 备用 {candidates[0][0]}字")
        return candidates[0][1]
    print("  ❌"); return "正文提取失败"

def main():
    print("="*50)
    print("  中文成人文学网 下载器 v3.0")
    print("="*50)
    book=input("\n📖 书名: ").strip()
    if not book: print("❌ 不能为空"); return

    encoded=re.sub(r"\s+","+",book)
    label_url=f"https://book.xbookcn.net/search/label/{encoded}?max-results=500"

    articles=get_articles(label_url)
    if not articles:
        print(f"❌ '{book}' 未找到")
        return

    fp=os.path.join(os.path.expanduser("~/Documents"),safe_fn(book))
    ok=0
    with open(fp,"w",encoding="utf-8") as f:
        for i,(t,u) in enumerate(articles,1):
            print(f"📖 [{i}/{len(articles)}] {t[:35]}...")
            c=extract_text(u)
            if "提取失败" not in c and len(re.findall(r'[\u4e00-\u9fff]',c))>10:
                f.write(f"\n\n=== {t} ===\n\n{c}\n"); ok+=1
                print(f"  ✅")
            else: print(f"  ⚠️")
            time.sleep(random.uniform(1,2))
    print(f"\n🎉 {ok}/{len(articles)}篇\n📁 {fp}")

if __name__=="__main__":
    main()
