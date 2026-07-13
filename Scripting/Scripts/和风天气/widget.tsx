import { VStack, HStack, ZStack, Text, Image, Widget, Spacer, fetch } from 'scripting'

interface NW { temp: string; feelsLike: string; icon: string; text: string; windDir: string; windScale: string; windSpeed: string; humidity: string; precip: string; pressure: string; vis: string; cloud: string; dew: string; obsTime: string }
interface DF { fxDate: string; tempMax: string; tempMin: string; iconDay: string; textDay: string }
interface HF { fxTime: string; temp: string; icon: string; text: string; precip: string }
interface AQ { aqi: string; level: string; category: string; primary: string; pm2p5: string; pm10: string }
interface WW { title: string; severity: string; text: string }

function icon(c: string, n: boolean): string {
  const v = parseInt(c)
  if (v === 100) return n ? "moon.stars.fill" : "sun.max.fill"
  if (v >= 101 && v <= 103) return n ? "cloud.moon.fill" : "cloud.sun.fill"
  if (v === 104) return "cloud.fill"
  if (v >= 150 && v <= 153) return "moon.stars.fill"
  if (v >= 300 && v <= 302) return "cloud.drizzle.fill"
  if (v >= 400 && v <= 406) return "wind"
  if (v >= 500 && v <= 515) return "cloud.fog.fill"
  if (v >= 700 && v <= 702) return "cloud.rain.fill"
  if (v >= 703 && v <= 704) return "cloud.heavyrain.fill"
  if (v >= 705 && v <= 706) return "cloud.bolt.rain.fill"
  if (v >= 707 && v <= 710) return "cloud.rain.fill"
  if (v >= 711 && v <= 712) return "cloud.heavyrain.fill"
  if (v >= 713 && v <= 715) return "cloud.bolt.rain.fill"
  if (v >= 800 && v <= 807) return "cloud.snow.fill"
  if (v === 900) return "thermometer.snowflake"
  return "questionmark"
}

const DAY_G = { colors: ["rgba(26,115,232,1)", "rgba(79,195,247,1)"], startPoint: "top", endPoint: "bottom" } as any
const NIGHT_G = { colors: ["rgba(12,20,69,1)", "rgba(26,26,46,1)"], startPoint: "top", endPoint: "bottom" } as any
function night(): boolean { const h = new Date().getHours(); return h < 6 || h >= 18 }
function aqic(lv: string): any {
  const n = parseInt(lv)
  if (n <= 1) return "rgba(0,228,0,1)"
  if (n <= 2) return "rgba(248,197,10,1)"
  if (n <= 3) return "rgba(255,126,0,1)"
  if (n <= 4) return "rgba(255,0,0,1)"
  if (n <= 5) return "rgba(186,0,51,1)"
  return "rgba(126,0,35,1)"
}
const D = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]
function wn(d: Date): number {
  const s = new Date(d.getFullYear(), 0, 1)
  return Math.ceil(((d.getTime() - s.getTime()) / 86400000 + s.getDay() + 1) / 7)
}
function getApiKey(): string { return Storage.get<string>("qweather_api_key") || "" }

function getLunarDate(): string {
  try {
    const df = new Intl.DateTimeFormat('zh-CN', { calendar: 'chinese', month: 'long', day: 'numeric' })
    return df.format(new Date())
  } catch { return "" }
}

const YI = [
  "祭祀.沐浴.扫舍.破屋", "祭祀.祈福.嫁娶.入宅", "祭祀.沐浴.出行.求医", "祭祀.祈福.开光.解除", "祭祀.沐浴.扫舍.坏垣",
  "祈福.求嗣.斋醮.嫁娶", "祭祀.沐浴.出行.入学", "祭祀.祈福.嫁娶.修造", "祭祀.沐浴.破屋.坏垣", "祈福.求嗣.嫁娶.入宅",
  "祭祀.沐浴.扫舍.破屋", "祭祀.祈福.开光.解除", "祭祀.沐浴.出行.求医", "祈福.求嗣.嫁娶.入宅", "祭祀.沐浴.扫舍.坏垣",
  "祭祀.祈福.开光.解除", "祭祀.沐浴.出行.入学", "祭祀.祈福.嫁娶.修造", "祭祀.沐浴.破屋.坏垣", "祈福.求嗣.嫁娶.入宅",
  "祭祀.沐浴.扫舍.破屋", "祭祀.祈福.开光.解除", "祭祀.沐浴.出行.求医", "祈福.求嗣.嫁娶.入宅", "祭祀.沐浴.扫舍.破屋",
  "祭祀.祈福.嫁娶.入宅", "祭祀.沐浴.出行.入学", "祭祀.祈福.开光.解除", "祭祀.沐浴.破屋.坏垣", "祭祀.祈福.嫁娶.入宅",
]

