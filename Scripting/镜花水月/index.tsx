import {
  Navigation, Script, TabView, Tab,
  VStack, HStack, Text, Button, TextField,
  Spacer, ScrollView, Image, LazyVGrid, ProgressView,
  useState, useEffect, fetch, VideoPlayer,
  NavigationStack, List, Section,
} from "scripting"

// (download 函数运行时不存在，已改用 fetch + Data + FileManager)
// Data.fromArrayBuffer 由运行时 Data 类提供，无需 custom declare

const KEY_SEC_UID = "douyin_sec_uid"
const KEY_HISTORY = "douyin_history"
const KEY_SAVED_USERS = "douyin_saved_users"
const KEY_COOKIE = "douyin_cookie"

// 运行时全局对象
declare const screen: { width: number; height: number; scale: number } | undefined

interface VideoInfo {
  aweme_id: string; desc: string; create_time: number; cover: string
  play_url: string; duration: number; digg_count: number
  comment_count: number; author_nickname: string; author_avatar: string; unique_id: string; author_ip_location: string
  images: string[]
}
interface HistoryItem extends VideoInfo { viewed_at: number }
interface SavedUser { id: string; nickname: string; avatar: string; savedAt: number; shortId?: string; totalFavorited?: number; followingCount?: number; followerCount?: number; signature?: string; ipLocation?: string; gender?: number }

const MOBILE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
const ANDROID_UA = "Mozilla/5.0 (Android; Mobile; rv:54.0) Gecko/54.0 Firefox/54.0"

// ─── 工具函数 ───
function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)) }
function pickFirstUrl(urls?: string[]): string { if (!urls || urls.length === 0) return ""; const h = urls.find((u) => u.startsWith("https://")); return h || urls[0] || "" }

/** 取 url_list 中最高画质的 URL（通常最后一个是最高画质 CDN） */
function pickBestUrl(urls?: string[]): string {
  if (!urls || urls.length === 0) return ""
  const https = urls.filter((u) => u.startsWith("https://"))
  return https.length > 0 ? https[https.length - 1] : (urls[0] || "")
}
function formatDuration(ms: number): string { const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, "0")}` }
function formatCount(n: number): string { if (n >= 10000) return (n / 10000).toFixed(1) + "w"; if (n >= 1000) return (n / 1000).toFixed(1) + "k"; return String(n) }

// ─── 去水印 API 配置 ───
const DEWATERMARK_APIS = [
  { type: "jx", url: "https://apis.jxcxin.cn/api/douyin" },
  { type: "hybrid", url: "http://47.116.14.174:8080" },
  { type: "hybrid", url: "http://124.221.224.159:9000" },
  { type: "hybrid", url: "http://129.154.217.183:9000" },
]

/** 从 aweme_id 构造抖音分享链接 */
function getShareUrl(video: VideoInfo): string {
  return `https://www.douyin.com/video/${video.aweme_id}`
}

/**
 * 展示保存/分享选择界面
 */
async function shareVideo(video: VideoInfo, isImage: boolean) {
  const shareUrl = getShareUrl(video)
  await Navigation.present(
    <ShareProgressView
      video={video}
      shareUrl={shareUrl}
      isImage={isImage}
      originalUrl={isImage ? (video.images[0] || "") : video.play_url}
    />
  )
}

// ─── 分享进度视图 ───
function ShareProgressView({ video, shareUrl, isImage, originalUrl }: {
  video: VideoInfo
  shareUrl: string
  isImage: boolean
  originalUrl: string
}) {
  const dismiss = Navigation.useDismiss()
  const [step, setStep] = useState(0)         // 0=准备, 1=去水印, 2=下载, 3=保存, 4=完成, -1=失败
  const [progressText, setProgressText] = useState("准备中...")
  const [errorMsg, setErrorMsg] = useState("")
  const [apiStatus, setApiStatus] = useState<string[]>([])

  useEffect(() => {
    ;(async () => {
      try {
        // 步骤1：尝试去水印接口
        setStep(1)
        setProgressText("正在尝试去水印接口...")
        
        let targetUrl: string | null = null
        
        setApiStatus(prev => [...prev, `🔗 视频链接: ${shareUrl}`])
        
        // 依次尝试4个接口，显示详细诊断
        for (let i = 0; i < DEWATERMARK_APIS.length; i++) {
          const api = DEWATERMARK_APIS[i]
          setApiStatus(prev => [...prev, `⏳ 接口 ${i+1}/${DEWATERMARK_APIS.length} 尝试中...`])
          
          try {
            let requestUrl: string
            if (api.type === "jx") {
              requestUrl = `${api.url}?url=${encodeURIComponent(shareUrl)}`
            } else {
              requestUrl = `${api.url}/api/hybrid/video_data?url=${encodeURIComponent(shareUrl)}&minimal=false`
            }
            
            setApiStatus(prev => [...prev, `  请求: ${requestUrl.substring(0, 80)}...`])
            
            const resp = await fetch(requestUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15" }
            })
            
            const statusText = `  HTTP ${resp.status} ${resp.statusText}`
            setApiStatus(prev => [...prev, statusText])
            
            if (!resp.ok) {
              setApiStatus(prev => [...prev, `  ❌ HTTP 状态码错误`])
              continue
            }
            
            const rawText = await resp.text()
            let json: any
            try { json = JSON.parse(rawText) } catch {
              setApiStatus(prev => [...prev, `  ❌ JSON 解析失败，返回不是 JSON`])
              continue
            }
            
            // 检查 detail 错误响应（Douyin_TikTok_Download_API 的错误格式）
            if (json.detail) {
              const errCode = json.detail.code || "?"
              const errMsg = json.detail.message || JSON.stringify(json.detail).substring(0, 100)
              setApiStatus(prev => [...prev, `  ❌ API 错误 [${errCode}]: ${errMsg}`])
              continue
            }
            
            // 宽松检查 code
            const respCode = json.code
            const codeOk = respCode === 200 || respCode === "200" || Number(respCode) === 200
            
            if (!codeOk) {
              setApiStatus(prev => [...prev, `  ❌ 返回 code=${respCode}，期待 200`])
              continue
            }
            
            if (!json.data) {
              setApiStatus(prev => [...prev, `  ❌ 返回无 data 字段`])
              continue
            }
            
            // --- 提取无水印 URL ---
            let extractedUrl: string | null = null
            
            if (api.type === "jx") {
              // apis.jxcxin.cn: data.url
              if (json.data.url) {
                extractedUrl = json.data.url
              } else {
                setApiStatus(prev => [...prev, `  ❌ data 格式不符，无 url 字段`])
                continue
              }
            } else {
              // Douyin_TikTok_Download_API hybrid 接口
              // 实际返回结构是 aweme_detail 的原始数据，在 data 顶层：
              // data.video.play_addr.url_list[] — 视频
              // data.images[].url_list[] — 图文
              // 也可能有 data.aweme_detail.video.play_addr.url_list[] 嵌套
              // 或 data.video_data.play_addr.url_list[]
              const vd = json.data
              
              // 根据 isImage 分开提取视频/图片路径，避免图文作品误取视频 URL
              if (isImage) {
                // 图片：只看图片路径
                const imagePaths = [
                  () => vd.images?.[0]?.url_list,
                  () => vd.image_data?.[0]?.url_list,
                  () => vd.aweme_detail?.images?.[0]?.url_list,
                ]
                for (const getList of imagePaths) {
                  try {
                    const list = getList()
                    if (list?.length > 0) {
                      extractedUrl = list[list.length - 1]
                      break
                    }
                  } catch {}
                }
              } else {
                // 视频：只看视频路径
                const videoPaths = [
                  () => vd.video?.play_addr?.url_list,
                  () => vd.video_data?.play_addr?.url_list,
                  () => vd.aweme_detail?.video?.play_addr?.url_list,
                  () => vd.aweme_detail?.video_data?.play_addr?.url_list,
                ]
                for (const getList of videoPaths) {
                  try {
                    const list = getList()
                    if (list?.length > 0) {
                      extractedUrl = list[list.length - 1]
                      break
                    }
                  } catch {}
                }
              }
              
              if (extractedUrl) {
                // 成功
              } else {
                const dataStr = JSON.stringify(vd).substring(0, 300)
                setApiStatus(prev => [...prev, `  ❌ 未找到视频/图片 URL，data 结构: ${dataStr}`])
                continue
              }
            }
            
            if (extractedUrl) {
              targetUrl = extractedUrl
              setApiStatus(prev => [...prev, `  ✅ 接口 ${i+1} 成功！`])
              break
            }
          } catch (e: any) {
            setApiStatus(prev => [...prev, `  ❌ 异常: ${e.message || e}`])
          }
        }
        
        if (!targetUrl) {
          setApiStatus(prev => [...prev, `⚠️ 所有去水印接口失败，回退原始地址`])
          targetUrl = originalUrl
        }
        
        if (!targetUrl) {
          throw new Error("无法获取下载地址（原始地址也为空）")
        }
        
        setApiStatus(prev => [...prev, `📥 下载地址已获取，长度: ${targetUrl.length} 字符`])
        
        // 步骤2：下载文件（带百分比进度）
        setStep(2)
        setProgressText("正在下载文件...")
        const ext = isImage ? "jpg" : "mp4"
        const fileName = `${video.aweme_id}.${ext}`
        
        setApiStatus(prev => [...prev, `📦 文件名: ${fileName}`])
        
        // 用 fetch + Data + FileManager 下载（绕过不存在的 download 函数）
        setApiStatus(prev => [...prev, `📥 开始下载...`])
        
        const downloadResp = await fetch(targetUrl, {
          headers: { "User-Agent": MOBILE_UA }
        })
        if (!downloadResp.ok) {
          throw new Error(`下载 HTTP ${downloadResp.status}`)
        }
        
        setProgressText("正在下载... 接收数据中")
        const arrayBuf = await downloadResp.arrayBuffer()
        const data = Data.fromArrayBuffer(arrayBuf)
        if (!data) {
          throw new Error("将下载数据转换为 Data 失败")
        }
        
        setProgressText(`正在下载... ${data.size} 字节`)
        
        // 步骤3：写入 Documents + 文件路径版保存到相册
        setStep(3)
        setProgressText("正在保存到相册...")
        
        // 先写文件到 Documents（路径已确认带 / 结尾）
        // @ts-ignore - Data 类型冲突
        const docPath = FileManager.documentsDirectory + fileName
        if (await FileManager.exists(docPath)) {
          await FileManager.remove(docPath)
        }
        try {
          // @ts-ignore
          await FileManager.writeAsData(docPath, data)
        } catch (writeErr: any) {
          throw new Error(`写入文件失败: ${writeErr?.message || String(writeErr)}`)
        }
        setApiStatus(prev => [...prev, `💾 已写入: ${docPath} (${data.size} 字节)`])
        
        // 文件路径版保存（视频版已验证成功）
        let savedOk = false
        if (isImage) {
          savedOk = await Photos.savePhoto(docPath, { fileName, shouldMoveFile: true })
        } else {
          savedOk = await Photos.saveVideo(docPath, { fileName, shouldMoveFile: true })
        }
        setApiStatus(prev => [...prev, `📤 保存${savedOk ? "成功" : "失败"}`])
        
        if (!savedOk) {
          // 回退：ShareSheet
          setApiStatus(prev => [...prev, `⚠️ Photos 保存失败，尝试 ShareSheet 回退`])
          await ShareSheet.present([docPath])
        }
        
        setStep(4)
        setProgressText("完成 ✓")
        
      } catch (e: any) {
        setStep(-1)
        const msg = (e?.message || String(e) || JSON.stringify(e) || "未知错误").substring(0, 200)
        setErrorMsg(msg)
        setApiStatus(prev => [...prev, `❌ ${msg}`])
      }
    })()
  }, [])

  return (
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="systemBackground"
      padding={24} spacing={16} alignment="center"
    >
      <Text font="title2" bold>保存/分享</Text>
      
      {step !== -1 && step < 4 ? (
        <ProgressView foregroundStyle="systemBlue" />
      ) : null}
      
      {step !== -1 && step < 4 ? (
        <Text font="body" foregroundStyle="secondaryLabel">{progressText}</Text>
      ) : null}
      
      {step === 4 ? (
        <Image systemName="checkmark.circle.fill" font="largeTitle" foregroundStyle="systemGreen" />
      ) : null}
      
      {step === -1 ? (
        <VStack spacing={8} alignment="center" padding={{ top: 4 }}>
          <Image systemName="xmark.circle.fill" font="largeTitle" foregroundStyle="systemRed" />
          <Text font="body" foregroundStyle="systemRed">{errorMsg}</Text>
        </VStack>
      ) : null}
      
      {/* 详细诊断日志 */}
      {apiStatus.length > 0 ? (
        <ScrollView frame={{ maxWidth: "infinity", maxHeight: 280 }}>
          <VStack spacing={2} frame={{ maxWidth: "infinity" }}>
            {apiStatus.map((s, i) => (
              <Text key={i} font="caption2" foregroundStyle="tertiaryLabel" lineLimit={3}>{s}</Text>
            ))}
          </VStack>
        </ScrollView>
      ) : null}
      
      {step >= 4 || step === -1 ? (
        <Button title="关闭" action={() => dismiss()} />
      ) : null}
    </VStack>
  )}

