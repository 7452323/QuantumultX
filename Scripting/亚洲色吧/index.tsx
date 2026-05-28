/**
 * 学习资料 - 看书 & 听书
 * 数据源: https://yazhouse8.com
 * 看书: /article.php (分类/文章列表) → /article/ID.html (内容)
 * 听书: /mp3/ (列表) → /mp3/mp3-l-N.html (曲目/音频URL)
 */

import {
  useState, useEffect, useMemo, useCallback, createContext, useContext, useRef,
  VStack, HStack, ZStack, Text, Image, Button, List, Section, ScrollView, ForEach,
  NavigationStack, NavigationLink, Spacer, LazyVGrid, TextField, ProgressView,
  TabView, Tab, fetch, Picker, Menu, Toggle, Slider, ScrollViewReader, ScrollViewProxy,
  Navigation, Script, gradient, RoundedRectangle, Rectangle
} from "scripting"

// ━━━━━━━━━━━━━━ 常量 ━━━━━━━━━━━━━━

const BASE_URL = "https://yazhouse8.com"

// 看书分类 — 完整标签列表
const READING_CATEGORIES = [
  { id: "1", name: "都市激情", url: "/article.php?cate=1" },
  { id: "2", name: "人妻交换", url: "/article.php?cate=2" },
  { id: "3", name: "校园春色", url: "/article.php?cate=3" },
  { id: "4", name: "家庭乱伦", url: "/article.php?cate=4" },
  { id: "5", name: "情色笑话", url: "/article.php?cate=5" },
  { id: "6", name: "性爱技巧", url: "/article.php?cate=6" },
  { id: "7", name: "另类小说", url: "/article.php?cate=7" },
  { id: "8", name: "乱伦文章", url: "/article.php?cate=8" },
  { id: "9", name: "纪实小说", url: "/article.php?cate=9" },
  { id: "10", name: "武侠小说", url: "/article.php?cate=10" },
  { id: "11", name: "虐待小说", url: "/article.php?cate=11" },
  { id: "12", name: "两性话题", url: "/article.php?cate=12" },
  { id: "siwa", name: "丝袜小说", url: "/l9kdK.htm" },
  { id: "mijian", name: "迷奸小说", url: "/Ryuid.htm" },
  { id: "tiaojiao", name: "调教小说", url: "/KGl2i.htm" },
  { id: "lunjian", name: "轮奸小说", url: "/6pmJE.htm" },
  { id: "shoujiao", name: "兽交小说", url: "/BmwSt.htm" },
  { id: "luchu", name: "露出小说", url: "/thguq.htm" },
  { id: "xingnu", name: "性奴小说", url: "/McpCg.htm" },
  { id: "juru", name: "巨乳小说", url: "/sxUlc.htm" },
]

// 听书分类
const AUDIO_CATEGORIES = [
  { id: "long", name: "长篇", icon: "book.fill" },
  { id: "short", name: "短篇", icon: "text.justify" },
]

// ━━━━━━━━━━━━━━ 类型定义 ━━━━━━━━━━━━━━

interface ArticleInfo {
  id: string         // URL path, e.g. /article/142346.html
  title: string
  category?: string
}

interface AudioBookInfo {
  id: string         // URL path, e.g. /mp3/mp3-l-0.html
  title: string
  type: "long" | "short"
}

interface TrackInfo {
  id: string         // index or URL
  bookId: string
  title: string
  audioUrl: string
}

interface ReadingHistory {
  id: string
  articleId: string
  articleTitle: string
  category?: string
  scrollPos: number   // 0-1
  timestamp: number
}

interface ListeningHistory {
  id: string
  bookId: string
  trackId: string
  trackTitle: string
  bookTitle: string
  progress: number    // 0-1
  timestamp: number
}

// ━━━━━━━━━━━━━━ HistoryView 刷新机制 ━━━━━━━━━━━━━━

const _moduleListeners = new Set<() => void>()

// ━━━━━━━━━━━━━━ 持久化存储 ━━━━━━━━━━━━━━

const SK = {
  FAV_ARTICLES: "study_fav_articles",
  FAV_AUDIO: "study_fav_audio",
  HIS_READING: "study_his_read",
  HIS_LISTENING: "study_his_listen",
  SETTINGS: "study_settings",
}

function loadJSON<T>(key: string, fallback: T): T {
  try { return Storage.get(key) ?? fallback } catch { return fallback }
}
function saveJSON(key: string, val: any) { Storage.set(key, val) }

function loadFavArticles(): ArticleInfo[] { return loadJSON(SK.FAV_ARTICLES, []) }
function saveFavArticles(list: ArticleInfo[]) { saveJSON(SK.FAV_ARTICLES, list) }
function loadFavAudio(): AudioBookInfo[] { return loadJSON(SK.FAV_AUDIO, []) }
function saveFavAudio(list: AudioBookInfo[]) { saveJSON(SK.FAV_AUDIO, list) }
function loadReadHistory(): ReadingHistory[] { return loadJSON(SK.HIS_READING, []) }
function saveReadHistory(list: ReadingHistory[]) { saveJSON(SK.HIS_READING, list) }
function loadListenHistory(): ListeningHistory[] { return loadJSON(SK.HIS_LISTENING, []) }
function saveListenHistory(list: ListeningHistory[]) { saveJSON(SK.HIS_LISTENING, list) }

function updateReadHistory(article: ArticleInfo, scrollPos: number) {
  const hist = loadReadHistory()
  const idx = hist.findIndex(h => h.articleId === article.id)
  const entry: ReadingHistory = {
    id: article.id,
    articleId: article.id,
    articleTitle: article.title,
    category: article.category,
    scrollPos,
    timestamp: Date.now(),
  }
  if (idx >= 0) hist.splice(idx, 1)
  hist.unshift(entry)
  saveReadHistory(hist.slice(0, 200))
}

function updateListenHistory(book: AudioBookInfo, track: TrackInfo, progress: number) {
  const hist = loadListenHistory()
  const idx = hist.findIndex(h => h.bookId === book.id)
  const entry: ListeningHistory = {
    id: `${book.id}_${track.id}`,
    bookId: book.id, trackId: track.id, trackTitle: track.title,
    bookTitle: book.title, progress, timestamp: Date.now(),
  }
  if (idx >= 0) hist.splice(idx, 1)
  hist.unshift(entry)
  saveListenHistory(hist.slice(0, 200))
}

// ━━━━━━━━━━━━━━ HTML 解析工具 ━━━━━━━━━━━━━━

