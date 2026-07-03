import { VStack, ZStack, Text, Image, Spacer, Widget, fetch } from 'scripting'

const API_BASE = 'http://v3.wufazhuce.com:8000/api'
const CACHE_KEY = 'one_content'
const BRIGHTNESS_CACHE_KEY = 'one_brightness'

interface ContentItem {
  title: string
  forward: string
  img_url: string
  author: any
}

function formatDate(): string {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}`
}

function cleanForward(text: string): string {
  const idx = text.indexOf('本周')
  return idx >= 0 ? text.slice(0, idx).trim() : text
}

/**
 * Compute perceived brightness (0-255) from a remote image.
 * Downloads image → creates 1x1 thumbnail → extracts average pixel via PNG/zlib.
 * Caches the result in Storage.
 */
async function computeBrightness(imgUrl: string): Promise<number | null> {
  try {
    // Check cache first
    const cached = Storage.get<number>(BRIGHTNESS_CACHE_KEY)
    if (cached != null) return cached

    const uiImage = await UIImage.fromURL(imgUrl)
    if (!uiImage) return null

    const thumb = uiImage.preparingThumbnail({ width: 1, height: 1 })
    if (!thumb) return null

    const pngBase64 = thumb.toPNGBase64String()
    if (!pngBase64) return null

    // Parse PNG to find and decompress IDAT chunk
    const pngData = Data.fromBase64String(pngBase64)
    if (!pngData) return null

    // Locate IDAT chunk: iterate chunks starting at byte 8 (after PNG sig)
    const bytes = pngData.toIntArray()
    let idatOffset = -1
    let idatLen = 0
    let pos = 8
    while (pos < bytes.length - 8) {
      const len = (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]
      const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7])
      if (type === 'IDAT') {
        idatOffset = pos + 8 // data starts after 4-byte length + 4-byte type
        idatLen = len
        break
      }
      pos += 12 + len
    }

    if (idatOffset < 0) return null

    // Extract IDAT data (zlib-wrapped) and decompress
    const idatSlice = Data.fromIntArray(bytes.slice(idatOffset, idatOffset + idatLen))
    const decompressed = idatSlice.decompressed(CompressionAlgorithm.zlib)
    const raw = decompressed.toIntArray()

    // For 1x1 RGBA PNG: raw = [filter_byte, R, G, B, A] (5 bytes)
    // PNG filter byte is 0 (None) for a single-pixel image
    if (raw.length >= 4) {
      const r = raw.length >= 5 ? raw[1] : raw[0]
      const g = raw.length >= 5 ? raw[2] : raw[1]
      const b = raw.length >= 5 ? raw[3] : raw[2]

      // Perceived brightness (ITU-R BT.709)
      const brightness = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
      Storage.set(BRIGHTNESS_CACHE_KEY, brightness)
      return brightness
    }

    return null
  } catch {
    return null
  }
}

function WidgetView({ content, brightness }: { content: ContentItem; brightness: number | null }) {
  const family = Widget.family
  const size = Widget.displaySize
  const isSmall = family === 'systemSmall'
  const isMedium = family === 'systemMedium'

  const isLightImage = brightness != null && brightness > 128

  return (
    <ZStack>
      <Image
        imageUrl={content.img_url}
        resizable
        aspectRatio={{ contentMode: 'fill' }}
        frame={{ width: size.width, height: size.height }}
        clipped
      />

      <VStack>
        {/* Date at top */}
        <Text
          font={isSmall ? 10 : isMedium ? 11 : 14}
          foregroundStyle={isLightImage ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)'}
          padding={{
            horizontal: isSmall ? 8 : 12,
            vertical: isSmall ? 4 : 6,
          }}
          shadow={{
            color: isLightImage ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.5)',
            radius: 1.5,
            y: 1,
          }}
        >
          {formatDate()}
        </Text>

        <Spacer />

        {/* Forward text at bottom */}
        <VStack
          padding={{
            horizontal: isSmall ? 10 : 14,
            vertical: isSmall ? 8 : 10,
          }}
        >
          <Text
            font={isSmall ? 10 : isMedium ? 13 : 16}
            foregroundStyle={isLightImage ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.92)'}
            lineLimit={isSmall ? 6 : isMedium ? 5 : 10}
            shadow={{
              color: isLightImage ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.5)',
              radius: 1.5,
              y: 1,
            }}
          >
            {cleanForward(content.forward)}
          </Text>
        </VStack>
      </VStack>
    </ZStack>
  )
}

function ErrorView({ message }: { message: string }) {
  return (
    <VStack
      background="rgba(0,0,0,0.8)"
      padding
    >
      <Text font={14} foregroundStyle="rgba(255,255,255,0.6)">
        ONE·一个
      </Text>
      <Text font={11} foregroundStyle="rgba(255,255,255,0.4)" lineLimit={2}>
        {message}
      </Text>
    </VStack>
  )
}

async function fetchContent(): Promise<ContentItem | null> {
  const idListResp = await fetch(`${API_BASE}/onelist/idlist`)
  const idListData = await idListResp.json()
  const ids: string[] = idListData.data

  if (!ids || ids.length === 0) return null

  const contentResp = await fetch(`${API_BASE}/onelist/${ids[0]}/0`)
  const contentData = await contentResp.json()

  if (contentData.res !== 0 || !contentData.data?.content_list?.length) return null

  return contentData.data.content_list[0] as ContentItem
}

async function main() {
  try {
    const content = await fetchContent()

    if (content) {
      Storage.set(CACHE_KEY, JSON.stringify(content))
      const brightness = await computeBrightness(content.img_url)

      Widget.present(<WidgetView content={content} brightness={brightness} />, {
        reloadPolicy: {
          policy: 'after',
          date: new Date(Date.now() + 1000 * 60 * 60 * 3),
        },
      })
      return
    }
  } catch {
    // Network error, fall through to cache
  }

  const cached = Storage.get<string>(CACHE_KEY)
  if (cached) {
    try {
      const content: ContentItem = JSON.parse(cached)
      const cachedBrightness = Storage.get<number>(BRIGHTNESS_CACHE_KEY)
      Widget.present(<WidgetView content={content} brightness={cachedBrightness} />, {
        reloadPolicy: {
          policy: 'after',
          date: new Date(Date.now() + 1000 * 60 * 30),
        },
      })
      return
    } catch {
      // Cache parse error
    }
  }

  Widget.present(<ErrorView message="暂无内容" />, {
    reloadPolicy: {
      policy: 'after',
      date: new Date(Date.now() + 1000 * 60 * 5),
    },
  })
}

main()
