# https://blog.xbookcn.net — 基于HAR抓包重构版
# 逻辑：搜索标签 -> 获取帖子列表 -> 逐篇提取正文 -> 保存为TXT

import requests
from bs4 import BeautifulSoup
import re
import time
import os
import random
import unicodedata
from datetime import datetime

# ─── 配置 ─────────────────────────────────────────────
DOMAIN = "blog.xbookcn.net"
BASE_URL = f"https://{DOMAIN}"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Referer": f"{BASE_URL}/",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Connection": "keep-alive"
}

session = requests.Session()
session.headers.update(headers)

# 所有分类
CATEGORIES = {
    "精选作品": "精选作品",
    "现代情色": "现代情色",
    "日本情色": "日本情色",
    "西洋情色": "西洋情色",
    "伴侣交换": "伴侣交换",
    "武侠情色": "武侠情色",
    "奇幻科幻": "奇幻科幻",
    "家庭乱伦": "家庭乱伦",
    "性爱调教": "性爱调教",
    "粗野性交": "粗野性交",
    "多人群交": "多人群交",
    "教师学生": "教师学生",
    "古典情色": "古典情色",
    "历史情色": "历史情色",
    "同性情色": "同性情色",
}


# ─── 工具函数 ─────────────────────────────────────────

def safe_filename(name, ext=".txt"):
    """生成安全文件名"""
    name = unicodedata.normalize("NFKD", name)
    name = re.sub(r'[\\/:*?"<>|]', "", name)
    name = name.strip().replace(" ", "_")
    return name + ext if name else "novel" + ext


def build_url(path="", params=None):
    """构造带 ?m=1 的URL"""
    if path.startswith("http"):
        url = path
    else:
        url = f"{BASE_URL}{path}"
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}{qs}"
    if "m=1" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}m=1"
    return url


def fetch(url, max_retries=3):
    """带重试的请求，处理 Cloudflare 和 302 跳转"""
    for attempt in range(max_retries):
        try:
            resp = session.get(url, timeout=15)
            resp.raise_for_status()
            resp.encoding = resp.apparent_encoding
            return resp
        except requests.RequestException as e:
            print(f"  ⚠️ 请求失败 (尝试 {attempt+1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                time.sleep(random.uniform(3, 5))
    return None


def extract_chinese(text):
    """统计中文字符数"""
    return len(re.findall(r'[\u4e00-\u9fff]', text))


# ─── 核心功能 ─────────────────────────────────────────

def get_post_links_by_label(label, max_pages=50):
    """
    通过标签搜索获取所有相关帖子链接
    支持自动翻页（使用 updated-max 分页）
    """
    links = []
    seen_urls = set()

    # 首次请求不带 updated-max
    next_params = {"max-results": "100"}
    page_count = 0

    while next_params and page_count < max_pages:
        url = build_url(f"/search/label/{label}", next_params)
        print(f"📄 目录页 {page_count+1}: {url[:90]}")

        resp = fetch(url)
        if not resp:
            break

        soup = BeautifulSoup(resp.text, "html.parser")

        # 提取本页所有帖子链接（含标题）
        found = 0
        for post in soup.select("h3.post-title a"):
            href = post.get("href", "").strip()
            title = post.get_text(strip=True)
            if href and title:
                # 规范化URL：保证有 ?m=1
                if "m=1" not in href:
                    sep = "&" if "?" in href else "?"
                    href = f"{href}{sep}m=1"
                if href not in seen_urls:
                    seen_urls.add(href)
                    links.append((title, href))
                    found += 1

        print(f"  本页找到 {found} 篇，累计 {len(links)} 篇")

        # 找翻页链接（Blogger 用 id=blog-pager-older-link）
        older = soup.select_one("#blog-pager-older-link a")
        if older and older.get("href"):
            next_url = older["href"]
            # 从URL中提取 updated-max 参数
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(next_url)
            qs = parse_qs(parsed.query)
            if "updated-max" in qs:
                next_params = {
                    "updated-max": qs["updated-max"][0],
                    "max-results": "100",
                    "start": str(page_count * 100 + 100),
                    "by-date": "false"
                }
            else:
                next_params = None
        else:
            next_params = None

        page_count += 1
        time.sleep(random.uniform(1.5, 3))

    print(f"\n✅ 共获取到标签 '{label}' 下的 {len(links)} 篇帖子")
    return links


def extract_article_text(url):
    """提取单篇文章正文"""
    print(f"🔍 提取: {url[:80]}")

    resp = fetch(url)
    if not resp:
        return "提取失败: 无法访问页面"

    soup = BeautifulSoup(resp.text, "html.parser")

    # 打印页面标题
    page_title = soup.title.string.strip() if soup.title else "无标题"
    print(f"  标题: {page_title[:60]}")

    # 正文区域
    content_div = soup.select_one("div.post-body.entry-content")
    if not content_div:
        # 备用：任意 post-body
        content_div = soup.select_one("[class*='post-body']")
    if not content_div:
        # 备用：找中文字符最多的 div
        all_divs = soup.find_all("div")
        if all_divs:
            content_div = max(all_divs, key=lambda d: extract_chinese(d.get_text()))
            print(f"  ⚠️ 使用备用 div，中文字符: {extract_chinese(content_div.get_text())}")
        else:
            return "提取失败: 未找到正文区域"

    # 清理：移除导航链接、广告等
    for tag in content_div.find_all(["a", "nav", "script", "style"]):
        tag.decompose()

    text = content_div.get_text("\n", strip=True)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"(上一页|下一页|主页|分类|全部小说|列表|\w+小说)", "", text)
    text = text.strip()

    if extract_chinese(text) < 20:
        return "提取失败: 正文内容过少"

    print(f"  ✅ 正文: {extract_chinese(text)} 中文字符")
    return text


