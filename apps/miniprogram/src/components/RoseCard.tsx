import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { colorEmoji, colorLabel } from '@/utils/wasm'
import styles from './RoseCard.module.css'

export function RoseCard({ rose, onTap }: { rose: Rose; onTap?: () => void }) {
  return (
    <View className={styles.card} onClick={onTap ?? (() => Taro.navigateTo({ url: `/subpkg-garden/pages/rose/index?id=${rose.id}` }))}>
      <View className={styles.header}>
        <Text className={styles.emoji}>{colorEmoji(rose.color)}</Text>
        <Text className={styles.color}>{colorLabel(rose.color)}</Text>
        {rose.is_private ? <Text className={styles.lock}>🔒</Text> : null}
        {rose.nickname ? <Text className={styles.nick}>@{rose.nickname}</Text> : null}
      </View>
      {rose.gratitude ? <Text className={styles.field}>🌹 {rose.gratitude}</Text> : null}
      {rose.anxiety   ? <Text className={styles.field}>🌵 {rose.anxiety}</Text>   : null}
      {rose.hope      ? <Text className={styles.field}>🌱 {rose.hope}</Text>      : null}
    </View>
  )
}
