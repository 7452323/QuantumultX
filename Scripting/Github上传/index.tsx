/**
 * GitHub 上传 - 将文件上传到 GitHub 仓库
 *
 * 使用 GitHub API 直接上传文件到指定仓库。
 * 需先在「设置 → GitHub」中配置 Personal Access Token。
 */

import {
  Button,
  HStack,
  List,
  Navigation,
  NavigationStack,
  ProgressView,
  Script,
  Section,
  Spacer,
  Text,
  TextField,
  VStack,
  Divider,
  useState,
  useEffect,
} from 'scripting'

// ── Types ──

interface UploadRecord {
  path: string
  fileName: string
  owner: string
  repo: string
  status: 'success' | 'error'
  message: string
  time: string
}

/** 选中的文件，上传时直接从原始路径读取 */
interface FileItem {
  name: string
  originalPath: string
  size: number
}

// ── Constants ──

const STORAGE_KEYS = {
  owner: 'github_owner',
  repo: 'github_repo',
  branch: 'github_branch',
  uploadPath: 'github_uploadPath',
  folderName: 'github_folderName',
  commitMessage: 'github_commitMessage',
  history: 'github_uploadHistory',
} as const

// ── Helper ──

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function loadString(key: string, fallback: string): string {
  return Storage.get<string>(key) ?? fallback
}

// ── Main ──

async function run() {
  const availability = GitHub.getAvailability()

  if (!availability.available) {
    if (!availability.tokenConfigured) {
      await alert({
        title: 'GitHub 未配置',
        message: '请在「设置 → GitHub」中配置 Personal Access Token。\n需要权限：read_profile, read_repos, write_contents',
      })
    } else {
      await alert({
        title: 'GitHub 不可用',
        message: '此功能需要 Scripting PRO。',
      })
    }
    Script.exit()
  }

  const granted = await GitHub.requestPermissions([
    'read_profile',
    'read_repos',
    'write_contents',
  ])

  if (granted.length === 0) {
    await alert({
      title: '权限不足',
      message: '需要授予 read_profile、read_repos、write_contents 权限才能使用上传功能。',
    })
    Script.exit()
  }

  await Navigation.present(<UploadPage />)
  Script.exit()
}

// ── Upload Page ──

