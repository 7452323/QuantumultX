/**
 * 和风天气 Widget — 小/中/大，自动定位，透明背景，AQI + 预警
 */

import { VStack, HStack, ZStack, Text, Image, Widget, Spacer, fetch } from 'scripting'

// ── 持久化配置 ──
function getApiKey(): string {
  return Storage.get<string>("qweather_api_key") || ""
}

// ── 类型定义 ──
interface NowWeather {
  temp: string; feelsLike: string; icon: string; text: string
  windDir: string; windScale: string; windSpeed: string
  humidity: string; precip: string; pressure: string; vis: string
  cloud: string; dew: string; obsTime: string
}

interface DailyForecast {
  fxDate: string; sunrise: string; sunset: string
  tempMax: string; tempMin: string; iconDay: string; textDay: string
  iconNight: string; textNight: string; windDirDay: string; windScaleDay: string
  humidity: string; precip: string; pressure: string; uvIndex: string
}

interface AirQuality {
  aqi: string; level: string; category: string; primary: string
  pm2p5: string; pm10: string
}

interface WeatherWarning {
  title: string; severity: string; text: string
}

interface WeatherData {
  now: NowWeather; daily: DailyForecast[]; cityName: string
  aqi: AirQuality | null; warnings: WeatherWarning[]
}

// ── QWeather icon → SF Symbol ──
function getWeatherIcon(iconCode: string): string {
  const code = parseInt(iconCode)
  if (code === 100) return "sun.max.fill"
  if (code >= 101 && code <= 103) return "cloud.sun.fill"
  if (code === 104) return "cloud.fill"
  if (code >= 150 && code <= 153) return "moon.stars.fill"
  if (code >= 300 && code <= 302) return "cloud.drizzle.fill"
  if (code >= 400 && code <= 406) return "wind"
  if (code >= 500 && code <= 515) return "cloud.fog.fill"
  if (code >= 700 && code <= 702) return "cloud.rain.fill"
  if (code >= 703 && code <= 704) return "cloud.heavyrain.fill"
  if (code >= 705 && code <= 706) return "cloud.bolt.rain.fill"
  if (code >= 707 && code <= 710) return "cloud.rain.fill"
  if (code >= 711 && code <= 712) return "cloud.heavyrain.fill"
  if (code >= 713 && code <= 715) return "cloud.bolt.rain.fill"
  if (code >= 800 && code <= 807) return "cloud.snow.fill"
  if (code === 900) return "thermometer.snowflake"
  return "questionmark"
}

// AQI level → SF Symbol
function getAQIIcon(level: string): string {
  const lv = parseInt(level)
  if (lv <= 1) return "leaf.fill"            // 优
  if (lv <= 2) return "wind"                 // 良
  if (lv <= 3) return "eyes"                 // 轻度
  if (lv <= 4) return "exclamationmark.circle.fill" // 中度
  return "xmark.circle.fill"                  // 重度
}

// ── 数据获取 ──
async function getCurrentLocation(): Promise<string | null> {
  try {
    await Location.setAccuracy("best")
    const location = await Location.requestCurrent({ forceRequest: false })
    if (location) {
      return `${location.longitude.toFixed(4)},${location.latitude.toFixed(4)}`
    }
    return null
  } catch {
    return null
  }
}

async function fetchCityName(locId: string, apiKey: string): Promise<string> {
  try {
    const res = await fetch(
      `https://geoapi.qweather.com/v2/city/lookup?location=${locId}&key=${apiKey}`
    )
    const data = await res.json()
    if (data.code === "200" && data.location?.length) {
      return data.location[0].name
    }
  } catch {}
  return ""
}

async function fetchWeatherData(location: string, apiKey: string): Promise<WeatherData | null> {
  try {
    const [nowRes, forecastRes, airRes, warnRes] = await Promise.all([
      fetch(`https://devapi.qweather.com/v7/weather/now?location=${location}&key=${apiKey}`),
      fetch(`https://devapi.qweather.com/v7/weather/3d?location=${location}&key=${apiKey}`),
      fetch(`https://devapi.qweather.com/v7/air/now?location=${location}&key=${apiKey}`),
      fetch(`https://devapi.qweather.com/v7/warning/now?location=${location}&key=${apiKey}`),
    ])

    const nowData = await nowRes.json()
    const forecastData = await forecastRes.json()
    const airData = await airRes.json()
    const warnData = await warnRes.json()

    if (nowData.code !== "200" || forecastData.code !== "200") return null

    const cityName = await fetchCityName(location, apiKey) || "当前位置"

    let aqi: AirQuality | null = null
    if (airData.code === "200" && airData.now) {
      aqi = {
        aqi: airData.now.aqi,
        level: airData.now.level,
        category: airData.now.category,
        primary: airData.now.primary || "",
        pm2p5: airData.now.pm2p5,
        pm10: airData.now.pm10,
      }
    }

    let warnings: WeatherWarning[] = []
    if (warnData.code === "200" && Array.isArray(warnData.warning)) {
      warnings = warnData.warning.map((w: any) => ({
        title: w.title || "",
        severity: w.severity || "",
        text: w.text || "",
      })).slice(0, 2)
    }

    return {
      now: nowData.now,
      daily: forecastData.daily || [],
      cityName,
      aqi,
      warnings,
    }
  } catch {
    return null
  }
}

