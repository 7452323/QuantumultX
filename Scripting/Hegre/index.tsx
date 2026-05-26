import {
  Script,
  Navigation,
  NavigationStack,
  List,
  TextField,
  Button,
  Text,
  Section,
  Link,
  Image,
  HStack,
  VStack,
  Spacer,
  ProgressView,
  useObservable,
  fetch,
  Response,
} from "scripting"

// ---------- Types ----------

interface HegreResult {
  url: string
  slug: string
  enTitle: string
  releaseDate: string  // YYYY-MM-DD
  runtime: string
  plot: string
  series: string
  posterUrl: string
  boardUrl: string
}

// ---------- Helper functions ----------

function extractSlugVariations(input: string): string[] {
  const clean = input
    .toLowerCase()
    .replace(/hegre\./g, "")
    .trim()

  // Remove leading date pattern like "25.05.26." -> keep the rest for slug
  const titlePart = clean.replace(/^\d{2}\.\d{2}\.\d{2}\./, "").trim()

  const variations = [
    clean.replace(/[\s.]+/g, "-"),
    titlePart.replace(/[\s.]+/g, "-"),
  ]

  // Deduplicate
  return [...new Set(variations.filter(v => v.length > 0))]
}

function guessSeries(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes("massage")) return "情色按摩 系列"
  if (lower.includes("day.in.the.life") || lower.includes("a.day.in.the.life")) return "生活纪实 系列"
  if (lower.includes("and")) return "情侣 系列"
  return "独奏 系列"
}

function guessDateFromFilename(input: string): string | null {
  const m = input.match(/(\d{2})\.(\d{2})\.(\d{2})/)
  if (m) {
    return `20${m[1]}-${m[2]}-${m[3]}`
  }
  return null
}

async function fetchWithTimeout(url: string, timeout = 10): Promise<Response> {
  return await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
    },
    timeout,
  })
}

async function scrapeHegrePage(slug: string): Promise<{ html: string; finalUrl: string } | null> {
  const url = `https://www.hegre.com/films/${slug}?locale=zh`
  try {
    const res = await fetchWithTimeout(url)
    if (res.status !== 200) return null
    // Check that the response URL still contains /films/ (i.e. not redirected)
    if (!res.url.includes("/films/")) return null
    const html = await res.text()
    return { html, finalUrl: res.url }
  } catch {
    return null
  }
}

function extractMetaFromHtml(html: string, slug: string) {
  // English title from <title>
  const titleMatch = html.match(/<title>(.*?)<\/title>/)
  const rawTitle = titleMatch ? titleMatch[1].trim() : slug
  const enTitle = rawTitle.split(" - Hegre.com")[0]?.split(" – Hegre.com")[0]?.trim() || slug

  // Release date from HTML
  let releaseDate: string | null = null
  const datePatterns = [
    /"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})"/,
    /"uploadDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/,
    /(\d{4}-\d{2}-\d{2})/,
  ]
  for (const pat of datePatterns) {
    const m = html.match(pat)
    if (m) {
      releaseDate = m[1]
      break
    }
  }

  // Runtime
  let runtime = "29"
  const runtimeMatch = html.match(/(\d+)\s*min/i)
  if (runtimeMatch) runtime = runtimeMatch[1]

  // Plot / description
  let plot = ""
  const plotMatch = html.match(/<p class="description">(.*?)<\/p>/s)
  if (plotMatch) {
    plot = plotMatch[1].trim()
  } else {
    const metaDesc = html.match(/<meta\s+name="description"\s+content="(.*?)"/i)
    if (metaDesc) plot = metaDesc[1].trim()
  }

  return { enTitle, releaseDate, runtime, plot }
}