// ─── 视频播放 ───
function VideoPreviewView({ video }: { video: VideoInfo }) {
  const dismiss = Navigation.useDismiss()
  const [player, setPlayer] = useState<AVPlayer | null>(null)
  const [error, setError] = useState("")
  const isImagePost = video.images.length > 0
  // 获取屏幕宽度用于分页，兜底 400
  const pageWidth = ((typeof screen !== 'undefined' && typeof screen?.width === 'number')
    ? screen.width
    : 400)

  useEffect(() => {
    if (isImagePost) return
    const p = new AVPlayer()
    if (!video.play_url) { setError("无可播放地址"); return }
    p.setSource(video.play_url, {
      headers: { "User-Agent": MOBILE_UA, Referer: "https://www.douyin.com/" }
    })
    SharedAudioSession.setCategory('playback', [])
    SharedAudioSession.setActive(true)
    p.onReadyToPlay = () => { 
      setPlayer(p)
      p.play()
    }
    p.onError = () => { setError("播放失败") }
    return () => {
      try { p.stop(); p.dispose() } catch {}
    }
  }, [])

  return (
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="black">
      {isImagePost ? (
        <ScrollView axes="horizontal" scrollTargetBehavior="paging">
          <HStack spacing={0}>
            {video.images.map((url, i) => (
              <VStack key={i} frame={{ width: pageWidth, maxHeight: "infinity" }} background="black" alignment="center">
                <Image
                  imageUrl={url}
                  resizable
                  scaleToFill
                  frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
                />
              </VStack>
            ))}
          </HStack>
        </ScrollView>
      ) : player ? (
        <VideoPlayer
          player={player}
          overlay={
            <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} padding={16}>
              {/* 右上角：关闭按钮 */}
              <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topTrailing" }}>
                <Button action={() => { try { player.stop(); player.dispose() } catch {}; dismiss() }}>
                  <Image systemName="xmark.circle.fill" font="title" foregroundStyle="white" opacity={0.8} />
                </Button>
              </VStack>
              {/* 左下角：分享按钮（原生纯图标无背景） */}
              <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "bottomLeading" }}>
                <Button action={() => shareVideo(video, false)}>
                  <Image systemName="square.and.arrow.up" font="title3" foregroundStyle="white" opacity={0.85} />
                </Button>
              </VStack>
            </VStack>
          }
        />
      ) : error ? (
        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} alignment="center" spacing={12}>
          <Image systemName="exclamationmark.triangle.fill" font="largeTitle" foregroundStyle="white" opacity={0.6} />
          <Text foregroundStyle="white" opacity={0.6}>{error}</Text>
          <Button title="关闭" action={() => { dismiss() }} />
        </VStack>
      ) : (
        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} alignment="center">
          <ProgressView foregroundStyle="white" />
          {video.cover ? (
            <Image imageUrl={video.cover} resizable scaleToFill frame={{ maxWidth: "infinity", maxHeight: "infinity" }} opacity={0.3} />
          ) : null}
        </VStack>
      )}
      {/* 图文作品的顶部按钮栏 */}
      {isImagePost ? (
        <HStack frame={{ maxWidth: "infinity" }} padding={{ horizontal: 16, top: 16 }} spacing={16}>
          {/* 左上角：分享按钮（原生纯图标） */}
          <Button action={() => shareVideo(video, true)}>
            <Image systemName="square.and.arrow.up" font="title3" foregroundStyle="white" opacity={0.85} />
          </Button>
          <Spacer />
          {/* 右上角：关闭按钮 */}
          <Button action={dismiss}>
            <Image systemName="xmark.circle.fill" font="title" foregroundStyle="white" opacity={0.8} />
          </Button>
        </HStack>
      ) : null}
    </VStack>
  )
}

// ─── 打开视频（防双击） ───
let _openingVideo = false
async function openVideo(video: VideoInfo, _idx?: number) {
  if (_openingVideo) return
  _openingVideo = true
  try {
    addToHistory(video)
    await Navigation.present(<VideoPreviewView video={video} />)
  } finally {
    _openingVideo = false
  }
}

// ─── Storage ───
function loadSecUid(): string { return Storage.get<string>(KEY_SEC_UID) || "" }
function saveSecUid(uid: string) { Storage.set(KEY_SEC_UID, uid) }

function loadHistory(): HistoryItem[] {
  try { const raw = Storage.get<string>(KEY_HISTORY); if (!raw) return []; return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [] }
  catch { return [] }
}
function saveHistory(items: HistoryItem[]) { Storage.set(KEY_HISTORY, JSON.stringify(items.slice(0, 500))) }
function addToHistory(video: VideoInfo) {
  const history = loadHistory(); const idx = history.findIndex((h) => h.aweme_id === video.aweme_id)
  if (idx >= 0) history.splice(idx, 1)
  history.unshift({ ...video, viewed_at: Date.now() }); saveHistory(history)
}
function loadSavedUsers(): SavedUser[] {
  try { const raw = Storage.get<string>(KEY_SAVED_USERS); if (!raw) return []; return Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [] }
  catch { return [] }
}
function saveUser(user: SavedUser) {
  const users = loadSavedUsers(); const idx = users.findIndex((u) => u.id === user.id)
  if (idx >= 0) users.splice(idx, 1); users.unshift(user)
  Storage.set(KEY_SAVED_USERS, JSON.stringify(users.slice(0, 20)))
}

// ─── 抖音号解析 ───
function extractUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s]+/)
  return m ? m[0].replace(/[:：][^\s]*$/, "") : text
}

// ─── iesdouyin API + Cookie 直调 ───
// 有 Cookie 时带上，可能 API 需要认证才能正确返回 JSON
async function resolveViaIesdouyin(uniqueId: string): Promise<{ secUid: string; nickname: string; avatar: string; shortId: string; totalFavorited: number; followingCount: number; followerCount: number; signature: string; ipLocation: string; gender: number } | null> {
  try {
    const cookie = (Storage.get<string>(KEY_COOKIE) || "").trim()
    const headers: Record<string, string> = { "User-Agent": ANDROID_UA, Referer: "https://www.iesdouyin.com/" }
    if (cookie) headers["Cookie"] = cookie
    const url = `https://www.iesdouyin.com/web/api/v2/user/info/?unique_id=${encodeURIComponent(uniqueId)}`
    const resp = await timeoutFetch(fetch(url, { method: "GET", headers }), 5000)
    if (!resp.ok) return null
    const text = await resp.text()
    let data: any
    try { data = JSON.parse(text) } catch { return null }
    const info = data?.user_info
    if (!info || !info.sec_uid) return null
    return {
      secUid: info.sec_uid,
      nickname: info.nickname || "",
      avatar: pickFirstUrl(info.avatar_thumb?.url_list) || pickFirstUrl(info.avatar_larger?.url_list) || "",
      shortId: info.unique_id || "",
      totalFavorited: parseInt(info.total_favorited) || 0,
      followingCount: info.following_count || 0,
      followerCount: info.follower_count || 0,
      signature: info.signature || info.desc || "",
      ipLocation: info.ip_location || info.ip_loc || info.region || "",
      gender: info.gender ?? 0,
    }
  } catch {
    return null
  }
}

