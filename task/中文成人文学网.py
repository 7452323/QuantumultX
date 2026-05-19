# https://blog.xbookcn.net — 零依赖版（仅用Python标准库）
# 适用于 iOS Python IDE (https://apps.apple.com/cn/app/python-ide/id6753987304)

import urllib.request
import urllib.parse
import re
import time
import os
import random
import unicodedata


headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def fetch(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            resp = urllib.request.urlopen(req, timeout=15)
            return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  ⚠️ 重试 {attempt+1}/3: {e}")
            if attempt < 2:
                time.sleep(random.uniform(3, 5))
    return None


def safe_filename(name, ext=".txt"):
    name = unicodedata.normalize("NFKD", name)
    name = re.sub(r'[\\/:*?"<>|]', "", name)
    return name.strip().replace(" ", "_") + ext


def get_search_url(bookname):
    encoded = urllib.parse.quote(bookname.strip())
    return f"https://blog.xbookcn.net/search/label/{encoded}?max-results=500&m=1"


def get_next_page_url(html):
    m = re.search(r'id="blog-pager-older-link"[^>]*>\s*<a\s+href="([^"]+)"', html)
    return m.group(1) if m else None


def get_post_links(base_url, bookname, max_pages=100):
    links = []
    next_page = base_url
    page_count = 0

    while next_page and page_count < max_pages:
        print(f"📄 目录页: {next_page[:90]}")
        html = fetch(next_page)
        if not html:
            break

        # 提取所有帖子标题和链接
        pattern = r'<h3[^>]*class="[^"]*post-title[^"]*"[^>]*>.*?<a\s+href="([^"]+)"[^>]*>([^<]+)</a>'
        for href, title in re.findall(pattern, html, re.DOTALL):
            if bookname.lower() in title.lower():
                if "m=1" not in href:
                    href += "&m=1" if "?" in href else "?m=1"
                links.append((title.strip(), href))

        print(f"  累计找到 {len(links)} 篇")
        next_page = get_next_page_url(html)
        page_count += 1
        time.sleep(random.uniform(1, 3))

    print(f"✅ 共获取到与 '{bookname}' 相关的 {len(links)} 篇文章")
    return links


def extract_text(url):
    print(f"🔍 提取: {url[:80]}")
    html = fetch(url)
    if not html:
        return "提取失败"

    # 标题
    m = re.search(r'<title>([^<]+)', html)
    if m:
        print(f"  标题: {m.group(1)[:60]}")

    # 提取正文块
    m = re.search(r'<div[^>]*class="[^"]*post-body[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>', html, re.DOTALL)
    if not m:
        return "正文提取失败"

    text = m.group(1)
    # 清理HTML标签
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&amp;', '&', text)
    # 清理导航文字
    text = re.sub(r"上一页|下一页|主页|分类|全部小说|列表|\w+小说", "", text)
    text = re.sub(r"\s+", " ", text).strip()

    if len(re.findall(r'[\u4e00-\u9fff]', text)) < 10:
        return "正文提取失败"

    return text


def download_book(bookname):
    safe_name = safe_filename(bookname)
    save_dir = os.path.expanduser("~/Documents")
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    filepath = os.path.join(save_dir, safe_name)

    posts = get_post_links(get_search_url(bookname), bookname)
    if not posts:
        print(f"❌ 没有找到与 '{bookname}' 相关的文章链接")
        return

    with open(filepath, "w", encoding="utf-8") as f:
        for i, (title, link) in enumerate(posts, 1):
            print(f"📖 下载 {i}/{len(posts)}: {title}")
            content = extract_text(link)
            if "提取失败" not in content:
                f.write(f"\n\n=== 第{i}章 {title} ===\n\n{content}\n")
            else:
                print(f"⚠️ 跳过: {title}")
            time.sleep(random.uniform(1, 2))

    print(f"\n🎉 '{bookname}' 下载完成，保存: {filepath}")


if __name__ == "__main__":
    bookname = input("请输入要下载的书名（例如 '小村春色'）：")
    download_book(bookname)
