/**
 * AI 角色扮演 - iOS 26 原生 Liquid Glass 聊天界面
 *
 * 使用 UIGlass 原生玻璃效果 + 深色/浅色自适应
 */

import {
  Script,
  Navigation,
  NavigationStack,
  ScrollView,
  VStack,
  HStack,
  ZStack,
  Text,
  Image,
  Spacer,
  Button,
  gradient,
  useState,
  useEffect,
  AppEvents,
} from "scripting"
import { characters, Character } from "./characters"

// ============================================================
// 角色卡片组件 - iOS 26 Liquid Glass
// ============================================================
function CharacterCard({
  character,
  isDark,
  onSelect,
}: {
  character: Character
  isDark: boolean
  onSelect: () => void
}) {

  return (
    <Button action={onSelect}>
      <HStack
        padding={20}
        spacing={16}
        // iOS 26 Liquid Glass 原生玻璃效果
        glassEffect={UIGlass.regular()}
        clipShape={{ type: "rect", cornerRadius: 24 }}
        shadow={{
          color: isDark
            ? "rgba(0,0,0,0.35)"
            : "rgba(0,0,0,0.08)",
          radius: 12,
          y: 4,
        }}
        frame={{ maxWidth: "infinity" }}
      >
        {/* 角色图标 - 带有 accentColor 的玻璃底座 */}
        <ZStack
          frame={{ width: 56, height: 56 }}
          background={(character.accentColor + "20") as any}
          clipShape={{ type: "rect", cornerRadius: 28 }}
          alignment="center"
        >
          <Image
            systemName={character.icon}
            font={24}
            foregroundStyle={character.accentColor as any}
          />
        </ZStack>

        {/* 角色名称与简介 */}
        <VStack spacing={4} alignment="leading">
          <Text font={20} fontWeight="semibold" foregroundStyle="label">
            {character.name}
          </Text>
          <Text font={14} foregroundStyle="secondaryLabel">
            {character.description}
          </Text>
        </VStack>

        <Spacer />

        {/* 右箭头 */}
        <Image
          systemName="chevron.right"
          font={14}
          foregroundStyle="tertiaryLabel"
        />
      </HStack>
    </Button>
  )
}

// ============================================================
// 角色选择主页面
// ============================================================
function CharacterSelectionView() {
  const dismiss = Navigation.useDismiss()
  const [scheme, setScheme] = useState<"light" | "dark">("light")

  // 监听系统颜色模式变化
  useEffect(() => {
    AppEvents.colorScheme.addListener((newScheme) => {
      setScheme(newScheme)
    })
  }, [])

  const isDark = scheme === "dark"

  // 处理角色选择 → 启动对话
  const handleSelectCharacter = async (character: Character) => {
    try {
      // 如果已有活跃对话，先关闭
      if (Assistant.hasActiveConversation) {
        await Assistant.stopConversation()
      }

      // 用角色的 systemPrompt 启动对话
      await Assistant.startConversation({
        message: "你好！",
        systemPrompt: character.systemPrompt,
        autoStart: true,
      })

      // 展示聊天界面
      await Assistant.present()

      // 聊天结束后返回
      dismiss()
    } catch (e) {
      console.error("启动对话失败:", String(e))
    }
  }

  return (
    <NavigationStack>
      <ZStack alignment="top">
        {/* ---------- 全屏渐变背景 ---------- */}
        <ZStack
          background={gradient("linear", {
            colors: isDark
              ? ["#1a1a2e", "#162447", "#0f3460"]
              : ["#f2f2f7", "#eaeaef", "#dce0e8"],
            startPoint: { x: 0, y: 0 },
            endPoint: { x: 0, y: 1 },
          })}
          frame={{
            maxWidth: "infinity",
            maxHeight: "infinity",
          }}
        />

        {/* ---------- 可滚动内容 ---------- */}
        <ScrollView>
          <VStack spacing={24} padding={20}>
            {/* 标题区域 */}
            <VStack
              spacing={8}
              alignment="leading"
              padding={{ top: 50, bottom: 8 }}
            >
              <Text font={34} fontWeight="bold" foregroundStyle="label">
                角色扮演
              </Text>
              <Text font={15} foregroundStyle="secondaryLabel">
                选一个角色，开启属于你的故事
              </Text>
            </VStack>

            {/* 角色卡片列表 */}
            {characters.map((c) => (
              <CharacterCard
                key={c.id}
                character={c}
                isDark={isDark}
                onSelect={() => handleSelectCharacter(c)}
              />
            ))}

            {/* 底部留白 */}
            <Spacer minLength={60} />
          </VStack>
        </ScrollView>

        {/* ---------- 关闭按钮 ---------- */}
        <HStack
          padding={{ horizontal: 16, top: 8 }}
          frame={{ maxWidth: "infinity" }}
        >
          <Spacer />
          <Button action={dismiss}>
            <Image
              systemName="xmark.circle.fill"
              font={28}
              foregroundStyle="tertiaryLabel"
            />
          </Button>
        </HStack>
      </ZStack>
    </NavigationStack>
  )
}

// ============================================================
// 入口
// ============================================================
export async function run() {
  await Navigation.present(<CharacterSelectionView />)
  Script.exit()
}

// 直接运行
run()