async function resolveViaWebView(url: string): Promise<string> {
  const webView = new WebViewController({ ephemeral: true })
  try {
    webView.setCustomUserAgent(MOBILE_UA)
    await webView.loadURL(url)
    await webView.waitForLoad()
    // 等待页面重定向和 JS 渲染完成
    let prevUrl = url
    for (let i = 0; i < 6; i++) {
      await sleep(1500)
      const currentUrl = await webView.evaluateJavaScript<string>("location.href")
      if (currentUrl && currentUrl !== prevUrl) {
        prevUrl = currentUrl
        // URL 变了（重定向了），额外等一会儿让新页面渲染
        await sleep(2000)
        break
      }
    }
    const extracted = await webView.evaluateJavaScript<string>(`
      (function(){
        var h=location.href;
        // 1. 优先从 URL 提取：/user/xxx 或 /share/user/xxx
        var m=h.match(/\/user\/([A-Za-z0-9_\-\.@]+)/);
        if(m&&m[1].length>15)return m[1];
        m=h.match(/sec_user_id=([^&#]+)/);
        if(m)return decodeURIComponent(m[1]);
        // 2. 从 _ROUTER_DATA 提取
        try{var v=Object.values(window._ROUTER_DATA?.loaderData||{});for(var i=0;i<v.length;i++){if(v[i]?.userPage?.sec_uid)return v[i].userPage.sec_uid;if(v[i]?.sec_uid)return v[i].sec_uid}}catch(e){}
        // 3. 从 __INITIAL_STATE__ 提取
        try{var s=window.__INITIAL_STATE__;if(s?.user?.sec_uid)return s.user.sec_uid}catch(e){}
        // 4. 从 __NEXT_DATA__ 提取
        try{var nd=JSON.parse(document.getElementById('__NEXT_DATA__')?.textContent||'{}');if(nd?.props?.pageProps?.user?.sec_uid)return nd.props.pageProps.user.sec_uid;if(nd?.props?.pageProps?.sec_uid)return nd.props.pageProps.sec_uid}catch(e){}
        // 5. 从所有 script 标签搜索 sec_uid
        try{var sc=document.scripts;for(var j=0;j<sc.length;j++){m=(sc[j].textContent||'').match(/"sec_uid"\s*:\s*"([A-Za-z0-9_\-\.@]+)"/);if(m&&m[1].length>15)return m[1]}}catch(e){}
        // 6. 从 SSR state 提取
        try{var ssr=window.__SSR_RENDER_DATA__||window.__STORE__||window.__PREFETCH_DATA__;if(ssr&&typeof ssr==='object'){var json=JSON.stringify(ssr);m=json.match(/"sec_uid"\s*:\s*"([A-Za-z0-9_\-\.@]+)"/);if(m&&m[1].length>15)return m[1]}}catch(e){}
        return''})()
    `)
    return typeof extracted === "string" ? extracted : ""
  } finally { webView.dispose() }
}

async function resolveSecUid(input: string): Promise<{ secUid: string; nickname?: string; avatar?: string; shortId?: string; totalFavorited?: number; followingCount?: number; followerCount?: number; signature?: string; ipLocation?: string; gender?: number; error?: string }> {
  let val = extractUrl(input)
  if (!val) return { secUid: "", error: "输入为空" }
  if (/v\.douyin\.com/.test(val)) {
    try {
      const uid = await resolveViaWebView(val)
      if (uid) return { secUid: uid }
      return { secUid: "", error: "无法解析该短链接" }
    }
    catch (e) { return { secUid: "", error: `解析失败: ${(e as Error).message}` } }
  }
  const mShare = val.match(/douyin\.com\/share\/user\/([A-Za-z0-9_\-\.]+)/)
  if (mShare) {
    const shareName = mShare[1]
    // 先用 Cookie 解析，不行再用 WebView
    try {
      const info = await resolveViaIesdouyin(shareName)
      if (info) return { secUid: info.secUid, nickname: info.nickname, avatar: info.avatar, shortId: shareName, totalFavorited: info.totalFavorited, followingCount: info.followingCount, followerCount: info.followerCount, signature: info.signature, ipLocation: info.ipLocation, gender: info.gender }
    } catch {}
    try {
      const uid = await resolveViaSharePage(shareName)
      if (uid) return { secUid: uid }
    } catch {}
    try {
      const uid = await resolveViaWebView(val)
      if (uid) return { secUid: uid }
    } catch {}
    return { secUid: "", error: "无法解析该分享链接" }
  }
  const m1 = val.match(/sec_user_id=([^&#]+)/)
  if (m1) return { secUid: decodeURIComponent(m1[1]) }
  const m2 = val.match(/douyin\.com\/user\/([A-Za-z0-9_\-\.]+)/)
  if (m2) return { secUid: m2[1] }
  if (val.length > 20 && /^[A-Za-z0-9_\-\.]{20,}$/.test(val)) return { secUid: val }
  if (/^[A-Za-z0-9_.]{3,30}$/.test(val) && !/^https?:\/\//.test(val)) {
    try {
      // 1. 原始 iesdouyin API + Cookie（最快，返回完整资料）
      const info = await resolveViaIesdouyin(val)
      if (info) return { secUid: info.secUid, nickname: info.nickname, avatar: info.avatar, shortId: val, totalFavorited: info.totalFavorited, followingCount: info.followingCount, followerCount: info.followerCount, signature: info.signature, ipLocation: info.ipLocation, gender: info.gender }
      // 2. SSR 分享页面 + Cookie
      const uid2 = await resolveViaSharePage(val)
      if (uid2) return { secUid: uid2, shortId: val }
      // 3. 最终兜底：WebView
      const uid3 = await resolveViaWebView(`https://www.douyin.com/share/user/${encodeURIComponent(val)}`)
      if (uid3) return { secUid: uid3, shortId: val }
      return { secUid: "", error: "无法解析该抖音号" }
    }
    catch (e) { return { secUid: "", error: `解析失败: ${(e as Error).message}` } }
  }
  if (/^https?:\/\//.test(val)) {
    try { const uid = await resolveViaWebView(val); if (uid) return { secUid: uid }; return { secUid: "", error: "无法从该链接解析" } }
    catch (e) { return { secUid: "", error: `解析失败: ${(e as Error).message}` } }
  }
  return { secUid: val }
}

// ─── 通过 Cookie 请求 SSR 分享页面解析抖音号 ───
// 原理：douyin.com/share/user/{抖音号} 是服务端渲染页面，HTML 中包含用户数据的 JSON
// 比 WebView 快（单次 HTTP 请求），比搜索 API 可靠
async function resolveViaSharePage(keyword: string): Promise<string> {
  const cookie = (Storage.get<string>(KEY_COOKIE) || "").trim()
  if (!cookie) return ""
  try {
    const url = `https://www.douyin.com/share/user/${encodeURIComponent(keyword)}`
    const resp = await timeoutFetch(fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": MOBILE_UA,
        "Cookie": cookie,
        "Referer": "https://www.douyin.com/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      }
    }), 5000)
    if (!resp.ok) return ""
    const html = await resp.text()

    // 1. 尝试从 __INITIAL_STATE__ 提取
    const m1 = html.match(/<script[^>]*>window\.__INITIAL_STATE__\s*=\s*({.*?});?\s*<\/script>/)
    if (m1) {
      try {
        const state = JSON.parse(m1[1])
        // 不同页面结构：{ user: { sec_uid } } 或 { userPage: { sec_uid } }
        if (state?.user?.sec_uid) return state.user.sec_uid
        if (state?.userPage?.sec_uid) return state.userPage.sec_uid
      } catch {}
    }

    // 2. 直接用正则搜索所有 script 中的 "sec_uid":"xxxx"
    const m2 = html.match(/"sec_uid"\s*:\s*"([A-Za-z0-9_\-\.@]{10,})"/)
    if (m2) return m2[1]

    // 3. 从任意 script 内容里提取
    const scriptRe = /<script[^>]*>([^<]{0,50000}?"sec_uid"[^<]*?)<\/script>/g
    let sm
    while ((sm = scriptRe.exec(html)) !== null) {
      const m = sm[1].match(/"sec_uid"\s*:\s*"([A-Za-z0-9_\-\.@]{10,})"/)
      if (m) return m[1]
    }
  } catch {}
  return ""
}

// ─── API ───
function parseAwemeResponse(rawJson: string): { videos: VideoInfo[]; maxCursor: number; hasMore: boolean } {
  let data: any
  try { data = JSON.parse(rawJson) } catch { throw new Error("JSON 解析失败") }
  if (data.status_code !== 0) throw new Error(`API 错误: ${data.status_msg || data.status_code}`)
  let awemeList: any[] = Array.isArray(data.aweme_list) ? data.aweme_list : []
  if (awemeList.length === 0) {
    function findAwemeList(obj: any): any[] | null {
      if (!obj || typeof obj !== 'object') return null
      if (Array.isArray(obj.aweme_list)) return obj.aweme_list
      for (const k of Object.keys(obj)) { const v = obj[k]; if (v && typeof v === 'object') { if (Array.isArray(v.aweme_list)) return v.aweme_list; const r = findAwemeList(v); if (r) return r } }
      return null
    }
    const found = findAwemeList(data)
    if (found) awemeList = found
  }
  if (awemeList.length === 0) throw new Error("未找到作品数据")
  const videos: VideoInfo[] = awemeList.map((item: any) => ({
    aweme_id: item.aweme_id || "", desc: item.desc || "", create_time: item.create_time || 0,
    cover: pickBestUrl(item.video?.origin_cover?.url_list) || pickBestUrl(item.video?.cover?.url_list),
    play_url: pickBestUrl(item.video?.play_addr?.url_list) || pickBestUrl(item.video?.download_addr?.url_list) || "",
    duration: item.video?.duration || 0, digg_count: item.statistics?.digg_count || 0,
    comment_count: item.statistics?.comment_count || 0,
    author_nickname: item.author?.nickname || "",
    author_avatar: pickBestUrl(item.author?.avatar_larger?.url_list) || pickBestUrl(item.author?.avatar_medium?.url_list) || pickBestUrl(item.author?.avatar_thumb?.url_list),
    unique_id: item.author?.unique_id || "",
    author_ip_location: item.author?.ip_location || item.author?.ip_loc || item.author?.region || "",
    images: (item.images || []).map((img: any) => pickBestUrl(img.url_list)).filter(Boolean),
  }))
  return { videos, maxCursor: data.max_cursor || 0, hasMore: data.has_more === 1 }
}

async function fetchViaWebView(secUid: string, cursor: number = 0): Promise<string> {
  const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/post/?device_platform=web&aid=6383&sec_user_id=${encodeURIComponent(secUid)}&count=21&max_cursor=${cursor}&cookie_enabled=true&platform=web&downlink=10`
  const webView = new WebViewController({ ephemeral: false })
  try {
    webView.setCustomUserAgent(MOBILE_UA)
    await webView.loadURL("https://www.douyin.com/")
    await webView.waitForLoad()
    let sig = ""
    for (let i = 0; i < 15; i++) {
      await sleep(2000)
      try {
        sig = await webView.evaluateJavaScript<string>("(document.cookie.match(/__ac_signature=([^;]+)/)||[])[1]||''")
        if (sig && sig.length > 5) break
      } catch {}
    }
    if (!sig || sig.length <= 5) {
      try {
        await webView.loadURL(`https://www.douyin.com/user/${encodeURIComponent(secUid)}`)
        await webView.waitForLoad()
        await sleep(3000)
        for (let i = 0; i < 10; i++) {
          await sleep(2000)
          try {
            sig = await webView.evaluateJavaScript<string>("(document.cookie.match(/__ac_signature=([^;]+)/)||[])[1]||''")
            if (sig && sig.length > 5) break
          } catch {}
        }
      } catch {}
    }
    if (!sig || sig.length <= 5) {
      throw new Error("WebView 未获取到 __ac_signature。请在设置页填写 douyin.com Cookie 即可跳过此步骤。")
    }
    await webView.evaluateJavaScript(`
      (function(){window.__API_DONE=0;window.__API_DATA='';try{
        var x=new XMLHttpRequest();
        x.open('GET','${apiUrl.replace(/'/g, "\\'")}',true);
        x.setRequestHeader('Accept','application/json, text/plain, */*');
        x.onload=function(){window.__API_DATA=x.responseText;window.__API_DONE=2};
        x.onerror=function(){window.__API_DONE=1;window.__API_ERR='onerror'};
        x.ontimeout=function(){window.__API_DONE=1;window.__API_ERR='timeout'};
        x.timeout=20000;x.send()
      }catch(e){window.__API_DONE=1;window.__API_ERR=String(e)}})()
    `)
    for (let i = 0; i < 15; i++) {
      await sleep(1500)
      try {
        const done = await webView.evaluateJavaScript<string>("String(window.__API_DONE)")
        if (done === "2") return await webView.evaluateJavaScript<string>("window.__API_DATA") || ""
        if (done === "1") break
      } catch {}
    }
    try {
      const err = await webView.evaluateJavaScript<string>("window.__API_ERR || ''")
      throw new Error(`WebView XHR 失败: ${err || '请求超时或无响应'}`)
    } catch { throw new Error("WebView XHR 请求失败") }
  } finally { webView.dispose() }
}

