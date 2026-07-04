/**
 * 百度输入法皮肤生成器
 * iOS (.bdi) / Android (.bds)
 * 纯 Scripting 实现 — 无需 Python / adb
 */

const MODES = [
  "en_26",
  "en_26s",
  "en_9",
  "en_9s",
  "py_26",
  "py_9",
  "num_26",
  "num_9",
  "symbol",
  "sel_ch",
  "sel_en",
  "bh",
  "hw_full",
  "hw_grid",
  "symbol_hw",
  "def_26_list",
] as const

/* 配色预设 */
const COLOR_PRESETS = [
  { name: "深海蓝", bg: "0f1729ff", fg: "e2e8f0ff", accent: "f87171ff" },
  { name: "星空紫", bg: "1e1143ff", fg: "ede9feff", accent: "a78bfaff" },
  { name: "森林绿", bg: "0a2e1aff", fg: "dcfce7ff", accent: "fbbf24ff" },
  { name: "樱草粉", bg: "3b0e2aff", fg: "fce7f3ff", accent: "fb7185ff" },
  { name: "深岩灰", bg: "1a1a1aff", fg: "f5f5f5ff", accent: "f97116ff" },
  { name: "碧海浪", bg: "0c2e3eff", fg: "cffafeff", accent: "06b6d4ff" },
  { name: "暖沙金", bg: "2e2810ff", fg: "fef9c3ff", accent: "f59e0bff" },
  { name: "极光青", bg: "0a2e3eff", fg: "ccfbf1ff", accent: "14b8a6ff" },
]

/* ── 文件内容生成 ── */

function gen_info(name: string, author: string, plat: string) {
  return `Name=${name}\nStyle=Default\nSupportPlatform=${plat}\nAuthor=${author}\n`
}

function gen_css(bg: string, fg: string, accent: string) {
  const p: string[] = []
  p.push("[GLOBAL]", "STYLE_NUM=614", "FOR=720", "")
  p.push("[STYLE101]背景", `NM_COLOR=${bg}`, "")
  p.push("[STYLE102]字体", `NM_COLOR=${fg}`, "FONT_CLEARTYPE=1", "FONT_SIZE=40", "")
  p.push("[STYLE103]面板背", `NM_COLOR=${bg}`, "")
  p.push("[STYLE104]面板", "SIZE=800,245", "")
  p.push("[STYLE105]更多字体", `NM_COLOR=${fg}`, "FONT_SIZE=37", "")
  p.push("[STYLE106]更细胞", "NM_IMG=back,5", "")
  p.push("[STYLE111]候背", `${bg.slice(0, 6)}bb`, "")
  p.push("[STYLE113]候字体", `NM_COLOR=${fg}`, "FONT_SIZE=42", "")
  p.push("[STYLE114]首字", `NM_COLOR=${accent}`, "FONT_SIZE=42", "")
  p.push("[STYLE121]列背", "NM_IMG=back,7", "")
  p.push("[STYLE123]列字体", `NM_COLOR=${fg}`, "FONT_SIZE=38", "")
  p.push("[STYLE133]分隔", "NM_COLOR=454545ff", "")
  p.push("[STYLE151]气泡", "NM_COLOR=aa999999", "")
  p.push("[STYLE153]泡字体", `NM_COLOR=${fg}`, "FONT_SIZE=60", "")
  p.push("[STYLE155]泡细胞", "NM_IMG=back,11", "")

  for (let i = 161; i <= 183; i++) {
    p.push(`[STYLE${i}]`, `NM_IMG=graph,${i - 160}`, `HL_IMG=graph,${i - 160}`, "")
  }
  for (let i = 201; i <= 210; i++) {
    p.push(`[STYLE${i}]`, `NM_IMG=plus,${i - 200}`, `HL_IMG=plus,${i - 200}`, "")
  }
  let idx = 1
  for (const c of "qwertyuiopasdfghjklzxcvbnm") {
    p.push(`[STYLE${210 + idx}]=${c}`, `NM_IMG=en,${idx}`, `HL_IMG=en,${idx}`, "")
    idx++
  }
  idx = 27
  for (const c of "QWERTYUIOPASDFGHJKLZXCVBNM") {
    p.push(`[STYLE${240 + idx - 26}]=${c}`, `NM_IMG=en,${idx}`, `HL_IMG=en,${idx}`, "")
    idx++
  }
  for (let i = 291; i <= 296; i++) {
    p.push(`[STYLE${i}]`, `NM_IMG=bh6,${i - 290}`, `HL_IMG=bh6,${i - 290}`, "")
  }
  for (let i = 301; i <= 310; i++) {
    p.push(`[STYLE${i}]`, `NM_IMG=pluss,${i - 300}`, `HL_IMG=pluss,${i - 300}`, "")
  }
  idx = 11
  for (const s of ["+","-","*","/","=","%",".",",","?","@","`","~"]) {
    p.push(`[STYLE${400 + idx - 10}]=${s}`, `NM_IMG=plus,${idx}`, `HL_IMG=plus,${idx}`, "")
    idx++
  }
  for (let i = 501; i <= 510; i++) {
    p.push(`[STYLE${i}]`, `NM_IMG=texts,${i - 500}`, `HL_IMG=texts,${i - 500}`, "")
  }
  idx = 1
  for (const s of ["zh","ch","sh","~"]) {
    p.push(`[STYLE${610 + idx}]=${s}`, `NM_IMG=add_sp,${idx}`, `HL_IMG=add_sp,${idx}`, "")
    idx++
  }

  return p.join("\n")
}

