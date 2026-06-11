import { Tabs } from 'expo-router'
import { colors } from '../../src/theme'

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="timer" options={{ title: 'Timer', tabBarLabel: 'Timer' }} />
      <Tabs.Screen name="timeline" options={{ title: 'Timeline', tabBarLabel: 'Timeline' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights', tabBarLabel: 'Insights' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarLabel: 'Settings' }} />
    </Tabs>
  )
}
