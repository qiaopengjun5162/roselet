import { View, Text, Button } from "@tarojs/components";
import { useState } from "react"
import Taro from "@tarojs/taro";
import { getToken } from "@/utils/storage";
import { initWasm, generatePetals } from "@/utils/wasm";
import { NavBar, TOTAL_HEADER_HEIGHT } from "@/components/NavBar";
import { useBloomTap } from "@/components/BloomTap";
import styles from "./index.module.css";
export default function Index() {
  const { handleTap, bloomsView } = useBloomTap()
  const [petals, setPetals] = useState<any[]>([])
  Taro.useLoad(() => { initWasm().then(() => { const p = generatePetals(8, 42); if (p) setPetals(p); }) })

  function handlePlant() {
    if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
    else Taro.navigateTo({ url: '/pages/plant/index' })
  }

  return (
    <View className={styles.page} onClick={handleTap}>
      <NavBar title="Roselet" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 32}px`, paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}>
        <View className={styles.glow} />
        {petals.map((p, i) => (<Text key={i} style={{ position: "fixed", top: "-5%", left: p.left+"%", fontSize: p.size+"px", zIndex: 0, pointerEvents: "none", opacity: p.opacity, animation: "petalFall1 "+p.duration+"s "+p.delay+"s ease-in infinite" }}>{p.emoji}</Text>))}
        <Text className={`${styles.emoji} fade-in-up`}>🌹</Text>
        <Text className={`${styles.title} fade-in-up-d1`} style={{ fontFamily: 'STXingkai, KaiTi, 楷体, serif' }}>Roselet</Text>
        <Text className={`${styles.tagline} fade-in-up-d1`}>在星空下种下你的情绪</Text>
        <Text className={`${styles.taglineSub} fade-in-up-d2`}>等待宇宙的回响</Text>

        <View className={`${styles.cards} fade-in-up-d2`}>
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

        <View className="fade-in-up-d3" style={{ width: '100%', maxWidth: '340px' }}>
          <Button className={styles.btnPrimary} onClick={handlePlant}>种一朵玫瑰</Button>
          <Button className={styles.btnSecondary} onClick={() => Taro.navigateTo({ url: '/pages/garden/index' })}>参观花圃</Button>
        </View>
      </View>
      {bloomsView}
    </View>
  )
}
