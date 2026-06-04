import { useState, useEffect } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { createRose } from '@/api'
import { getToken } from '@/utils/storage'
import { initWasm, getRecommendation } from '@/utils/wasm'
import styles from './index.module.css'

const COLORS = [{ id: 'red', label: '红玫瑰', emoji: '🌹' }, { id: 'white', label: '白玫瑰', emoji: '🤍' }, { id: 'yellow', label: '黄玫瑰', emoji: '💛' }]

export default function Plant() {
  const [step, setStep] = useState<'color' | 'form' | 'success'>('color')
  const [color, setColor] = useState('')
  const [gratitude, setGratitude] = useState('')
  const [anxiety, setAnxiety] = useState('')
  const [hope, setHope] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [recColor, setRecColor] = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) { Taro.navigateTo({ url: '/pages/login/index' }); return }
    initWasm().then(ok => {
      if (ok) {
        const rec = getRecommendation([])
        if (rec) setRecColor(rec.color_suggestion.color)
      }
    })
  }, [])

  async function handleSubmit() {
    if (!gratitude.trim() && !anxiety.trim() && !hope.trim()) { setError('至少填写一项'); return }
    setSubmitting(true); setError('')
    try {
      await createRose({ color, gratitude: gratitude.trim() || undefined, anxiety: anxiety.trim() || undefined, hope: hope.trim() || undefined })
      setStep('success')
    } catch { setError('提交失败，请重试') }
    finally { setSubmitting(false) }
  }

  const colorMeta = COLORS.find(c => c.id === color)

  if (step === 'color') return (
    <View className={styles.container}>
      <Text className={styles.title}>选择玫瑰颜色</Text>
      {recColor && <Text className={styles.rec}>推荐：{COLORS.find(c => c.id === recColor)?.label}</Text>}
      <View className={styles.colors}>
        {COLORS.map(c => (
          <View key={c.id} className={styles.colorCard} onClick={() => { setColor(c.id); setStep('form') }}>
            <Text className={styles.colorEmoji}>{c.emoji}</Text>
            <Text className={styles.colorLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )

  if (step === 'success') return (
    <View className={styles.container}>
      <Text className={styles.successEmoji}>{colorMeta?.emoji}</Text>
      <Text className={styles.successTitle}>已种入花圃</Text>
      <Text className={styles.successSub}>AI 正在聆听你的故事...</Text>
      <Button className={styles.btn} onClick={() => Taro.navigateBack()}>回到花圃</Button>
    </View>
  )

  return (
    <View className={styles.container}>
      <Text className={styles.title}>{colorMeta?.emoji} 种下你的玫瑰</Text>
      <Text className={styles.fieldLabel}>🌹 感恩（选填）</Text>
      <Textarea className={styles.textarea} placeholder="这周让你感到幸福的事..." maxlength={500} value={gratitude} onInput={e => setGratitude(e.detail.value)} />
      <Text className={styles.fieldLabel}>🌵 焦虑（选填）</Text>
      <Textarea className={styles.textarea} placeholder="有什么让你感到压力..." maxlength={500} value={anxiety} onInput={e => setAnxiety(e.detail.value)} />
      <Text className={styles.fieldLabel}>🌱 期待（选填）</Text>
      <Textarea className={styles.textarea} placeholder="你现在期待的事情..." maxlength={500} value={hope} onInput={e => setHope(e.detail.value)} />
      {error ? <Text className={styles.error}>{error}</Text> : null}
      <Button className={styles.btn} loading={submitting} disabled={submitting} onClick={handleSubmit}>种下玫瑰</Button>
      <Text className={styles.back} onClick={() => setStep('color')}>换颜色</Text>
    </View>
  )
}
