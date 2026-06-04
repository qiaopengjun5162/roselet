import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { register } from '@/api'
import { setToken, setUser } from '@/utils/storage'
import { NavBar, TOTAL_HEADER_HEIGHT } from '@/components/NavBar'
import styles from './index.module.css'

export default function Login() {
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister() {
    const trimmed = nickname.trim()
    if (!trimmed || trimmed.length > 20) { setError('昵称 1-20 字'); return }
    setLoading(true); setError('')
    try {
      const res = await register(trimmed)
      setToken(res.token); setUser(res.user)
      Taro.navigateBack()
    } catch {
      setError('注册失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className={styles.page}>
      <NavBar title="登录" />
      <View className={styles.container} style={{ paddingTop: `${TOTAL_HEADER_HEIGHT + 16}px` }}>
        <View className={styles.card}>
          <Text className={styles.title}>🌹 给自己取个名字</Text>
          <Text className={styles.sub}>起个昵称，开始种花</Text>
          <Input
            className={styles.input}
            placeholder="你想叫什么名字？"
            maxlength={20}
            value={nickname}
            onInput={e => setNickname(e.detail.value)}
          />
          {error ? <Text className={styles.error}>{error}</Text> : null}
          <Button className={styles.btn} loading={loading} disabled={loading} onClick={handleRegister}>
            {loading ? '进入中...' : '进入花圃'}
          </Button>
        </View>
      </View>
    </View>
  )
}