function htmlDecode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/** 从 article 列表 HTML 中提取文章链接和标题 */
function parseArticleList(html: string): ArticleInfo[] {
  const results: ArticleInfo[] = []
  const seen = new Set<string>()
  // 匹配 <a href="article/ID.html">标题</a> 格式（没有 span 干扰的简单匹配）
  const linkRe = /<a[^>]*href="(article\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1]
    if (seen.has(href)) continue
    seen.add(href)
    const title = htmlDecode(match[2].replace(/<[^>]+>/g, ''))
    if (title && title.length > 2 && !title.includes('下一页') && !title.includes('首页')) {
      results.push({ id: "/" + href, title })
    }
  }
  return results
}

/** 从文章详情页提取标题 */
function parseArticleTitle(html: string): string {
  const h1Re = /<h1[^>]*>([\s\S]*?)<\/h1>/i
  const m = h1Re.exec(html)
  if (m) return htmlDecode(m[1].replace(/<[^>]+>/g, ''))
  return ""
}

/** 从文章详情页提取正文内容（支持 <p> 标签和 <br> 分隔两种格式） */
function parseArticleContent(html: string): string[] {
  // 参考书源阅读的 cleanHtmlToText 模式：先清洗再分段
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  const paragraphs: string[] = []
  const blocks = text.split(/\n{2,}/)
  for (const block of blocks) {
    const trimmed = block.replace(/\n/g, '').trim()
    if (trimmed && !/^(?:&nbsp;|\u00a0|\u3000)+$/.test(trimmed)) {
      paragraphs.push(trimmed)
    }
  }

  return paragraphs
}

/** 从文章列表页提取分页信息 */
function parseArticlePagination(html: string): { hasNext: boolean; nextUrl?: string } {
  // 先尝试匹配 word_2.htm 格式（自定义分类页面）
  const customRe = /<a[^>]*href="([^"]*(?:_\d+|_\d+)\.htm)"[^>]*>[\s\S]*?下一页[\s\S]*?<\/a>/i
  let m = customRe.exec(html)
  if (m) {
    let href = m[1]
    if (href.startsWith('/')) return { hasNext: true, nextUrl: href }
    return { hasNext: true, nextUrl: '/' + href }
  }
  // 再尝试匹配 ?page=N 格式（标准分类页面）
  const stdRe = /<a[^>]*href="([^"]*page=\d+[^"]*)"[^>]*>[\s\S]*?下一页[\s\S]*?<\/a>/i
  m = stdRe.exec(html)
  if (m) {
    let href = m[1]
    if (href.startsWith('/')) return { hasNext: true, nextUrl: href }
    return { hasNext: true, nextUrl: '/' + href }
  }
  return { hasNext: false }
}