function gen_main_ini() {
  return `[INPUT]
BACK_STYLE=101
FORE_STYLE=102

[CAND]
VIEW_RECT=0,0,800,60
LAYOUT_NAME=cand1
TYPE=4

[PANEL]
BACK_STYLE=103
FORE_STYLE=102
SIZE=800,245

[MORE]
GRID=4,5
SYM_LAYOUT=symbol
LAYOUT_NAME=sel_ch
FORE_STYLE=105
CELL_STYLE=106
CELL_SIZE=50,50

[HINT]
LAYOUT_NAME=hint1
TYPE=0

[LIST]
BACK_STYLE=121
CELL_STYLE=123
FORE_STYLE=123
CELL_SIZE=57,60
POS=33,43
VIEW_RECT=0,0,800,118

[KEY60]
CELL_STYLE=133
FORE_STYLE=133
PADDING=10,10,10,10

[KEY61]
STYLE=106
VIEW_RECT=10,452,96,70
HOLD=F50

[KEY63]
VIEW_RECT=10,452,96,70
HOLD=F50

[KEY64]
STYLE=106
VIEW_RECT=700,452,96,70

[KEY65]
STYLE=106
VIEW_RECT=700,108,100,60
`
}

function gen_cand() {
  return `[TAB]
BACK_STYLE=113
FORE_STYLE=113
PADDING=0,0,50,0
CELL_STYLE=113
CELL_W=40

[CAND]
BACK_STYLE=113
FORE_STYLE=113
CELL_STYLE=113
PADDING=0,0,50,0
FIRST_GAP=12
CELL_W=40
`
}

function gen_hint() {
  return `[TIP0]
STYLE=151
PADDING=20,48,0,0
VIEW_RECT=0,200,800,48
POSITION=0,-50,80,
`
}

function gen_mini() {
  return `[INPUT]
BACK_STYLE=101
FORE_STYLE=102

[CAND]
VIEW_RECT=0,0,800,60
LAYOUT_NAME=cand1
TYPE=4

[PANEL]
BACK_STYLE=103
FORE_STYLE=102
SIZE=800,245

[MORE]
GRID=4,5
SYM_LAYOUT=symbol
LAYOUT_NAME=sel_ch
FORE_STYLE=105
CELL_STYLE=106
CELL_SIZE=50,50

[HINT]
LAYOUT_NAME=hint1
TYPE=0

[LIST]
BACK_STYLE=121
CELL_STYLE=123
FORE_STYLE=123
CELL_SIZE=57,60
POS=33,43
`
}

function gen_til() {
  return `[GLOBAL]
USE_ALPHA=2
TILE_NUM=1

[IMG1]
SOURCE_RECT=0,0,80,312
INNER_RECT=34,21,18,270
SCALE=1,1,1,1,1
`
}

/* ── 主函数 ── */

export async function generateSkin(params: {
  name: string
  author: string
  platform: "iOS" | "Android"
  colors: { bg: string; fg: string; accent: string }
}): Promise<string> {
  const { name, author, platform, colors } = params

  const isIOS = platform === "iOS"
  const ext = isIOS ? ".bdi" : ".bds"
  const platCode = isIOS ? "I" : "A"
  const outName = `${name.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, "_")}${ext}`
  const outPath = `${FileManager.documentsDirectory}/${outName}`

  const ts = Date.now()
  const baseDir = `${FileManager.temporaryDirectory}/baidu_${ts}`
  const landDir = `${baseDir}/land`
  const portDir = `${baseDir}/port`
  const resDir = `${baseDir}/res`

  await FileManager.createDirectory(landDir, true)
  await FileManager.createDirectory(portDir, true)
  await FileManager.createDirectory(resDir, true)

  // 1. Info.txt
  await FileManager.writeAsString(`${baseDir}/Info.txt`, gen_info(name, author, platCode))

  // 2. CSS
  await FileManager.writeAsString(`${resDir}/default.css`, gen_css(colors.bg, colors.fg, colors.accent))

  // 3. TIL
  await FileManager.writeAsString(`${resDir}/back.til`, gen_til())

  // 4. INI (land + port)
  const mainIni = gen_main_ini()
  const cand = gen_cand()
  const hint = gen_hint()
  const mini = gen_mini()

  for (const dir of [landDir, portDir]) {
    await FileManager.writeAsString(`${dir}/gen.ini`, mainIni)
    await FileManager.writeAsString(`${dir}/def_26.ini`, mainIni)
    await FileManager.writeAsString(`${dir}/cand0.cnd`, cand)
    await FileManager.writeAsString(`${dir}/hint1.pop`, hint)
    for (const m of MODES) {
      await FileManager.writeAsString(`${dir}/${m}.ini`, mini)
    }
  }

  // 5. PNG placeholders (1×1 gray PNG)
  const pngHex =
    "89504e470d0a1a0a0000000d" +
    "49484452000000010000000108060000007f1d4b830000000c" +
    "49444154789c6360f8cf00000002000168651a1a0000000049454e44ae426082"
  const pngData = Data.fromHexString(pngHex) as Data
  for (const img of ["back","graph","en","plus","pluss","bh6","texts","add_sp"]) {
    await FileManager.writeAsData(`${resDir}/${img}.png`, pngData)
  }

  // 6. ZIP
  await FileManager.zip(outPath, baseDir)

  // 7. Cleanup
  await FileManager.remove(baseDir)

  return outPath
}

export { COLOR_PRESETS }
