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
  VStack,
} from "scripting"

function View() {
  const dismiss = Navigation.useDismiss()
  const topic = useObservable("")
  const style = useObservable("杠精课代表")
  const result = useObservable("")
  const copied = useObservable(false)

  const templates: Record<string, string[]> = {
    "祖安": [
      `就这？{{t}}就这水平也敢拿出来说？啊？不会吧不会吧，这年头连这种货色都能出来指点江山了？省省吧你，洗洗睡吧😅`,
      `笑了，{{t}}？你认真的吗？但凡有点常识都说不出口，一看就是没玩过/没用过/没体验过的🤣`,
      `经典{{t}}，我就知道有人要说这个。每次都是这套说辞，能不能整点新活？🙄`,
    ],
    "CF技术杠": [
      `一看就没用过好配置，{{t}}？我i5-12490F+GTX1060稳300帧不掉，你这肯定是AMD的U吧？`,
      `你确定{{t}}？我实测同场景我帧数比你高50%，先把系统调明白了再来讨论`,
      `笑死，{{t}}？你什么分辨率什么画质什么驱动版本？这些都不说就在这论？`,
    ],
    "电竞粉杠": [
      `经典{{t}}，又开始岁月史书了是吧？你什么冠军？你什么段位？🤡`,
      `你说{{t}}？那我想问问你，xxx输的时候你在哪？赢了吹输了喷，立于不败之地是吧`,
      `又开始了？{{t}}都能拿出来说？翻旧账谁不会啊，经典双标`,
    ],
    "杠精课代表": [
      `先问是不是，再问为什么。你确定{{t}}吗？据我所知事实恰恰相反，有没有一种可能你被带节奏了？`,
      `不是我想杠，但{{t}}这个说法本身就存在问题。第一，逻辑前提不成立；第二，你开心就好。`,
      `说得好，但是{{t}}这个结论下得太草率了。我随便举三个反例：1...算了不举了😊`,
    ],
    "阴阳怪气": [
      `啊对对对，{{t}}，你说得都对呢~你好懂哦，不像我什么都不会呢🥺`,
      `太厉害了！{{t}}这种话都能说出来，建议直接申请诺贝尔杠精奖👍`,
      `嗯嗯嗯，你说得都对。{{t}}嘛，懂的都懂，不懂的说了也不懂🙏`,
    ],
  }

  function generate() {
    const t = topic.value.trim()
    if (!t) return
    const replies = templates[style.value]
    if (!replies) return
    const raw = replies[Math.floor(Math.random() * replies.length)]
    result.value = raw.replace(/\{\{t\}\}/g, t)
    copied.value = false
  }

  return (
    <List
      navigationTitle={"杠精生成器"}
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
        <Text>🤡 警告：本工具仅供娱乐，抬杠有风险，祖安需谨慎</Text>
      </Section>

      <Section>
        <TextField value={topic} />
      </Section>

      <Section>
        <Picker value={style}>
          <Text tag="option" value="杠精课代表" label="杠精课代表">🧠 杠精课代表</Text>
          <Text tag="option" value="祖安" label="祖安">🔥 祖安</Text>
          <Text tag="option" value="CF技术杠" label="CF技术杠">💻 CF技术杠</Text>
          <Text tag="option" value="电竞粉杠" label="电竞粉杠">🎮 电竞粉杠</Text>
          <Text tag="option" value="阴阳怪气" label="阴阳怪气">🎭 阴阳怪气</Text>
        </Picker>
      </Section>

      <Section>
        <Button title="🎯 开杠！" action={generate} />
      </Section>

      {result.value ? (
        <Section>
          <Text>{result.value}</Text>
          <HStack spacing={10}>
            <Button title="📋 复制" action={() => { copied.value = true }} />
            <Button title="🔄 换一句" action={generate} />
          </HStack>
          {copied.value ? <Text>✅ 已复制</Text> : null}
        </Section>
      ) : null}

      <Section>
        <Text>没别的意思，就是单纯想杠一下😏</Text>
      </Section>
    </List>
  )
}

Navigation.present(View, {
  modalPresentationStyle: "overFullScreen",
})
