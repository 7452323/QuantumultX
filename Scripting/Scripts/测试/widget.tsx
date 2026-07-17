import { Text, VStack } from 'scripting'

const birth = new Date('1993-01-27')
const today = new Date()
const days = Math.round(Math.abs(today.getTime() - birth.getTime()) / 86400000)
const age = today.getFullYear() - birth.getFullYear() - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0)

VStack({ spacing: 10, alignment: 'center' },
  Text({ size: 18, weight: 'bold', color: '#ffffff' }, '生日倒数日'),
  Text({ size: 24, weight: 'bold', color: '#00ffaa' }, `还有 ${days} 天`),
  Text({ size: 16, color: '#aaccff' }, `你 ${age} 岁`)
)