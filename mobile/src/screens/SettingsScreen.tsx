import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { colors, typography, spacing, radius } from '../theme'
import { useAuth } from '../contexts/auth'
import { logout } from '../api/auth'

export default function SettingsScreen() {
  const { signOut } = useAuth()

  const handleLogout = () => {
    Alert.alert('Log out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          await logout()
          signOut()
        },
      },
    ])
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.appName}>TimeLens</Text>
        <Text style={styles.tagline}>Track where your time really goes</Text>
      </View>

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>v1.0.0</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  appName: { fontSize: typography.size.xl, fontWeight: typography.weight.bold, color: colors.text },
  tagline: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 4 },
  row: { alignItems: 'center' },
  logoutText: { color: colors.danger, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: typography.size.xs, marginTop: 'auto' as never, marginBottom: spacing.md },
})
