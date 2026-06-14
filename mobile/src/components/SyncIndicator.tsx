/**
 * SyncIndicator — subtle visual indicator of sync status.
 *
 * Shows different states:
 * - Nothing when fully synced and online (clean)
 * - Cloud + count when pending ops exist
 * - Spinner when actively syncing
 * - Warning when sync error or offline
 */
import React, { useMemo } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { useSyncStatus } from '../sync/syncStatus'
import { useTheme, typography, spacing, radius, type Palette } from '../theme'

function SpinnerDot() {
  const { colors } = useTheme()
  const spin = React.useRef(new Animated.Value(0)).current

  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => loop.stop()
  }, [])

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  return (
    <Animated.Text style={[{ fontSize: 12, color: colors.textSecondary }, { transform: [{ rotate }] }]}>
      ↻
    </Animated.Text>
  )
}

export function SyncIndicator() {
  const { isOnline, isSyncing, pendingOpsCount, lastError } = useSyncStatus()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  // Fully synced and online — show nothing
  if (isOnline && !isSyncing && pendingOpsCount === 0 && !lastError) {
    return null
  }

  return (
    <View style={styles.container}>
      {isSyncing ? (
        <>
          <SpinnerDot />
          <Text style={styles.label}>Syncing…</Text>
        </>
      ) : !isOnline ? (
        <>
          <Text style={styles.iconWarning}>⚡</Text>
          <Text style={styles.label}>Offline</Text>
          {pendingOpsCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingOpsCount}</Text>
            </View>
          )}
        </>
      ) : lastError ? (
        <>
          <Text style={styles.iconWarning}>⚠</Text>
          <Text style={styles.labelError}>Sync error</Text>
        </>
      ) : pendingOpsCount > 0 ? (
        <>
          <Text style={styles.icon}>☁↑</Text>
          <Text style={styles.label}>{pendingOpsCount}</Text>
        </>
      ) : null}
    </View>
  )
}

/**
 * Compact version for use inside tab bars or tight spaces.
 */
export function SyncDot() {
  const { isOnline, isSyncing, pendingOpsCount, lastError } = useSyncStatus()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])

  if (isOnline && !isSyncing && pendingOpsCount === 0 && !lastError) {
    return null
  }

  let dotColor: string = colors.textMuted
  if (!isOnline) dotColor = colors.neutral
  else if (lastError) dotColor = colors.danger
  else if (isSyncing) dotColor = colors.accent
  else if (pendingOpsCount > 0) dotColor = colors.neutral

  return <View style={[styles.dot, { backgroundColor: dotColor }]} />
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  icon: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  iconWarning: {
    fontSize: 12,
    color: colors.neutral,
  },
  label: {
    fontSize: typography.size.xs,
    color: colors.textSecondary,
  },
  labelError: {
    fontSize: typography.size.xs,
    color: colors.danger,
  },
  badge: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
})
