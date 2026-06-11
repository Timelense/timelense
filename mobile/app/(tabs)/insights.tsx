import { View, Text } from 'react-native'
import { colors, typography } from '../../src/theme'

export default function InsightsScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: typography.size.lg, color: colors.text }}>Insights</Text>
    </View>
  )
}