async function fetchViaCookie(secUid: string, cursor: number = 0): Promise<string> {
  const cookie = (Storage.get<string>(KEY_COOKIE) || "").trim()
  if (!cookie || cookie.length < 50) throw new Error("未配置 Cookie 或长度不足")
  const apiUrl = `https://www.douyin.com/aweme/v1/web/aweme/post/?device_platform=web&aid=6383&sec_user_id=${encodeURIComponent(secUid)}&count=21&max_cursor=${cursor}&cookie_enabled=true&platform=web&downlink=10`
  const resp = await fetch(apiUrl, {
    headers: { "User-Agent": MOBILE_UA, "Referer": `https://www.douyin.com/user/${encodeURIComponent(secUid)}`, "Cookie": cookie, "Accept": "application/json" },
  })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  return await resp.text()
}

async function fetchUserPosts(secUid: string, cursor: number = 0): Promise<{ videos: VideoInfo[]; maxCursor: number; hasMore: boolean }> {
  const rawJson = await fetchViaCookie(secUid, cursor)
  return parseAwemeResponse(rawJson)
}

// ─── 获取用户完整资料 ───
function timeoutFetch<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ])
}

async function fetchUserProfile(secUid: string): Promise<Partial<SavedUser> | null> {
  let result: Partial<SavedUser> = {}
  let shortId = ""

  // 1. 用 sec_uid 调 iesdouyin（基础数据）+ Cookie
  try {
    const cookie = (Storage.get<string>(KEY_COOKIE) || "").trim()
    const headers: Record<string, string> = { "User-Agent": ANDROID_UA, Referer: "https://www.iesdouyin.com/" }
    if (cookie) headers["Cookie"] = cookie
    const url = `https://www.iesdouyin.com/web/api/v2/user/info/?sec_uid=${encodeURIComponent(secUid)}`
    const resp = await fetch(url, { method: "GET", headers })
    if (resp.ok) {
      const data = await resp.json()
      const info = data?.user_info
      if (info && info.sec_uid) {
        result = {
          nickname: info.nickname || "",
          avatar: pickFirstUrl(info.avatar_thumb?.url_list) || pickFirstUrl(info.avatar_larger?.url_list) || "",
          shortId: info.unique_id || "",
          totalFavorited: parseInt(info.total_favorited) || 0,
          followingCount: info.following_count || 0,
          followerCount: info.follower_count || 0,
          signature: info.signature || info.desc || "",
          ipLocation: info.ip_location || info.ip_loc || info.region || "",
          gender: info.gender ?? 0,
        }
      }
    }
  } catch {}
  // 2. 从已保存数据拿 shortId
  if (!shortId) {
    const existing = loadSavedUsers().find((u) => u.id === secUid)
    if (existing?.shortId) shortId = existing.shortId
  }

  // 3. 从作品 API 的 author 提取 unique_id
  if (!shortId) {
    try {
      const rawJson = await timeoutFetch(fetchViaCookie(secUid, 0), 15000)
      const data = JSON.parse(rawJson)
      const author = data?.aweme_list?.[0]?.author
      if (author?.unique_id) shortId = author.unique_id
    } catch {}
  }



  // 4. 尝试抖音官方用户资料 API（需要 Cookie）— 补充任何缺失字段
  if (!result.totalFavorited || !result.signature || !result.ipLocation || !result.gender) {
    try {
      const cookie = Storage.get<string>(KEY_COOKIE) || ""
      if (cookie && cookie.length >= 50) {
        const url = `https://www.douyin.com/aweme/v1/web/user/profile/other/?sec_user_id=${encodeURIComponent(secUid)}&device_platform=web&aid=6383&cookie_enabled=true&platform=web`
        const resp = await timeoutFetch(fetch(url, {
          method: "GET",
          headers: { "User-Agent": ANDROID_UA, "Cookie": cookie, "Referer": "https://www.douyin.com/" }
        }), 15000)
        if (resp.ok) {
          const data = await resp.json()
          const user = data?.user
          if (user) {
            const avatar = pickFirstUrl(user.avatar_thumb?.url_list) || pickFirstUrl(user.avatar_larger?.url_list) || ""
            result = {
              nickname: user.nickname || result.nickname || "",
              avatar: avatar || result.avatar || "",
              shortId: user.unique_id || result.shortId || "",
              totalFavorited: parseInt(user.total_favorited) || result.totalFavorited || 0,
              followingCount: user.following_count || result.followingCount || 0,
              followerCount: user.follower_count || result.followerCount || 0,
              signature: user.signature || user.desc || result.signature || "",
              ipLocation: user.ip_location || user.ip_loc || user.region || result.ipLocation || "",
              gender: user.gender ?? result.gender ?? 0,
            }
            // 不要 return — 后面还有从 author 数据补 IP 的步骤
          }
        }
      }
    } catch {}
  }

  // 5.5 如果 IP 地区仍为空，尝试从保存的用户数据中提取（不额外请求 API）
  if (!result.ipLocation) {
    // 从已保存的用户列表里找同一个人
    const existing = loadSavedUsers().find((u) => u.id === secUid)
    if (existing?.ipLocation) result.ipLocation = existing.ipLocation
  }

  // 6. 最终回退：直接从 author 数据
  if (!result.totalFavorited) {
    try {
      const rawJson = await timeoutFetch(fetchViaCookie(secUid, 0), 15000)
      const data = JSON.parse(rawJson)
      const author = data?.aweme_list?.[0]?.author
      if (author) {
        result = {
          nickname: author.nickname || result.nickname || "",
          avatar: pickFirstUrl(author.avatar_thumb?.url_list) || pickFirstUrl(author.avatar_larger?.url_list) || result.avatar || "",
          shortId: author.unique_id || result.shortId || "",
          totalFavorited: parseInt(author.total_favorited) || result.totalFavorited || 0,
          followingCount: author.following_count || result.followingCount || 0,
          followerCount: author.follower_count || result.followerCount || 0,
          signature: author.signature || result.signature || "",
          ipLocation: author.ip_location || author.ip_loc || author.region || result.ipLocation || "",
          gender: author.gender ?? result.gender ?? 0,
        }
      }
    } catch {}
  }

  return Object.keys(result).length > 0 ? result : null
}