function getLunarDayOfMonth(): number {
  try {
    const df = new Intl.DateTimeFormat('zh-CN', { calendar: 'chinese', day: 'numeric' })
    const dayStr = df.format(new Date())
    const numMap: Record<string, number> = {
      "初一": 1, "初二": 2, "初三": 3, "初四": 4, "初五": 5, "初六": 6, "初七": 7, "初八": 8, "初九": 9, "初十": 10,
      "十一": 11, "十二": 12, "十三": 13, "十四": 14, "十五": 15, "十六": 16, "十七": 17, "十八": 18, "十九": 19, "二十": 20,
      "廿一": 21, "廿二": 22, "廿三": 23, "廿四": 24, "廿五": 25, "廿六": 26, "廿七": 27, "廿八": 28, "廿九": 29, "三十": 30,
    }
    return numMap[dayStr] || 1
  } catch { return 1 }
}

function getAlmanac(): string {
  const day = getLunarDayOfMonth()
  const idx = Math.max(0, Math.min(29, day - 1))
  return YI[idx]
}

async function gl(): Promise<{ s: string; lat: number; long: number } | null> {
  try { await Location.setAccuracy("best"); const l = await Location.requestCurrent({ forceRequest: false }); if (l) return { s: `${l.longitude.toFixed(4)},${l.latitude.toFixed(4)}`, lat: l.latitude, long: l.longitude }; return null } catch { return null }
}
async function fc(l: string, k: string): Promise<string> {
  try { const r = await fetch(`https://geoapi.qweather.com/v2/city/lookup?location=${l}&key=${k}`); const d = await r.json(); if (d.code === "200" && d.location?.length) return d.location[0].name } catch {} return ""
}
async function rg(lat: number, long: number): Promise<{ d: string; s: string }> {
  try { const pm = await Location.reverseGeocode({ latitude: lat, longitude: long }); if (pm?.length) return { d: pm[0].subLocality || pm[0].locality || "", s: pm[0].name || "" } } catch {} return { d: "", s: "" }
}
async function fw(loc: string, key: string): Promise<{ now: NW; daily: DF[]; hourly: HF[]; city: string; aqi: AQ | null; warn: WW[] } | null> {
  try {
    const [nr, fr, hr, ar, wr] = await Promise.all([
      fetch(`https://devapi.qweather.com/v7/weather/now?location=${loc}&key=${key}`),
      fetch(`https://devapi.qweather.com/v7/weather/7d?location=${loc}&key=${key}`),
      fetch(`https://devapi.qweather.com/v7/weather/24h?location=${loc}&key=${key}`),
      fetch(`https://devapi.qweather.com/v7/air/now?location=${loc}&key=${key}`),
      fetch(`https://devapi.qweather.com/v7/warning/now?location=${loc}&key=${key}`),
    ])
    const nd = await nr.json(), fd = await fr.json(), hd = await hr.json(), ad = await ar.json(), wd = await wr.json()
    if (nd.code !== "200" || fd.code !== "200") return null
    const city = await fc(loc, key) || "当前位置"
    const aqi = ad.code === "200" && ad.now ? { aqi: ad.now.aqi, level: ad.now.level, category: ad.now.category, primary: ad.now.primary || "", pm2p5: ad.now.pm2p5, pm10: ad.now.pm10 } : null
    const warn = wd.code === "200" && Array.isArray(wd.warning) ? wd.warning.slice(0, 2).map((w: any) => ({ title: w.title || "", severity: w.severity || "", text: w.text || "" })) : []
    const hourly = hd.code === "200" && Array.isArray(hd.hourly) ? hd.hourly.slice(0, 8).map((h: any) => ({ fxTime: h.fxTime, temp: h.temp, icon: h.icon, text: h.text, precip: h.precip || "0" })) : []
    return { now: nd.now, daily: fd.daily || [], hourly, city, aqi, warn }
  } catch { return null }
}

