import { useEffect, useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Rose } from '@roselet/core'
import { getGarden } from '@/api'
import { RoseCard } from '@/components/RoseCard'
import { NavBar, TOTAL_HEADER_HEIGHT } from '@/components/NavBar'
import { initWasm, getLayout, filterRoses } from '@/utils/wasm'
import styles from './index.module.css'

const FILTERS = [{ value: '', label: '全部' }, { value: 'red', label: '红' }, { value: 'white', label: '白' }, { value: 'yellow', label: '黄' }]

export default function Garden() {
  const [roses, setRoses] = useState<Rose[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [color, setColor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wasmReady, setWasmReady] = useState(false)

  // WASM 初始化 + 排版计算
  useEffect(() => {
    initWasm().then(ok => setWasmReady(ok))
  }, [])

  // Rust 驱动的过滤
  const rustFiltered = wasmReady && roses.length > 0 ? filterRoses(roses, color) : null
  const displayed = rustFiltered ?? (color ? roses.filter(r => r.color === color) : roses)

  function load(p: number, c: string) {
    if (p === 1) setLoading(true)
    getGarden(p, 20, c || undefined)
      .then(res => { setRoses(prev => p === 1 ? res.data : [...prev, ...res.data]); setTotal(res.total); setPage(p) })
      .catch(() => setError('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(1, color) }, [color])
  Taro.useDidShow(() => { load(1, color) })

  return (
    <View className={styles.page}>
      <NavBar title="花圃" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 12}px` }}>
        <View className={styles.filters}>
          {FILTERS.map(f => (
            <Text key={f.value} className={`${styles.filter} ${color === f.value ? styles.active : ''}`} onClick={() => setColor(f.value)}>{f.label}</Text>
          ))}
        </View>
        {!wasmReady && !loading && <Text className={styles.hint} style={{ marginTop: '8px', fontSize: '11px' }}>⚡ Rust 引擎加载中...</Text>}
        {loading ? <Text className={styles.hint}>加载中...</Text>
          : error ? <Text className={styles.hint}>{error}</Text>
          : displayed.length === 0 ? <Text className={styles.hint}>花圃还是空的</Text>
          : (
            <ScrollView scrollY className={styles.list}>
              {displayed.map(r => <RoseCard key={r.id} rose={r} />)}
              {displayed.length < total && <Text className={styles.more} onClick={() => load(page + 1, color)}>加载更多</Text>}
            </ScrollView>
          )}
      </View>
    </View>
  )
}