/** 从 MP3 列表页提取有声书链接 */
function parseAudioBookList(html: string, type: "long" | "short"): AudioBookInfo[] {
  const results: AudioBookInfo[] = []
  const prefix = type === "long" ? "mp3-l-" : "mp3-s-"
  const linkRe = new RegExp(`<a[^>]*href="(${prefix}\\d+\\.html)"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi')
  let match: RegExpExecArray | null
  while ((match = linkRe.exec(html)) !== null) {
    const title = htmlDecode(match[2].replace(/<[^>]+>/g, ''))
    if (title && title.length > 1) {
      results.push({ id: "/mp3/" + match[1], title, type })
    }
  }
  return results
}

/** 从 MP3 详情页提取曲目列表 */
function parseTracks(html: string, bookId: string): TrackInfo[] {
  const results: TrackInfo[] = []
  // 匹配 data-song 属性获取音频URL
  const songRe = /<div[^>]*data-song="([^"]*)"[^>]*>([\s\S]*?)<\/div>\s*(?:<div|$)/gi
  // 更宽松的匹配
  const trackRe = /data-song="([^"]*)"[^>]*>/gi
  let match
  while ((match = trackRe.exec(html)) !== null) {
    const audioUrl = match[1]
    // 在附近查找 song-title
    const context = html.substring(Math.max(0, match.index - 200), match.index + 600)
    const titleRe = /<span[^>]*class="[^"]*song-title[^"]*"[^>]*>([^<]+)<\/span>/i
    const tm = titleRe.exec(context)
    const title = tm ? htmlDecode(tm[1]) : `曲目 ${results.length + 1}`
    results.push({
      id: `${bookId}_${results.length}`,
      bookId,
      title,
      audioUrl,
    })
  }
  return results
}

// ━━━━━━━━━━━━━━ Context ━━━━━━━━━━━━━━

interface AppCtx {
  favArticles: ArticleInfo[]
  favAudio: AudioBookInfo[]
  toggleFavArticle: (a: ArticleInfo) => void
  toggleFavAudio: (b: AudioBookInfo) => void
  isFavArticle: (id: string) => boolean
  isFavAudio: (id: string) => boolean
}

const AppContext = createContext<AppCtx>()

// ━━━━━━━━━━━━━━ 网格 ━━━━━━━━━━━━━━

const GRID_COLUMNS = [
  { size: { type: 'adaptive' as const, min: 150 }, spacing: 12 },
]

// ━━━━━━━━━━━━━━ 工具函数 ━━━━━━━━━━━━━━

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ━━━━━━━━━━━━━━ 看书：分类页 ━━━━━━━━━━━━━━

function CategoryGrid({ onSelect }: { onSelect: (cat: typeof READING_CATEGORIES[0]) => void }) {
  return (
    <ScrollView navigationTitle={"看书"}>
      <LazyVGrid columns={[
        { size: { type: 'adaptive' as const, min: 80 }, spacing: 10 },
      ]} padding={16} spacing={10}>
        {READING_CATEGORIES.map(cat => (
          <NavigationLink key={cat.id} destination={<ArticleListView category={cat} />}>
            <ZStack
              frame={{ height: 70 }}
              background={gradient("linear", {
                colors: ['#007AFF', '#5856D6'],
                startPoint: 'topLeading',
                endPoint: 'bottomTrailing',
              })}
              clipShape={{ type: 'rect', cornerRadius: 12 }}>
              <VStack alignment={'center'} spacing={4}>
                <Text font={'subheadline'} fontWeight={'semibold'} foregroundStyle={'white'}>
                  {cat.name}
                </Text>
              </VStack>
            </ZStack>
          </NavigationLink>
        ))}
      </LazyVGrid>
    </ScrollView>
  )
}

// ━━━━━━━━━━━━━━ 看书：文章列表 ━━━━━━━━━━━━━━

function ArticleListView({ category }: { category: typeof READING_CATEGORIES[0] }) {
  const ctx = useContext(AppContext)
  const [articles, setArticles] = useState<ArticleInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [nextUrl, setNextUrl] = useState<string | undefined>(undefined)

  const fetchArticles = useCallback(async (pageNum: number, append: boolean, overrideUrl?: string) => {
    setLoading(true)
    setError('')
    try {
      let url: string
      if (overrideUrl) {
        // 使用分页返回的 URL
        url = overrideUrl.startsWith('http') ? overrideUrl : `${BASE_URL}${overrideUrl}`
      } else if (/^\d+$/.test(category.id)) {
        // 标准分类使用 article.php?cate=N 格式
        url = pageNum > 1
          ? `${BASE_URL}/article.php?cate=${category.id}&page=${pageNum}`
          : `${BASE_URL}/article.php?cate=${category.id}`
      } else {
        // 自定义分类直接使用其 URL
        url = `${BASE_URL}${category.url}`
      }
      const resp = await fetch(url)
      const html = await resp.text()
      let list = parseArticleList(html)
      // 为每篇文章添加分类信息
      list = list.map(a => ({ ...a, category: category.name }))
      const pg = parseArticlePagination(html)
      setNextUrl(pg.hasNext ? pg.nextUrl : undefined)
      if (append) {
        setArticles(prev => [...prev, ...list])
      } else {
        setArticles(list)
      }
    } catch (e: any) {
      setError(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [category])

  useEffect(() => {
    setArticles([])
    setNextUrl(undefined)
    fetchArticles(1, false)
  }, [category.id])

  const loadMore = () => {
    if (!nextUrl || loading) return
    fetchArticles(0, true, nextUrl)
  }

  return (
    <List navigationTitle={category.name} navigationBarTitleDisplayMode={"inline"}>
      {loading && articles.length === 0 ? (
        <Section>
          <HStack padding={{ vertical: 8 }} spacing={8}>
            <ProgressView />
            <Text font={'subheadline'} foregroundStyle={'tertiaryLabel'}>加载中…</Text>
          </HStack>
        </Section>
      ) : null}

      {error ? (
        <Section>
          <VStack padding={{ vertical: 20 }} spacing={8} alignment={'center'}>
            <Image systemName={'exclamationmark.triangle'} foregroundStyle={'systemOrange'} font={'title'} />
            <Text font={'subheadline'} foregroundStyle={'secondaryLabel'}>{error}</Text>
          </VStack>
        </Section>
      ) : null}

      {articles.map(article => {
        const isFav = ctx?.isFavArticle(article.id) ?? false
        return (
          <NavigationLink key={article.id} destination={<ArticleReaderView article={article} />}>
            <HStack padding={{ vertical: 6 }}>
              <VStack alignment={'leading'} spacing={4} frame={{ maxWidth: 'infinity' }}>
                <Text font={'subheadline'} lineLimit={2} multilineTextAlignment={'leading'}>{article.title}</Text>
              </VStack>
              <Button action={() => ctx?.toggleFavArticle(article)}>
                <Image systemName={isFav ? 'bookmark.fill' : 'bookmark'}
                  foregroundStyle={isFav ? 'systemBlue' : 'systemGray3'}
                  imageScale={'small'} />
              </Button>
            </HStack>
          </NavigationLink>
        )
      })}

      {nextUrl && !loading ? (
        <VStack onAppear={loadMore}>
          <Section>
            <HStack padding={{ vertical: 8 }} spacing={8}>
              <ProgressView />
              <Text font={'caption'} foregroundStyle={'tertiaryLabel'}>加载更多…</Text>
            </HStack>
          </Section>
        </VStack>
      ) : null}
    </List>
  )
}

// ━━━━━━━━━━━━━━ 看书：文章阅读器 ━━━━━━━━━━━━━━

function ArticleReaderView({ article }: { article: ArticleInfo }) {
  const ctx = useContext(AppContext)
  const [content, setContent] = useState<string[]>([])
  const [title, setTitle] = useState(article.title)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [fontSize, setFontSize] = useState(18)
  const isFav = ctx?.isFavArticle(article.id) ?? false
  const lastVisibleRef = useRef(0)
  const saveTimerRef = useRef<number | null>(null)
  const scrollProxyRef = useRef<ScrollViewProxy | null>(null)

  // 从历史恢复阅读位置
  useEffect(() => {
    if (loading || content.length === 0) return
    const hist = loadReadHistory()
    const entry = hist.find(h => h.articleId === article.id)
    if (entry && entry.scrollPos > 0.01) {
      const idx = Math.floor(entry.scrollPos * content.length)
      lastVisibleRef.current = idx
      if (idx > 0 && scrollProxyRef.current) {
        scrollProxyRef.current.scrollTo(`para_${idx}`)
      }
    }
  }, [loading, content.length])

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${BASE_URL}${article.id}`)
        const html = await resp.text()
        const h1 = parseArticleTitle(html)
        if (h1) setTitle(h1)
        const paras = parseArticleContent(html)
        setContent(paras)
      } catch (e: any) {
        setError(e.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }
    fetchContent()
  }, [article.id])

  return (
    <NavigationStack>
      <ScrollView
        navigationTitle={title}
        navigationBarTitleDisplayMode={'inline'}
        toolbar={{
          topBarTrailing: (
            <HStack spacing={8}>
              <Button action={() => ctx?.toggleFavArticle(article)}>
                <Image systemName={isFav ? 'bookmark.fill' : 'bookmark'}
                  foregroundStyle={isFav ? 'systemBlue' : 'label'} />
              </Button>
              <Button action={() => setFontSize(s => Math.min(28, s + 2))}>
                <Image systemName={'textformat.size.larger'} foregroundStyle={'label'} />
              </Button>
              <Button action={() => setFontSize(s => Math.max(14, s - 2))}>
                <Image systemName={'textformat.size.smaller'} foregroundStyle={'label'} />
              </Button>
            </HStack>
          ),
        }}>
        <VStack padding={{ horizontal: 16, top: 8, bottom: 40 }} spacing={12}>
          {loading ? (
            <VStack padding={{ vertical: 40 }} frame={{ maxWidth: 'infinity' }} alignment={'center'}>
              <ProgressView />
              <Text font={'subheadline'} foregroundStyle={'tertiaryLabel'} padding={{ top: 8 }}>
                加载中…
              </Text>
            </VStack>
          ) : error ? (
            <VStack padding={{ vertical: 40 }} spacing={12} alignment={'center'}>
              <Image systemName={'exclamationmark.triangle'} foregroundStyle={'systemOrange'} font={'title'} />
              <Text font={'subheadline'} foregroundStyle={'secondaryLabel'}>{error}</Text>
            </VStack>
          ) : (
            <ScrollViewReader>
              {(proxy: ScrollViewProxy) => {
                scrollProxyRef.current = proxy
                return (
                  <>
                    <Text font={'title2'} fontWeight={'bold'}>{title}</Text>
                    {content.map((para, i) => (
                      <VStack key={i} tag={`para_${i}`}
                        onAppear={() => { lastVisibleRef.current = Math.max(lastVisibleRef.current, i) }}>
                        <Text font={fontSize} foregroundStyle={'label'} lineSpacing={6}>
                          {'\u3000\u3000'}{para}
                        </Text>
                      </VStack>
                    ))}
                  </>
                )
              }}
            </ScrollViewReader>
          )}
        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}

