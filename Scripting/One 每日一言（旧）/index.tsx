import { VStack, Text, Spacer, Widget, Navigation } from 'scripting'

function ConfigView() {
  return (
    <VStack
      padding
      spacing={20}
    >
      <Spacer />

      <VStack
        alignment="center"
        spacing={8}
      >
        <Text
          font={28}
          fontWeight="bold"
        >
          ONE·一个
        </Text>
        <Text
          font={14}
          foregroundStyle="secondaryLabel"
        >
          每日一言小组件
        </Text>
      </VStack>

      <VStack
        background="rgba(0,0,0,0.05)"
        padding={{ horizontal: 16, vertical: 12 }}
        clipShape={{ type: 'rect', cornerRadius: 12 }}
        spacing={4}
      >
        <Text font={13} foregroundStyle="secondaryLabel">
          数据来源
        </Text>
        <Text font={12} foregroundStyle="tertiaryLabel">
          v3.wufazhuce.com
        </Text>
      </VStack>

      <Spacer />

      <Text
        font={11}
        foregroundStyle="tertiaryLabel"
      >
        添加到桌面后可预览小、中、大三尺寸
      </Text>
    </VStack>
  )
}

async function previewWidget() {
  try {
    await Widget.preview({ family: 'systemMedium' })
  } catch {
    // Preview dismissed
  }
}

previewWidget()

Navigation.present(<ConfigView />)
