# https://book.xbookcn.net — 中文成人文学网 下载器 v3.0
# 适用: iOS Python IDE
# 基于原版脚本+抓包数据修复

import requests
from bs4 import BeautifulSoup
import re
import time
import os
import random
import unicodedata
import html

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Referer": "https://book.xbookcn.net/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
    "Connection": "keep-alive"
}

# 备用domain（如果book被墙）
DOMAINS = ["https://book.xbookcn.net", "https://blog.xbookcn.net"]

def safe_filename(name, ext=".txt"):
    name = unicodedata.normalize("NFKD", name)
    name = re.sub(r"[^\w\s-]", "", name)
    name = name.strip().replace(" ", "_")
    return name + ext if name else "novel" + ext

def get_search_url(bookname):
    encoded = re.sub(r"\s+", "+", bookname.strip())
    return f"https://book.xbookcn.net/search/label/{encoded}?max-results=500"

def get_next_page_url(soup):
    next_btn = soup.find("a", attrs={"rel": "next"})
    return next_btn["href"] if next_btn else None

def get_post_links(base_url, bookname, max_pages=100):
    links = []
    next_page = base_url
    page_count = 0

    while next_page and page_count < max_pages:
        print(f"📄 目录页: {next_page}")
        try:
            resp = requests.get(next_page, headers=headers, timeout=10)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding
            soup = BeautifulSoup(resp.text, "html.parser")

            for a in soup.find_all("a", href=True):
                href = a["href"]
                title = a.get_text(strip=True)
                if href and title and "book.xbookcn.net" in href and len(title) < 50:
                    if bookname.lower() in title.lower():
                        links.append((title, href))

            next_page = get_next_page_url(soup)
            page_count += 1
            time.sleep(random.uniform(1, 3))
        except Exception as e:
            print(f"❌ 目录页失败: {e}")
            break

    print(f"✅ 共找到 {len(links)} 篇")
    return links

def extract_text(url):
    print(f"🔍 {url[:70]}...")
    try:
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        html_content = resp.text
        soup = BeautifulSoup(html_content, "html.parser")

        # 打印页面标题
        if soup.title:
            print(f"  标题: {soup.title.string[:50]}")

        # 查找post-body容器（兼容单/双引号）
        content_div = soup.find("div", class_=re.compile(r"post-body"))
        
        if content_div:
            # 移除无关标签
            for tag in content_div.find_all(["a", "nav"]):
                tag.decompose()
            # 获取原始HTML再解码实体
            raw = str(content_div)
            # ⭐ 关键修复：解码HTML实体（&#xxxx; → 实际字符）
            raw = html.unescape(raw)
            # 移除HTML标签
            text = re.sub(r'<[^>]+>', '', raw)
            text = re.sub(r'\s+', ' ', text).strip()
            # 清理导航文字
            text = re.sub(r"(上一页|下一页|主页|分类|全部小说|列表|\w+小说)", "", text)
            
            cn_chars = len(re.findall(r'[\u4e00-\u9fff]', text))
            print(f"  ✅ {cn_chars} 中文字符")
            
            if cn_chars > 10:
                return text

        # 备用逻辑
        candidates = soup.find_all(["div", "article", "section"])
        texts = []
        for tag in candidates:
            raw = html.unescape(str(tag))
            raw = re.sub(r'<[^>]+>', '', raw)
            cn = len(re.findall(r'[\u4e00-\u9fff]', raw))
            if cn > 50:
                texts.append((cn, raw))
        
        if texts:
            texts.sort(reverse=True)
            print(f"  ⚠️ 备用: {texts[0][0]} 中文字符")
            return texts[0][1]

        print("  ❌ 未找到正文")
        return "正文提取失败"
    except Exception as e:
        print(f"  ❌ 错误: {e}")
        return f"提取失败: {e}"

def download_book(bookname):
    safe_name = safe_filename(bookname)
    save_dir = os.path.expanduser("~/Documents")
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    filepath = os.path.join(save_dir, safe_name)

    toc_url = get_search_url(bookname)
    posts = get_post_links(toc_url, bookname)
    if not posts:
        print(f"❌ 没有找到相关文章")
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

    print(f"\n🎉 {ok}/{len(posts)}篇\n📁 {filepath}")

if __name__ == "__main__":
    bookname = input("请输入书名（如 少妇白洁）：").strip()
    if bookname:
        download_book(bookname)
    else:
        print("❌ 不能为空")
