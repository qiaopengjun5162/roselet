import { useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getGarden } from '@/api'
import { RoseCard } from '@/components/RoseCard'
import { NavBar, TOTAL_HEADER_HEIGHT } from '@/components/NavBar'
import { loadGardenCache } from '@/utils/garden-cache'
import { useWasmStore } from '@/utils/useWasmStore'
import styles from './index.module.css'

const FILTERS = [
  { value: '', label: '全部' }, { value: 'red', label: '红' },
  { value: 'white', label: '白' }, { value: 'yellow', label: '黄' },
]

export default function Garden() {
  const { items, total, hasMore, loading, error, filter, dispatch, ready } = useWasmStore()

  function restoreCache(color?: string) {
    if (color) return
    const cache = loadGardenCache()
    if (!cache) return
    dispatch({ type: 'set_roses', roses: cache.roses as unknown[], total: cache.total, page: cache.page })
  }

  function load(p: number, color?: string) {
    if (p === 1) {
      restoreCache(color)
      dispatch({ type: 'set_loading', loading: true })
    }
    getGarden(p, 20, color)
      .then(res => {
        if (p === 1) dispatch({ type: 'set_roses', roses: res.data as unknown[], total: res.total, page: res.page })
        else dispatch({ type: 'append_roses', roses: res.data as unknown[], page: res.page })
      })
      .catch(() => dispatch({ type: 'set_error', error: '加载失败' }))
  }

  useEffect(() => {
    if (ready) load(1, filter === 'all' ? undefined : filter)
  }, [ready, filter])
  Taro.useDidShow(() => { load(1, filter === 'all' ? undefined : filter) })

  return (
    <View className={styles.page}>
      <NavBar title="花圃" />
      <Text className="petal-fall-1">🌸</Text>
      <Text className="petal-fall-2">🌺</Text>
      <Text className="petal-fall-3">🌷</Text>
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 12}px` }}>
        <View className={styles.filters}>
          {FILTERS.map(f => (
            <Text key={f.value} className={`${styles.filter} ${filter === f.value ? styles.active : ''}`}
              onClick={() => dispatch({ type: 'set_filter', filter: f.value })}>{f.label}</Text>
          ))}
          {ready && <Text style={{ color: '#10b981', fontSize: '11px', alignSelf: 'center' }}>⚡Rust</Text>}
        </View>
        {loading && items.length === 0 ? <Text className={styles.hint}>加载中...</Text>
          : error ? <Text className={styles.hint} style={{ color: '#f87171' }}>{error}</Text>
          : items.length === 0 ? <Text className={styles.hint}>花圃还是空的</Text>
          : (
            <ScrollView scrollY className={styles.list}>
              {items.map(r => <RoseCard key={(r as any).id} rose={r as any} />)}
              {hasMore && <Text className={styles.more} onClick={() => load((Math.floor(items.length / 20)) + 1)}>加载更多</Text>}
            </ScrollView>
          )}
      </View>
    </View>
  )
}
