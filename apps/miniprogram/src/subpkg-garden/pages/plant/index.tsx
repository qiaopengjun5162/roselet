import { useState, useEffect } from 'react'
import { View, Text, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { createRose } from '@/api'
import { getToken } from '@/utils/storage'
import { initWasm, getRecommendation, validatePlant, colorOptions } from '@/utils/wasm'
import { NavBar, TOTAL_HEADER_HEIGHT } from '@/components/NavBar'
import styles from './index.module.css'

export default function Plant() {
  const [step, setStep]           = useState<'color' | 'form' | 'success'>('color')
  const [color, setColor]         = useState('')
  const [gratitude, setGratitude] = useState('')
  const [anxiety, setAnxiety]     = useState('')
  const [hope, setHope]           = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState('')
  const [recColor, setRecColor]   = useState<string | null>(null)

  useEffect(() => {
    if (!getToken()) { Taro.navigateTo({ url: '/pages/login/index' }); return }
    initWasm().then(ok => { if (ok) { const rec = getRecommendation([]); if (rec) setRecColor((rec as any).color_suggestion.color) } })
  }, [])

  async function handleSubmit() {
    if (!gratitude.trim() && !anxiety.trim() && !hope.trim()) { setError('至少填写一项'); return }
    setSubmitting(true); setError('')
    try {
      const input = { color, gratitude: gratitude.trim() || undefined, anxiety: anxiety.trim() || undefined, hope: hope.trim() || undefined }
      const result = validatePlant(input)
      if (result && !result.valid) { setError(result.error || '校验失败'); setSubmitting(false); return }
      const c = result?.cleaned
      await createRose({ color: c?.color || color, gratitude: c?.gratitude || undefined, anxiety: c?.anxiety || undefined, hope: c?.hope || undefined })
      setStep('success')
    } catch { setError('提交失败，请重试') } finally { setSubmitting(false) }
  }

  const options   = colorOptions()
  const colorMeta = options.find(c => c.id === color)

  if (step === 'color') return (
    <View className={styles.page}>
      <NavBar title="种一朵玫瑰" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
        <Text className={styles.title}>选择玫瑰颜色</Text>
        {recColor && <Text className={styles.rec}>💡 推荐：{options.find(c => c.id === recColor)?.label}</Text>}
        <View className={styles.colors}>
          {options.map(c => (
            <View key={c.id} className={styles.colorCard} onClick={() => { setColor(c.id); setStep('form') }}>
              <Text className={styles.colorEmoji}>{c.emoji}</Text>
              <Text className={styles.colorLabel}>{c.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )

  if (step === 'success') return (
    <View className={styles.page}>
      <NavBar title="种花成功" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
        <Text className={styles.successEmoji}>{colorMeta?.emoji}</Text>
        <Text className={styles.successTitle}>已种入花圃</Text>
        <Text className={styles.successSub}>AI 正在聆听你的故事...</Text>
        <Button className={styles.btn} onClick={() => Taro.navigateTo({ url: '/subpkg-garden/pages/garden/index' })}>回到花圃</Button>
      </View>
    </View>
  )

  return (
    <View className={styles.page}>
      <NavBar title="种一朵玫瑰" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
        <Text className={styles.formTitle}>{colorMeta?.emoji} 写下你的心情</Text>
        <Text className={styles.fieldLabel}>🌹 感恩</Text>
        <Textarea className={styles.textarea} placeholder="这周让你感到幸福的事..." maxlength={500} value={gratitude} onInput={e => setGratitude(e.detail.value)} />
        <Text className={styles.fieldLabel}>🌵 焦虑</Text>
        <Textarea className={styles.textarea} placeholder="有什么让你感到压力..." maxlength={500} value={anxiety} onInput={e => setAnxiety(e.detail.value)} />
        <Text className={styles.fieldLabel}>🌱 期待</Text>
        <Textarea className={styles.textarea} placeholder="你现在期待的事情..." maxlength={500} value={hope} onInput={e => setHope(e.detail.value)} />
        {error ? <Text className={styles.error}>{error}</Text> : null}
        <Button className={styles.btn} loading={submitting} disabled={submitting} onClick={handleSubmit}>种下玫瑰</Button>
        <Text className={styles.back} onClick={() => setStep('color')}>← 换颜色</Text>
      </View>
    </View>
  )
}