// ── UI 组件 ──

function DayForecastRow({ day, index }: { day: DailyForecast, index: number }) {
  const date = new Date(day.fxDate)
  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
  const label = index === 0 ? "今天" : index === 1 ? "明天" : dayNames[date.getDay()]

  return (
    <HStack alignment="center" spacing={0}>
      <Text font="subheadline" foregroundStyle="label" frame={{ width: 42, alignment: "leading" }} opacity={0.9}>
        {label}
      </Text>
      <Text font="caption" foregroundStyle="secondaryLabel" frame={{ width: 62, alignment: "leading" }}>
        {day.textDay}
      </Text>
      <HStack alignment="center" spacing={0} frame={{ maxWidth: "infinity", alignment: "trailing" }}>
        <Text font="subheadline" foregroundStyle="label" fontWeight="bold">{day.tempMax}°</Text>
        <Text font="caption" foregroundStyle="tertiaryLabel"> / </Text>
        <Text font="subheadline" foregroundStyle="secondaryLabel">{day.tempMin}°</Text>
      </HStack>
    </HStack>
  )
}

// ═══ 小组件 · 简洁布局 ═══
// 布局：
// ┌──────────────────────────────┐
// │ 18°C              昆山市    │
// │ 晴                 ↑26°C    │
// │                    ↓ 8°C    │
// │ 东北风 2级         100%     │
// └──────────────────────────────┘

function SmallWidget({ data }: { data: WeatherData }) {
  const { now, cityName, daily } = data
  const tempMax = daily[0]?.tempMax || now.temp
  const tempMin = daily[0]?.tempMin || now.temp

  return (
    <VStack spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={{ horizontal: 14, vertical: 12 }}>
      {/* 第1行：温度 | 位置 */}
      <HStack alignment="firstTextBaseline" spacing={0} frame={{ maxWidth: "infinity" }}>
        <Text font={42} foregroundStyle="label" fontWeight="bold">{now.temp}°</Text>
        <Spacer />
        <Text font="callout" foregroundStyle="secondaryLabel" opacity={0.9}>{cityName}</Text>
      </HStack>

      {/* 第2行：天气状况 | 最高温 */}
      <HStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }} padding={{ top: 2 }}>
        <Text font="subheadline" foregroundStyle="secondaryLabel">{now.text}</Text>
        <Spacer />
        <HStack alignment="center" spacing={2}>
          <Text font="caption" foregroundStyle="tertiaryLabel">↑</Text>
          <Text font={18} foregroundStyle="label" fontWeight="bold">{tempMax}°</Text>
        </HStack>
      </HStack>

      {/* 第3行：最低温 */}
      <HStack alignment="center" spacing={0} frame={{ maxWidth: "infinity", alignment: "trailing" }} padding={{ top: 2 }}>
        <HStack alignment="center" spacing={2}>
          <Text font="caption" foregroundStyle="tertiaryLabel">↓</Text>
          <Text font={18} foregroundStyle="tertiaryLabel" fontWeight="bold">{tempMin}°</Text>
        </HStack>
      </HStack>

      <Spacer />

      {/* 第4行：风向 | 湿度 */}
      <HStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }}>
        <Text font="caption2" foregroundStyle="tertiaryLabel">风向</Text>
        <Spacer />
        <Text font="caption2" foregroundStyle="tertiaryLabel">湿度</Text>
      </HStack>

      {/* 第5行：风向数值 | 湿度数值 */}
      <HStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }} padding={{ top: 4 }}>
        <Text font="callout" foregroundStyle="label" fontWeight="bold">
          {now.windDir} {now.windScale}级
        </Text>
        <Spacer />
        <Text font="callout" foregroundStyle="label" fontWeight="bold">{now.humidity}%</Text>
      </HStack>
    </VStack>
  )
}

