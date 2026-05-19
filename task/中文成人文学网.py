# https://blog.xbookcn.net — HAR抓包重构版

import requests
from bs4 import BeautifulSoup
import re
import time
import os
import random
import unicodedata

# ─── 配置 ─────────────────────────────────────────────
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Referer": "https://blog.xbookcn.net/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive"
}

session = requests.Session()
session.headers.update(headers)


def safe_filename(name, ext=".txt"):
    name = unicodedata.normalize("NFKD", name)
    name = re.sub(r'[\\/:*?"<>|]', "", name)
    name = name.strip().replace(" ", "_")
    return name + ext if name else "novel" + ext


def fetch_with_retry(url, max_retries=3):
    for attempt in range(max_retries):
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding
            return resp
        except requests.RequestException as e:
            print(f"  ⚠️ 重试 {attempt+1}/{max_retries}: {e}")
            if attempt < max_retries - 1:
                time.sleep(random.uniform(3, 5))
    return None


def get_search_url(bookname):
    """构造搜索URL（标签搜索），使用移动版"""
    encoded = re.sub(r"\s+", "+", bookname.strip())
    return f"https://blog.xbookcn.net/search/label/{encoded}?max-results=500&m=1"


def get_next_page_url(soup):
    """提取下一页URL（Blogger翻页）"""
    older = soup.select_one("#blog-pager-older-link a")
    return older["href"] if older else None


def get_post_links(base_url, bookname, max_pages=100):
    """抓取标签页中与书名相关的文章链接，支持多页翻页"""
    links = []
    next_page = base_url
    page_count = 0

    while next_page and page_count < max_pages:
        print(f"📄 目录页: {next_page[:90]}")
        try:
            resp = session.get(next_page, timeout=15)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding
            soup = BeautifulSoup(resp.text, "html.parser")

            for a in soup.select("h3.post-title a"):
                href = a.get("href", "").strip()
                title = a.get_text(strip=True)
                if href and title and len(title) < 50:
                    if bookname.lower() in title.lower():
                        # 保证有 ?m=1
                        if "m=1" not in href:
                            sep = "&" if "?" in href else "?"
                            href = f"{href}{sep}m=1"
                        links.append((title, href))

            next_page = get_next_page_url(soup)
            page_count += 1
            time.sleep(random.uniform(1.5, 3))
        except requests.RequestException as e:
            print(f"❌ 请求失败: {e}")
            break

    print(f"✅ 共获取到与 '{bookname}' 相关的 {len(links)} 篇文章")
    return links


def extract_text(url):
    """提取文章正文"""
    print(f"🔍 提取: {url[:80]}")
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        resp.encoding = resp.apparent_encoding
        soup = BeautifulSoup(resp.text, "html.parser")

        # 正文容器
        content_div = soup.select_one("div.post-body.entry-content")
        if not content_div:
            content_div = soup.find("div", class_=re.compile(r"post-body|content|entry"))
        if not content_div:
            candidates = soup.find_all(["div", "article", "section"])
            content_div = max(
                (t for t in candidates if t.get_text()),
                key=lambda x: len(re.findall(r"[\u4e00-\u9fff]", x.get_text())),
                default=None
            )

        if not content_div:
            return "正文提取失败"

        # 清理导航、链接
        for tag in content_div.find_all(["a", "nav"]):
            tag.decompose()

        text = content_div.get_text(" ", strip=True)
        text = re.sub(r"上一页|下一页|主页|分类|全部小说|列表|\w+小说", "", text)
        text = re.sub(r"\s+", " ", text).strip()

        if not text or len(re.findall(r"[\u4e00-\u9fff]", text)) < 10:
            return "正文提取失败"

        return text
    except requests.RequestException as e:
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
        print(f"❌ 没有找到与 '{bookname}' 相关的文章链接")
        return

    with open(filepath, "w", encoding="utf-8") as f:
        for i, (title, link) in enumerate(posts, 1):
            print(f"📖 下载 {i}/{len(posts)}: {title}")
            try:
                content = extract_text(link)
                if "提取失败" not in content:
                    f.write(f"\n\n=== 第{i}章 {title} ===\n\n")
                    f.write(content + "\n")
                else:
                    print(f"⚠️ 跳过: {title}")
            except Exception as e:
                print(f"❌ 失败: {title}, {e}")
            time.sleep(random.uniform(1, 2))

    print(f"\n🎉 '{bookname}' 下载完成，保存: {filepath}")


if __name__ == "__main__":
    bookname = input("请输入要下载的书名（例如 '小村春色'）：")
    download_book(bookname)
