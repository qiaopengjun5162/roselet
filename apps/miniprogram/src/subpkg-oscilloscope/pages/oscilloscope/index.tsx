import { View, Text } from '@tarojs/components'

export default function Oscilloscope() {
  return (
    <View style={{ minHeight: '100vh', background: '#0a0b14', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px' }}>
      <Text style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>🎵</Text>
      <Text style={{ color: '#f9a8d4', fontSize: '20px', fontWeight: 'bold', display: 'block' }}>示波器</Text>
      <Text style={{ color: '#64748b', fontSize: '13px', marginTop: '8px', textAlign: 'center', display: 'block' }}>
        情绪示波器功能即将到来
      </Text>
    </View>
  )
}
