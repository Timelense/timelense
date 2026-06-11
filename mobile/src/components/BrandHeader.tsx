import { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { colors, typography, spacing, radius } from '../theme'

// Mini lens-clock logo (same motif as the app icon)
export function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#818CF8" />
          <Stop offset="100%" stopColor="#A78BFA" />
        </LinearGradient>
      </Defs>
      <Circle cx={24} cy={24} r={15} stroke="url(#ringGrad)" strokeWidth={4} fill="none" />
      {/* focus ticks */}
      <Path d="M24 3.5v5M44.5 24h-5M24 44.5v-5M3.5 24h5" stroke="#A78BFA" strokeWidth={2.5} strokeLinecap="round" />
      {/* hands */}
      <Path d="M24 24V14.5" stroke="#F1F5F9" strokeWidth={3} strokeLinecap="round" />
      <Path d="M24 24l6.5 4.5" stroke="#34D399" strokeWidth={2.6} strokeLinecap="round" />
      <Circle cx={24} cy={24} r={2.6} fill="#6366F1" />
    </Svg>
  )
}

export function BrandWordmark({ size = typography.size.lg }: { size?: number }) {
  return (
    <Text style={[styles.wordmark, { fontSize: size }]}>
      Time<Text style={styles.wordmarkAccent}>Lense</Text>
    </Text>
  )
}

// Header used across all tab screens: logo + wordmark, screen name as a chip.
export function BrandHeader({ screen }: { screen: string }) {
  const insets = useSafeAreaInsets()
  const anim = useRef(new Animated.Value(0)).current

  // Subtle once-per-mount entrance: logo eases in with a tiny rotation settle
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 700,
      easing: Easing.out(Easing.back(1.6)),
      useNativeDriver: true,
    }).start()
  }, [])

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View style={styles.brandRow}>
        <Animated.View
          style={{
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) },
              { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['-40deg', '0deg'] }) },
            ],
          }}
        >
          <BrandLogo />
        </Animated.View>
        <BrandWordmark />
      </View>
      <View style={styles.screenChip}>
        <Text style={styles.screenChipText}>{screen}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wordmark: { fontWeight: typography.weight.bold, color: colors.text, letterSpacing: 0.3 },
  wordmarkAccent: { color: colors.accent },
  screenChip: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  screenChipText: { color: colors.textSecondary, fontSize: typography.size.xs, fontWeight: typography.weight.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
})
