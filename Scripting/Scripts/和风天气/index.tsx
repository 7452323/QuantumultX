/**
 * 和风天气 Widget - 配置页面
 * 在此页面配置 API Key，数据将自动永久保存到 Storage
 * 小组件使用系统当前位置获取天气
 */

import { Script, Navigation, NavigationStack, List, Section, VStack, HStack, ZStack, Text, Image, Button, TextField, Widget, useState } from 'scripting'

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

function MainPage() {
  const [apiKey, setApiKey] = useState(loadApiKey())
  const [saved, setSaved] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const dismiss = Navigation.useDismiss()
  const hasSavedKey = loadApiKey().length > 0

  function handleSave() {
    const key = apiKey.trim()
    if (!key) { setErrorMsg("请输入 API Key"); return }
    if (key.length < 10) { setErrorMsg("API Key 格式不正确，请检查"); return }
    saveApiKey(key)
    setSaved(true)
    setErrorMsg("")
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <NavigationStack>
      <List navigationTitle="和风天气 Widget" navigationBarTitleDisplayMode="large"
        toolbar={{cancellationAction:(<Button title="完成" action={dismiss}/>)}}>
        <Section><VStack alignment="center" spacing={8} padding={20} frame={{maxWidth:"infinity"}}>
          <Image systemName="cloud.sun.fill" frame={{width:56,height:56}} foregroundStyle={{primary:"#FF9A56",secondary:"#6FB1FC"}}/>
          <Text font="title2" foregroundStyle="label">和风天气 Widget</Text>
          <Text font="subheadline" foregroundStyle="secondaryLabel" frame={{maxWidth:"infinity",alignment:"center"}}>精美天气小组件 · 自动获取当前位置天气</Text>
          {hasSavedKey?(<HStack spacing={4} alignment="center" padding={{top:4}}><Image systemName="checkmark.circle.fill" frame={{width:14,height:14}} foregroundStyle="systemGreen"/><Text font="caption" foregroundStyle="systemGreen">API Key 已配置 ✅</Text></HStack>):(<HStack spacing={4} alignment="center" padding={{top:4}}><Image systemName="exclamationmark.circle.fill" frame={{width:14,height:14}} foregroundStyle="systemRed"/><Text font="caption" foregroundStyle="systemRed">请先配置 API Key</Text></HStack>)}
        </VStack></Section>
        <Section header={<Text font="headline">API Key 设置</Text>} footer={<Text font="caption" foregroundStyle="tertiaryLabel">👆 输入后点击「保存」自动永久存储，无需重复填写</Text>}>
          <TextField title="和风天气 API Key" value={apiKey} onChanged={(val)=>{setApiKey(val);setErrorMsg("")}} prompt="粘贴你的 API Key"/>
          <VStack spacing={4} padding={{top:8}}>
            <Button title={saved?"✅ 已保存！":"💾 保存 API Key"} action={handleSave}/>
            {errorMsg?(<Text font="footnote" foregroundStyle="systemRed">{errorMsg}</Text>):null}
            {hasSavedKey&&(<Button title="🗑 清除已保存的 Key" role="destructive" action={()=>{Storage.remove(STORAGE_KEY_API_KEY);setApiKey("");setSaved(false)}}/>)}
          </VStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<MainPage />)
  Script.exit()
}
run()
