import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getToken } from '@/utils/storage'
import { initWasm } from '@/utils/wasm'
import { NavBar } from '@/components/NavBar'
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
      <View className={styles.container}>
        <View className={styles.glow} />
        <Text className={styles.emoji}>🌹</Text>
        <Text className={styles.title}>Roselet</Text>
        <Text className={styles.sub}>在星空下种下你的情绪，等待宇宙的回响</Text>
        <View className={styles.cards}>
          <View className={`${styles.card} ${styles.cardGratitude}`}>
            <Text className={styles.cardEmoji}>🌹</Text>
            <Text className={styles.cardTitle}>玫瑰</Text>
            <Text className={styles.cardDesc}>感恩与幸福</Text>
          </View>
          <View className={`${styles.card} ${styles.cardHope}`}>
            <Text className={styles.cardEmoji}>🌱</Text>
            <Text className={styles.cardTitle}>花苞</Text>
            <Text className={styles.cardDesc}>期待与灵感</Text>
          </View>
          <View className={`${styles.card} ${styles.cardAnxiety}`}>
            <Text className={styles.cardEmoji}>🌵</Text>
            <Text className={styles.cardTitle}>尖刺</Text>
            <Text className={styles.cardDesc}>焦虑与帮助</Text>
          </View>
        </View>
        <Button className={styles.btnPrimary} onClick={handlePlant}>种一朵玫瑰</Button>
        <Button className={styles.btnSecondary} onClick={() => Taro.switchTab({ url: '/pages/garden/index' })}>参观花圃</Button>
      </View>
    </View>
  )
}