function HC({ h, i, lo, hi }: { h: HF; i: number; lo: number; hi: number }) {
  const t = Math.round(parseFloat(h.temp))
  const r = hi - lo || 1
  const fill = Math.max(6, ((t - lo) / r) * 34)
  const lb = i === 0 ? "现在" : h.fxTime.slice(11, 13).replace(/^0/, "") + "时"
  return (
    <VStack spacing={1} alignment="center" frame={{ width: 26 }}>
      <Text font="caption2" foregroundStyle="white" opacity={0.65}>{lb}</Text>
      <ZStack frame={{ width: 8, height: 34 }}>
        <VStack frame={{ width: 8, height: 34 }} background={"rgba(255,255,255,0.12)" as any} />
        <VStack frame={{ width: 8, height: fill, alignment: "bottom" }} background={parseFloat(h.precip) >= 0.06 ? "rgba(255,255,255,0.6)" as any : "white" as any} opacity={0.6} />
      </ZStack>
      <Text font="caption2" foregroundStyle="white" opacity={0.65}>{t}°</Text>
    </VStack>
  )
}

function SW({ nw, ct }: { nw: NW; ct: string }) {
  return (
    <VStack spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={{ horizontal: 14, vertical: 12 }}>
      <HStack frame={{ maxWidth: "infinity" }}>
        <Image systemName={icon(nw.icon, night())} frame={{ width: 22, height: 22 }} foregroundStyle="white" />
        <Spacer />
        <Text font="callout" foregroundStyle="white" opacity={0.9} fontWeight="medium" lineLimit={1}>{ct}</Text>
      </HStack>
      <Spacer />
      <Text font={48} foregroundStyle="white" fontWeight="semibold">{nw.temp}°</Text>
      <Text font="subheadline" foregroundStyle="white" opacity={0.7}>{nw.text}</Text>
      <Spacer />
      <HStack frame={{ maxWidth: "infinity" }}>
        <Text font="caption2" foregroundStyle="white" opacity={0.55}>{nw.windDir} {nw.windScale}级</Text>
        <Spacer />
        <Text font="caption2" foregroundStyle="white" opacity={0.55}>湿度 {nw.humidity}%</Text>
      </HStack>
    </VStack>
  )
}

function MW({ nw, daily, hourly }: { nw: NW; daily: DF[]; hourly: HF[] }) {
  const n = night()
  const t = Math.round(parseFloat(nw.temp))
  const hi = daily[0] ? Math.round(parseFloat(daily[0].tempMax)) : t
  const lo = daily[0] ? Math.round(parseFloat(daily[0].tempMin)) : t
  const nd = new Date()
  const lunar = getLunarDate()
  const almanac = getAlmanac()
  const textDay = daily[0]?.textDay || nw.text
  let rainText = "未来两小时无降水"
  const h2Sum = hourly.slice(0, 2).reduce((s, h) => s + parseFloat(h.precip), 0)
  if (h2Sum >= 0.3) rainText = "未来两小时有降水"

  return (
    <VStack spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={{ top: 26, leading: 12, bottom: 12, trailing: 12 }}>
      <HStack frame={{ maxWidth: "infinity" }} alignment="firstTextBaseline">
        <VStack spacing={0} frame={{ alignment: "leading" }}>
          <Text font="caption2" foregroundStyle="white" fontWeight="medium">
            {nd.getFullYear()}年{nd.getMonth()+1}月{nd.getDate()}日 第{wn(nd)}周
          </Text>
          <Text font="caption2" foregroundStyle="white" opacity={0.6}>
            {D[nd.getDay()]} {lunar}
          </Text>
        </VStack>
        <Spacer />
        <HStack spacing={3} frame={{ alignment: "trailing" }}>
          {hourly.slice(0, 6).map((h, i) => (
            <Text key={i} font="caption2" foregroundStyle="white" opacity={0.5} frame={{ width: 26, alignment: "center" }}>
              {i === 0 ? "现在" : h.fxTime.slice(11, 13).replace(/^0/, "") + "时"}
            </Text>
          ))}
        </HStack>
      </HStack>
      <Spacer minLength={4} />
      <HStack spacing={6} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <VStack spacing={1} frame={{ width: 115, maxHeight: "infinity", alignment: "leading" }}>
          <HStack spacing={4} alignment="center">
            <Image systemName={icon(nw.icon, n)} frame={{ width: 22, height: 22 }} foregroundStyle="white" />
            <HStack alignment="firstTextBaseline" spacing={0}>
              <Text font={36} foregroundStyle="white" fontWeight="regular">{t}</Text>
              <Text font={14} foregroundStyle="white" opacity={0.5}>°</Text>
            </HStack>
          </HStack>
          <HStack spacing={3} alignment="center">
            <Image systemName={icon(daily[0]?.iconDay || nw.icon, n)} frame={{ width: 12, height: 12 }} foregroundStyle="white" opacity={0.7} />
            <Text font="caption2" foregroundStyle="white" opacity={0.8}>{daily[0]?.tempMin || lo}°/{daily[0]?.tempMax || hi}° {textDay}</Text>
          </HStack>
          <VStack spacing={0} padding={{ top: 2 }}>
            <Text font="caption2" foregroundStyle="white" opacity={0.6} lineLimit={1}>宜：{almanac.slice(0, 14)}</Text>
          </VStack>
          <Text font="caption2" foregroundStyle="white" opacity={0.7}>{textDay}</Text>
        </VStack>
        <VStack frame={{ width: 1, maxHeight: "infinity" }} background={"rgba(255,255,255,0.12)" as any} />
        <VStack spacing={2} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
          <HStack spacing={3} frame={{ maxWidth: "infinity", alignment: "leading" }}>
            {hourly.slice(0, 6).map((h, i) => <HC key={i} h={h} i={i} lo={lo} hi={hi} />)}
          </HStack>
          <Spacer />
          <HStack frame={{ maxWidth: "infinity" }}>
            {daily.slice(1, 4).map((d, i) => {
              const dt = new Date(d.fxDate)
              const item = (
                <VStack key={i} spacing={1} alignment="center" frame={{ width: 48 }}>
                  <Text font="caption2" foregroundStyle="white" opacity={0.7}>{D[dt.getDay()]}</Text>
                  <Image systemName={icon(d.iconDay, n)} frame={{ width: 16, height: 16 }} foregroundStyle="white" opacity={0.8} />
                  <HStack spacing={2}>
                    <Text font="caption2" foregroundStyle="white" opacity={0.55}>{d.tempMin}°</Text>
                    <Text font="caption2" foregroundStyle="white" fontWeight="semibold">{d.tempMax}°</Text>
                  </HStack>
                </VStack>
              )
              if (i === 0) return item
              return <><Spacer />{item}</>
            })}
          </HStack>
        </VStack>
      </HStack>
      <Spacer minLength={2} />
      <Text font="caption2" foregroundStyle="white" opacity={0.5} frame={{ maxWidth: "infinity", alignment: "center" }}>
        {rainText}
      </Text>
    </VStack>
  )
}

