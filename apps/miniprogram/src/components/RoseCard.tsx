import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { COLOR_EMOJI, COLOR_LABEL } from '@/utils/constants'
import styles from './RoseCard.module.css'

export function RoseCard({ rose }: { rose: Rose }) {
  return (
    <View className={styles.card} onClick={() => Taro.navigateTo({ url: `/subpkg-garden/pages/rose/index?id=${rose.id}` })}>
      <View className={styles.header}>
        <Text className={styles.emoji}>{COLOR_EMOJI[rose.color] ?? '🌸'}</Text>
        <Text className={styles.color}>{COLOR_LABEL[rose.color] ?? rose.color}</Text>
        {rose.nickname ? <Text className={styles.nick}>@{rose.nickname}</Text> : null}
      </View>
      {rose.gratitude ? <Text className={styles.field}>🌹 {rose.gratitude}</Text> : null}
      {rose.anxiety ? <Text className={styles.field}>🌵 {rose.anxiety}</Text> : null}
      {rose.hope ? <Text className={styles.field}>🌱 {rose.hope}</Text> : null}
    </View>
  )
}
