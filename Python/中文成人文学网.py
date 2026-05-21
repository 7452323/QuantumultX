# https://blog.xbookcn.net 

# v2.0 — 修复：网站已启用Cloudflare防护，通过Web Archive绕过

import urllib.request
import urllib.parse
import urllib.error
import re
import time
import os
import random
import unicodedata
import json

# ── 配置 ──────────────────────────────────────────────
SOURCE_NAME = "中文成人文学网"
SOURCE_URL = "https://blog.xbookcn.net"
ARCHIVE_BASE = "https://web.archive.org/web"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
}


def fetch(url, timeout=20):
    """获取网页内容，失败时重试"""
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            resp = urllib.request.urlopen(req, timeout=timeout)
            return resp.read().decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  ⚠️ 重试 {attempt+1}/3: {str(e)[:60]}")
            if attempt < 2:
                time.sleep(random.uniform(2, 4))
    return None


# ── 工具函数 ──────────────────────────────────────────────

def safe_filename(name, ext=".txt"):
    name = unicodedata.normalize("NFKD", name)
    name = re.sub(r'[\\/:*?"<>|]', "", name)
    return name.strip().replace(" ", "_") + ext


def clean_html(text):
    """去除HTML标签，保留纯文本"""
    text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
    text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<p[^>]*>', '\n', text)
    text = re.sub(r'</p>', '', text)
    text = re.sub(r'<div[^>]*>', '\n', text)
    text = re.sub(r'</div>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def archive_url(path):
    """通过 Web Archive 获取原始路径，绕过 Cloudflare"""
    return f"{ARCHIVE_BASE}/2025/https://blog.xbookcn.net{path}"


def get_latest_snapshot():
    """获取最近的快照时间戳"""
    url = "https://web.archive.org/cdx/search/cdx?url=blog.xbookcn.net&output=json&limit=1&fl=timestamp,original&sort=reverse"
    try:
        data = json.loads(fetch(url) or "[]")
        if len(data) > 1:
            ts = data[1][0]
            print(f"📅 使用 Wayback Machine 快照: {ts[:4]}-{ts[4:6]}-{ts[6:8]}")
            return ts
    except:
        pass
    return "2025"


# ── 核心功能 ──────────────────────────────────────────────

def get_search_url(bookname):
    """构造 Blogger 标签搜索 URL"""
    encoded = urllib.parse.quote(bookname.strip())
    return f"https://blog.xbookcn.net/search/label/{encoded}?max-results=500&m=1"


def get_post_links(bookname, max_pages=100):
    """获取所有相关文章的标题和链接（通过 Web Archive）"""
    all_links = []
    seen_urls = set()
    search_path = "/" + "/".join(get_search_url(bookname).split("/")[3:])
    next_url = archive_url(search_path)
    page_count = 0

    while next_url and page_count < max_pages:
        print(f"📄 目录页 [{page_count+1}]: 获取中...")
        html = fetch(next_url, timeout=30)
        if not html:
            print("  ❌ 获取失败，终止")
            break

        # 提取文章链接（多种模式兼容）
        patterns = [
            # Blogger 标准格式
            (r'<h3[^>]*class="[^"]*post-title[^"]*"[^>]*>.*?<a\s+href="([^"]+)"[^>]*>([^<]+)</a>', re.DOTALL),
            # 简化标题格式
            (r'<a\s+href="(https?://blog\.xbookcn\.net/\d{4}/\d{2}/[^"]+)"[^>]*>([^<]+)</a>', 0),
            # 通用文章链接
            (r'<a\s+href="(/202[0-9]/[^"]+)"[^>]*>([^<]+)</a>', 0),
        ]

        found = 0
        for pat, flags in patterns:
            for href, title in re.findall(pat, html, flags):
                title = title.strip()
                if not title or len(title) < 2:
                    continue
                # 统一转换为相对路径
                orig = href
                if href.startswith("http"):
                    href = "/" + "/".join(href.split("/")[3:])
                # 去重
                if href in seen_urls:
                    continue
                seen_urls.add(href)
                all_links.append((title, href))
                found += 1

        if found == 0:
            print(f"  ⚠️ 本页未找到新文章，可能已到尾页")
            break

        print(f"  ✅ 找到 {found} 篇，累计 {len(all_links)} 篇")
        
        # 翻页
        next_url = None
        for pat in [
            r'class="blog-pager-older-link"[^>]*href="([^"]+)"',
            r'id="blog-pager-older-link"[^>]*>.*?<a\s+href="([^"]+)"',
            r'rel="next"\s+href="([^"]+)"',
        ]:
            m = re.search(pat, html, re.DOTALL)
            if m:
                href = m.group(1)
                if href.startswith("http"):
                    href = "/" + "/".join(href.split("/")[3:])
                next_url = archive_url(href)
                break

        page_count += 1
        time.sleep(random.uniform(1, 2))

    print(f"\n📊 共找到 '{bookname}' 相关文章 {len(all_links)} 篇")
    return all_links


def extract_text(rel_path):
    """提取单篇文章正文（通过 Web Archive）"""
    url = archive_url(rel_path)
    print(f"🔍 提取: {rel_path}")
    html = fetch(url, timeout=30)
    if not html:
        return "提取失败"

    # 提取标题
    m = re.search(r'<title>([^<]+)', html)
    if m:
        print(f"  标题: {m.group(1).strip()[:50]}")

    # 提取正文
    text = None
    patterns = [
        r'<div[^>]*class="[^"]*post-body[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
        r'<div[^>]*class="[^"]*post-body[^"]*"[^>]*>(.*?)</div>\s*</div>',
        r'<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>(.*?)</div>\s*</div>',
        r'<article[^>]*>(.*?)</article>',
    ]
    for pat in patterns:
        m = re.search(pat, html, re.DOTALL)
        if m:
            t = clean_html(m.group(1))
            if len(re.findall(r'[\u4e00-\u9fff]', t)) > 50:
                text = t
                break

    if not text:
        return "正文提取失败"

    return text


def download_book(bookname):
    """主下载流程"""
    safe_name = safe_filename(bookname)
    save_dir = os.path.expanduser("~/Documents")
    if not os.path.exists(save_dir):
        os.makedirs(save_dir)
    filepath = os.path.join(save_dir, safe_name)

    print(f"📚 开始搜索: '{bookname}'")
    print(f"🔗 通过 Web Archive 获取（网站已启用 Cloudflare 防护）")
    print()

    posts = get_post_links(bookname)
    if not posts:
        print(f"❌ 没有找到与 '{bookname}' 相关的文章")
        return

    success = 0
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"# {bookname}\n# 来源: {SOURCE_URL}\n# 下载日期: {time.strftime('%Y-%m-%d %H:%M')}\n# 数据来源: Web Archive\n\n")
        for i, (title, path) in enumerate(posts, 1):
            print(f"📖 [{i}/{len(posts)}] {title[:40]}...")
            content = extract_text(path)
            if "提取失败" not in content and len(content) > 100:
                f.write(f"\n\n=== 第{i}章 {title} ===\n\n{content}\n")
                success += 1
                print(f"  ✅ 已保存 ({len(content)} 字符)")
            else:
                print(f"  ⚠️ 跳过: {content if '提取失败' not in content else '内容过少'}")
            time.sleep(random.uniform(1, 2))

    print(f"\n{'='*50}")
    print(f"📊 统计:")
    print(f"  找到文章: {len(posts)} 篇")
    print(f"  成功下载: {success} 篇")
    print(f"📁 保存路径: {filepath}")
    print(f"{'='*50}")


if __name__ == "__main__":
    print("=" * 50)
    print(f"  {SOURCE_NAME} 下载器 v2.0")
    print(f"  来源: {SOURCE_URL}")
    print(f"  支持: iOS Python IDE / macOS / Linux")
    print("=" * 50)
    print()
    bookname = input("请输入要下载的书名（例如 '小村春色'）：").strip()
    if bookname:
        print()
        download_book(bookname)
    else:
        print("❌ 书名不能为空")
