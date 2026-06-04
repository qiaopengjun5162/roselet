import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { getGarden } from '@/api'
import { getToken } from '@/utils/storage'
import { RoseCard } from '@/components/RoseCard'
import { COLOR_FILTERS } from '@/utils/constants'
import styles from './index.module.css'

export default function Garden() {
  const [roses, setRoses] = useState<Rose[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  function load(p: number, c: string) {
    if (p === 1) setLoading(true)
    getGarden(p, 20, c || undefined)
      .then(res => { setRoses(prev => p === 1 ? res.data : [...prev, ...res.data]); setTotal(res.total); setPage(p) })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1, color) }, [color])
  Taro.useDidShow(() => { load(1, color) })

  // 未登录时跳转到登录页，否则跳种花页
  function handleFabClick() {
    if (!getToken()) Taro.navigateTo({ url: '/pages/login/index' })
    else Taro.navigateTo({ url: '/pages/plant/index' })
  }

  return (
    <View className={styles.container}>
      <Text className="petal-fall-1">🌸</Text>
      <Text className="petal-fall-2">🌺</Text>
      <Text className="petal-fall-3">🌷</Text>
      <View className={styles.filters}>
        {COLOR_FILTERS.map(f => (
          <Text key={f.value} className={`${styles.filter} ${color === f.value ? styles.active : ''}`} onClick={() => setColor(f.value)}>{f.label}</Text>
        ))}
      </View>
      {loading ? <Text className={styles.hint}>加载中...</Text>
        : error ? <Text className={styles.hint}>{error}</Text>
        : roses.length === 0 ? <Text className={styles.hint}>花圃还是空的</Text>
        : (
          <ScrollView scrollY className={styles.list}>
            {roses.map(r => <RoseCard key={r.id} rose={r} />)}
            {roses.length < total && <Text className={styles.more} onClick={() => load(page + 1, color)}>加载更多</Text>}
          </ScrollView>
        )}
      <View className={styles.fab} onClick={handleFabClick}>
        <Text className={styles.fabText}>🌹</Text>
      </View>
    </View>
  )
}