function UploadPage() {
  const dismiss = Navigation.useDismiss()

  // ── Reactive state ──
  const [owner, setOwner] = useState(loadString(STORAGE_KEYS.owner, ''))
  const [repo, setRepo] = useState(loadString(STORAGE_KEYS.repo, ''))
  const [branch, setBranch] = useState(loadString(STORAGE_KEYS.branch, 'main'))
  const [uploadPath, setUploadPath] = useState(loadString(STORAGE_KEYS.uploadPath, ''))
  const [folderName, setFolderName] = useState(loadString(STORAGE_KEYS.folderName, ''))
  const [commitMsg, setCommitMsg] = useState(loadString(STORAGE_KEYS.commitMessage, 'Upload via Scripting'))
  const [files, setFiles] = useState<FileItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadedCount, setUploadedCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [resultMessage, setResultMessage] = useState('')
  const [uploadHistory, setUploadHistory] = useState<UploadRecord[]>(Storage.get<UploadRecord[]>(STORAGE_KEYS.history) ?? [])
  const [userInfo, setUserInfo] = useState('')
  const [savedToast, setSavedToast] = useState('')

  // ── Load user info ──
  useEffect(() => {
    GitHub.getViewer().then(user => {
      if (user?.login) {
        setUserInfo(`👤 ${user.login}`)
      }
    }).catch(() => {})
  }, [])

  // ── Auto-save helpers ──
  function saveField(key: string, value: string) {
    Storage.set(key, value)
  }

  function saveSettings() {
    Storage.set(STORAGE_KEYS.owner, owner)
    Storage.set(STORAGE_KEYS.repo, repo)
    Storage.set(STORAGE_KEYS.branch, branch)
    Storage.set(STORAGE_KEYS.uploadPath, uploadPath)
    Storage.set(STORAGE_KEYS.folderName, folderName)
    Storage.set(STORAGE_KEYS.commitMessage, commitMsg)
    setSavedToast('✅ 设置已保存')
  }

  // ── File handlers ──
  async function pickFiles() {
    const paths = await DocumentPicker.pickFiles({
      allowsMultipleSelection: true,
    })
    if (!paths || paths.length === 0) return

    const newItems: FileItem[] = []
    for (const filePath of paths) {
      const data = Data.fromFile(filePath)
      if (data == null) continue
      const name = filePath.split('/').pop() ?? 'unknown'
      newItems.push({
        name,
        originalPath: filePath,
        size: data.size,
      })
    }
    setFiles(prev => [...prev, ...newItems])
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  function clearFiles() {
    setFiles([])
  }

  // ── 计算最终上传路径 ──
  function buildDestPath(fileName: string): string {
    let base = uploadPath.trim()
    // 确保 base 以 / 结尾
    if (base && !base.endsWith('/')) base += '/'

    let folder = folderName.trim()
    // 确保 folder 以 / 结尾
    if (folder && !folder.endsWith('/')) folder += '/'

    return `${base}${folder}${fileName}`
  }

  // ── Upload ──
  async function doUpload() {
    if (!owner.trim()) {
      await alert({ title: '提示', message: '请填写 GitHub 仓库所有者（Owner）' })
      return
    }
    if (!repo.trim()) {
      await alert({ title: '提示', message: '请填写 GitHub 仓库名称（Repo）' })
      return
    }
    if (files.length === 0) {
      await alert({ title: '提示', message: '请先选择要上传的文件' })
      return
    }

    saveSettings()
    setUploading(true)
    setUploadedCount(0)
    setTotalCount(files.length)
    setUploadProgress('')
    setResultMessage('')

    const results: UploadRecord[] = []
    const now = new Date().toLocaleString('zh-CN')
    const branchVal = branch.trim() || undefined

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const destPath = buildDestPath(file.name)

      setUploadProgress(`[${i + 1}/${files.length}] ${file.name} ...`)

      try {
        // 直接从原始文件路径读取 Data，避免 base64 编解码
        const content = Data.fromFile(file.originalPath)
        if (content == null) {
          throw new Error('无法读取文件数据')
        }

        // 检查文件是否已存在（获取 SHA）
        let sha: string | undefined
        let action = '🆕 新建'
        try {
          const existing = await GitHub.getContent({
            owner: owner.trim(),
            repo: repo.trim(),
            path: destPath,
            ref: branchVal,
          })
          if (existing && typeof existing === 'object' && !Array.isArray(existing) && 'sha' in existing) {
            sha = existing.sha as string
            action = '🔄 更新'
          }
        } catch {
          // 文件不存在，直接创建
        }

        await GitHub.putContent({
          owner: owner.trim(),
          repo: repo.trim(),
          path: destPath,
          message: commitMsg.trim() || `Upload ${file.name}`,
          content,
          sha,
          branch: branchVal,
        })

        // 实时更新进度
        const actionLabel = action
        setUploadedCount(prev => {
          const next = prev + 1
          setUploadProgress(`[${next}/${files.length}] ${actionLabel} ${file.name} → ${destPath}`)
          return next
        })

        results.push({
          path: destPath,
          fileName: file.name,
          owner: owner.trim(),
          repo: repo.trim(),
          status: 'success',
          message: `${actionLabel} ${destPath}`,
          time: now,
        })
      } catch (e: any) {
        setUploadProgress(`[${i + 1}/${files.length}] ❌ ${file.name} 失败: ${e?.message ?? e}`)
        results.push({
          path: destPath,
          fileName: file.name,
          owner: owner.trim(),
          repo: repo.trim(),
          status: 'error',
          message: `❌ ${e?.message ?? String(e)}`,
          time: now,
        })
      }
    }

    // Save history
    const newHistory = [...results, ...uploadHistory].slice(0, 50)
    setUploadHistory(newHistory)
    Storage.set(STORAGE_KEYS.history, newHistory)

    setUploading(false)
    setUploadProgress('')

    const successCount = results.filter(r => r.status === 'success').length
    const failCount = results.filter(r => r.status === 'error').length
    setResultMessage(`✅ 成功: ${successCount}   ❌ 失败: ${failCount}`)

    await alert({
      title: '上传完成',
      message: `✅ 成功: ${successCount} 个\n❌ 失败: ${failCount} 个`,
    })

    if (failCount === 0) {
      setFiles([])
    }
  }

  function clearHistory() {
    setUploadHistory([])
    Storage.set(STORAGE_KEYS.history, [])
  }

  // ── Computed ──
  const totalSize = files.reduce((s, f) => s + f.size, 0)

  /** 预览最终上传路径 */
  const exampleDest = files.length > 0
    ? buildDestPath(files[0].name)
    : buildDestPath('example.txt')

  // ── Render ──

  return (
    <NavigationStack>
      <List
        navigationTitle="GitHub 上传"
        navigationBarTitleDisplayMode="inline"
        toolbar={{
          cancellationAction: <Button title="关闭" action={dismiss} />,
        }}
      >
        {/* ── User Info ── */}
        {userInfo ? (
          <Section>
            <HStack>
              <Text>{userInfo}</Text>
              <Spacer />
            </HStack>
          </Section>
        ) : null}

        {/* ── Repository Config ── */}
        <Section header={<Text>📦 仓库配置</Text>}>
          <TextField
            title="Owner"
            value={owner}
            onChanged={(v) => { setOwner(v); saveField(STORAGE_KEYS.owner, v) }}
            prompt="填写你的 GitHub 用户名"
          />
          <Text>Owner 是仓库所属的用户或组织名，例如 7452323</Text>

          <TextField
            title="Repo"
            value={repo}
            onChanged={(v) => { setRepo(v); saveField(STORAGE_KEYS.repo, v) }}
            prompt="填写仓库名称"
          />
          <Text>Repo 是要上传到的目标仓库名，例如 QuantumultX</Text>

          <TextField
            title="Branch"
            value={branch}
            onChanged={(v) => { setBranch(v); saveField(STORAGE_KEYS.branch, v) }}
            prompt="填写分支名，留空默认为 main"
          />
          <Text>Branch 是仓库的分支，不填则使用默认分支（通常是 main）</Text>

          <TextField
            title="仓库内路径"
            value={uploadPath}
            onChanged={(v) => { setUploadPath(v); saveField(STORAGE_KEYS.uploadPath, v) }}
            prompt="例如 Scripting/"
          />
          <Text>仓库内路径是文件存放的固定目录，例如 Scripting/，留空则传到仓库根目录</Text>
        </Section>

        {/* ── Auto Folder ── */}
        <Section header={<Text>📁 自动创建文件夹</Text>}>
          <TextField
            title="文件夹名称"
            value={folderName}
            onChanged={(v) => { setFolderName(v); saveField(STORAGE_KEYS.folderName, v) }}
            prompt="输入本次上传的文件夹名，例如 生日"
          />
          <Text>在此输入文件夹名称（如 生日、壁纸、备份），系统会自动在该路径下创建文件夹并将文件放入其中</Text>

          {folderName.trim() || uploadPath.trim() ? (
            <Text>
              文件将上传到：{exampleDest}
            </Text>
          ) : null}
        </Section>

        {/* ── Commit Message ── */}
        <Section header={<Text>📝 提交信息</Text>}>
          <TextField
            title="Commit 信息"
            value={commitMsg}
            onChanged={(v) => { setCommitMsg(v); saveField(STORAGE_KEYS.commitMessage, v) }}
            prompt="填写本次提交的描述信息"
          />
          <Text>Commit 信息是 Git 提交时附带的说明文字，描述本次上传的内容或原因</Text>
          <Button title="💾 保存设置" action={saveSettings} />
          {savedToast ? <Text>{savedToast}</Text> : null}
        </Section>

        {/* ── File Selection ── */}
        <Section
          header={
            <HStack>
              <Text>📎 选择文件</Text>
              <Spacer />
              {files.length > 0 ? (
                <Button title="清除全部" action={clearFiles} />
              ) : null}
            </HStack>
          }
        >
          <Button title="📂 从文件选择" action={pickFiles} />
          <Text>点击上方按钮从 iPhone「文件」App 中选择要上传的文件，可多选</Text>

          {files.length === 0 ? (
            <Text>尚未选择文件</Text>
          ) : (
            files.map((file, index) => (
              <HStack key={index}>
                <VStack>
                  <Text>{file.name}</Text>
                  <Text>{formatSize(file.size)}</Text>
                </VStack>
                <Spacer />
                <Button title="✕" action={() => removeFile(index)} />
              </HStack>
            ))
          )}

          {files.length > 0 ? (
            <Text>
              共 {files.length} 个文件，总计 {formatSize(totalSize)}，点击 ✕ 可移除
            </Text>
          ) : null}
        </Section>

        {/* ── Upload ── */}
        <Section header={<Text>🚀 上传</Text>}>
          <Text>确认以上配置无误后，点击下方按钮开始上传到 GitHub</Text>

          <Button
            title={uploading ? '上传中...' : '⬆️ 上传到 GitHub'}
            action={doUpload}
            disabled={uploading}
          />

          {uploading ? (
            <VStack>
              <ProgressView />
              <Text>{uploadProgress}</Text>
              <Text>
                {uploadedCount} / {totalCount}
              </Text>
            </VStack>
          ) : null}

          {resultMessage ? <Text>{resultMessage}</Text> : null}
        </Section>

        {/* ── Upload History ── */}
        {uploadHistory.length > 0 ? (
          <Section
            header={
              <HStack>
                <Text>📜 上传历史</Text>
                <Spacer />
                <Button title="清空" action={clearHistory} />
              </HStack>
            }
          >
            {uploadHistory.slice(0, 10).map((record, index) => (
              <VStack key={index}>
                <HStack>
                  <Text>
                    {record.status === 'success' ? '✅' : '❌'}
                  </Text>
                  <Text>{record.fileName}</Text>
                  <Spacer />
                  <Text>{record.time}</Text>
                </HStack>
                {record.status === 'error' ? (
                  <Text>{record.message}</Text>
                ) : null}
                <Divider />
              </VStack>
            ))}
          </Section>
        ) : null}

        {/* ── Info ── */}
        <Section header={<Text>ℹ️ 说明</Text>}>
          <Text>使用 GitHub API 将文件上传到指定仓库。</Text>
          <Text>1. 在「设置 → GitHub」中配置 Personal Access Token</Text>
          <Text>2. 填写仓库信息（Owner / Repo / Branch）+ 仓库内路径</Text>
          <Text>3. 输入文件夹名称，系统自动创建并上传文件到该目录</Text>
          <Text>4. 选择文件并上传</Text>
          <Text>5. 同名文件自动检测并更新（🔄），新文件自动创建（🆕）</Text>
          <Text>支持所有文件类型，单文件不超过 GitHub API 限制（~25MB）。</Text>
        </Section>
      </List>
    </NavigationStack>
  )
}

run()