// ─── 切换用户弹窗 ───
function SwitchUserView({ onSwitch, currentUid }: { onSwitch: (uid: string) => void; currentUid: string }) {
  const dismiss = Navigation.useDismiss()
  const users = loadSavedUsers()
  const [switching, setSwitching] = useState(false)

  return (
    <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} background="systemBackground">
      <NavigationStack>
        <List navigationTitle="切换抖音号">
          {users.length === 0 ? (
            <VStack frame={{ maxWidth: "infinity", height: 300 }} alignment="center" spacing={16}>
              <Image systemName="person.2.slash" font="largeTitle" foregroundStyle="tertiaryLabel" />
              <Text font="title3" bold foregroundStyle="secondaryLabel">还没有保存的抖音号</Text>
              <Text font="callout" foregroundStyle="tertiaryLabel">去「设置」标签页添加</Text>
            </VStack>
          ) : (
            <Section>
              {/* 用网格展示 */}
              <VStack>
                <LazyVGrid columns={[
                  { size: { type: "flexible", min: 80, max: 120 }, spacing: 12 },
                  { size: { type: "flexible", min: 80, max: 120 }, spacing: 12 },
                  { size: { type: "flexible", min: 80, max: 120 }, spacing: 12 },
                ]} spacing={16} padding={16}>
                  {users.map((u) => (
                    <VStack key={u.id} spacing={6} alignment="center" frame={{ maxWidth: "infinity" }} onTapGesture={() => {
                      if (u.id === currentUid) { dismiss(); return }
                      setSwitching(true); saveSecUid(u.id); dismiss(); onSwitch(u.id)
                    }}>
                      {u.avatar ? (
                        <Image imageUrl={u.avatar} resizable scaleToFill frame={{ width: 64, height: 64 }} clipShape={{ type: "rect", cornerRadius: 32 }} />
                      ) : (
                        <VStack frame={{ width: 64, height: 64 }} background="systemGray4" clipShape={{ type: "rect", cornerRadius: 32 }} alignment="center">
                          <Image systemName="person.fill" font="title2" foregroundStyle="secondaryLabel" />
                        </VStack>
                      )}
                      <Text font="caption" lineLimit={1}>{u.nickname || u.id.slice(0, 10)}</Text>
                      {u.id === currentUid ? <Text font="caption2" foregroundStyle="systemBlue">当前</Text> : null}
                    </VStack>
                  ))}
                </LazyVGrid>
              </VStack>
            </Section>
          )}
        </List>
      </NavigationStack>
    </VStack>
  )
}

// ─── Cookie 工具函数 ───

