/**
 * 破壳日 - 生日纪念日小组件
 *
 * 左上角小圆环 + 右上角头像圆环 + 底部信息。
 * - Small/Medium:  圆环 + 头像 + 信息
 * - Large:         圆环 + 头像 + 信息 + 一言
 */

import {
  Circle,
  Color,
  Device,
  HStack,
  Image,
  Spacer,
  Text,
  VStack,
  Widget,
  ZStack,
  fetch,
} from 'scripting'
import {
  solar2lunar,
  getNextBirthday,
  getAge,
  getMeetDays,
} from './lunar-calendar'

// ── 颜色 ──

const isDark = Device.colorScheme === 'dark'

const ringAccent: Color = isDark ? '#fc5ead' : '#e84393'
const ringBg: Color = isDark
  ? 'rgba(255,255,255,0.15)'
  : 'rgba(0,0,0,0.08)'
const textPrimary: Color = isDark ? 'white' : '#1a1a1a'
const textSecondary: Color = isDark
  ? 'rgba(255,255,255,0.6)'
  : 'rgba(0,0,0,0.5)'

// ── 设置 ──

interface Settings {
  nickname: string
  birthday: string
  nongli: boolean
  eday: string
  bless: string
  avatarPath: string
}

interface Data {
  nickname: string
  meetDays: number
  progressPercent: number
  daysUntilBirthday: number
  ageText: string
  lunarText: string
  nextBirthdayText: string
  bless: string
  avatarPath: string
}

const DEFAULTS: Settings = {
  nickname: '',
  birthday: '2000-01-01',
  nongli: false,
  eday: '',
  bless: '',
  avatarPath: '',
}

function loadSettings(): Settings {
  const saved = Storage.get<string>('birthday_settings')
  if (saved) {
    try {
      return { ...DEFAULTS, ...JSON.parse(saved) }
    } catch (_) {}
  }
  return { ...DEFAULTS }
}

function computeData(s: Settings): Data {
  const now = new Date()
  const [by, bm, bd] = s.birthday.split('-').map(Number)

  const age = getAge(s.birthday) as { year: number; month: number; day: number }
  const ageText =
    age.year > 0
      ? `${age.year}岁${age.month > 0 ? age.month + '月' : ''}`
      : age.month > 0
        ? `${age.month}月${age.day}天`
        : `${age.day}天`

  let lunarText = '--'
  try {
    const lunar = solar2lunar(now.getFullYear(), now.getMonth() + 1, now.getDate())
    lunarText = `${lunar.IMonthCn}${lunar.IDayCn}`
  } catch (_) {}

  const nextBirthday = getNextBirthday(by, bm, bd, s.nongli, false)
  const nextBirthdayText = nextBirthday
    ? `${nextBirthday.cYear}-${String(nextBirthday.cMonth).padStart(2, '0')}-${String(nextBirthday.cDay).padStart(2, '0')}`
    : '--'

  let progressPercent = 0
  let daysUntilBirthday = 0
  if (nextBirthday) {
    const nextDate = new Date(nextBirthday.cYear, nextBirthday.cMonth - 1, nextBirthday.cDay)
    const diffMs = nextDate.getTime() - now.getTime()
    daysUntilBirthday = Math.ceil(diffMs / 86400000)
    const lastBirthday = new Date(nextBirthday.cYear - 1, nextBirthday.cMonth - 1, nextBirthday.cDay)
    const yearMs = nextDate.getTime() - lastBirthday.getTime()
    const elapsedMs = now.getTime() - lastBirthday.getTime()
    progressPercent = Math.min(1, Math.max(0, elapsedMs / yearMs))
  }

  let meetDays = 0
  if (s.eday) {
    meetDays = getMeetDays(s.eday)
  }

  return {
    nickname: s.nickname || '破壳日',
    meetDays,
    progressPercent,
    daysUntilBirthday,
    ageText,
    lunarText,
    nextBirthdayText,
    bless: s.bless,
    avatarPath: s.avatarPath,
  }
}

// ── 组件 ──

/** 倒计时小圆环 — 靠左 */
function RingView({
  size = 42,
  progress,
  daysUntil,
}: {
  size?: number
  progress: number
  daysUntil: number
}) {
  const stroke = Math.max(2, size * 0.06)

  return (
    <ZStack>
      <Circle
        stroke={{
          shapeStyle: ringBg,
          strokeStyle: { lineWidth: stroke },
        }}
        frame={{ width: size, height: size }}
      />
      <Circle
        trim={{ from: 0, to: progress }}
        stroke={{
          shapeStyle: ringAccent,
          strokeStyle: { lineWidth: stroke, lineCap: 'round' },
        }}
        frame={{ width: size, height: size }}
      />
      <Text
        font={Math.round(size * 0.4)}
        foregroundStyle={ringAccent}
        multilineTextAlignment="center"
      >
        {daysUntil > 0 ? `${daysUntil}` : '🎉'}
      </Text>
    </ZStack>
  )
}

