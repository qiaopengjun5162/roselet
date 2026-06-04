import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getToken } from '@/utils/storage'
import { initWasm } from '@/utils/wasm'
import { NavBar, TOTAL_HEADER_HEIGHT } from '@/components/NavBar'
import styles from './index.module.css'

export default function Index() {
  Taro.useLoad(() => { initWasm() })

  function handlePlant() {
    if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
    else Taro.navigateTo({ url: '/pages/plant/index' })
  }

  return (
    <View className={styles.page}>
      <NavBar title="Roselet" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 32}px` }}>
        <View className={styles.glow} />
        <Text className={styles.emoji}>🌹</Text>
        <Text className={styles.title} style={{ fontFamily: 'STXingkai, KaiTi, 楷体, serif' }}>Roselet</Text>
        <Text className={styles.tagline}>在星空下种下你的情绪</Text>
        <Text className={styles.taglineSub}>等待宇宙的回响</Text>

        <View className={styles.cards}>
          <View className={`${styles.card} ${styles.cardGratitude}`}>
            <Text className={styles.cardEmoji}>🌹</Text>
            <View>
              <Text className={styles.cardTitle}>玫瑰 · 感恩</Text>
              <Text className={styles.cardDesc}>这周让你感到幸福的事情</Text>
            </View>
          </View>
          <View className={`${styles.card} ${styles.cardHope}`}>
            <Text className={styles.cardEmoji}>🌱</Text>
            <View>
              <Text className={styles.cardTitle}>花苞 · 期待</Text>
              <Text className={styles.cardDesc}>你正期待的新灵感和愿望</Text>
            </View>
          </View>
          <View className={`${styles.card} ${styles.cardAnxiety}`}>
            <Text className={styles.cardEmoji}>🌵</Text>
            <View>
              <Text className={styles.cardTitle}>尖刺 · 焦虑</Text>
              <Text className={styles.cardDesc}>让你感到压力或需要帮助的事</Text>
            </View>
          </View>
        </View>

        <Button className={styles.btnPrimary} onClick={handlePlant}>种一朵玫瑰</Button>
        <Button className={styles.btnSecondary} onClick={() => Taro.navigateTo({ url: '/pages/garden/index' })}>参观花圃</Button>
      </View>
    </View>
  )
}
