import { View, Text, TouchableOpacity } from 'react-native'
import { colors, typography, spacing, radius } from '../theme'
import { useAuth } from '../contexts/auth'
import { logout } from '../api/auth'

export default function SettingsScreen() {
  const { signOut } = useAuth()

  const handleLogout = async () => {
    await logout()
    signOut()
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.lg }}>
      <Text style={{ fontSize: typography.size.xl, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.xl }}>
        Settings
      </Text>
      <TouchableOpacity
        onPress={handleLogout}
        style={{
          backgroundColor: colors.danger,
          padding: spacing.md,
          borderRadius: radius.md,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: colors.white, fontWeight: typography.weight.semibold, fontSize: typography.size.md }}>
          Log Out
        </Text>
      </TouchableOpacity>
    </View>
  )
}
