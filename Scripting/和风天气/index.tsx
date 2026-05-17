/**
 * 和风天气 Widget - 配置页面
 * 
 * 在此页面配置 API Key，数据将自动永久保存到 Storage
 * 小组件使用系统当前位置获取天气
 */

import { Script, Navigation, NavigationStack, List, Section, VStack, HStack, ZStack, Text, Image, Button, TextField, Widget, useState } from 'scripting'

// ═══════════════════════════════════════════════════════════════
//  持久化存储
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY_API_KEY = "qweather_api_key"

function loadApiKey(): string {
  return Storage.get<string>(STORAGE_KEY_API_KEY) || ""
}

function saveApiKey(value: string) {
  if (value.trim()) {
    Storage.set(STORAGE_KEY_API_KEY, value.trim())
    return true
  }
  return false
}

// ═══════════════════════════════════════════════════════════════
//  主页面
// ═══════════════════════════════════════════════════════════════

function MainPage() {
  const [apiKey, setApiKey] = useState(loadApiKey())
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const dismiss = Navigation.useDismiss()
  
  const hasSavedKey = loadApiKey().length > 0

  function handleSave() {
    const key = apiKey.trim()
    if (!key) {
      setErrorMsg("请输入 API Key")
      return
    }
    if (key.length < 10) {
      setErrorMsg("API Key 格式不正确，请检查")
      return
    }
    saveApiKey(key)
    setSaved(true)
    setErrorMsg("")
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="和风天气 Widget"
        navigationBarTitleDisplayMode="large"
        toolbar={{
          cancellationAction: (
            <Button
              title="完成"
              action={dismiss}
            />
          )
        }}
      >
        {/* 标题 */}
        <Section>
          <VStack
            alignment="center"
            spacing={8}
            padding={20}
            frame={{ maxWidth: "infinity" }}
          >
            <Image
              systemName="cloud.sun.fill"
              frame={{ width: 56, height: 56 }}
              foregroundStyle={{
                primary: "#FF9A56",
                secondary: "#6FB1FC",
              }}
            />
            <Text font="title2" foregroundStyle="label">和风天气 Widget</Text>
            <Text
              font="subheadline"
              foregroundStyle="secondaryLabel"
              frame={{ maxWidth: "infinity", alignment: "center" }}
            >精美天气小组件 · 自动获取当前位置天气</Text>

            {/* 状态指示 */}
            {hasSavedKey ? (
              <HStack spacing={4} alignment="center" padding={{ top: 4 }}>
                <Image
                  systemName="checkmark.circle.fill"
                  frame={{ width: 14, height: 14 }}
                  foregroundStyle="systemGreen"
                />
                <Text font="caption" foregroundStyle="systemGreen">API Key 已配置 ✅</Text>
              </HStack>
            ) : (
              <HStack spacing={4} alignment="center" padding={{ top: 4 }}>
                <Image
                  systemName="exclamationmark.circle.fill"
                  frame={{ width: 14, height: 14 }}
                  foregroundStyle="systemRed"
                />
                <Text font="caption" foregroundStyle="systemRed">请先配置 API Key</Text>
              </HStack>
            )}
          </VStack>
        </Section>

        {/* API Key 设置 */}
        <Section
          header={<Text font="headline">API Key 设置</Text>}
          footer={
            <Text font="caption" foregroundStyle="tertiaryLabel">
              👆 输入后点击「保存」自动永久存储，无需重复填写
            </Text>
          }
        >
          <TextField
            title="和风天气 API Key"
            value={apiKey}
            onChanged={(val) => {
              setApiKey(val)
              setErrorMsg("")
            }}
            prompt="粘贴你的 API Key"
          />

          <VStack spacing={4} padding={{ top: 8 }}>
            <Button
              title={saved ? "✅ 已保存！" : "💾 保存 API Key"}
              action={handleSave}
            />
            {errorMsg ? (
              <Text font="footnote" foregroundStyle="systemRed">{errorMsg}</Text>
            ) : null}
            {hasSavedKey && (
              <Button
                title="🗑 清除已保存的 Key"
                role="destructive"
                action={() => {
                  Storage.remove(STORAGE_KEY_API_KEY)
                  setApiKey("")
                  setSaved(false)
                }}
              />
            )}
          </VStack>
        </Section>

        {/* 使用说明 */}
        <Section
          header={<Text font="headline">使用方法</Text>}
        >
          <VStack spacing={10} padding={12}>
            <StepRow num="1" text="在上面输入你的和风天气 API Key 并保存" />
            <StepRow num="2" text="返回桌面，长按空白处进入编辑模式" />
            <StepRow num="3" text="点击左上角 + 号，搜索「和风天气」" />
            <StepRow num="4" text="选择喜欢的小组件尺寸，点击「添加」" />
            <StepRow num="5" text="小组件会自动获取你当前位置的天气 ✨" />
          </VStack>
        </Section>

        {/* 获取 API Key */}
        <Section
          header={<Text font="headline">如何获取 API Key？</Text>}
        >
          <VStack spacing={8} padding={12}>
            <Text font="body" foregroundStyle="label">
              1. 打开 dev.qweather.com 注册账号
            </Text>
            <Text font="body" foregroundStyle="label">
              2. 创建项目 → 选择免费订阅
            </Text>
            <Text font="body" foregroundStyle="label">
              3. 复制 API Key 粘贴到上方输入框
            </Text>
          </VStack>
        </Section>

        {/* 天气卡片预览 */}
        <Section
          header={<Text font="headline">天气卡片预览</Text>}
        >
          <VStack spacing={8} padding={12}>
            <Text font="body" foregroundStyle="secondaryLabel">
              基于当前位置实时天气数据生成的竖排天气卡片，白色圆角背景。
            </Text>
            <Button
              title="👁 预览天气卡片"
              action={async () => {
                Navigation.present(<WeatherCardPreview />)
              }}
            />
          </VStack>
        </Section>

        {/* 透明背景 */}
        <Section
          header={<Text font="headline">透明背景</Text>}
        >
          <VStack spacing={6} padding={12}>
            <Text font="body" foregroundStyle="label">
              小组件已支持 iOS 透明背景，在 Scripting App 中设置即可生效。
            </Text>
          </VStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

// ═══════════════════════════════════════════════════════════════
//  天气卡片组件
// ═══════════════════════════════════════════════════════════════

interface WeatherCardData {
  city: string
  aqi: { level: string; value: number | null }
  warnings: string[]
  weather: string
  temperature: { current: number; high: number; low: number; unit: string }
  update_time: string
}

function AqiBadge({ level }: { level: string }) {
  return (
    <HStack spacing={4} background="rgba(232,245,233,1)" padding={{ horizontal: 10, vertical: 5 }}>
      <Text font="caption" foregroundStyle="rgba(46,125,50,1)" fontWeight="medium">{level}</Text>
    </HStack>
  )
}

function WarningBadge({ text }: { text: string }) {
  return (
    <HStack spacing={4} background="rgba(227,242,253,1)" padding={{ horizontal: 10, vertical: 5 }}>
      <Image systemName="exclamationmark.triangle.fill" frame={{ width: 12, height: 12 }} foregroundStyle="rgba(21,101,192,1)" />
      <Text font="caption" foregroundStyle="rgba(21,101,192,1)" fontWeight="medium">{text}</Text>
    </HStack>
  )
}

function WeatherCard({ data }: { data: WeatherCardData }) {
  const { city, aqi, warnings, weather, temperature, update_time } = data

  return (
    <VStack
      spacing={12}
      padding={22}
      background="white"
      frame={{ maxWidth: 360 }}
    >
      {/* Row 1: 城市名（左）+ 当前温度（右） */}
      <HStack alignment="firstTextBaseline" spacing={0} frame={{ maxWidth: "infinity" }}>
        <Text
          font="title"
          foregroundStyle="label"
          fontWeight="bold"
          frame={{ maxWidth: "infinity", alignment: "leading" }}
        >
          {city}
        </Text>
        <HStack alignment="firstTextBaseline" spacing={0}>
          <Text font={52} foregroundStyle="label" fontWeight="bold">
            {temperature.current}
          </Text>
          <Text font={28} foregroundStyle="secondaryLabel" fontWeight="regular">°</Text>
        </HStack>
      </HStack>

      {/* Row 2: AQI 标签 + 预警标签 + 天气图标+文字 */}
      <HStack alignment="center" spacing={8} frame={{ maxWidth: "infinity", alignment: "leading" }}>
        {/* AQI 标签 */}
        <AqiBadge level={aqi.level} />

        {/* 预警标签 */}
        {warnings.length > 0 ? (
          <WarningBadge text={warnings[0]} />
        ) : null}

        {/* 天气图标 + 文字 */}
        <HStack spacing={4}>
          <Image systemName="sun.max.fill" frame={{ width: 16, height: 16 }} foregroundStyle="systemOrange" />
          <Text font="subheadline" foregroundStyle="secondaryLabel">{weather}</Text>
        </HStack>
      </HStack>

      {/* Row 3: 温度范围 ↑28° / ↓20° */}
      <HStack spacing={0} frame={{ maxWidth: "infinity" }}>
        <HStack spacing={4} alignment="center" frame={{ maxWidth: "infinity", alignment: "leading" }}>
          <Text font={22} foregroundStyle="systemRed" fontWeight="medium">↑</Text>
          <Text font={22} foregroundStyle="label" fontWeight="medium">{temperature.high}°</Text>
        </HStack>
        <HStack spacing={4} alignment="center" frame={{ maxWidth: "infinity", alignment: "trailing" }}>
          <Text font={22} foregroundStyle="systemBlue" fontWeight="medium">↓</Text>
          <Text font={22} foregroundStyle="secondaryLabel" fontWeight="medium">{temperature.low}°</Text>
        </HStack>
      </HStack>

      {/* Row 4: 更新时间 */}
      <Text
        font="caption2"
        foregroundStyle="tertiaryLabel"
        frame={{ maxWidth: "infinity", alignment: "leading" }}
      >
        更新时间 {update_time}
      </Text>
    </VStack>
  )
}

// ═══════════════════════════════════════════════════════════════
//  天气卡片预览页
// ═══════════════════════════════════════════════════════════════

const mockWeatherData: WeatherCardData = {
  city: "昆山市",
  aqi: { level: "优", value: null },
  warnings: ["大风蓝色预警"],
  weather: "晴朗",
  temperature: { current: 28, high: 28, low: 20, unit: "°C" },
  update_time: "13:16"
}

function WeatherCardPreview() {
  const dismiss = Navigation.useDismiss()

  return (
    <NavigationStack>
      <List
        navigationTitle="天气卡片"
        toolbar={{
          cancellationAction: (
            <Button title="关闭" action={dismiss} />
          )
        }}
      >
        <Section>
          <VStack alignment="center" spacing={0} frame={{ maxWidth: "infinity" }} padding={{ top: 20, bottom: 30 }}>
            <WeatherCard data={mockWeatherData} />
          </VStack>
        </Section>

        <Section header={<Text font="headline">数据字段说明</Text>}>
          <VStack spacing={6} padding={12}>
            <DataFieldRow label="城市" value={mockWeatherData.city} />
            <DataFieldRow label="空气质量" value={`${mockWeatherData.aqi.level}`} />
            <DataFieldRow label="预警" value={mockWeatherData.warnings[0]} />
            <DataFieldRow label="天气状况" value={mockWeatherData.weather} />
            <DataFieldRow label="当前温度" value={`${mockWeatherData.temperature.current}${mockWeatherData.temperature.unit}`} />
            <DataFieldRow label="最高温" value={`${mockWeatherData.temperature.high}°`} />
            <DataFieldRow label="最低温" value={`${mockWeatherData.temperature.low}°`} />
            <DataFieldRow label="更新时间" value={mockWeatherData.update_time} />
          </VStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

function DataFieldRow({ label, value }: { label: string; value: string }) {
  return (
    <HStack spacing={8} alignment="center" frame={{ maxWidth: "infinity" }}>
      <Text font="subheadline" foregroundStyle="secondaryLabel" frame={{ width: 80 }}>{label}</Text>
      <Text font="body" foregroundStyle="label" fontWeight="medium">{value}</Text>
    </HStack>
  )
}

// ═══════════════════════════════════════════════════════════════
//  辅助组件
// ═══════════════════════════════════════════════════════════════

function StepRow({ num, text }: { num: string, text: string }) {
  return (
    <HStack spacing={10} alignment="top">
      <Text
        font="subheadline"
        foregroundStyle="systemBlue"
        fontWeight="bold"
      >{num}.</Text>
      <Text font="body" foregroundStyle="label" frame={{ maxWidth: "infinity" }}>{text}</Text>
    </HStack>
  )
}

// ═══════════════════════════════════════════════════════════════
//  入口
// ═══════════════════════════════════════════════════════════════

async function run() {
  await Navigation.present(<MainPage />)
  Script.exit()
}

run()
