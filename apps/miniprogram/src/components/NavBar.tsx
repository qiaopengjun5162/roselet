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

export function NavBar({ title }: { title: string }) {
  return (
    <View
      style={{
        paddingTop: `${STATUS_BAR_HEIGHT}px`,
        height: `${TOTAL_HEADER_HEIGHT}px`,
        background: "rgba(10,11,20,0.88)",
        borderBottom: '1px solid rgba(244,63,94,0.15)',
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
      <Text
        style={{
          color: '#f9a8d4',
          fontSize: '17px',
          fontWeight: 600,
          letterSpacing: '1px',
        }}
      >
        {title}
      </Text>
    </View>
  )
}