/** 解析音频 URL 为完整 URL，自动编码非 ASCII 字符（中文路径等） */
function resolveAudioUrl(url: string): string {
  if (!url) return ""
  if (url.startsWith("http")) {
    // URL 编码路径中的非 ASCII 字符，避免 AVPlayer.setSource() 崩溃
    // 保留协议、域名和 `/` `-` `_` `.` 等合法字符
    const qIdx = url.indexOf("?")
    const base = qIdx >= 0 ? url.substring(0, qIdx) : url
    const query = qIdx >= 0 ? url.substring(qIdx) : ""
    // 只编码路径部分（协议://域名之后、查询参数之前）
    const protoEnd = base.indexOf("://")
    if (protoEnd >= 0) {
      const pathStart = base.indexOf("/", protoEnd + 3)
      if (pathStart >= 0) {
        const protoHost = base.substring(0, pathStart)
        const pathPart = base.substring(pathStart)
        const encodedPath = pathPart.replace(/[^\x00-\x7F]/g, (ch) => encodeURIComponent(ch))
        return protoHost + encodedPath + query
      }
    }
    // 降级：全量编码非 ASCII
    return url.replace(/[^\x00-\x7F]/g, (ch) => encodeURIComponent(ch))
  }
  return url.startsWith("/") ? `${BASE_URL}${url}` : `${BASE_URL}/${url}`
}

// ━━━━━━━━━━━━━━ 听书：有声书列表 ━━━━━━━━━━━━━━