/** 头像圆环 — 靠右 */
function AvatarCircle({ path }: { path: string }) {
  const size = 42
  const bg: Color = isDark
    ? 'rgba(255,255,255,0.08)'
    : 'rgba(0,0,0,0.05)'

  if (path) {
    return (
      <Image
        filePath={path}
        frame={{ width: size, height: size }}
        clipShape="circle"
        resizable
      />
    )
  }

  return (
    <VStack
      frame={{ width: size, height: size }}
      alignment="center"
      background={bg}
      clipShape="circle"
    >
      <Text
        font={18}
        foregroundStyle={'rgba(128,128,128,0.35)' as any}
        multilineTextAlignment="center"
      >
        🎂
      </Text>
    </VStack>
  )
}

// ── 组件 ──
function InfoPanel({ data }: { data: Data }) {
  return (
    <VStack spacing={2}>
      {/* 三列布局：图标 | 标签 | 值 */}
      <HStack spacing={4}>
        <VStack spacing={2} frame={{ width: 20, alignment: 'center' }}>
          <Text font={11} foregroundStyle={textSecondary}>⏳</Text>
          <Text font={11} foregroundStyle={textSecondary}>📅</Text>
          <Text font={11} foregroundStyle={textSecondary}>🎁</Text>
        </VStack>
        <VStack spacing={2} frame={{ width: 28, alignment: 'leading' }}>
          <Text font={11} foregroundStyle={textSecondary}>年龄</Text>
          <Text font={11} foregroundStyle={textSecondary}>农历</Text>
          <Text font={11} foregroundStyle={textSecondary}>生日</Text>
        </VStack>
        <VStack spacing={2} alignment="trailing">
          <Text font={11} foregroundStyle={textPrimary} lineLimit={1}>{data.ageText}</Text>
          <Text font={11} foregroundStyle={textPrimary} lineLimit={1}>{data.lunarText}</Text>
          <Text font={11} foregroundStyle={textPrimary} lineLimit={1}>{data.nextBirthdayText}</Text>
        </VStack>
      </HStack>

      {/* 寄语 — 没写祝福语则显示一言 */}
      <Text
        font={10}
        foregroundStyle={textSecondary}
        multilineTextAlignment="leading"
      >
        {data.bless || quoteText}
      </Text>
    </VStack>
  )
}

// ── 一言 ──

async function fetchQuote(): Promise<string> {
  try {
    const res = await fetch('https://v1.hitokoto.cn/')
    const data: any = await res.json()
    if (data && data.hitokoto) return data.hitokoto
  } catch (_) {}
  try {
    const res = await fetch('https://api.btstu.cn/yan/api.php?charset=utf-8&encode=json')
    const data: any = await res.json()
    if (data && data.text) return data.text
  } catch (_) {}
  return '愿你每一天都充满阳光 ☀️'
}

// ── 主组件 ──

let quoteText = ''

function WidgetView() {
  const settings = loadSettings()
  const data = computeData(settings)

  return (
    <ZStack>
      <VStack padding={12} spacing={6}>
        {/* 昵称 + 相识天数 — 最上边 */}
        <HStack alignment="center" spacing={6}>
          <Text font={15} foregroundStyle={textPrimary}>
            {data.nickname}
          </Text>
          {data.meetDays > 0 && (
            <Text font={20} foregroundStyle={ringAccent}>
              {data.meetDays}
            </Text>
          )}
        </HStack>

        {/* 中间行：圆环靠左 + 头像靠右 */}
        <HStack alignment="center" spacing={18}>
          <RingView
            size={42}
            progress={data.progressPercent}
            daysUntil={data.daysUntilBirthday}
          />
          <AvatarCircle path={data.avatarPath} />
        </HStack>

        {/* 信息面板 */}
        <InfoPanel data={data} />
      </VStack>
    </ZStack>
  )
}

// ── 入口 ──

async function main() {
  quoteText = await fetchQuote()
  const now = new Date()
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0,
  )
  Widget.present(<WidgetView />, {
    reloadPolicy: { policy: 'after', date: nextMidnight },
  })
}

main()
