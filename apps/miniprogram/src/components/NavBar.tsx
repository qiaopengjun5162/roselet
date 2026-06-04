import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'

const { statusBarHeight } = Taro.getSystemInfoSync()
const menuButton = Taro.getMenuButtonBoundingClientRect()
const navHeight = (menuButton.top - statusBarHeight) * 2 + menuButton.height
const totalHeight = statusBarHeight + navHeight

export function NavBar({ title }: { title: string }) {
  return (
    <View
      style={{
        paddingTop: `${statusBarHeight}px`,
        height: `${totalHeight}px`,
        background: 'linear-gradient(180deg, rgba(15,8,30,0.95) 0%, rgba(20,10,35,0.9) 100%)',
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

export function useNavHeight() {
  return totalHeight
}
