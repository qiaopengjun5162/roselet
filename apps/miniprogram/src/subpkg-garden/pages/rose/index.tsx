import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { getRose } from '@/api'
import { NavBar, TOTAL_HEADER_HEIGHT } from '@/components/NavBar'
import { colorEmoji } from '@/utils/wasm'
import styles from './index.module.css'

export default function RoseDetail() {
  const { id } = Taro.getCurrentInstance().router?.params ?? {}
  const [rose, setRose] = useState<Rose | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { if (!id) return; getRose(id).then(setRose).catch(() => setError('加载失败')) }, [id])

  if (error) return <View className={styles.page}><NavBar title="玫瑰" /><Text className={styles.hint}>{error}</Text></View>
  if (!rose)  return <View className={styles.page}><NavBar title="玫瑰" /><Text className={styles.hint}>加载中...</Text></View>

  return (
    <View className={styles.page}>
      <NavBar title="玫瑰详情" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
        <Text className={styles.emoji}>{colorEmoji(rose.color)}</Text>
        {rose.nickname && <Text className={styles.nick}>@{rose.nickname}</Text>}
        {rose.gratitude && <View className={styles.section}><Text className={styles.sectionTitle}>🌹 感恩</Text><Text className={styles.content}>{rose.gratitude}</Text></View>}
        {rose.anxiety   && <View className={styles.section}><Text className={styles.sectionTitle}>🌵 焦虑</Text><Text className={styles.content}>{rose.anxiety}</Text></View>}
        {rose.hope      && <View className={styles.section}><Text className={styles.sectionTitle}>🌱 期待</Text><Text className={styles.content}>{rose.hope}</Text></View>}
        {rose.ai_reply  && (
          <View className={styles.aiSection}>
            <Text className={styles.aiTitle}>✨ AI 回应</Text>
            <Text className={styles.aiContent}>{rose.ai_reply}</Text>
          </View>
        )}
      </View>
    </View>
  )
}
