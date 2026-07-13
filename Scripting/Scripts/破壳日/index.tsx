/**
 * 破壳日 - 设置页面
 *
 * 简洁、干净，只保留核心字段。
 * 自动保存：点「完成」或「保存」都保存设置。
 */

import {
  Button,
  HStack,
  Image,
  List,
  Navigation,
  NavigationStack,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  Toggle,
} from 'scripting'

interface Settings {
  nickname: string
  birthday: string
  nongli: boolean
  eday: string
  bless: string
  avatarPath: string
}

const DEFAULTS: Settings = {
  nickname: '',
  birthday: '',
  nongli: false,
  eday: '',
  bless: '',
  avatarPath: '',
}

function loadSettings(): Settings {
  const saved = Storage.get<string>('birthday_settings')
  if (saved) {
    try { return { ...DEFAULTS, ...JSON.parse(saved) } } catch (_) {}
  }
  return { ...DEFAULTS }
}

function saveSettings(s: Settings) {
  Storage.set('birthday_settings', JSON.stringify(s))
}

function SettingsPage() {
  const dismiss = Navigation.useDismiss()

  const saved = loadSettings()
  let nickname = saved.nickname
  let birthday = saved.birthday
  let nongli = saved.nongli
  let eday = saved.eday
  let bless = saved.bless
  let avatarPath = saved.avatarPath

  let errorMsg = ''
  let savedMsg = ''

  function getCurrentSettings(): Settings {
    return { nickname, birthday, nongli, eday, bless, avatarPath }
  }

  function handleSave(): boolean {
    if (!birthday || !/^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
      errorMsg = '生日格式：YYYY-MM-DD'
      return false
    }
    if (eday && !/^\d{4}-\d{2}-\d{2}$/.test(eday)) {
      errorMsg = '相识日格式：YYYY-MM-DD'
      return false
    }
    errorMsg = ''
    saveSettings(getCurrentSettings())
    savedMsg = '已保存 ✓'
    return true
  }

  function handleDone() {
    handleSave()
    dismiss()
  }

  /** 读取图片 → 缩放 → 转 JPEG → 写入目标路径 */
  async function compressAndSaveImage(
    sourcePath: string,
    destPath: string,
    maxSize: number,
    quality: number = 0.7
  ): Promise<void> {
    const image = UIImage.fromFile(sourcePath)
    if (!image) {
      // 降级：尝试直接拷贝原文件
      await FileManager.copyFile(sourcePath, destPath)
      return
    }
    let finalImage: UIImage = image
    const maxDim = Math.max(image.width, image.height)
    if (maxDim > maxSize) {
      const scale = maxSize / maxDim
      const thumb = image.preparingThumbnail({
        width: Math.round(image.width * scale),
        height: Math.round(image.height * scale),
      })
      if (thumb) finalImage = thumb
    }
    const data = finalImage.toJPEGData(quality)
    if (data) {
      await FileManager.writeAsData(destPath, data)
    } else {
      await FileManager.copyFile(sourcePath, destPath)
    }
  }

  async function handlePickAvatar() {
    try {
      const results = await Photos.pick({ limit: 1 })
      if (results && results.length > 0) {
        const imagePath = await results[0].imagePath()
        if (imagePath) {
          const destDir = FileManager.appGroupDocumentsDirectory + '/birthday_avatar'
          if (!await FileManager.exists(destDir)) {
            await FileManager.createDirectory(destDir, true)
          }
          const destPath = destDir + '/avatar.jpg'
          if (await FileManager.exists(destPath)) {
            await FileManager.remove(destPath)
          }
          // 压缩为 JPEG 以确保格式兼容
          await compressAndSaveImage(imagePath, destPath, 300, 0.7)
          avatarPath = destPath
          saveSettings(getCurrentSettings())
          savedMsg = '头像已更新 ✓'
        }
      }
    } catch (e) {
      console.error('选择头像失败:', e)
    }
  }

  return (
    <NavigationStack>
      <List
        navigationTitle="破壳日"
        toolbar={{
          cancellationAction: <Button title="完成" action={handleDone} />,
        }}
      >
        <Section header={<Text>个人信息</Text>}>
          {/* 头像 */}
          <HStack spacing={12}>
            {avatarPath ? (
              <Image
                filePath={avatarPath}
                frame={{ width: 44, height: 44 }}
                clipShape="circle"
                resizable
              />
            ) : (
              <Image
                systemName="person.circle.fill"
                frame={{ width: 44, height: 44 }}
                foregroundStyle={'rgba(128,128,128,0.4)' as any}
              />
            )}
            <Button title="选择头像" action={handlePickAvatar} />
            {avatarPath ? (
              <Button
                title="清除"
                action={() => {
                  avatarPath = ''
                  saveSettings(getCurrentSettings())
                  savedMsg = '头像已清除 ✓'
                }}
              />
            ) : null}
          </HStack>

          {/* 昵称 */}
          <TextField
            title="昵称"
            value={nickname}
            onChanged={(v) => { nickname = v; savedMsg = ''; saveSettings(getCurrentSettings()) }}
            prompt="你的名字"
          />
        </Section>

        <Section header={<Text>日期</Text>}>
          {/* 生日 */}
          <TextField
            title="生日"
            value={birthday}
            onChanged={(v) => { birthday = v; savedMsg = ''; saveSettings(getCurrentSettings()) }}
            prompt="YYYY-MM-DD"
          />

          {/* 农历 */}
          <HStack spacing={12}>
            <Text font={16}>农历生日</Text>
            <Spacer />
            <Toggle
              value={nongli}
              onChanged={(v) => { nongli = v; savedMsg = ''; saveSettings(getCurrentSettings()) }}
            />
          </HStack>

          {/* 相识日 */}
          <TextField
            title="相识日"
            value={eday}
            onChanged={(v) => { eday = v; savedMsg = ''; saveSettings(getCurrentSettings()) }}
            prompt="可选，YYYY-MM-DD"
          />
        </Section>

        <Section footer={<Text>显示在小组件底部</Text>}>
          <TextField
            title="寄语"
            value={bless}
            onChanged={(v) => { bless = v; savedMsg = ''; saveSettings(getCurrentSettings()) }}
            prompt="一句祝福"
          />
        </Section>

        <Section>
          <HStack spacing={12}>
            <Button title="保存" action={handleSave} />
          </HStack>
          {errorMsg ? (
            <Text font={14} foregroundStyle="red">{errorMsg}</Text>
          ) : null}
          {savedMsg ? (
            <Text font={14} foregroundStyle="green">{savedMsg}</Text>
          ) : null}
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present(<SettingsPage />)
  Script.exit()
}

run()