# ─── 下载功能 ─────────────────────────────────────────

def download_book(bookname, save_dir=None):
    """下载指定书名的全部章节（通过标签搜索）"""
    safe_name = safe_filename(bookname)
    if save_dir is None:
        save_dir = os.path.expanduser("~/Documents")
    os.makedirs(save_dir, exist_ok=True)
    filepath = os.path.join(save_dir, safe_name)

    print(f"\n{'='*50}")
    print(f"📚 开始下载: {bookname}")
    print(f"{'='*50}\n")

    # 获取帖子列表
    posts = get_post_links_by_label(bookname)

    if not posts:
        print(f"\n❌ 标签 '{bookname}' 下没有找到任何帖子")
        return

    # 按链接排序（部分章节可能无日期前缀，用其在列表中的顺序）
    posts = [(t, u) for t, u in posts if u]  # 过滤空URL

    # 下载并保存
    success = 0
    failed = 0

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(f"【{bookname}】\n")
        f.write(f"下载时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write(f"来源: {BASE_URL}\n")
        f.write(f"{'='*50}\n\n")

        for i, (title, link) in enumerate(posts, 1):
            print(f"\n📖 章节 {i}/{len(posts)}: {title[:50]}")
            try:
                content = extract_article_text(link)
                if "提取失败" not in content:
                    f.write(f"\n\n=== 第{i}章 {title} ===\n\n")
                    f.write(content + "\n")
                    success += 1
                else:
                    print(f"  ⚠️ 跳过: {content}")
                    failed += 1
            except Exception as e:
                print(f"  ❌ 异常: {e}")
                failed += 1
            time.sleep(random.uniform(1.5, 3))

    print(f"\n{'='*50}")
    print(f"🎉 下载完成!")
    print(f"   成功: {success} 章")
    print(f"   失败: {failed} 章")
    print(f"   保存: {filepath}")
    print(f"{'='*50}")


# ─── 辅助功能 ─────────────────────────────────────────

def browse_category(category):
    """浏览某个分类下的帖子"""
    label = CATEGORIES.get(category)
    if not label:
        print(f"❌ 未知分类: {category}")
        print(f"   可选: {', '.join(CATEGORIES.keys())}")
        return

    posts = get_post_links_by_label(label, max_pages=3)
    print(f"\n📋 '{category}' 最新帖子 ({len(posts)} 篇):")
    for i, (title, url) in enumerate(posts[:30], 1):
        print(f"  {i:3d}. {title[:50]}")


def list_categories():
    """列出所有分类"""
    print("\n📂 可用分类:")
    for i, (name, label) in enumerate(CATEGORIES.items(), 1):
        print(f"  {i:2d}. {name}")


# ─── 交互菜单 ─────────────────────────────────────────

if __name__ == "__main__":
    print(f"\n{'='*50}")
    print(f"  xbookcn 成人文学下载器")
    print(f"  来源: {BASE_URL}")
    print(f"{'='*50}")

    while True:
        print("\n请选择操作:")
        print("  1. 下载小说（按标签搜索）")
        print("  2. 浏览分类")
        print("  3. 列出所有分类")
        print("  0. 退出")

        choice = input("\n请输入数字: ").strip()

        if choice == "1":
            bookname = input("请输入小说标签名（如 小村春色）: ").strip()
            if bookname:
                download_book(bookname)
        elif choice == "2":
            list_categories()
            cat_name = input("\n请输入分类名: ").strip()
            if cat_name in CATEGORIES:
                browse_category(cat_name)
            else:
                print("❌ 分类不存在")
        elif choice == "3":
            list_categories()
        elif choice == "0":
            print("👋 再见!")
            break
        else:
            print("❌ 无效输入")
