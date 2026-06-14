import { useMemo } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import { useTheme, typography, spacing, radius, fonts, type Palette, type ThemePreference } from '../theme'
import { useAuth } from '../contexts/auth'
import { logout } from '../api/auth'
import { useSyncStatus } from '../sync/syncStatus'

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export default function SettingsScreen() {
  const { signOut } = useAuth()
  const { pendingOpsCount } = useSyncStatus()
  const { colors, preference, setPreference } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  const handleLogout = () => {
    if (pendingOpsCount > 0) {
      Alert.alert(
        'Warning: Unsynced Tasks',
        `You have ${pendingOpsCount} task(s) that haven't been saved to the server yet. If you log out now, these tasks will be permanently lost.\n\nAre you sure you want to log out?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Log Out Anyway',
            style: 'destructive',
            onPress: async () => {
              await logout()
              signOut()
            },
          },
        ]
      )
      return
    }

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
        <Text style={styles.cardLabel}>Appearance</Text>
        <View style={styles.segment}>
          {THEME_OPTIONS.map((opt) => {
            const active = preference === opt.value
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.segmentBtn, active && styles.segmentBtnActive]}
                onPress={() => setPreference(opt.value)}
              >
                <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
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

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: spacing.md, gap: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  appName: { fontSize: typography.size.xl, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
  tagline: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 4, fontFamily: fonts.medium, fontWeight: typography.weight.medium },
  cardLabel: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.textSecondary },
  segment: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.full, padding: 4 },
  segmentBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.textSecondary },
  segmentTextActive: { color: colors.white },
  row: { alignItems: 'center' },
  logoutText: { color: colors.danger, fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: typography.size.xs, marginTop: 'auto' as never, marginBottom: spacing.md, fontWeight: typography.weight.medium },
})