/** 将 Cookie 数组序列化为 HTTP Cookie 字符串 */
function cookiesToString(cookies: { name: string; value: string; domain: string }[]): string {
  // 只保留 douyin.com 域名的 cookie
  const relevant = cookies.filter((c) => c.domain.includes("douyin.com") || c.domain.includes("iesdouyin.com"))
  // 去重（后出现的覆盖前面的同名 cookie）
  const seen = new Map<string, string>()
  for (const c of relevant) {
    seen.set(c.name, c.value)
  }
  return Array.from(seen.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

/** 从 WebView 提取所有 douyin.com Cookie 并保存到 Storage */
async function extractAndSaveCookies(webView: any): Promise<string> {
  const allCookies: any[] = await webView.getAllCookies()
  const cookieStr = cookiesToString(allCookies)
  if (cookieStr && cookieStr.length > 50) {
    Storage.set(KEY_COOKIE, cookieStr)
  }
  return cookieStr
}

/** 检查已保存的 Cookie 是否仍然有效（调用抖音简单 API） */
async function checkCookieValidity(): Promise<{ valid: boolean; detail: string }> {
  const cookie = (Storage.get<string>(KEY_COOKIE) || "").trim()
  if (!cookie || cookie.length < 50) {
    return { valid: false, detail: "未登录或 Cookie 无效" }
  }
  try {
    // 用 Cookie 调一个简单的资料 API 看返回
    const resp = await fetch(
      "https://www.douyin.com/aweme/v1/web/im/user/info/",
      {
        method: "GET",
        headers: {
          "User-Agent": MOBILE_UA,
          "Cookie": cookie,
          "Referer": "https://www.douyin.com/",
          "Accept": "application/json",
        },
      }
    )
    const text = await resp.text()
    let json: any
    try { json = JSON.parse(text) } catch { json = {} }
    if (json.status_code === 0 || json.status_code === undefined) {
      return { valid: true, detail: "Cookie 有效" }
    }
    if (json.status_code === 3 || json.status_code === -99 || String(text).includes("login")) {
      return { valid: false, detail: "Cookie 已过期，请重新登录" }
    }
    return { valid: true, detail: `状态码: ${json.status_code}` }
  } catch (e: any) {
    return { valid: false, detail: `检查失败: ${e.message || e}` }
  }
}

/**
 * 静默刷新 Cookie：打开一个不可见的 WebView，导航到抖音
 * 利用已有的 cookie（非 ephemeral WebView 共享 cookie store）
 * 看能否自动续期 __ac_signature
 */
async function silentRefreshCookie(): Promise<{ ok: boolean; message: string }> {
  const currentCookie = (Storage.get<string>(KEY_COOKIE) || "").trim()
  if (!currentCookie || currentCookie.length < 50) {
    return { ok: false, message: "尚未登录，无法刷新" }
  }
  
  let webView: any = null
  try {
    webView = new WebViewController()
    webView.setCustomUserAgent(MOBILE_UA)
    
    // 先预置现有 Cookie
    const cookiePairs = currentCookie.split(";").map(s => s.trim())
    for (const pair of cookiePairs) {
      const eq = pair.indexOf("=")
      if (eq <= 0) continue
      const name = pair.substring(0, eq)
      const value = pair.substring(eq + 1)
      await webView.setCookie({
        name,
        value,
        domain: ".douyin.com",
        path: "/",
        isSecure: false,
        isHTTPOnly: false,
        isSessionOnly: false,
      })
    }
    
    // 加载抖音首页（cookie 会被自动携带）
    await webView.loadURL("https://www.douyin.com/")
    await webView.waitForLoad()
    await sleep(3000)
    
    // 获取更新后的 cookie
    const allCookies: any[] = await webView.getAllCookies()
    const newCookieStr = cookiesToString(allCookies)
    
    if (newCookieStr && newCookieStr.length >= 50) {
      // 检查 __ac_signature 是否更新
      const oldSig = currentCookie.match(/__ac_signature=([^;]+)/)?.[1] || ""
      const newSig = newCookieStr.match(/__ac_signature=([^;]+)/)?.[1] || ""
      
      if (newSig && newSig !== oldSig) {
        // __ac_signature 已更新 — 保存新 cookie
        Storage.set(KEY_COOKIE, newCookieStr)
        return { ok: true, message: "Cookie 已自动刷新" }
      } else if (newSig) {
        return { ok: true, message: "Cookie 仍有效，无需刷新" }
      }
    }
    
    return { ok: false, message: "无法自动刷新，请重新登录" }
  } catch (e: any) {
    return { ok: false, message: `刷新失败: ${e.message || e}` }
  } finally {
    if (webView) webView.dispose()
  }
}

// ─── 抖音 WebView 登录视图 ───
/**
 * 在 App 内嵌 WebView 展示抖音官网，用户自然完成登录（扫码/手机号/邮箱）
 * 登录成功后自动提取 Cookie 并保存
 */
function DouyinLoginView({ onLoginComplete }: { onLoginComplete: () => void }) {
  const dismiss = Navigation.useDismiss()
  const [status, setStatus] = useState<string>("加载中...")
  const [progress, setProgress] = useState(true)
  const [error, setError] = useState("")
  
  useEffect(() => {
    ;(async () => {
      let webView: any = null
      try {
        webView = new WebViewController()
        webView.setCustomUserAgent(MOBILE_UA)
        
        // 监控请求：检测登录成功后的页面跳转
        let loginDetected = false
        
        webView.shouldAllowRequest = async (request: any) => {
          const url = request.url || ""
          
          // 检测登录成功信号：
          // - passport 登录回调完成进入首页
          // - 或用户个人主页
          if (!loginDetected && (
            url === "https://www.douyin.com/" ||
            url === "https://www.douyin.com/follow" ||
            url === "https://www.douyin.com/recommend" ||
            /douyin\.com\/(user|profile)/.test(url) ||
            // sso 登录回调成功
            (url.includes("passport/sso/login/callback") && url.includes("ticket=")) 
          )) {
            if (url.includes("ticket=") || !loginDetected) {
              // 延迟一点等 cookie 设置好
              loginDetected = true
              setTimeout(async () => {
                try {
                  setStatus("正在获取登录信息...")
                  await sleep(2000)
                  
                  const cookieStr = await extractAndSaveCookies(webView)
                  if (cookieStr && cookieStr.length >= 50) {
                    setStatus("登录成功 ✓")
                    setProgress(false)
                    await sleep(800)
                    onLoginComplete()
                    dismiss()
                  } else {
                    // 再等一会再试一次
                    await sleep(3000)
                    const retryStr = await extractAndSaveCookies(webView)
                    if (retryStr && retryStr.length >= 50) {
                      setStatus("登录成功 ✓")
                      setProgress(false)
                      await sleep(800)
                      onLoginComplete()
                      dismiss()
                    } else {
                      setError("无法获取 Cookie，请确保已登录成功")
                      setProgress(false)
                    }
                  }
                } catch (e: any) {
                  setError(`获取 Cookie 失败: ${e.message || e}`)
                  setProgress(false)
                }
              }, 1000)
            }
          }
          return true
        }
        
        // 启动一个轮询，监控 cookie 中的 __ac_signature
        ;(async function pollLogin() {
          for (let i = 0; i < 60; i++) { // 最多等 5 分钟（每5秒轮询一次）
            await sleep(5000)
            if (loginDetected) return // 已被 shouldAllowRequest 处理
            try {
              const cookies: any[] = await webView.getAllCookies()
              const sig = cookies.find((c: any) => c.name === "__ac_signature" && c.value.length > 5)
              const sessionid = cookies.find((c: any) => c.name === "sessionid" && c.value.length > 5)
              if (sig || sessionid) {
                loginDetected = true
                setStatus("检测到登录，正在保存...")
                await sleep(1500) // 等 cookie 稳定
                const cookieStr = await extractAndSaveCookies(webView)
                if (cookieStr && cookieStr.length >= 50) {
                  setStatus("登录成功 ✓")
                  setProgress(false)
                  await sleep(800)
                  onLoginComplete()
                  dismiss()
                }
                return
              }
            } catch {}
          }
        })()
        
        // 导航到抖音首页
        setStatus("正在打开抖音...")
        await webView.loadURL("https://www.douyin.com/")
        await webView.present({ fullscreen: true })
        setStatus("请在抖音页面登录（扫码/手机号/邮箱）")
        
      } catch (e: any) {
        setError(`启动失败: ${e.message || e}`)
        setProgress(false)
      }
    })()
  }, [])
  
  return null // WebView 已通过 present 展示，不需要 UI 组件
}

// ─── 主页 ───
function HomeView({ dismissApp }: { dismissApp: () => void }) {
  const [secUid, setSecUid] = useState(() => loadSecUid())
  const [videos, setVideos] = useState<VideoInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [cursor, setCursor] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [userInfo, setUserInfo] = useState<{ nickname: string; avatar: string }>({ nickname: "", avatar: "" })

  async function doLoadVideos(reset: boolean, uidParam?: string) {
    const targetUid = uidParam || loadSecUid()
    if (!targetUid) { setError("请先设置抖音号"); return }
    const c = reset ? 0 : cursor
    if (reset) { setLoading(true); setVideos([]) } else { setLoadingMore(true) }
    setError("")
    try {
      const result = await fetchUserPosts(targetUid, c)
      if (reset) setVideos(result.videos)
      else setVideos((prev) => [...prev, ...result.videos])
      setCursor(result.maxCursor)
      setHasMore(result.hasMore)
      if (result.videos.length > 0) {
        const first = result.videos[0]
        const info = { nickname: first.author_nickname, avatar: first.author_avatar }
        setUserInfo(info)
        // 保留已保存用户的已有字段，同时从作品数据提取 IP 地区
        const users = loadSavedUsers()
        const existing = users.find((u) => u.id === targetUid)
        const ipLoc = first.author_ip_location || ""
        if (existing) {
          saveUser({ ...existing, nickname: info.nickname, avatar: info.avatar, ipLocation: ipLoc || existing.ipLocation || "" })
        } else {
          saveUser({ id: targetUid, ...info, savedAt: Date.now(), ipLocation: ipLoc || "" })
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
    }
    if (reset) setLoading(false)
    else setLoadingMore(false)
  }

  useEffect(() => { doLoadVideos(true) }, [])

  function handleSwitchUser(uid: string) {
    setSecUid(uid)
    doLoadVideos(true, uid)
  }

  return (
    <NavigationStack>
      <List
        navigationTitle={userInfo.nickname || "抖音作品"}
        toolbar={{
          topBarLeading: <Button title="关闭" action={() => dismissApp()} />,
          topBarTrailing: (
            <HStack spacing={8}>
              <Button title="刷新" action={() => doLoadVideos(true)} disabled={loading} />
              {userInfo.avatar ? (
                <Image
                  imageUrl={userInfo.avatar}
                  resizable scaleToFill
                  frame={{ width: 28, height: 28 }}
                  clipShape={{ type: "rect", cornerRadius: 14 }}
                  onTapGesture={() => {
                    Navigation.present(<SwitchUserView onSwitch={handleSwitchUser} currentUid={secUid} />)
                  }}
                />
              ) : (
                <Image
                  systemName="person.circle"
                  font="title2"
                  foregroundStyle="systemBlue"
                  onTapGesture={() => {
                    Navigation.present(<SwitchUserView onSwitch={handleSwitchUser} currentUid={secUid} />)
                  }}
                />
              )}
            </HStack>
          ),
        }}
      >
        {error ? (
          <Section>
            <VStack padding={{ vertical: 8, horizontal: 4 }} spacing={8} frame={{ maxWidth: "infinity" }}>
              <HStack spacing={6}>
                <Image systemName="exclamationmark.triangle.fill" foregroundStyle="systemRed" font="subheadline" />
                <Text font="subheadline" foregroundStyle="systemRed">{error}</Text>
              </HStack>
              {error.includes("Cookie") || error.includes("__ac_signature") ? (
                <VStack padding={12} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 10 }} spacing={6}>
                  <Text font="caption" bold>💡 建议：</Text>
                  <Text font="caption">在「设置」标签页填入有效的 douyin.com Cookie，可跳过 WebView 直接加载，速度快且稳定。</Text>
                  <Text font="caption" foregroundStyle="tertiaryLabel">获取 Cookie：在 Safari 打开 douyin.com 并登录 → 开发者工具 → 复制 Cookie 字符串</Text>
                </VStack>
              ) : null}
            </VStack>
          </Section>
        ) : null}

        {loading ? (
          <Section>
            <VStack frame={{ maxWidth: "infinity", height: 300 }} alignment="center" spacing={12}>
              <ProgressView />
              <Text font="callout" foregroundStyle="secondaryLabel">加载中...</Text>
            </VStack>
          </Section>
        ) : videos.length === 0 ? (
          <Section>
            <VStack frame={{ maxWidth: "infinity", height: 300 }} alignment="center" spacing={8}>
              <Image systemName="video.slash" font="title" foregroundStyle="tertiaryLabel" />
              <Text font="callout" foregroundStyle="secondaryLabel" padding={{ top: 4 }}>暂无作品</Text>
            </VStack>
          </Section>
        ) : (
          <Section>
            <VStack padding={{ horizontal: 8 }}>
              <LazyVGrid columns={[
                { size: { type: "flexible", min: 100, max: 200 }, spacing: 6 },
                { size: { type: "flexible", min: 100, max: 200 }, spacing: 6 },
                { size: { type: "flexible", min: 100, max: 200 }, spacing: 6 },
              ]} spacing={6}>
                {videos.map((v, idx) => (
                    <VStack key={v.aweme_id} spacing={3} onTapGesture={() => openVideo(v, idx)}>
                      <VStack frame={{ maxWidth: "infinity", height: 200 }} background="systemGray5" clipShape={{ type: "rect", cornerRadius: 8 }}>
                        {v.cover ? <Image imageUrl={v.cover} resizable aspectRatio={{ value: null, contentMode: 'fill' }} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} /> : <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} alignment="center"><Image systemName="play.rectangle" font="largeTitle" foregroundStyle="tertiaryLabel" /></VStack>}
                        <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "bottom" }} padding={3} spacing={3}>
                          <HStack>
                            {v.duration > 0 ? (
                              <HStack padding={{ horizontal: 6, vertical: 2 }} background="black" opacity={0.6} clipShape={{ type: "rect", cornerRadius: 4 }} spacing={3}>
                                <Image systemName="play.fill" font="caption2" foregroundStyle="white" />
                                <Text font="caption2" foregroundStyle="white">{formatDuration(v.duration)}</Text>
                              </HStack>
                            ) : null}
                            {v.images.length > 0 ? (
                              <HStack padding={{ horizontal: 6, vertical: 2 }} background="black" opacity={0.6} clipShape={{ type: "rect", cornerRadius: 4 }} spacing={3}>
                                <Image systemName="photo.on.rectangle" font="caption2" foregroundStyle="white" />
                                <Text font="caption2" foregroundStyle="white">{v.images.length}</Text>
                              </HStack>
                            ) : null}
                          </HStack>
                          <HStack>
                            <HStack spacing={2}>
                              <Image systemName="heart.fill" font="caption2" foregroundStyle="systemPink" />
                              <Text font="caption2" foregroundStyle="white">{formatCount(v.digg_count)}</Text>
                            </HStack>
                          </HStack>
                        </VStack>
                      </VStack>
                    <Text font="caption2" lineLimit={2} padding={{ horizontal: 2 }}>{v.desc}</Text>
                  </VStack>
                ))}
              </LazyVGrid>
              {hasMore ? (
                <VStack padding={{ vertical: 16 }} frame={{ maxWidth: "infinity" }} alignment="center">
                  {loadingMore ? (
                    <HStack spacing={8}><ProgressView /><Text font="caption" foregroundStyle="secondaryLabel">加载更多...</Text></HStack>
                  ) : (
                    <Button action={() => doLoadVideos(false)}>
                      <HStack padding={{ horizontal: 20, vertical: 10 }} background="secondarySystemBackground" clipShape={{ type: "rect", cornerRadius: 8 }} spacing={6}>
                        <Image systemName="arrow.down.circle" font="caption" />
                        <Text font="subheadline">加载更多</Text>
                      </HStack>
                    </Button>
                  )}
                </VStack>
              ) : videos.length > 0 ? (
                <VStack padding={{ vertical: 16 }} frame={{ maxWidth: "infinity" }} alignment="center">
                  <Text font="caption" foregroundStyle="tertiaryLabel">已加载全部作品</Text>
                </VStack>
              ) : null}
            </VStack>
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}

// ─── 历史 ───
function HistoryView() {
  const [history, setHistory] = useState<HistoryItem[]>(() => loadHistory())
  useEffect(() => {
    const h = loadHistory()
    if (JSON.stringify(h) !== JSON.stringify(history)) setHistory(h)
  }, [])

  return (
    <NavigationStack>
      <List
        navigationTitle="观看历史"
        toolbar={{
          topBarTrailing: history.length > 0 ? (
            <Button title="清空" action={() => { saveHistory([]); setHistory([]) }} />
          ) : undefined,
        }}
      >
        {history.length === 0 ? (
          <Section>
            <VStack frame={{ maxWidth: "infinity", height: 300 }} alignment="center" spacing={12}>
              <Image systemName="clock.badge.questionmark" font="largeTitle" foregroundStyle="tertiaryLabel" />
              <Text font="title3" bold foregroundStyle="secondaryLabel">暂无观看历史</Text>
              <Text font="callout" foregroundStyle="tertiaryLabel">在主页点击任意作品后自动记录</Text>
            </VStack>
          </Section>
        ) : (
          <Section>
            <VStack padding={{ horizontal: 8 }}>
              <LazyVGrid columns={[
                { size: { type: "flexible", min: 100, max: 200 }, spacing: 6 },
                { size: { type: "flexible", min: 100, max: 200 }, spacing: 6 },
                { size: { type: "flexible", min: 100, max: 200 }, spacing: 6 },
              ]} spacing={6}>
                {history.map((item, idx) => (
                  <VStack key={item.aweme_id} spacing={3} onTapGesture={() => openVideo(item, idx)}>
                    <VStack frame={{ maxWidth: "infinity", height: 200 }} background="systemGray5" clipShape={{ type: "rect", cornerRadius: 8 }}>
                      {item.cover ? <Image imageUrl={item.cover} resizable aspectRatio={{ value: null, contentMode: 'fill' }} frame={{ maxWidth: "infinity", maxHeight: "infinity" }} /> : <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity" }} alignment="center"><Image systemName="play.rectangle" font="largeTitle" foregroundStyle="tertiaryLabel" /></VStack>}
                      <VStack frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "topTrailing" }} padding={3}>
                        <Button action={() => { const u = history.filter((h) => h.aweme_id !== item.aweme_id); saveHistory(u); setHistory(u) }}>
                          <Image systemName="xmark.circle.fill" font="title3" foregroundStyle="white" />
                        </Button>
                      </VStack>
                      {item.duration > 0 ? <HStack padding={{ horizontal: 6, vertical: 2 }} background="black" opacity={0.6} frame={{ maxWidth: "infinity", maxHeight: "infinity", alignment: "bottom" }}><Spacer /><Text font="caption2" foregroundStyle="white">{formatDuration(item.duration)}</Text></HStack> : null}
                    </VStack>
                    <Text font="caption2" lineLimit={2} padding={{ horizontal: 2 }}>{item.desc}</Text>
                    <Text font="caption2" foregroundStyle="tertiaryLabel" padding={{ horizontal: 2 }}>{new Date(item.viewed_at).toLocaleDateString("zh-CN")}</Text>
                  </VStack>
                ))}
              </LazyVGrid>
            </VStack>
          </Section>
        )}
      </List>
    </NavigationStack>
  )
}

