import { useState } from 'react'
import { View, Text } from '@tarojs/components'

const EMOJIS = ['🌸', '🌺', '🌷', '💮', '🌹', '🏵️']
let nextId = 0

interface Bloom {
  id: number
  x: number
  y: number
  emoji: string
}

/** 点击绽放——在点击位置出现玫瑰 emoji 弹跳动画 */
export function useBloomTap() {
  const [blooms, setBlooms] = useState<Bloom[]>([])

  function handleTap(e: any) {
    const id = ++nextId
    const x = e.detail?.x ?? e.touches?.[0]?.clientX ?? 200
    const y = e.detail?.y ?? e.touches?.[0]?.clientY ?? 400
    const emoji = EMOJIS[Math.floor(Math.random() * EMOJIS.length)]
    setBlooms(prev => [...prev, { id, x, y, emoji }])
    setTimeout(() => setBlooms(prev => prev.filter(b => b.id !== id)), 800)
  }

  const bloomsView = (
    <>
      {blooms.map(b => (
        <Text
          key={b.id}
          className="bloom-petal"
          style={{ left: `${b.x}px`, top: `${b.y}px`, fontSize: '24px' }}
        >
          {b.emoji}
        </Text>
      ))}
    </>
  )

  return { handleTap, bloomsView }
}
