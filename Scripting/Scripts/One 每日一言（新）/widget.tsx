// ONE 每日一言 — 纯 Worker API（无 AES）
import { VStack, ZStack, Text, Image, Spacer, Widget, Device, fetch } from "scripting"

const WORKER = "https://one.1314k.eu.org/daily"

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

interface Article { author: string; desc: string; image: string }

async function fetchArticle(): Promise<Article> {
  const r = await fetch(`${WORKER}?date=${today()}`)
  const d = JSON.parse(await r.text())
  if (d.error) throw new Error(d.error)
  return { author: d.author || "", desc: d.desc || "", image: d.image || "" }
}

function brightness(img: UIImage): number | null {
  const t = img.preparingThumbnail({ width: 1, height: 1 }); if (!t) return null
  const png = t.toPNGBase64String(); if (!png) return null
  const px = Data.fromBase64String(png)?.toIntArray(); if (!px || px.length < 4) return null
  return Math.round(0.2126 * px[1] + 0.7152 * px[2] + 0.0722 * px[3])
}

function OneWidget(props: { desc: string; author: string; filePath: string | null; bright: number | null }) {
  const f = Widget.family
  const s = Widget.displaySize
  const sm = f === "systemSmall"
  const md = f === "systemMedium"
  const light = props.bright != null && props.bright > 128
  const tc = light ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.92)"
  const sc = light ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.55)"
  return (
    <ZStack>
      {props.filePath ? <Image filePath={props.filePath} resizable scaleToFill frame={{ width: s.width, height: s.height }} /> : null}
      <VStack>
        <Text font={sm ? 8 : md ? 9 : 11} foregroundStyle={sc} padding={{ horizontal: sm ? 8 : 12, vertical: sm ? 4 : 6 }}>ONE · 每日一言</Text>
        <Spacer />
        <VStack padding={{ horizontal: sm ? 10 : 14, vertical: sm ? 8 : 10 }}>
          <Text font={sm ? 10 : md ? 12 : 15} foregroundStyle={tc} lineLimit={sm ? 5 : md ? 4 : 8}>{props.desc}</Text>
          {props.author ? <Text font={sm ? 9 : md ? 10 : 12} foregroundStyle={sc}>—— {props.author}</Text> : null}
        </VStack>
      </VStack>
    </ZStack>
  )
}

;(async () => {
  try {
    const dir = FileManager.appGroupDocumentsDirectory
    const day = today()
    const imgPath = `${dir}/one_bg_${day}.jpg`
    const metaPath = `${dir}/one_meta_${day}.json`

    let filePath: string | null = null
    let bright: number | null = null
    let article: Article

    // 缓存命中
    if (await FileManager.exists(imgPath) && await FileManager.exists(metaPath)) {
      const meta = JSON.parse(await FileManager.readAsString(metaPath))
      filePath = imgPath; bright = meta.bright; article = meta.article
    } else {
      article = await fetchArticle()
      if (article.image) {
        // Worker 直接返回 data:image/jpeg;base64,... → 解码保存
        const b64 = article.image.split(",")[1] || article.image
        const raw = Data.fromBase64String(b64)
        if (raw) {
          const img = UIImage.fromData(raw)
          if (img) {
            bright = brightness(img)
            const ws = Widget.displaySize, sc = Device.screen.scale
            const thumb = img.preparingThumbnail({ width: Math.round(ws.width * sc), height: Math.round(ws.height * sc) })
            if (thumb) { const jpg = thumb.toJPEGData(0.8); if (jpg) { try { await FileManager.remove(imgPath) } catch {}; await FileManager.writeAsData(imgPath, jpg); filePath = imgPath } }
          }
        }
      }
      await FileManager.writeAsString(metaPath, JSON.stringify({ article, bright }))
    }

    Widget.present(
      <OneWidget desc={article.desc} author={article.author} filePath={filePath} bright={bright} />,
      { policy: "after", date: new Date(Date.now() + 4 * 3600 * 1000) }
    )
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e)
    Widget.present(
      <VStack padding={8}>
        <Text font="headline">ONE</Text><Spacer />
        <Text font="footnote" opacity={0.6}>加载失败</Text>
        <Text font="caption2" opacity={0.4}>{m}</Text>
      </VStack>
    )
  }
})()
