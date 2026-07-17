import { Form, VStack, Text, DatePicker, Slider, Toggle, Button, Section } from 'scripting'

let birthDate = new Date('1993-01-27')
let remindDays = 7
let showAge = true
let transparent = false

function calc() {
  const today = new Date()
  const msPerDay = 86400000
  const diff = today.getTime() - birthDate.getTime()
  const daysLeft = Math.round(Math.abs(diff) / msPerDay)
  let age = today.getFullYear() - birthDate.getFullYear()
  if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) age--
  return { daysLeft, age }
}

Form({
  title: '生日倒数日'
},
  VStack({ spacing: 16 },
    Section({ header: '当前' },
      Text(`还有 ${calc().daysLeft} 天`, { size: 22, weight: 'bold', color: '#00ffaa' }),
      showAge && Text(`${calc().age} 岁`, { size: 18, color: '#aaccff' })
    ),
    Section({ header: '设置' },
      DatePicker({ title: '生日', value: birthDate, onChange: v => birthDate = v }),
      Slider({ title: '提前提醒', min: 0, max: 30, value: remindDays, onChange: v => remindDays = v }),
      Toggle({ title: '显示年龄', value: showAge, onChange: v => showAge = v }),
      Toggle({ title: '透明背景', value: transparent, onChange: v => transparent = v })
    ),
    Section({ header: '操作' },
      Button({ title: '今日' }),
      Button({ title: '本周' }),
      Button({ title: '本月' }),
      Button({ title: '刷新' })
    )
  )
)