// ─── 设置 ───
function SettingsView() {
  const [inputValue, setInputValue] = useState("")
  const [cookieValue, setCookieValue] = useState(() => {
    const saved = Storage.get<string>(KEY_COOKIE) || ""
    return saved.length >= 50 ? "" : saved
  })
  const [isCookieSaved, setIsCookieSaved] = useState(() => {
    const saved = (Storage.get<string>(KEY_COOKIE) || "").trim()
    return saved.length >= 50
  })
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{ type: string; text: string }>({ type: "", text: "" })
  const [cookieStatus, setCookieStatus] = useState<{ checking: boolean; valid: boolean; detail: string }>({ checking: true, valid: false, detail: "检查中..." })
  const [refreshing, setRefreshing] = useState(false)
  const [showManualCookie, setShowManualCookie] = useState(false)
  const [savedInfo, setSavedInfo] = useState<SavedUser | null>(null)
  const [savedUsers, setSavedUsers] = useState<SavedUser[]>(() => loadSavedUsers())
  const [currentUid, setCurrentUid] = useState(() => loadSecUid())

  function refreshSavedUsers() {
    const users = loadSavedUsers()
    setSavedUsers(users)
    const uid = loadSecUid()
    setCurrentUid(uid)
    if (uid) {
      const users = loadSavedUsers(); const found = users.find((u) => u.id === uid)
      if (found) {
        setSavedInfo(found)
        // 缺资料时异步获取
        if (!found.totalFavorited || !found.shortId || !found.signature || !found.ipLocation) {
          fetchUserProfile(uid).then((profile) => {
            if (profile) {
              const all = loadSavedUsers().map((u) => u.id === uid ? {
                ...u,
                ...(profile.nickname ? { nickname: profile.nickname } : {}),
                ...(profile.avatar ? { avatar: profile.avatar } : {}),
                ...(profile.shortId ? { shortId: profile.shortId } : {}),
                ...(profile.totalFavorited ? { totalFavorited: profile.totalFavorited } : {}),
                ...(profile.followingCount ? { followingCount: profile.followingCount } : {}),
                ...(profile.followerCount ? { followerCount: profile.followerCount } : {}),
                ...(profile.signature ? { signature: profile.signature } : {}),
                ...(profile.ipLocation ? { ipLocation: profile.ipLocation } : {}),
                ...(profile.gender ? { gender: profile.gender } : {}),
                id: u.id, savedAt: u.savedAt,
              } : u)
              Storage.set(KEY_SAVED_USERS, JSON.stringify(all))
          const newUsers = loadSavedUsers()
              setSavedUsers(newUsers)
              const updated = newUsers.find((u) => u.id === uid)
              if (updated) setSavedInfo(updated)
            }
          }).catch(() => {})
        }
      }
      else setSavedInfo({ id: uid, nickname: "", avatar: "", savedAt: Date.now() })
    } else { setSavedInfo(null) }
  }

  useEffect(() => { refreshSavedUsers() }, [])

  // 检查 Cookie 状态
  useEffect(() => {
    ;(async () => {
      const result = await checkCookieValidity()
      setCookieStatus({ checking: false, valid: result.valid, detail: result.detail })
    })()
  }, [])

  async function handleLogin() {
    await Navigation.present(
      <DouyinLoginView onLoginComplete={() => {
        // 登录成功后刷新状态
        setCookieStatus({ checking: true, valid: false, detail: "检查中..." })
        setTimeout(async () => {
          const result = await checkCookieValidity()
          setCookieStatus({ checking: false, valid: result.valid, detail: result.detail })
          setIsCookieSaved(result.valid)
          refreshSavedUsers()
        }, 500)
      }} />
    )
  }

  async function handleRefresh() {
    setRefreshing(true)
    const result = await silentRefreshCookie()
    setRefreshing(false)
    if (result.ok) {
      setTimeout(async () => {
        const check = await checkCookieValidity()
        setCookieStatus({ checking: false, valid: check.valid, detail: check.detail })
        setIsCookieSaved(check.valid)
      }, 500)
    } else {
      setCookieStatus({ checking: false, valid: false, detail: result.message })
    }
  }

  async function handleSave() {
    const t = inputValue.trim()
    if (!t) { setStatus({ type: "error", text: "请输入抖音号" }); return }
    setSaving(true); setStatus({ type: "", text: "" })
    try {
      const r = await resolveSecUid(t)
      if (r.error) { setStatus({ type: "error", text: r.error }); setSaving(false); return }
      saveSecUid(r.secUid)
      let nn = r.nickname || ""; let av = r.avatar || ""
      let fullUser: SavedUser = {
        id: r.secUid, nickname: nn, avatar: av, savedAt: Date.now(),
        shortId: r.shortId || "", totalFavorited: r.totalFavorited || 0,
        followingCount: r.followingCount || 0, followerCount: r.followerCount || 0,
        signature: r.signature || "", ipLocation: r.ipLocation || "", gender: r.gender ?? 0,
      }
      if (!nn) {
        try { const posts = await fetchUserPosts(r.secUid, 0); if (posts.videos.length > 0) { const p = posts.videos[0]; nn = p.author_nickname; av = p.author_avatar; fullUser.nickname = nn; fullUser.avatar = av } } catch { /* ignore */ }
      }
      // 异步补充资料：不阻塞保存
      fetchUserProfile(r.secUid).then((profile) => {
        if (profile) {
          const all = loadSavedUsers().map((u) => u.id === r.secUid ? {
            ...u,
            ...(profile.nickname ? { nickname: profile.nickname } : {}),
            ...(profile.avatar ? { avatar: profile.avatar } : {}),
            ...(profile.shortId ? { shortId: profile.shortId } : {}),
            ...(profile.totalFavorited ? { totalFavorited: profile.totalFavorited } : {}),
            ...(profile.followingCount ? { followingCount: profile.followingCount } : {}),
            ...(profile.followerCount ? { followerCount: profile.followerCount } : {}),
            ...(profile.signature ? { signature: profile.signature } : {}),
            ...(profile.ipLocation ? { ipLocation: profile.ipLocation } : {}),
            ...(profile.gender ? { gender: profile.gender } : {}),
            id: u.id, savedAt: u.savedAt,
          } : u)
          Storage.set(KEY_SAVED_USERS, JSON.stringify(all))
          setSavedUsers(loadSavedUsers())
          const updated = loadSavedUsers().find((x) => x.id === r.secUid)
          if (updated) setSavedInfo(updated)
        }
      }).catch(() => {})
      saveUser(fullUser)
      setSavedInfo(fullUser); setInputValue("")
      refreshSavedUsers()
    } catch (e) { setStatus({ type: "error", text: (e as Error).message }) }
    setSaving(false)
  }

  return (
    <NavigationStack>
      <List navigationTitle="设置">
        <Section>
          <VStack padding={16} spacing={12} frame={{ maxWidth: "infinity" }}>
            <HStack spacing={0} frame={{ maxWidth: "infinity" }}>
              <Text font="headline" bold>当前用户</Text>
              <Spacer />
              {savedInfo ? (
                <Image systemName="arrow.clockwise" font="headline" foregroundStyle="systemBlue" onTapGesture={() => {
                  const uid = loadSecUid()
                  if (uid) {
                    fetchUserProfile(uid).then((profile) => {
                      if (profile) {
                        const all = loadSavedUsers().map((u) => u.id === uid ? {
                          ...u,
                          ...(profile.nickname ? { nickname: profile.nickname } : {}),
                          ...(profile.avatar ? { avatar: profile.avatar } : {}),
                          ...(profile.shortId ? { shortId: profile.shortId } : {}),
                          ...(profile.totalFavorited ? { totalFavorited: profile.totalFavorited } : {}),
                          ...(profile.followingCount ? { followingCount: profile.followingCount } : {}),
                          ...(profile.followerCount ? { followerCount: profile.followerCount } : {}),
                          ...(profile.signature ? { signature: profile.signature } : {}),
                          ...(profile.ipLocation ? { ipLocation: profile.ipLocation } : {}),
                          ...(profile.gender ? { gender: profile.gender } : {}),
                          id: u.id, savedAt: u.savedAt,
                        } : u)
                        Storage.set(KEY_SAVED_USERS, JSON.stringify(all))
                        const newUsers = loadSavedUsers()
                        setSavedUsers(newUsers)
                        const updated = newUsers.find((x) => x.id === uid)
                        if (updated) setSavedInfo(updated)
                      }
                    }).catch(() => {})
                  }
                }} />
              ) : null}
            </HStack>
            {savedInfo ? (
              <VStack spacing={12} frame={{ maxWidth: "infinity" }}>
                <HStack spacing={12}>
                  {savedInfo.avatar ? <Image imageUrl={savedInfo.avatar} resizable scaleToFill frame={{ width: 56, height: 56 }} clipShape={{ type: "rect", cornerRadius: 28 }} /> : <VStack frame={{ width: 56, height: 56 }} background="systemGray4" clipShape={{ type: "rect", cornerRadius: 28 }} alignment="center"><Image systemName="person.fill" font="title2" foregroundStyle="tertiaryLabel" /></VStack>}
                  <VStack spacing={2} alignment="leading">
                    <Text font="title3" bold>{savedInfo.nickname || "抖音用户"}</Text>
                    {savedInfo.shortId ? <Text font="subheadline" foregroundStyle="secondaryLabel">抖音号: {savedInfo.shortId}</Text> : null}
                  </VStack>
                </HStack>
                {(savedInfo.totalFavorited || savedInfo.followingCount || savedInfo.followerCount) ? (
                  <HStack spacing={0} frame={{ maxWidth: "infinity" }}>
                    <VStack frame={{ maxWidth: "infinity" }} alignment="center" spacing={2}>
                      <Text font="headline" bold>{formatCount(savedInfo.totalFavorited || 0)}</Text>
                      <Text font="caption" foregroundStyle="secondaryLabel">获赞</Text>
                    </VStack>
                    <VStack frame={{ maxWidth: "infinity" }} alignment="center" spacing={2}>
                      <Text font="headline" bold>{formatCount(savedInfo.followingCount || 0)}</Text>
                      <Text font="caption" foregroundStyle="secondaryLabel">关注</Text>
                    </VStack>
                    <VStack frame={{ maxWidth: "infinity" }} alignment="center" spacing={2}>
                      <Text font="headline" bold>{formatCount(savedInfo.followerCount || 0)}</Text>
                      <Text font="caption" foregroundStyle="secondaryLabel">粉丝</Text>
                    </VStack>
                  </HStack>
                ) : null}
                {savedInfo.signature ? <Text font="subheadline" foregroundStyle="secondaryLabel" lineLimit={3}>{savedInfo.signature}</Text> : null}
                {(savedInfo.ipLocation || savedInfo.gender) ? (
                  <HStack spacing={16}>
                    {savedInfo.ipLocation ? <HStack spacing={4}><Image systemName="location.fill" font="caption" foregroundStyle="tertiaryLabel" /><Text font="caption" foregroundStyle="tertiaryLabel">{savedInfo.ipLocation}</Text></HStack> : null}
                    {savedInfo.gender === 1 ? <Text font="caption" foregroundStyle="tertiaryLabel">♂ 男</Text> : savedInfo.gender === 2 ? <Text font="caption" foregroundStyle="tertiaryLabel">♀ 女</Text> : null}
                  </HStack>
                ) : null}
              </VStack>
            ) : (
              <Text foregroundStyle="secondaryLabel">尚未设置</Text>
            )}
          </VStack>
        </Section>

        <Section title="添加/修改抖音号">
          <TextField
            title="抖音号"
            prompt="粘贴抖音号 / 链接 / sec_uid"
            value={inputValue}
            onChanged={(val: string) => setInputValue(val)}
          />
          <Button
            title={saving ? "解析中..." : "保存"}
            action={handleSave}
            disabled={saving || !inputValue.trim()}
          />
          {status.text ? (
            <Text font="caption" foregroundStyle={status.type === "error" ? "systemRed" : "systemGreen"}>
              {status.text}
            </Text>
          ) : null}
        </Section>

        <Section title="抖音登录">
          <VStack padding={12} spacing={12} frame={{ maxWidth: "infinity" }}>
            {/* Cookie 状态指示器 */}
            <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
              {cookieStatus.checking ? (
                <ProgressView foregroundStyle="systemBlue" />
              ) : (
                <Image 
                  systemName={cookieStatus.valid ? "checkmark.seal.fill" : "exclamationmark.triangle.fill"} 
                  foregroundStyle={cookieStatus.valid ? "systemGreen" : "systemOrange"} 
                  font="body" 
                />
              )}
              <VStack spacing={0}>
                <Text font="body" bold>{cookieStatus.checking ? "正在检查..." : (cookieStatus.valid ? "已登录" : "未登录")}</Text>
                <Text font="caption" foregroundStyle="secondaryLabel">{cookieStatus.checking ? "" : cookieStatus.detail}</Text>
              </VStack>
              <Spacer />
            </HStack>
            
            {/* 操作按钮 */}
            <HStack spacing={8} frame={{ maxWidth: "infinity" }}>
              <Button 
                title={cookieStatus.valid ? "重新登录" : "登录抖音"}
                action={handleLogin}
                frame={{ maxWidth: "infinity" }}
              />
              {cookieStatus.valid && (
                <Button 
                  title={refreshing ? "刷新中..." : "刷新 Cookie"}
                  action={handleRefresh}
                  disabled={refreshing}
                  frame={{ maxWidth: "infinity" }}
                />
              )}
            </HStack>
            
            {/* 手动 Cookie 编辑（高级） */}
            <HStack spacing={4}>
              <Text font="caption" foregroundStyle="tertiaryLabel" onTapGesture={() => setShowManualCookie(!showManualCookie)}>
                {showManualCookie ? "收起手动输入" : "手动配置 Cookie（高级）"}
              </Text>
            </HStack>
            
            {showManualCookie && (
              <VStack spacing={8} frame={{ maxWidth: "infinity" }}>
                {isCookieSaved ? (
                  <HStack spacing={8} padding={{ vertical: 8 }}>
                    <Image systemName="checkmark.circle.fill" foregroundStyle="systemGreen" font="body" />
                    <Text font="body" foregroundStyle="systemGreen">Cookie 已保存 ✓</Text>
                    <Spacer />
                    <Button title="清除 Cookie" action={() => {
                      Storage.set(KEY_COOKIE, "")
                      setIsCookieSaved(false)
                      setCookieValue("")
                      setCookieStatus({ checking: false, valid: false, detail: "已清除" })
                    }} />
                  </HStack>
                ) : (
                  <>
                    <TextField
                      title="Cookie"
                      prompt="粘贴 douyin.com Cookie"
                      value={cookieValue}
                      onChanged={(val: string) => setCookieValue(val)}
                    />
                    <HStack spacing={8} padding={{ top: 4 }}>
                      <Spacer />
                      <Button title="保存 Cookie" action={() => {
                        Storage.set(KEY_COOKIE, cookieValue.trim())
                        setCookieValue("")
                        setIsCookieSaved(true)
                        setCookieStatus({ checking: true, valid: false, detail: "检查中..." })
                        setTimeout(async () => {
                          const result = await checkCookieValidity()
                          setCookieStatus({ checking: false, valid: result.valid, detail: result.detail })
                        }, 1000)
                      }} disabled={!cookieValue.trim()} />
                    </HStack>
                  </>
                )}
              </VStack>
            )}
          </VStack>
        </Section>

        <Section title={`已保存用户（${savedUsers.length}）`}>
          {savedUsers.length === 0 ? (
            <Text font="caption" foregroundStyle="secondaryLabel">暂无已保存的用户</Text>
          ) : (
            savedUsers.map((u) => (
              <HStack key={u.id} spacing={12} padding={{ vertical: 8, leading: 0, trailing: 0 }}>
                <HStack spacing={12} frame={{ maxWidth: "infinity" }} onTapGesture={() => {
                  if (u.id !== currentUid) { saveSecUid(u.id); refreshSavedUsers() }
                }}>
                  {u.avatar ? <Image imageUrl={u.avatar} resizable scaleToFill frame={{ width: 36, height: 36 }} clipShape={{ type: "rect", cornerRadius: 18 }} /> : <VStack frame={{ width: 36, height: 36 }} background="systemGray4" clipShape={{ type: "rect", cornerRadius: 18 }} alignment="center"><Image systemName="person.fill" font="caption" foregroundStyle="tertiaryLabel" /></VStack>}
                  <VStack spacing={0} frame={{ maxWidth: "infinity" }}>
                    <Text font="subheadline">{u.nickname || "未命名"}</Text>
                  </VStack>
                  {u.id === currentUid ? (
                    <Text font="caption" foregroundStyle="systemBlue">当前</Text>
                  ) : null}
                </HStack>
                <Text font="caption" foregroundStyle="systemRed" padding={{ leading: 8, trailing: 4 }} onTapGesture={() => {
                  const users = loadSavedUsers().filter((x) => x.id !== u.id)
                  Storage.set(KEY_SAVED_USERS, JSON.stringify(users))
                  refreshSavedUsers()
                }}>删除</Text>
              </HStack>
            ))
          )}
        </Section>
      </List>
    </NavigationStack>
  )
}

// ─── 主入口 ───
function App() {
  const dismiss = Navigation.useDismiss()

  return (
    <TabView>
      <Tab title="作品" systemImage="rectangle.grid.2x2">
        <HomeView dismissApp={() => dismiss()} />
      </Tab>
      <Tab title="历史" systemImage="clock">
        <HistoryView />
      </Tab>
      <Tab title="设置" systemImage="gear">
        <SettingsView />
      </Tab>
    </TabView>
  )
}

async function run() {
  await Navigation.present({
    element: <App />,
    modalPresentationStyle: 'overFullScreen',
  })
  Script.exit()
}

run()