function LW({ nw, daily, hourly, ct, aqi, warn }: {
  nw: NW; daily: DF[]; hourly: HF[]; ct: string; aqi: AQ | null; warn: WW[]
}) {
  const n = night()
  const t = Math.round(parseFloat(nw.temp))
  const f = Math.round(parseFloat(nw.feelsLike))
  const hi = daily[0] ? Math.round(parseFloat(daily[0].tempMax)) : t
  const lo = daily[0] ? Math.round(parseFloat(daily[0].tempMin)) : t
  const nd = new Date()
  const desc = warn.length > 0 ? `⚠ ${warn[0].title}` : `${nw.text} · 体感${f}°C`

  return (
    <VStack spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={{ horizontal: 14, vertical: 10 }}>
      <HStack frame={{ maxWidth: "infinity" }}>
        <Text font="headline" foregroundStyle="white" fontWeight="medium">{ct}</Text>
        <Spacer />
        <Text font="callout" foregroundStyle="white" fontWeight="medium">{nd.getFullYear()}年{nd.getMonth()+1}月{nd.getDate()}日 {D[nd.getDay()]}</Text>
      </HStack>
      <Spacer minLength={8} />
      <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
        <Image systemName={icon(nw.icon, n)} frame={{ width: 40, height: 40 }} foregroundStyle="white" />
        <HStack alignment="firstTextBaseline" spacing={0}>
          <Text font={56} foregroundStyle="white" fontWeight="regular">{t}</Text>
          <Text font={20} foregroundStyle="white" opacity={0.5}>°</Text>
        </HStack>
        <Spacer />
        {aqi ? (<VStack spacing={0} background={aqic(aqi.level)} padding={{ horizontal: 8, vertical: 3 }}><Text font="caption" foregroundStyle="white" fontWeight="bold">AQI {aqi.aqi}</Text></VStack>) : null}
      </HStack>
      <Spacer minLength={8} />
      <HStack spacing={0} frame={{ maxWidth: "infinity" }}>
        <DI icon="thermometer.medium" label="体感" val={`${f}°`} />
        <DI icon="humidity.fill" label="湿度" val={`${nw.humidity}%`} />
        <DI icon="wind.snow" label={nw.windDir} val={`${nw.windScale}级`} />
        <DI icon="eye" label="能见度" val={`${nw.vis}km`} />
        <DI icon="drop.fill" label="降水" val={`${nw.precip}mm`} />
      </HStack>
      <Spacer minLength={6} />
      <VStack frame={{ maxWidth: "infinity", height: 1 }} background={"rgba(255,255,255,0.15)" as any} />
      <Spacer minLength={6} />
      <HStack spacing={6} frame={{ maxWidth: "infinity" }}>{hourly.slice(0, 8).map((h, i) => <HC key={i} h={h} i={i} lo={lo} hi={hi} />)}</HStack>
      <Spacer minLength={6} />
      <VStack frame={{ maxWidth: "infinity", height: 1 }} background={"rgba(255,255,255,0.1)" as any} />
      <Spacer minLength={4} />
      <HStack spacing={12} frame={{ maxWidth: "infinity", alignment: "center" }}>
        {daily.slice(0, 3).map((d, i) => {
          const dt = new Date(d.fxDate)
          const lb = i === 0 ? "今天" : i === 1 ? "明天" : D[dt.getDay()]
          return (
            <VStack key={i} spacing={3} alignment="center" frame={{ maxWidth: "infinity" }}>
              <Text font="callout" foregroundStyle="white" opacity={0.8}>{lb}</Text>
              <Image systemName={icon(d.iconDay, n)} frame={{ width: 24, height: 24 }} foregroundStyle="white" />
              <Text font="body" foregroundStyle="white" fontWeight="semibold">{d.tempMax}°/{d.tempMin}°</Text>
              <Text font="caption2" foregroundStyle="white" opacity={0.6}>{d.textDay}</Text>
            </VStack>
          )
        })}
      </HStack>
      <Spacer minLength={3} />
      <Text font="footnote" foregroundStyle="white" opacity={0.7} frame={{ maxWidth: "infinity", alignment: "center" }}>{desc}</Text>
    </VStack>
  )
}

