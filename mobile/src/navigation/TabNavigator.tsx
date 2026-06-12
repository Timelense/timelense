import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { colors, typography } from '../theme'
import type { TabParamList } from './types'
import { TimerIcon, TimelineIcon, InsightsIcon, SettingsIcon } from '../components/icons'
import { BrandHeader } from '../components/BrandHeader'
import TimerScreen from '../screens/TimerScreen'
import TimelineScreen from '../screens/TimelineScreen'
import InsightsScreen from '../screens/InsightsScreen'
import SettingsScreen from '../screens/SettingsScreen'

const Tab = createBottomTabNavigator<TabParamList>()

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        header: () => <BrandHeader screen={route.name} />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontSize: typography.size.xs,
          fontWeight: typography.weight.medium,
        },
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.text, fontWeight: typography.weight.semibold },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      })}
    >
      <Tab.Screen
        name="Timer"
        component={TimerScreen}
        options={{
          title: 'Timer',
          tabBarIcon: ({ color, size, focused }) => <TimerIcon color={color} size={size} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Timeline"
        component={TimelineScreen}
        options={{
          title: 'Timeline',
          tabBarIcon: ({ color, size, focused }) => <TimelineIcon color={color} size={size} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={InsightsScreen}
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size, focused }) => <InsightsIcon color={color} size={size} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size, focused }) => <SettingsIcon color={color} size={size} focused={focused} />,
        }}
      />
    </Tab.Navigator>
  )
}
