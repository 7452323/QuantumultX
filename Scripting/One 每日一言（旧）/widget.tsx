import { VStack, ZStack, Text, Image, Spacer, Widget, fetch } from 'scripting'

const API_BASE = 'http://v3.wufazhuce.com:8000/api'
const CACHE_KEY = 'one_content'

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

function WidgetView({ content }: { content: ContentItem }) {
  const family = Widget.family
  const size = Widget.displaySize
  const isSmall = family === 'systemSmall'
  const isMedium = family === 'systemMedium'

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
          foregroundStyle="white"
          background="rgba(0,0,0,0.4)"
          padding={{
            horizontal: isSmall ? 8 : 12,
            vertical: isSmall ? 4 : 6,
          }}
          clipShape={{ type: 'rect', cornerRadius: 6 }}
        >
          {formatDate()}
        </Text>

        <Spacer />

        {/* Forward text at bottom — adaptive lines */}
        <VStack
          background="rgba(0,0,0,0.4)"
          padding={{
            horizontal: isSmall ? 10 : 14,
            vertical: isSmall ? 8 : 10,
          }}
        >
          <Text
            font={isSmall ? 10 : isMedium ? 13 : 16}
            foregroundStyle="rgba(255,255,255,0.92)"
            lineLimit={isSmall ? 6 : isMedium ? 5 : 10}
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
      <Text
        font={14}
        foregroundStyle="rgba(255,255,255,0.6)"
      >
        ONE·一个
      </Text>
      <Text
        font={11}
        foregroundStyle="rgba(255,255,255,0.4)"
        lineLimit={2}
      >
        {message}
      </Text>
    </VStack>
  )
}

async function fetchContent(): Promise<ContentItem | null> {
  const idListResp = await fetch(`${API_BASE}/onelist/idlist`)
  const idListData = await idListResp.json()
  const ids: string[] = idListData.data

  if (!ids || ids.length === 0) {
    return null
  }

  const contentResp = await fetch(`${API_BASE}/onelist/${ids[0]}/0`)
  const contentData = await contentResp.json()

  if (contentData.res !== 0 || !contentData.data?.content_list?.length) {
    return null
  }

  return contentData.data.content_list[0] as ContentItem
}

async function main() {
  try {
    const content = await fetchContent()

    if (content) {
      Storage.set(CACHE_KEY, JSON.stringify(content))

      Widget.present(<WidgetView content={content} />, {
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

  // Try cached content as fallback
  const cached = Storage.get<string>(CACHE_KEY)
  if (cached) {
    try {
      const content: ContentItem = JSON.parse(cached)
      Widget.present(<WidgetView content={content} />, {
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

  // No content available
  Widget.present(<ErrorView message="暂无内容" />, {
    reloadPolicy: {
      policy: 'after',
      date: new Date(Date.now() + 1000 * 60 * 5),
    },
  })
}

main()
