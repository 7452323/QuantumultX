/**
 * 破壳日 - 设置界面
 */
import { Button, Color, ColorPicker, HStack, Image, List, Navigation, NavigationStack, Script, Section, Slider, Spacer, Text, TextField, Toggle } from 'scripting'

interface Settings {
  nickname: string; birthday: string; nongli: boolean; eday: string; bless: string; avatarPath: string
  ringSize: number; fontName: number; fontAge: number; fontLunar: number; fontQuote: number; fontMeetDays: number
  padding: number; ringStroke: number; colorName: string; colorAge: string; colorLunar: string; colorQuote: string
  cornerPhotoPath: string; cornerPhotoSize: number; cornerPhotoOffsetX: number; cornerPhotoOffsetY: number
}

const DEFAULTS: Settings = {
  nickname: '小可爱', birthday: '2000-01-01', nongli: false, eday: '', bless: '', avatarPath: '',
  ringSize: 52, fontName: 16, fontAge: 11, fontLunar: 10, fontQuote: 10, fontMeetDays: 20,
  padding: 12, ringStroke: 2.5, colorName: '', colorAge: '', colorLunar: '', colorQuote: '',
  cornerPhotoPath: '', cornerPhotoSize: 52, cornerPhotoOffsetX: 8, cornerPhotoOffsetY: 0,
}

function loadSettings(): Settings {
  const saved = Storage.get<string>('birthday_settings')
  if (saved) { try { return { ...DEFAULTS, ...JSON.parse(saved) } } catch (_) {} }
  return { ...DEFAULTS }
}
function saveSettings(s: Settings) { Storage.set('birthday_settings', JSON.stringify(s)) }

function SettingsPage() {
  const dismiss = Navigation.useDismiss()
  let nickname = DEFAULTS.nickname; let birthday = DEFAULTS.birthday; let nongli = false; let eday = ''; let bless = ''
  let avatarPath = ''; let ringSize = DEFAULTS.ringSize; let fontName = DEFAULTS.fontName; let fontAge = DEFAULTS.fontAge
  let fontLunar = DEFAULTS.fontLunar; let fontQuote = DEFAULTS.fontQuote; let fontMeetDays = DEFAULTS.fontMeetDays
  let padding = DEFAULTS.padding; let ringStroke = DEFAULTS.ringStroke; let colorName = DEFAULTS.colorName
  let colorAge = DEFAULTS.colorAge; let colorLunar = DEFAULTS.colorLunar; let colorQuote = DEFAULTS.colorQuote
  let cornerPhotoPath = DEFAULTS.cornerPhotoPath; let cornerPhotoSize = DEFAULTS.cornerPhotoSize
  let cornerPhotoOffsetX = DEFAULTS.cornerPhotoOffsetX; let cornerPhotoOffsetY = DEFAULTS.cornerPhotoOffsetY
  
  const saved = loadSettings()
  nickname = saved.nickname; birthday = saved.birthday; nongli = saved.nongli; eday = saved.eday; bless = saved.bless
  avatarPath = saved.avatarPath; ringSize = saved.ringSize; fontName = saved.fontName; fontAge = saved.fontAge
  fontLunar = saved.fontLunar; fontQuote = saved.fontQuote; fontMeetDays = saved.fontMeetDays; padding = saved.padding
  ringStroke = saved.ringStroke; colorName = saved.colorName; colorAge = saved.colorAge; colorLunar = saved.colorLunar
  colorQuote = saved.colorQuote; cornerPhotoPath = saved.cornerPhotoPath; cornerPhotoSize = saved.cornerPhotoSize
  cornerPhotoOffsetX = saved.cornerPhotoOffsetX; cornerPhotoOffsetY = saved.cornerPhotoOffsetY
  
  let errorMsg = ''; let savedMsg = ''
  function getCurrentSettings(): Settings { return { nickname: nickname || '小可爱', birthday, nongli, eday, bless, avatarPath, ringSize, fontName, fontAge, fontLunar, fontQuote, fontMeetDays, padding, ringStroke, colorName, colorAge, colorLunar, colorQuote, cornerPhotoPath, cornerPhotoSize, cornerPhotoOffsetX, cornerPhotoOffsetY } }

  return (
    <NavigationStack>
      <List navigationTitle="破壳日 · 设置" toolbar={{cancellationAction:<Button title="关闭" action={dismiss}/>}}>
        <Section title="📝 个人信息">
          <HStack spacing={12}><Text font={16}>👤 昵称</Text><TextField title="昵称" value={nickname} onChanged={(v)=>{nickname=v}} prompt="输入昵称"/></HStack>
        </Section>
        <Section title="💾 保存">
          <HStack spacing={12}><Button title="💾 保存设置" action={()=>{saveSettings(getCurrentSettings());savedMsg='✅ 设置已保存'}}/><Button title="👁 预览组件" action={async()=>{saveSettings(getCurrentSettings());await Script.run({name:'生日',queryParameters:{action:'preview',family:'systemMedium'}})}}/></HStack>
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() { await Navigation.present(<SettingsPage />); Script.exit() }
run()
