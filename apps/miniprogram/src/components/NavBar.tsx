import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

const systemInfo = Taro.getSystemInfoSync()
const menuButton = Taro.getMenuButtonBoundingClientRect()

/** 状态栏高度 — iPhone 14 Pro: 54px, iPhone SE: 20px */
export const STATUS_BAR_HEIGHT = systemInfo.statusBarHeight || 20

/** 导航栏高度（不含状态栏），根据胶囊按钮位置动态计算 */
export const NAV_BAR_HEIGHT = (menuButton.top - STATUS_BAR_HEIGHT) * 2 + menuButton.height

/** 顶部安全区总高度 — 状态栏 + 导航栏 */
export const TOTAL_HEADER_HEIGHT = STATUS_BAR_HEIGHT + NAV_BAR_HEIGHT

export function NavBar({ title, showBack = true }: { title: string; showBack?: boolean }) {
  const pages = Taro.getCurrentPages()
  const canBack = showBack && pages.length > 1

  return (
    <View
      style={{
        paddingTop: `${STATUS_BAR_HEIGHT}px`,
        height: `${TOTAL_HEADER_HEIGHT}px`,
        background: 'linear-gradient(135deg, rgba(15,8,30,0.95) 0%, rgba(40,12,30,0.92) 50%, rgba(15,8,30,0.95) 100%)',
        borderBottom: '1px solid rgba(244,63,94,0.15)',
        boxShadow: '0 1px 20px rgba(244,63,94,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
      }}
    >
      {canBack && (
        <View
          onClick={() => Taro.navigateBack()}
          style={{
            position: 'absolute',
            left: 12,
            paddingTop: `${STATUS_BAR_HEIGHT}px`,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '4px',
            paddingRight: '4px',
          }}
        >
          <Text style={{ fontSize: '20px', color: '#fda4af' }}>←</Text>
        </View>
      )}
      <Text
        style={{
          color: '#fda4af',
          fontSize: '17px',
          fontWeight: 600,
          letterSpacing: '2px',
        }}
      >
        {title}
      </Text>
    </View>
  )
}
