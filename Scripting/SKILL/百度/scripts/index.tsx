import {
  Button,
  HStack,
  List,
  Navigation,
  Script,
  Section,
  Text,
  TextField,
  Picker,
  useObservable,
} from "scripting"

function View() {
  const dismiss = Navigation.useDismiss()
  const skinName = useObservable("我的皮肤")
  const author = useObservable("Akino")
  const color = useObservable("Blue")
  const result = useObservable("")

  const colors = [
    { name: "深海蓝", rgb: [30, 144, 255] },
    { name: "森林绿", rgb: [34, 139, 34] },
    { name: "玫瑰红", rgb: [220, 20, 60] },
    { name: "日落橙", rgb: [255, 140, 0] },
    { name: "紫罗兰", rgb: [138, 43, 226] },
    { name: "石墨黑", rgb: [50, 50, 50] },
    { name: "樱花粉", rgb: [255, 183, 197] },
    { name: "金色", rgb: [255, 215, 0] },
  ]

  function getColorRGB(colorName: string) {
    const c = colors.find(x => x.name === colorName)
    return c ? c.rgb : [30, 144, 255]
  }

  async function generate() {
    try {
      const [r, g, b] = getColorRGB(color.value)
      const sName = skinName.value.trim() || "MySkin"
      const sAuthor = author.value.trim() || "Akino"
      const fileName = sName.replace(/\s+/g, "_") + ".bds"
      const outputPath = `/var/mobile/Documents/${fileName}`

      result.value = `正在生成"${sName} (...)`

      // 构建内联 Python 脚本
      const pyScript = `import zipfile, os, struct, zlib\n\nPNG_1PX = bytes.fromhex('89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000c49444154789c633871e2040004b40259162e81400000000049454e44ae426082')\n\ndef create_skin(name, author, output):\n    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as z:\n        z.writestr("Info.txt", f"Name={name}\\nStyle=Default\\nSupportPlatform=SWIA\\nAuthor={author}\\n")\n        res = "[res]\\n"\n        res += "back1=@bg.png;0,0,800,250\\n"\n        res += "back2=@key_bg.png;0,0,70,60\\n"\n        res += "back3=@space_bg.png;0,0,200,60\\n"\n        for i,c in enumerate('qwertyuiopasdfghjklzxcvbnm',1):\n            res += f"fore{i+1}=@{c}_n.png;0,0,60,60\\n"\n        z.writestr("res.ini", res)\n        for mode in ['land','port']:\n            gen_ini = "[INPUT]\\nBACK_STYLE=1\\nFORE_STYLE=2\\nCENTER=\\"\\"\\n[CAND]\\nVIEW_RECT=0,0,800,60\\nLAYOUT_NAME=cand1\\nTYPE=4\\n[PANEL]\\nBACK_STYLE=4\\nFORE_STYLE=2\\nSIZE=800,260\\n"\n            z.writestr(f"{mode}/gen.ini", gen_ini)\n            for i in range(1,25):\n                x = 10 + ((i-1)%10)*78\n                y = 90 + ((i-1)//10)*75\n                z.writestr(f"{mode}/key_{i}.ini", f"[INPUT]\\nBACK_STYLE=1\\n[KEY1]\\nBACK_STYLE=3\\nVIEW_RECT={x},{y},70,60\\n\\n")\n            z.writestr(f"{mode}/enter.ini","[INPUT]\\nBACK_STYLE=1\\n[KEY25]\\nBACK_STYLE=5\\nCENTER=F49\\n")\n            z.writestr(f"{mode}/symbol.ini","[INPUT]\\nBACK_STYLE=1\\n[KEY30]\\nBACK_STYLE=8\\nCENTER=F48\\n")\n        for img in ['bg.png','key_bg.png','space_bg.png','enter.png']:\n            z.writestr(f"res/{img}", PNG_1PX)\n        for c in 'qwertyuiopasdfghjklzxcvbnm':\n            z.writestr(f"res/{c}_n.png", PNG_1PX)\n    print(f"OK: {output} ({os.path.getsize(output))} bytes)")\n\ncreate_skin("${sName}", "${sAuthor}", "${outputPath}")`

      // 写入临时 Python 并执行
      const pyFile = `/var/mobile/Documents/_gen_skin.py`
      await FileManager.write(pyFile, pyScript)
      const res = await run_shell_command(`python3 "${pyFile}"`)
      result.value = `\u2705 生成成功！\\n\n皮肤: ${sName}\\n作者: ${sAuthor}\\n颜色: ${color.value}\\n文件: ${outputPath}`
    } catch (err) {
      result.value = `\u274c 生成失败: ${err}`
    }
  }

  return (
    <List
      navigationTitle={"百度皮肤制作"}
      toolbar={{
        topBarLeading: [
          <Button
            title="关闭"
            systemImage="xmark"
            action={() => { dismiss(); Script.exit() }}
          />,
        ],
      }}
    >
      <Section>
        <Text>百度输入法皮肤制作器 — 输入信息，一键生成.bds皮肤包</Text>
      </Section>

      <Section>
        <TextField value={skinName} title={"皮肤名称"}
        <TextField value={author} title={"作者名称"}
        <Picker value={color} label={<Text>主题色</Text>}>
          {colors.map(c => (
            <Text>{c.name}</Text>
          ))}
        </Picker>
      </Section>

      <Section>
        <Button title="生成皮肤包" action={generate} />
      </Section>

      {result.value ? (
        <Section>
          <Text>{result.value}</Text>
          <HStack spacing={10}>
            <Button title="分享文件" action={() => {
              // TODO: share .bds file
            }} />
            <Button title="重新生成" action={generate} />
          </HStack>
        </Section>
      ) : null}

      <Section>
        <Text>安装方法: 百度输入法 → 超级皮肤 → 本地 → 选择 .bds 文件</Text>
      </Section>
    </List>
  )
}

Navigation.present(<View />)