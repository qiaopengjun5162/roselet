import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { getGarden } from '@/api'
import { RoseCard } from '@/components/RoseCard'
import { NavBar } from '@/components/NavBar'
import styles from './index.module.css'

export default function Garden() {
  const [roses, setRoses] = useState<Rose[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const filtered = color ? roses.filter(r => r.color === color) : roses

  function load(p: number, c: string) {
    if (p === 1) setLoading(true)
    getGarden(p, 20, c || undefined)
      .then(res => { setRoses(prev => p === 1 ? res.data : [...prev, ...res.data]); setTotal(res.total); setPage(p) })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1, color) }, [color])
  Taro.useDidShow(() => { load(1, color) })

  const filters = [{ value: '', label: '全部' }, { value: 'red', label: '红' }, { value: 'white', label: '白' }, { value: 'yellow', label: '黄' }]

  return (
    <View className={styles.page}>
      <NavBar title="花圃" />
      <View className={styles.container}>
        <View className={styles.filters}>
          {filters.map(f => (
            <Text key={f.value} className={`${styles.filter} ${color === f.value ? styles.active : ''}`} onClick={() => setColor(f.value)}>{f.label}</Text>
          ))}
        </View>
        {loading ? <Text className={styles.hint}>加载中...</Text>
          : error ? <Text className={styles.hint}>{error}</Text>
          : filtered.length === 0 ? <Text className={styles.hint}>花圃还是空的</Text>
          : (
            <ScrollView scrollY className={styles.list}>
              {filtered.map(r => <RoseCard key={r.id} rose={r} />)}
              {filtered.length < total && <Text className={styles.more} onClick={() => load(page + 1, color)}>加载更多</Text>}
            </ScrollView>
          )}
      </View>
    </View>
  )
}