// ═══ 中组件 ═══
function MediumWidget({ data }: { data: WeatherData }) {
  const { now, aqi, warnings, cityName, daily } = data
  const tempMax = daily[0]?.tempMax || now.temp
  const tempMin = daily[0]?.tempMin || now.temp
  const obsTime = now.obsTime
  const updateTime = obsTime ? obsTime.substring(11, 16) : ""

  return (
    <HStack spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={{ horizontal: 12, vertical: 12 }}>
      {/* 左列：温度核心 */}
      <VStack alignment="leading" spacing={6} frame={{ width: 130 }}>
        <HStack alignment="center" spacing={6}>
          <Text font="headline" foregroundStyle="label" fontWeight="bold">{cityName}</Text>
          <Image systemName={getWeatherIcon(now.icon)} frame={{ width: 20, height: 20 }} foregroundStyle="label" />
        </HStack>

        <VStack alignment="leading" spacing={0}>
          <Text font={44} foregroundStyle="label" fontWeight="bold">{now.temp}°</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel">{now.text}</Text>
        </VStack>

        <HStack alignment="center" spacing={10}>
          <VStack alignment="center" spacing={0}>
            <Text font="caption2" foregroundStyle="tertiaryLabel">最高</Text>
            <Text font="headline" foregroundStyle="label" fontWeight="bold">{tempMax}°</Text>
          </VStack>
          <VStack alignment="center" spacing={0}>
            <Text font="caption2" foregroundStyle="tertiaryLabel">最低</Text>
            <Text font="headline" foregroundStyle="secondaryLabel" fontWeight="bold">{tempMin}°</Text>
          </VStack>
        </HStack>

        {updateTime ? (
          <Text font="caption2" foregroundStyle="tertiaryLabel">{updateTime} 更新</Text>
        ) : null}
      </VStack>

      {/* 分隔线 */}
      <VStack frame={{ width: 1, height: 160 }} background="separator" />

      {/* 右列：AQI + 预警 + 预报 */}
      <VStack spacing={8} frame={{ maxWidth: "infinity" }}>
        {/* AQI */}
        <HStack alignment="center" spacing={6}>
          {aqi ? (
            <>
              <Image systemName={getAQIIcon(aqi.level)} frame={{ width: 16, height: 16 }} foregroundStyle="systemGreen" />
              <Text font="subheadline" foregroundStyle="label">AQI {aqi.category}</Text>
              <Text font="caption" foregroundStyle="secondaryLabel">{aqi.aqi}</Text>
            </>
          ) : (
            <Text font="caption" foregroundStyle="tertiaryLabel">AQI 暂无数据</Text>
          )}
        </HStack>

        {/* 预警 */}
        {warnings.length > 0 ? (
          <HStack alignment="center" spacing={4}>
            <Image systemName="exclamationmark.triangle.fill" frame={{ width: 14, height: 14 }} foregroundStyle="systemOrange" />
            <Text font="caption" foregroundStyle="systemOrange">{warnings[0].title}</Text>
          </HStack>
        ) : null}

        {/* 分隔 */}
        <VStack frame={{ maxWidth: "infinity", height: 1 }} background="separator" />

        {/* 预报 */}
        <VStack spacing={4}>
          {daily.slice(0, 2).map((day, i) => (
            <DayForecastRow key={day.fxDate} day={day} index={i} />
          ))}
        </VStack>
      </VStack>
    </HStack>
  )
}

// ═══ 大组件 ═══
function LargeWidget({ data }: { data: WeatherData }) {
  const { now, aqi, warnings, cityName, daily } = data
  const tempMax = daily[0]?.tempMax || now.temp
  const tempMin = daily[0]?.tempMin || now.temp
  const obsTime = now.obsTime
  const updateTime = obsTime ? obsTime.substring(11, 16) : ""

  return (
    <VStack spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={{ horizontal: 12, vertical: 14 }}>
      {/* 顶部：城市 + 图标 + AQI + 预警 */}
      <HStack alignment="center" spacing={8} frame={{ maxWidth: "infinity" }}>
        <Text font="headline" foregroundStyle="label" fontWeight="bold">{cityName}</Text>
        <Image systemName={getWeatherIcon(now.icon)} frame={{ width: 18, height: 18 }} foregroundStyle="label" />
        {aqi && (
          <>
            <VStack frame={{ width: 1, height: 12 }} background="separator" />
            <Image systemName={getAQIIcon(aqi.level)} frame={{ width: 12, height: 12 }} foregroundStyle="systemGreen" />
            <Text font="caption" foregroundStyle="secondaryLabel">AQI {aqi.category} {aqi.aqi}</Text>
          </>
        )}
        {warnings.length > 0 ? (
          <>
            <VStack frame={{ width: 1, height: 12 }} background="separator" />
            <Image systemName="exclamationmark.triangle.fill" frame={{ width: 12, height: 12 }} foregroundStyle="systemOrange" />
            <Text font="caption" foregroundStyle="systemOrange">{warnings[0].title}</Text>
          </>
        ) : null}
      </HStack>

      {/* 温度核心区 */}
      <HStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }}>
        <VStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }}>
          <Text font="caption" foregroundStyle="tertiaryLabel">最高</Text>
          <Text font="largeTitle" foregroundStyle="label" fontWeight="bold">{tempMax}°</Text>
        </VStack>

        <VStack alignment="center" spacing={0}>
          <Text font={52} foregroundStyle="label" fontWeight="bold">{now.temp}°</Text>
          <Text font="headline" foregroundStyle="secondaryLabel">{now.text}</Text>
        </VStack>

        <VStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }}>
          <Text font="caption" foregroundStyle="tertiaryLabel">最低</Text>
          <Text font="largeTitle" foregroundStyle="secondaryLabel" fontWeight="bold">{tempMin}°</Text>
        </VStack>
      </HStack>

      {/* 更新时间 */}
      {updateTime ? (
        <Text font="caption" foregroundStyle="tertiaryLabel" frame={{ maxWidth: "infinity", alignment: "trailing" }}>
          {updateTime} 更新
        </Text>
      ) : null}

      {/* 分隔线 */}
      <VStack frame={{ maxWidth: "infinity", height: 1 }} background="separator" />

      {/* 3天预报 */}
      <VStack spacing={6}>
        {daily.slice(0, 3).map((day, i) => (
          <DayForecastRow key={day.fxDate} day={day} index={i} />
        ))}
      </VStack>

      {/* 分隔线 */}
      <VStack frame={{ maxWidth: "infinity", height: 1 }} background="separator" />

      {/* 详情 */}
      <HStack spacing={0} frame={{ maxWidth: "infinity" }} alignment="center">
        <DetailItem icon="thermometer.medium" label="体感" value={`${now.feelsLike}°`} />
        <DetailItem icon="humidity" label="湿度" value={`${now.humidity}%`} />
        <DetailItem icon="wind" label={now.windDir} value={`${now.windScale}级`} />
        <DetailItem icon="eye" label="能见度" value={`${now.vis}km`} />
      </HStack>
    </VStack>
  )
}

