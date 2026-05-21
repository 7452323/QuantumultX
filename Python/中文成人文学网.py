# https://book.xbookcn.net — 中文成人文学网 下载器 v3.0

import requests, re, time, os, random, unicodedata, html, ssl
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
from requests.adapters import HTTPAdapter
from bs4 import BeautifulSoup

# ── 自定义SSL适配（兼容Cloudflare TLS拦截）──
class CustomAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        try:
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            kwargs['ssl_context'] = ctx
        except:
            pass
        return super().init_poolmanager(*args, **kwargs)

s = requests.Session()
s.mount('https://', CustomAdapter())

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",
    "Referer": "https://book.xbookcn.net/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8",
}


def fetch(url, to=10):
    """带重试+SSL兼容的请求"""
    for a in range(3):
        try:
            r = s.get(url, headers=headers, timeout=to, verify=False)
            if r.status_code == 200:
                r.encoding = r.apparent_encoding
                return r.text
            print(f"  ⚠️ HTTP {r.status_code}")
        except Exception as e:
            print(f"  ⚠️ {a+1}/3: {str(e)[:60]}")
            if a < 2:
                time.sleep(random.uniform(2, 4))
    return None


def safe_filename(name, ext=".txt"):
    name = unicodedata.normalize("NFKD", name)
    name = re.sub(r"[^\w\s-]", "", name).strip().replace(" ", "_")
    return name + ext if name else "novel" + ext


def get_post_links(bookname, max_pages=100):
    """搜索并获取相关文章的链接"""
    links = []
    encoded = re.sub(r"\s+", "+", bookname.strip())
    base = "https://book.xbookcn.net"
    next_url = f"{base}/search/label/{encoded}?max-results=500"
    page = 0

    while next_url and page < max_pages:
        print(f"📄 目录页: {next_url[:80]}")
        html = fetch(next_url)
        if not html:
            # fallback: 尝试blog.域名
            if "blog.xbookcn.net" not in next_url and "book.xbookcn.net" in next_url:
                fallback = next_url.replace("book.xbookcn.net", "blog.xbookcn.net")
                print(f"  ⚠️ 尝试备用域名...")
                html = fetch(fallback)
            if not html:
                print("  ❌ 获取失败")
                break

        soup = BeautifulSoup(html, "html.parser")
        found = 0
        for a in soup.find_all("a", href=True):
            href, title = a["href"], a.get_text(strip=True)
            # 只取真实文章URL(/20xx/xx/blog-post格式)，排除搜索标签和分类
            if not href or not title or len(title) < 5 or len(title) > 50:
                continue
            if "/search/label/" in href or "/2000/01/" in href:
                continue  # 跳过搜索页、分类页
            if bookname.lower() in title.lower():
                links.append((title, href))
                found += 1

        print(f"  ✅ 找到 {found} 篇, 累计 {len(links)}")

        next_btn = soup.find("a", attrs={"rel": "next"})
        next_url = next_btn["href"] if next_btn else None
        page += 1
        time.sleep(random.uniform(1, 3))

    print(f"📊 共 {len(links)} 篇")
    return links


def extract_text(url):
    """提取文章正文，关键修复: html.unescape解码实体"""
    print(f"🔍 {url[:70]}...")
    html_content = fetch(url)
    if not html_content:
        return "提取失败"

    soup = BeautifulSoup(html_content, "html.parser")
    content_div = soup.find("div", class_=re.compile(r"post-body"))

    if content_div:
        for tag in content_div.find_all(["a", "nav"]):
            tag.decompose()
        # ⭐ 关键: html.unescape 解码 &#xxxx; 实体
        raw = html.unescape(str(content_div))
        text = re.sub(r'<[^>]+>', '', raw)
        text = re.sub(r'\s+', ' ', text).strip()
        cn = len(re.findall(r'[\u4e00-\u9fff]', text))
        print(f"  ✅ {cn} 字")
        if cn > 10:
            return text

    # ⭐ 备用: 找中文最多的块（也解码实体）
    candidates = []
    for tag in soup.find_all(["div", "article", "section"]):
        raw = html.unescape(str(tag))
        raw = re.sub(r'<[^>]+>', '', raw)
        cn = len(re.findall(r'[\u4e00-\u9fff]', raw))
        if cn > 50:
            candidates.append((cn, raw))
    if candidates:
        candidates.sort(reverse=True)
        print(f"  ⚠️ 备用: {candidates[0][0]} 字")
        return candidates[0][1]

    print("  ❌ 未找到正文")
    return "正文提取失败"


def download_book(bookname):
    safe_name = safe_filename(bookname)
    save_dir = os.path.expanduser("~/Documents")
    os.makedirs(save_dir, exist_ok=True)
    filepath = os.path.join(save_dir, safe_name)

    posts = get_post_links(bookname)
    if not posts:
        print(f"❌ 未找到 '{bookname}'")
        return

    ok = 0
    with open(filepath, "w", encoding="utf-8") as f:
        for i, (title, link) in enumerate(posts, 1):
            print(f"📖 [{i}/{len(posts)}] {title[:35]}...")
            content = extract_text(link)
            if "提取失败" not in content and len(re.findall(r'[\u4e00-\u9fff]', content)) > 10:
                f.write(f"\n\n=== {title} ===\n\n{content}\n")
                ok += 1
                print(f"  ✅ 已保存")
            else:
                print(f"  ⚠️ 跳过")
            time.sleep(random.uniform(1, 2))

    print(f"\n🎉 {ok}/{len(posts)} 篇\n📁 {filepath}")


if __name__ == "__main__":
    book = input("请输入书名: ").strip()
    if book:
        download_book(book)
    else:
        print("❌ 不能为空")
