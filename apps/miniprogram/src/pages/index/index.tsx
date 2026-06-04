import { useEffect, useState } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getToken } from '@/utils/storage'
import { initWasm } from '@/utils/wasm'
import styles from './index.module.css'

export default function Index() {
  Taro.useLoad(() => { initWasm() })

  function handleEnter() {
    if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
    else Taro.navigateTo({ url: '/pages/garden/index' })
  }

  return (
    <View className={styles.container}>
      <Text className={styles.emoji}>🌹</Text>
      <Text className={styles.title}>Roselet</Text>
      <Text className={styles.sub}>种下感恩，花苞，与尖刺</Text>
      <Text className={styles.desc}>感恩一件让你幸福的事 · 说出一件让你焦虑的事 · 期待一件美好的事</Text>
      <Button className={styles.btn} onClick={handleEnter}>进入花圃</Button>
    </View>
  )
}