async function verifyDateFromThenude(slug: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://www.thenude.com/hegre/${slug}`)
    if (res.status !== 200) return null
    const text = await res.text()
    const m = text.match(/(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function verifyDateFromIndexxx(slug: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(`https://www.indexxx.com/hegre/${slug}`)
    if (res.status !== 200) return null
    const text = await res.text()
    const m = text.match(/(\d{4}-\d{2}-\d{2})/)
    return m ? m[1] : null
  } catch {
    return null
  }
}

async function scrapeAndVerify(input: string): Promise<{
  result: HegreResult | null
  error?: string
}> {
  const variations = extractSlugVariations(input)

  for (const slug of variations) {
    const page = await scrapeHegrePage(slug)
    if (!page) continue

    const { enTitle, releaseDate, runtime, plot } = extractMetaFromHtml(page.html, slug)

    // Multi-source date verification
    let realDate = releaseDate
    if (!realDate) {
      realDate = await verifyDateFromThenude(slug)
    }
    if (!realDate) {
      realDate = await verifyDateFromIndexxx(slug)
    }
    if (!realDate) {
      realDate = guessDateFromFilename(input)
    }
    if (!realDate) {
      realDate = "2025-01-01"
    }

    const series = guessSeries(input)

    // Build Chinese title (replace "And" with "和")
    const cnTitle = enTitle
      .replace(/\bAnd\b/g, "和")
      .replace(/\band\b/g, "和")

    const posterUrl = `https://pp.hegre.com/films/${slug}/${slug}-poster-image-1440x.jpg`
    const boardUrl = `https://pp.hegre.com/films/${slug}/${slug}-board-image-3840x.jpg`

    // Generate plot if empty
    const finalPlot = plot || `HEGRE ${realDate} 上线经典作品《${enTitle}》。`

    return {
      result: {
        url: page.finalUrl,
        slug,
        enTitle: cnTitle,
        releaseDate: realDate,
        runtime,
        plot: finalPlot,
        series,
        posterUrl,
        boardUrl,
      },
    }
  }

  return { result: null, error: "未能找到匹配的 Hegre 页面，请检查文件名是否正确。" }
}

function generateNfoContent(result: HegreResult, fname: string): string {
  const year = result.releaseDate.substring(0, 4)
  const actorName = result.enTitle.split(/\s+/)[0] || "未知"
  const tagline = `${result.enTitle}……最真实、最放纵的时刻`

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<movie>
    <title>${result.enTitle}</title>
    <originaltitle>${result.enTitle}</originaltitle>
    <sorttitle>${fname}</sorttitle>
    <year>${year}</year>
    <releasedate>${result.releaseDate}</releasedate>
    <runtime>${result.runtime}</runtime>
    <mpaa>XXX</mpaa>
    <country>挪威</country>
    <language>英语</language>

    <tmdbid></tmdbid>
    <uniqueid type="imdb" default="true"></uniqueid>

    <plot>${result.plot}</plot>
    <tagline>${tagline}</tagline>

    <genre>${result.series.replace(" 系列", "")}</genre>
    <genre>自慰</genre>
    <genre>艺术情色</genre>

    <tag>多重高潮</tag>
    <tag>真实喷水</tag>
    <tag>艺术情色</tag>

    <director>Petter Hegre</director>
    <writer>Petter Hegre</writer>

    <actor>
        <name>${actorName}</name>
        <role>独奏女神</role>
        <thumb>${result.posterUrl}</thumb>
    </actor>

    <thumb aspect="poster">${result.posterUrl}</thumb>
    <thumb aspect="fanart">${result.boardUrl}</thumb>

    <rating>9.8</rating>
    <votes>1248</votes>

    <studio>Hegre.com / Petter Hegre</studio>
</movie>`
}

// ---------- Main UI ----------

function MainView() {
  const inputText = useObservable("")
  const isLoading = useObservable(false)
  const scrapedResult = useObservable<HegreResult | null>(null)
  const errorMessage = useObservable("")
  const nfoContent = useObservable("")

  async function handleFetch() {
    const text = inputText.value.trim()
    if (!text) {
      errorMessage.setValue("请输入文件名")
      return
    }

    isLoading.setValue(true)
    errorMessage.setValue("")
    scrapedResult.setValue(null)
    nfoContent.setValue("")

    const { result: r, error } = await scrapeAndVerify(text)

    isLoading.setValue(false)

    if (r) {
      scrapedResult.setValue(r)
      const fname = text.replace(/\.(mp4|mkv|avi|mov|wmv|flv)$/i, "").trim()
      nfoContent.setValue(generateNfoContent(r, fname))
    } else {
      errorMessage.setValue(error || "未知错误")
    }
  }

  async function handleExportNfo() {
    const nfo = nfoContent.value
    if (!nfo) return

    const data = Data.fromRawString(nfo, "utf8")
    if (!data) return

    const fname = inputText.value
      .replace(/\.(mp4|mkv|avi|mov|wmv|flv)$/i, "")
      .trim()
      .replace(/[\s.]+/g, ".")

    await DocumentPicker.exportFiles({
      files: [
        {
          data,
          name: `${fname}.nfo`,
        },
      ],
    })
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="Hegre NFO Generator"
        navigationBarTitleDisplayMode="large"
      >
        {/* Input Section */}
        <Section title="文件名输入">
          <TextField
            title="文件名"
            prompt="例如: Hegre.A.Day.In.The.Alya"
            value={inputText}
            autofocus
          />
          <Button
            title={isLoading.value ? "正在获取…" : "获取"}
            systemImage="magnifyingglass"
            action={handleFetch}
          />
        </Section>

        {/* Loading */}
        {isLoading.value && (
          <Section title="正在刮削…">
            <HStack alignment="center" spacing={12}>
              <ProgressView />
              <Text font="body">正在从 Hegre 官网获取数据，并验证日期…</Text>
            </HStack>
          </Section>
        )}

        {/* Error */}
        {errorMessage.value !== "" && (
          <Section title="错误">
            <Text>{errorMessage.value}</Text>
          </Section>
        )}

        {/* Result */}
        {scrapedResult.value && (
          <>
            <Section title="基本信息">
              <VStack alignment="leading" spacing={4}>
                <HStack spacing={4}>
                  <Text font="caption">标题 (EN)：</Text>
                  <Text font={12}>{scrapedResult.value.enTitle}</Text>
                </HStack>
                <HStack spacing={4}>
                  <Text font="caption">日期：</Text>
                  <Text font={12}>{scrapedResult.value.releaseDate}</Text>
                </HStack>
                <HStack spacing={4}>
                  <Text font="caption">时长：</Text>
                  <Text font={12}>{scrapedResult.value.runtime} min</Text>
                </HStack>
                <HStack spacing={4}>
                  <Text font="caption">系列：</Text>
                  <Text font={12}>{scrapedResult.value.series}</Text>
                </HStack>
                <Link url={scrapedResult.value.url}>
                  <Text font="subheadline">打开 Hegre 页面 ↗</Text>
                </Link>
              </VStack>
            </Section>

            <Section title="海报与封面">
              <VStack alignment="leading" spacing={8}>
                <Text font="caption">竖版 Poster (1440x)：</Text>
                <Link url={scrapedResult.value.posterUrl}>
                  <Text font={12}>{scrapedResult.value.posterUrl}</Text>
                </Link>
                <Image
                  imageUrl={scrapedResult.value.posterUrl}
                  resizable
                  scaleToFit
                  frame={{ maxHeight: 200 }}
                />

                <Text font="caption">横版 Board (3840x)：</Text>
                <Link url={scrapedResult.value.boardUrl}>
                  <Text font={12}>{scrapedResult.value.boardUrl}</Text>
                </Link>
                <Image
                  imageUrl={scrapedResult.value.boardUrl}
                  resizable
                  scaleToFit
                  frame={{ maxHeight: 150 }}
                />
              </VStack>
            </Section>

            <Section title="剧情简介">
              <Text>{scrapedResult.value.plot}</Text>
            </Section>

            <Section title="NFO 文件">
              <VStack alignment="leading" spacing={8}>
                <Button
                  title="导出 NFO 文件"
                  systemImage="square.and.arrow.up"
                  action={handleExportNfo}
                />
                <Text font="caption" >点击后将生成 .nfo 文件并通过系统分享导出。</Text>
              </VStack>
            </Section>

            <Section title="NFO 预览">
              <Text font={10}>{nfoContent.value}</Text>
            </Section>
          </>
        )}
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<MainView />)
  Script.exit()
}

run()