function AudioBookListView({ type }: { type: "long" | "short" }) {
  const ctx = useContext(AppContext)
  const [books, setBooks] = useState<AudioBookInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchList = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${BASE_URL}/mp3/`)
        const html = await resp.text()
        const list = parseAudioBookList(html, type)
        setBooks(list)
      } catch (e: any) {
        setError(e.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [type])

  if (loading) {
    return (
      <VStack padding={{ vertical: 40 }} frame={{ maxWidth: 'infinity' }} alignment={'center'}>
        <ProgressView />
        <Text font={'subheadline'} foregroundStyle={'tertiaryLabel'} padding={{ top: 8 }}>加载中…</Text>
      </VStack>
    )
  }

  if (error) {
    return (
      <VStack padding={{ vertical: 40 }} spacing={12} alignment={'center'}>
        <Image systemName={'exclamationmark.triangle'} foregroundStyle={'systemOrange'} font={'title'} />
        <Text font={'subheadline'} foregroundStyle={'secondaryLabel'}>{error}</Text>
      </VStack>
    )
  }

  return (
    <List>
      {books.map(book => {
        const isFav = ctx?.isFavAudio(book.id) ?? false
        return (
          <NavigationLink key={book.id} destination={<TrackListView book={book} />}>
            <HStack padding={{ vertical: 6 }}>
              <VStack alignment={'leading'} spacing={4} frame={{ maxWidth: 'infinity' }}>
                <Text font={'subheadline'} lineLimit={2} multilineTextAlignment={'leading'}>{book.title}</Text>
                <Text font={'caption2'} foregroundStyle={'tertiaryLabel'}>
                  {book.type === 'long' ? '长篇' : '短篇'}
                </Text>
              </VStack>
              <Button action={() => ctx?.toggleFavAudio(book)}>
                <Image systemName={isFav ? 'heart.fill' : 'heart'}
                  foregroundStyle={isFav ? 'systemRed' : 'systemGray3'}
                  imageScale={'small'} />
              </Button>
            </HStack>
          </NavigationLink>
        )
      })}
    </List>
  )
}

// ━━━━━━━━━━━━━━ 听书：曲目列表 ━━━━━━━━━━━━━━

function TrackListView({ book, resumeTrackId, resumeProgress }: { book: AudioBookInfo; resumeTrackId?: string; resumeProgress?: number }) {
  const ctx = useContext(AppContext)
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const isFav = ctx?.isFavAudio(book.id) ?? false
  const autoPlayedRef = useRef(false)

  useEffect(() => {
    const fetchTracks = async () => {
      setLoading(true)
      setError('')
      try {
        const resp = await fetch(`${BASE_URL}${book.id}`)
        const html = await resp.text()
        const list = parseTracks(html, book.id)
        setTracks(list)
        // 自动恢复上次播放位置
        if (resumeTrackId && !autoPlayedRef.current) {
          const trk = list.find(t => t.id === resumeTrackId)
          if (trk) {
            autoPlayedRef.current = true
            setTimeout(() => {
              Navigation.present({
                element: <AudioPlayerView book={book} track={trk} tracks={list} trackIndex={list.indexOf(trk)} initialProgress={resumeProgress} />,
                modalPresentationStyle: "overFullScreen",
              })
            }, 100)
          }
        }
      } catch (e: any) {
        setError(e.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }
    fetchTracks()
  }, [book.id, resumeTrackId])

  return (
    <List navigationTitle={book.title} navigationBarTitleDisplayMode={"inline"}
      toolbar={{
        topBarTrailing: (
          <Button action={() => ctx?.toggleFavAudio(book)}>
            <Image systemName={isFav ? 'heart.fill' : 'heart'}
              foregroundStyle={isFav ? 'systemRed' : 'label'} />
          </Button>
        ),
      }}>
      {loading ? (
        <Section>
          <HStack padding={{ vertical: 8 }} spacing={8}>
            <ProgressView />
            <Text font={'subheadline'} foregroundStyle={'tertiaryLabel'}>加载曲目…</Text>
          </HStack>
        </Section>
      ) : error ? (
        <Section>
          <VStack padding={{ vertical: 20 }} spacing={8} alignment={'center'}>
            <Image systemName={'exclamationmark.triangle'} foregroundStyle={'systemOrange'} font={'title'} />
            <Text font={'subheadline'} foregroundStyle={'secondaryLabel'}>{error}</Text>
          </VStack>
        </Section>
      ) : (
        <Section header={<Text>曲目 ({tracks.length})</Text>}>
          {tracks.map((track, idx) => (
            <NavigationLink key={track.id} destination={<AudioPlayerView book={book} track={track} tracks={tracks} trackIndex={idx} />}>
              <HStack padding={{ vertical: 4 }}>
                <VStack alignment={'leading'} spacing={2} frame={{ maxWidth: 'infinity' }}>
                  <Text font={'subheadline'} lineLimit={1}>{track.title}</Text>
                </VStack>
                <Image systemName={'play.fill'} foregroundStyle={'systemBlue'} imageScale={'small'} />
              </HStack>
            </NavigationLink>
          ))}
        </Section>
      )}
    </List>
  )
}

// ━━━━━━━━━━━━━━ 听书：音频播放器（独立本地 AVPlayer）━━━━━━━━━━━━━━━

function AudioPlayerView({ book, track, tracks, trackIndex: initIndex, initialProgress }: {
  book: AudioBookInfo
  track: TrackInfo
  tracks: TrackInfo[]
  trackIndex: number
  initialProgress?: number
}) {
  const playerRef = useRef<AVPlayer | null>(null)
  const timerRef = useRef<number | null>(null)
  const shouldPlayRef = useRef(false)
  const seekOnReadyRef = useRef<number | undefined>(undefined) // 首次加载时的 seek 目标

  const [currentTrack, setCurrentTrack] = useState<TrackInfo>(track)
  const [curIdx, setCurIdx] = useState(initIndex)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  // ── 挂载：创建本地 AVPlayer ─────────────────
  useEffect(() => {
    const player = new AVPlayer()
    playerRef.current = player

    player.onReadyToPlay = () => {
      setDuration(player.duration)
      if (shouldPlayRef.current) {
        player.play(1.0)
      }
    }

    player.onEnded = () => {
      setIsPlaying(false)
      shouldPlayRef.current = false
      setProgress(1)
      if (timerRef.current != null) clearTimeout(timerRef.current)
      // 自动下一曲
      setCurIdx(prev => {
        if (prev + 1 < tracks.length) {
          setCurrentTrack(tracks[prev + 1])
          return prev + 1
        }
        return prev
      })
    }

    player.onError = (msg: string) => {
      console.error("AVPlayer error:", msg)
      setIsPlaying(false)
      shouldPlayRef.current = false
    }

    return () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
      player.dispose()
    }
  }, [])

  // ── 曲目切换时加载播放 ─────────────────────
  useEffect(() => {
    const player = playerRef.current
    if (!player || !currentTrack?.audioUrl) return

    if (timerRef.current != null) clearTimeout(timerRef.current)
    setProgress(0)
    setDuration(0)
    setIsPlaying(false)
    shouldPlayRef.current = false
    player.stop()

    player.setSource(resolveAudioUrl(currentTrack.audioUrl))
    player.currentTime = 0
    shouldPlayRef.current = true
    const ok = player.play(1.0)
    if (ok) {
      setIsPlaying(true)
      startTimer()
    }
  }, [currentTrack?.id])

  // ── 进度计时器 ─────────────────────────────
  const startTimer = () => {
    if (timerRef.current != null) clearTimeout(timerRef.current)
    const tick = () => {
      const player = playerRef.current
      if (!player) return
      const d = player.duration
      if (d > 0) {
        setDuration(d)
        setProgress(player.currentTime / d)
      }
      timerRef.current = setTimeout(tick, 500)
    }
    timerRef.current = setTimeout(tick, 500)
  }

  // ── 控制 ───────────────────────────────────
  const togglePlay = () => {
    const player = playerRef.current
    if (!player) return
    if (isPlaying) {
      player.pause()
      if (timerRef.current != null) clearTimeout(timerRef.current)
      setIsPlaying(false)
    } else {
      if (currentTrack?.audioUrl) {
        player.play(1.0)
        setIsPlaying(true)
        startTimer()
      }
    }
  }

  const selectTrack = (trk: TrackInfo, idx: number) => {
    if (trk.id === currentTrack?.id) return
    setCurrentTrack(trk)
    setCurIdx(idx)
  }

  const seekTo = (value: number) => {
    setProgress(value)
    const player = playerRef.current
    if (player && player.duration > 0) {
      player.currentTime = value * player.duration
    }
  }

  const skipBack = () => {
    const player = playerRef.current
    if (player && player.duration > 0) {
      const t = Math.max(0, player.currentTime - 15)
      player.currentTime = t
      setProgress(t / player.duration)
    }
  }

  const skipForward = () => {
    const player = playerRef.current
    if (player && player.duration > 0) {
      const t = Math.min(player.duration, player.currentTime + 15)
      player.currentTime = t
      setProgress(t / player.duration)
    }
  }

  const currentTime = progress * (duration > 0 ? duration : 1)

  // ── JSX ────────────────────────────────────
  return (
    <VStack navigationTitle={book.title} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={"systemBackground"} spacing={0}>
      {/* 封面 & 曲目信息 */}
      <VStack padding={{ horizontal: 20, vertical: 20 }} spacing={12} alignment={"center"}>
        <ZStack
          frame={{ width: 140, height: 140 }}
          background={"systemGray5"}
          clipShape={{ type: "rect", cornerRadius: 14 }}>
          <Image systemName={isPlaying ? "waveform" : "headphones"} foregroundStyle={"systemGray3"} font={"title"} />
        </ZStack>
        <Text font={"title3"} fontWeight={"bold"} lineLimit={2}>{currentTrack?.title || "未知曲目"}</Text>
        <Text font={"subheadline"} foregroundStyle={"secondaryLabel"}>{book.title}</Text>

        {/* 进度条 */}
        <VStack spacing={6} frame={{ maxWidth: "infinity" }} padding={{ horizontal: 8 }}>
          <Slider min={0} max={1} value={progress} onChanged={seekTo} />
          <HStack>
            <Text font={"caption2"} foregroundStyle={"tertiaryLabel"}>
              {duration > 0 ? formatTime(currentTime) : "0:00"}
            </Text>
            <Spacer />
            <Text font={"caption2"} foregroundStyle={"tertiaryLabel"}>
              {duration > 0 ? formatTime(duration) : "--:--"}
            </Text>
          </HStack>
        </VStack>

        {/* 播放控制 */}
        <HStack spacing={32} alignment={"center"} padding={{ top: 4 }}>
          {curIdx > 0 ? (
            <Button action={() => { if (curIdx > 0) selectTrack(tracks[curIdx - 1], curIdx - 1) }}>
              <Image systemName={"backward.fill"} foregroundStyle={"label"} font={"title2"} />
            </Button>
          ) : (
            <Spacer frame={{ width: 28 }} />
          )}

          <Button action={skipBack}>
            <Image systemName={"gobackward.15"} foregroundStyle={"label"} font={"title2"} />
          </Button>

          <Button action={togglePlay}>
            <ZStack
              frame={{ width: 60, height: 60 }}
              background={"systemBlue"}
              clipShape={"circle"}>
              <Image systemName={isPlaying ? "pause.fill" : "play.fill"}
                foregroundStyle={"white"} font={"title2"} />
            </ZStack>
          </Button>

          <Button action={skipForward}>
            <Image systemName={"goforward.15"} foregroundStyle={"label"} font={"title2"} />
          </Button>

          {curIdx < tracks.length - 1 ? (
            <Button action={() => { if (curIdx < tracks.length - 1) selectTrack(tracks[curIdx + 1], curIdx + 1) }}>
              <Image systemName={"forward.fill"} foregroundStyle={"label"} font={"title2"} />
            </Button>
          ) : (
            <Spacer frame={{ width: 28 }} />
          )}
        </HStack>
      </VStack>

      <Rectangle frame={{ height: 0.5 }} fill={"separator"} />

      {/* 曲目列表 */}
      <ScrollView>
        <VStack padding={12} spacing={2}>
          {tracks.map((trk, idx) => {
            const isActive = currentTrack?.id === trk.id
            return (
              <HStack key={trk.id}
                contentShape={"rect"}
                onTapGesture={() => selectTrack(trk, idx)}
                padding={{ vertical: 10, horizontal: 12 }}
                background={isActive ? "tertiarySystemGroupedBackground" : undefined}
                clipShape={{ type: "rect", cornerRadius: 8 }}>
                <VStack spacing={2} frame={{ maxWidth: "infinity" }}>
                  <Text font={"subheadline"} fontWeight={isActive ? "semibold" : "regular"}
                    foregroundStyle={isActive ? "systemBlue" : "label"}
                    lineLimit={1}>{trk.title}</Text>
                </VStack>
                <Spacer />
                <Image systemName={isActive && isPlaying ? "speaker.wave.2.fill" : "play.fill"}
                  foregroundStyle={isActive ? "systemBlue" : "systemGray3"} imageScale={"small"} />
              </HStack>
            )
          })}
        </VStack>
      </ScrollView>
    </VStack>
  )
}

// ━━━━━━━━━━━━━━ 听书：主页面 ━━━━━━━━━━━━━━

function ListeningView() {
  const [subTab, setSubTab] = useState("long")

  return (
    <NavigationStack>
      <VStack navigationTitle={'听书'} spacing={0}>
        {/* 子标签：长篇 / 短篇 */}
        <HStack padding={{ horizontal: 16, vertical: 8 }} spacing={16}>
          {AUDIO_CATEGORIES.map(c => {
            const active = subTab === c.id
            return (
              <Button key={c.id} action={() => setSubTab(c.id)}>
                <Text font={'subheadline'}
                  foregroundStyle={active ? 'systemBlue' : 'secondaryLabel'}
                  fontWeight={active ? 'semibold' : 'regular'}>
                  {c.name}
                </Text>
              </Button>
            )
          })}
        </HStack>
        <Rectangle frame={{ height: 0.5 }} fill={'separator'} />
        <AudioBookListView type={subTab as "long" | "short"} />
      </VStack>
    </NavigationStack>
  )
}

// ━━━━━━━━━━━━━━ 书库（收藏）━━━━━━━━━━━━━━━

function LibraryView() {
  const ctx = useContext(AppContext)
  const [subTab, setSubTab] = useState<"articles" | "audio">("articles")
  const [listenHistory, setListenHistory] = useState<ListeningHistory[]>(() => loadListenHistory())

  useEffect(() => { setListenHistory(loadListenHistory()) }, [subTab, ctx?.favAudio])

  return (
    <NavigationStack>
      <VStack navigationTitle={'书库'} spacing={0}>
        <HStack padding={{ horizontal: 16, vertical: 8 }} spacing={16}>
          <Button action={() => setSubTab("articles")}>
            <Text font={'subheadline'}
              foregroundStyle={subTab === 'articles' ? 'systemBlue' : 'secondaryLabel'}
              fontWeight={subTab === 'articles' ? 'semibold' : 'regular'}>
              文章
            </Text>
          </Button>
          <Button action={() => setSubTab("audio")}>
            <Text font={'subheadline'}
              foregroundStyle={subTab === 'audio' ? 'systemBlue' : 'secondaryLabel'}
              fontWeight={subTab === 'audio' ? 'semibold' : 'regular'}>
              听书
            </Text>
          </Button>
        </HStack>
        <Rectangle frame={{ height: 0.5 }} fill={'separator'} />

        {subTab === 'articles' ? (
          (ctx?.favArticles.length ?? 0) === 0 ? (
            <VStack frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }} spacing={12} alignment={'center'}>
              <Image systemName={'bookmark.slash'} imageScale={'large'}
                foregroundStyle={'tertiaryLabel'} font={'title'} />
              <Text font={'headline'} foregroundStyle={'secondaryLabel'}>还没有收藏文章</Text>
              <Text font={'subheadline'} foregroundStyle={'tertiaryLabel'}>
                在「看书」页面点击书签图标添加收藏
              </Text>
            </VStack>
          ) : (
            <ScrollView>
              <LazyVGrid columns={[
                { size: { type: 'adaptive' as const, min: 90 }, spacing: 12 },
              ]} padding={16} spacing={10}>
                {(ctx?.favArticles ?? []).map(a => {
                  return (
                    <NavigationLink key={a.id} destination={<ArticleReaderView article={a} />}>
                      <VStack alignment={'leading'} spacing={4}>
                        <ZStack
                          frame={{ height: 100 }}
                          background={gradient("linear", {
                            colors: ['#FF9500', '#FF6B35'],
                            startPoint: 'topLeading',
                            endPoint: 'bottomTrailing',
                          })}
                          clipShape={{ type: 'rect', cornerRadius: 8 }}>
                          <VStack alignment={'center'} padding={8}>
                            <Text font={'caption2'} foregroundStyle={'white'} lineLimit={4}>
                              {a.title}
                            </Text>
                          </VStack>
                        </ZStack>
                        <Text font={'caption2'} foregroundStyle={'secondaryLabel'} lineLimit={1}>
                          {a.category || ''}
                        </Text>
                      </VStack>
                    </NavigationLink>
                  )
                })}
              </LazyVGrid>
            </ScrollView>
          )
        ) : (
          (ctx?.favAudio.length ?? 0) === 0 ? (
            <VStack frame={{ maxWidth: 'infinity', maxHeight: 'infinity' }} spacing={12} alignment={'center'}>
              <Image systemName={'heart.slash'} imageScale={'large'}
                foregroundStyle={'tertiaryLabel'} font={'title'} />
              <Text font={'headline'} foregroundStyle={'secondaryLabel'}>还没有收藏听书</Text>
              <Text font={'subheadline'} foregroundStyle={'tertiaryLabel'}>
                在「听书」页面点击 ♡ 添加收藏
              </Text>
            </VStack>
          ) : (
            <List>
              {(ctx?.favAudio ?? []).map(b => {
                const hist = listenHistory.find(h => h.bookId === b.id)
                return (
                <NavigationLink key={b.id} destination={<TrackListView book={b} resumeTrackId={hist?.trackId} resumeProgress={hist?.progress} />}>
                  <HStack padding={{ vertical: 4 }}>
                    <Image systemName={'headphones'} foregroundStyle={'systemBlue'} imageScale={'small'} />
                    <Text font={'subheadline'} lineLimit={1}>{b.title}</Text>
                    <Spacer />
                    <Text font={'caption2'} foregroundStyle={'tertiaryLabel'}>
                      {b.type === 'long' ? '长篇' : '短篇'}
                    </Text>
                  </HStack>
                </NavigationLink>
              )})}
            </List>
          )
        )}
      </VStack>
    </NavigationStack>
  )
}

// ━━━━━━━━━━━━━━ 历史 ━━━━━━━━━━━━━━

function HistoryView() {
  const [subTab, setSubTab] = useState<"reading" | "listening">("reading")
  const [readHistory, setReadHistory] = useState<ReadingHistory[]>(() => loadReadHistory())
  const [listenHistory, setListenHistory] = useState<ListeningHistory[]>(() => loadListenHistory())

  const refresh = useCallback(() => {
    setReadHistory(loadReadHistory())
    setListenHistory(loadListenHistory())
  }, [])

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const listener = () => refresh()
    _moduleListeners.add(listener)
    return () => { _moduleListeners.delete(listener) }
  }, [])

  const clearAll = () => {
    if (subTab === 'reading') {
      saveReadHistory([])
      setReadHistory([])
    } else {
      saveListenHistory([])
      setListenHistory([])
    }
  }

  const items = subTab === 'reading' ? readHistory : listenHistory

  return (
    <NavigationStack>
      <List navigationTitle={'历史'}
        toolbar={{
          topBarTrailing: items.length > 0 ? (
            <Button action={clearAll}>
              <Image systemName={'trash'} foregroundStyle={'systemRed'} />
            </Button>
          ) : undefined,
        }}>
        <Section>
          <HStack spacing={8} padding={{ vertical: 4 }}>
            <ZStack
              onTapGesture={() => setSubTab("reading")}
              frame={{ height: 38 }}
              background={subTab === 'reading' ? 'ultraThinMaterial' : undefined}
              clipShape={{ type: 'rect', cornerRadius: 999 }}
              padding={{ horizontal: 18 }}>
              <HStack spacing={6} alignment={'center'}>
                <Image systemName={'book.fill'} font={'body'}
                  foregroundStyle={subTab === 'reading' ? 'systemBlue' : 'secondaryLabel'} />
                <Text font={'subheadline'} fontWeight={'semibold'}
                  foregroundStyle={subTab === 'reading' ? 'systemBlue' : 'secondaryLabel'}>
                  看书
                </Text>
              </HStack>
            </ZStack>
            <ZStack
              onTapGesture={() => setSubTab("listening")}
              frame={{ height: 38 }}
              background={subTab === 'listening' ? 'ultraThinMaterial' : undefined}
              clipShape={{ type: 'rect', cornerRadius: 999 }}
              padding={{ horizontal: 18 }}>
              <HStack spacing={6} alignment={'center'}>
                <Image systemName={'headphones'} font={'body'}
                  foregroundStyle={subTab === 'listening' ? 'systemBlue' : 'secondaryLabel'} />
                <Text font={'subheadline'} fontWeight={'semibold'}
                  foregroundStyle={subTab === 'listening' ? 'systemBlue' : 'secondaryLabel'}>
                  听书
                </Text>
              </HStack>
            </ZStack>
          </HStack>
        </Section>

        {items.length === 0 ? (
          <VStack frame={{ maxWidth: 'infinity' }} padding={40} spacing={12} alignment={'center'}>
            <Image systemName={'clock.arrow.circlepath'} imageScale={'large'}
              foregroundStyle={'tertiaryLabel'} font={'title'} />
            <Text font={'headline'} foregroundStyle={'secondaryLabel'}>
              {subTab === 'reading' ? '暂无阅读记录' : '暂无收听记录'}
            </Text>
          </VStack>
        ) : subTab === 'reading' ? (
          (items as ReadingHistory[]).map(h => {
            const article: ArticleInfo = {
              id: h.articleId, title: h.articleTitle, category: h.category,
            }
            return (
              <NavigationLink key={h.id} destination={<ArticleReaderView article={article} />}>
                <VStack alignment={'leading'} spacing={2} padding={{ vertical: 4 }}>
                  <Text font={'subheadline'} fontWeight={'medium'} lineLimit={2}>{h.articleTitle}</Text>
                  <HStack spacing={8}>
                    {h.category ? (
                      <Text font={'caption'} foregroundStyle={'systemBlue'}>{h.category}</Text>
                    ) : null}
                    <Text font={'caption2'} foregroundStyle={'tertiaryLabel'}>
                      {new Date(h.timestamp).toLocaleString()}
                    </Text>
                  </HStack>
                </VStack>
              </NavigationLink>
            )
          })
        ) : (
          (items as ListeningHistory[]).map(h => {
            const book: AudioBookInfo = {
              id: h.bookId, title: h.bookTitle, type: 'long',
            }
            return (
              <NavigationLink key={h.id} destination={<TrackListView book={book} resumeTrackId={h.trackId} resumeProgress={h.progress} />}>
                <HStack spacing={12} padding={{ vertical: 4 }}>
                  <ZStack
                    frame={{ width: 44, height: 44 }}
                    background={gradient("linear", {
                      colors: ['#007AFF', '#5856D6'],
                      startPoint: 'topLeading',
                      endPoint: 'bottomTrailing',
                    })}
                    clipShape={{ type: 'rect', cornerRadius: 8 }}>
                    <Image systemName={'headphones'} foregroundStyle={'white'} imageScale={'small'} />
                  </ZStack>
                  <VStack alignment={'leading'} spacing={2} frame={{ maxWidth: 'infinity' }}>
                    <Text font={'subheadline'} fontWeight={'medium'} lineLimit={1}>{h.bookTitle}</Text>
                    <Text font={'caption'} foregroundStyle={'secondaryLabel'} lineLimit={1}>
                      {h.trackTitle} · {Math.round(h.progress * 100)}%
                    </Text>
                    <Text font={'caption2'} foregroundStyle={'tertiaryLabel'}>
                      {new Date(h.timestamp).toLocaleString()}
                    </Text>
                  </VStack>
                </HStack>
              </NavigationLink>
            )
          })
        )}
      </List>
    </NavigationStack>
  )
}

// ━━━━━━━━━━━━━━ 设置 ━━━━━━━━━━━━━━

function SettingsView() {
  const [fontSize, setFontSizeState] = useState(18)
  const [autoPlayNext, setAutoPlayNext] = useState(true)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const settings = loadJSON(SK.SETTINGS, { fontSize: 18, autoPlayNext: true })
    setFontSizeState(settings.fontSize || 18)
    setAutoPlayNext(settings.autoPlayNext !== false)
  }, [])

  const saveSettings = () => {
    saveJSON(SK.SETTINGS, { fontSize, autoPlayNext })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <NavigationStack>
      <ScrollView>
        <VStack navigationTitle={'设置'} padding={{ horizontal: 16, top: 8, bottom: 32 }} spacing={24}>

          {/* 阅读设置 */}
          <VStack spacing={10}>
            <Text font={'footnote'} fontWeight={'semibold'} foregroundStyle={'secondaryLabel'}
              padding={{ horizontal: 4 }}>
              阅读
            </Text>
            <VStack
              background={'secondarySystemGroupedBackground'}
              clipShape={{ type: 'rect', cornerRadius: 14 }}
              spacing={0}>
              <VStack padding={{ horizontal: 16, vertical: 14 }} spacing={10}>
                <HStack alignment={'center'}>
                  <VStack spacing={2}>
                    <Text font={'body'} fontWeight={'medium'}>默认字体大小</Text>
                    <Text font={'caption2'} foregroundStyle={'tertiaryLabel'}>
                      调整阅读器文字大小
                    </Text>
                  </VStack>
                  <Spacer />
                  <Text font={'body'} fontWeight={'semibold'} foregroundStyle={'systemBlue'}>
                    {fontSize}pt
                  </Text>
                </HStack>
                <Slider min={12} max={28} step={2} value={fontSize} onChanged={v => setFontSizeState(v)} />
              </VStack>
            </VStack>
          </VStack>

          {/* 播放设置 */}
          <VStack spacing={10}>
            <Text font={'footnote'} fontWeight={'semibold'} foregroundStyle={'secondaryLabel'}
              padding={{ horizontal: 4 }}>
              播放
            </Text>
            <VStack
              background={'secondarySystemGroupedBackground'}
              clipShape={{ type: 'rect', cornerRadius: 14 }}
              spacing={0}>
              <HStack padding={{ horizontal: 16, vertical: 13 }} alignment={'center'}>
                <VStack spacing={2}>
                  <Text font={'body'} fontWeight={'medium'}>自动播放下一曲</Text>
                  <Text font={'caption2'} foregroundStyle={'tertiaryLabel'}>
                    一曲结束后自动续播
                  </Text>
                </VStack>
                <Spacer />
                <Toggle title={'自动播放'} value={autoPlayNext} onChanged={setAutoPlayNext} />
              </HStack>
            </VStack>
          </VStack>

          {/* 保存 & 退出 */}
          <HStack spacing={12}>
            <ZStack
              onTapGesture={saveSettings}
              alignment={'center'}
              frame={{ maxWidth: 'infinity', minHeight: 50 }}
              padding={{ horizontal: 20, vertical: 14 }}
              background={saved
                ? gradient("linear", { colors: ['#34C759', '#30D158'], startPoint: 'leading', endPoint: 'trailing' })
                : gradient("linear", { colors: ['#007AFF', '#5856D6'], startPoint: 'leading', endPoint: 'trailing' })}
              clipShape={{ type: 'rect', cornerRadius: 14 }}
              shadow={{ color: saved ? 'systemGreen' : 'systemBlue', radius: 8, y: 4 }}>
              <HStack spacing={6} alignment={'center'}>
                {saved ? <Image systemName={'checkmark'} font={'body'} foregroundStyle={'white'} /> : null}
                <Text font={'body'} fontWeight={'semibold'} foregroundStyle={'white'}>
                  {saved ? '已保存' : '保存设置'}
                </Text>
              </HStack>
            </ZStack>
            <ZStack
              onTapGesture={() => Script.exit()}
              alignment={'center'}
              frame={{ maxWidth: 'infinity', minHeight: 50 }}
              padding={{ horizontal: 20, vertical: 14 }}
              background={gradient("linear", { colors: ['#FF375F', '#FF453A'], startPoint: 'leading', endPoint: 'trailing' })}
              clipShape={{ type: 'rect', cornerRadius: 14 }}
              shadow={{ color: 'systemRed', radius: 8, y: 4 }}>
              <Text font={'body'} fontWeight={'semibold'} foregroundStyle={'white'}>
                退出
              </Text>
            </ZStack>
          </HStack>

        </VStack>
      </ScrollView>
    </NavigationStack>
  )
}

// ━━━━━━━━━━━━━━ 主应用 ━━━━━━━━━━━━━━

function App() {
  Navigation.useDismiss()

  const [favArticles, setFavArticles] = useState<ArticleInfo[]>(() => loadFavArticles())
  const [favAudio, setFavAudio] = useState<AudioBookInfo[]>(() => loadFavAudio())

  const toggleFavArticle = useCallback((a: ArticleInfo) => {
    setFavArticles(prev => {
      const idx = prev.findIndex(x => x.id === a.id)
      const next = idx >= 0 ? prev.filter((_, i) => i !== idx) : [a, ...prev]
      saveFavArticles(next)
      return next
    })
  }, [])

  const toggleFavAudio = useCallback((b: AudioBookInfo) => {
    setFavAudio(prev => {
      const idx = prev.findIndex(x => x.id === b.id)
      const next = idx >= 0 ? prev.filter((_, i) => i !== idx) : [b, ...prev]
      saveFavAudio(next)
      return next
    })
  }, [])

  const isFavArticle = useCallback((id: string) => {
    return favArticles.some(a => a.id === id)
  }, [favArticles])

  const isFavAudio = useCallback((id: string) => {
    return favAudio.some(b => b.id === id)
  }, [favAudio])

  const ctx = useMemo(() => ({
    favArticles, favAudio, toggleFavArticle, toggleFavAudio,
    isFavArticle, isFavAudio,
  }), [favArticles, favAudio, toggleFavArticle, toggleFavAudio, isFavArticle, isFavAudio])

  return (
    <AppContext.Provider value={ctx}>
      <TabView>
        <Tab title={"看书"} systemImage={"book.fill"} value={0}>
          <NavigationStack>
            <CategoryGrid onSelect={() => {}} />
          </NavigationStack>
        </Tab>
        <Tab title={"听书"} systemImage={"headphones"} value={1}>
          <ListeningView />
        </Tab>
        <Tab title={"书库"} systemImage={"books.vertical"} value={2}>
          <LibraryView />
        </Tab>
        <Tab title={"历史"} systemImage={"clock"} value={3}>
          <HistoryView />
        </Tab>
        <Tab title={"设置"} systemImage={"gearshape"} value={4}>
          <SettingsView />
        </Tab>
      </TabView>
    </AppContext.Provider>
  )
}

// ━━━━━━━━━━━━━━ 启动 ━━━━━━━━━━━━━━

async function run() {
  await Navigation.present({ element: <App />, modalPresentationStyle: "overFullScreen" })
  Script.exit()
}
run()