function DetailItem({ label, value, icon }: { label: string, value: string, icon: string }) {
  return (
    <VStack alignment="center" spacing={2} frame={{ maxWidth: "infinity" }}>
      <Image systemName={icon} frame={{ width: 16, height: 16 }} foregroundStyle="label" />
      <Text font="caption2" foregroundStyle="label">{value}</Text>
      <Text font="caption2" foregroundStyle="tertiaryLabel">{label}</Text>
    </VStack>
  )
}

function BackgroundLayer() {
  return <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="ultraThinMaterial" />
}

// ── 主视图 ──
function WidgetView({ data }: { data: WeatherData }) {
  const isTransparent = Widget.isTransparentBackground

  return (
    <ZStack>
      {!isTransparent && <BackgroundLayer />}

      <VStack
        frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
        widgetBackground={isTransparent ? {
          style: "ultraThinMaterial" as any,
          shape: "rect"
        } as any : undefined}
      >
        {Widget.family === "systemSmall" ? (
          <SmallWidget data={data} />
        ) : Widget.family === "systemMedium" ? (
          <MediumWidget data={data} />
        ) : (
          <LargeWidget data={data} />
        )}
      </VStack>
    </ZStack>
  )
}

// ── 入口 ──
async function main() {
  const apiKey = getApiKey()

  if (!apiKey) {
    Widget.present(
      <ZStack>
        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="ultraThinMaterial" />
        <VStack alignment="center" spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={16}>
          <Image systemName="key.fill" frame={{ width: 40, height: 40 }} foregroundStyle="label" />
          <Text font="subheadline" foregroundStyle="label">请先配置 API Key</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">打开和风天气 App 设置</Text>
        </VStack>
      </ZStack>
    )
    return
  }

  let location = Widget.parameter
  if (!location) {
    const gps = await getCurrentLocation()
    if (gps) {
      location = gps
    } else {
      Widget.present(
        <ZStack>
          <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="ultraThinMaterial" />
          <VStack alignment="center" spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={16}>
            <Image systemName="location.slash.fill" frame={{ width: 40, height: 40 }} foregroundStyle="label" />
            <Text font="subheadline" foregroundStyle="label">无法获取位置</Text>
            <Text font="caption" foregroundStyle="secondaryLabel">请在设置中允许定位权限</Text>
          </VStack>
        </ZStack>
      )
      return
    }
  }

  const data = await fetchWeatherData(location, apiKey)

  if (data) {
    Widget.present(<WidgetView data={data} />)
  } else {
    Widget.present(
      <ZStack>
        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="ultraThinMaterial" />
        <VStack alignment="center" spacing={8} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={16}>
          <Image systemName="exclamationmark.icloud.fill" frame={{ width: 40, height: 40 }} foregroundStyle="label" />
          <Text font="subheadline" foregroundStyle="label">天气数据加载失败</Text>
          <Text font="caption" foregroundStyle="secondaryLabel">请检查网络连接</Text>
        </VStack>
      </ZStack>
    )
  }
}

main()