function DI({ icon: ic, label, val }: { icon: string; label: string; val: string }) {
  return (
    <VStack spacing={2} alignment="center" frame={{ maxWidth: "infinity" }}>
      <Image systemName={ic} frame={{ width: 16, height: 16 }} foregroundStyle="white" opacity={0.7} />
      <Text font="caption" foregroundStyle="white" fontWeight="medium">{val}</Text>
      <Text font="caption2" foregroundStyle="white" opacity={0.5}>{label}</Text>
    </VStack>
  )
}

interface AD { now: NW; daily: DF[]; hourly: HF[]; city: string; dist: string; str: string; aqi: AQ | null; warn: WW[] }

function WV({ d }: { d: AD }) {
  const bg = night() ? NIGHT_G : DAY_G
  return (
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={bg}>
      {Widget.family === "systemSmall" ? (
        <SW nw={d.now} ct={d.dist || d.city} />
      ) : Widget.family === "systemMedium" ? (
        <MW nw={d.now} daily={d.daily} hourly={d.hourly} />
      ) : (
        <LW nw={d.now} daily={d.daily} hourly={d.hourly} ct={d.city} aqi={d.aqi} warn={d.warn} />
      )}
    </VStack>
  )
}

async function main() {
  const key = getApiKey()
  if (!key) {
    Widget.present(<VStack spacing={8} alignment="center" frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={NIGHT_G} padding={20}>
      <Image systemName="key.fill" frame={{ width: 36, height: 36 }} foregroundStyle="systemOrange" />
      <Text font="body" foregroundStyle="white" opacity={0.8} frame={{ maxWidth: "infinity", alignment: "center" }}>请先在配置页设置 API Key</Text>
    </VStack>)
    return
  }
  const loc = await gl()
  if (!loc) {
    Widget.present(<VStack spacing={8} alignment="center" frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={NIGHT_G} padding={20}>
      <Image systemName="location.slash.fill" frame={{ width: 36, height: 36 }} foregroundStyle="systemRed" />
      <Text font="body" foregroundStyle="white" opacity={0.8} frame={{ maxWidth: "infinity", alignment: "center" }}>无法获取位置</Text>
    </VStack>)
    return
  }
  const w = await fw(loc.s, key)
  if (!w) {
    Widget.present(<VStack spacing={8} alignment="center" frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background={NIGHT_G} padding={20}>
      <Image systemName="wifi.slash" frame={{ width: 36, height: 36 }} foregroundStyle="systemRed" />
      <Text font="body" foregroundStyle="white" opacity={0.8} frame={{ maxWidth: "infinity", alignment: "center" }}>天气数据获取失败</Text>
    </VStack>)
    return
  }
  const geo = await rg(loc.lat, loc.long)
  Widget.present(<WV d={{
    now: w.now, daily: w.daily, hourly: w.hourly,
    city: w.city, dist: geo.d || w.city, str: geo.s,
    aqi: w.aqi, warn: w.warn
  }} />)
}

main()
