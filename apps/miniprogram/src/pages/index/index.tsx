import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getToken } from '@/utils/storage'
import { initWasm } from '@/utils/wasm'
import styles from './index.module.css'

export default function Index() {
  Taro.useLoad(() => { initWasm() })

  function handlePlant() {
    if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
    else Taro.navigateTo({ url: '/pages/plant/index' })
  }

  return (
    <View className={styles.container}>
      <Text className="petal-fall-1">🌸</Text>
      <Text className="petal-fall-2">🌺</Text>
      <Text className="petal-fall-3">🌷</Text>
      <Text className="petal-fall-4">💮</Text>
      {/* 光晕 */}
      <View className={styles.glow} />

      {/* 标题区 */}
      <Text className={styles.emoji}>🌹</Text>
      <Text className={styles.title}>Roselet</Text>
      <Text className={styles.sub}>在星空下种下你的情绪，等待宇宙的回响</Text>

      {/* 三张说明卡片 */}
      <View className={styles.cards}>
        <View className={`${styles.card} ${styles.cardGratitude}`}>
          <Text className={styles.cardEmoji}>🌹</Text>
          <Text className={styles.cardTitle}>玫瑰</Text>
          <Text className={styles.cardDesc}>这周让你感到幸福或感恩的事情是什么？</Text>
        </View>
        <View className={`${styles.card} ${styles.cardHope}`}>
          <Text className={styles.cardEmoji}>🌱</Text>
          <Text className={styles.cardTitle}>花苞</Text>
          <Text className={styles.cardDesc}>你现在有什么期待的事情，或新灵感想实现？</Text>
        </View>
        <View className={`${styles.card} ${styles.cardAnxiety}`}>
          <Text className={styles.cardEmoji}>🌵</Text>
          <Text className={styles.cardTitle}>尖刺</Text>
          <Text className={styles.cardDesc}>有什么让你感到焦虑或需要帮助的事情？</Text>
        </View>
      </View>

      {/* 按钮 */}
      <Button className={styles.btnPrimary} onClick={handlePlant}>种一朵玫瑰</Button>
      <Button className={styles.btnSecondary} onClick={() => Taro.navigateTo({ url: '/pages/garden/index' })}>参观花圃</Button>
    </View>
  )
}
