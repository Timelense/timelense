import { useEffect, useMemo, useRef } from 'react'
import { View, Text, StyleSheet, Animated, Easing } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Path, Defs, LinearGradient, Stop } from 'react-native-svg'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../theme'
import { SyncIndicator } from './SyncIndicator'

// Mini lens-clock logo (same motif as the app icon)
export function BrandLogo({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#7C6BF5" />
          <Stop offset="22%" stopColor="#6FB7FF" />
          <Stop offset="44%" stopColor="#5BD1B0" />
          <Stop offset="64%" stopColor="#FFC93C" />
          <Stop offset="82%" stopColor="#FF8A6B" />
          <Stop offset="100%" stopColor="#FF9EC4" />
        </LinearGradient>
      </Defs>
      <Circle cx={24} cy={24} r={15} stroke="url(#ringGrad)" strokeWidth={5} fill="none" />
      {/* focus ticks */}
      <Path d="M24 3.5v5M44.5 24h-5M24 44.5v-5M3.5 24h5" stroke="#FF9EC4" strokeWidth={3} strokeLinecap="round" />
      {/* hands */}
      <Path d="M24 24V14.5" stroke="#7C6BF5" strokeWidth={3.4} strokeLinecap="round" />
      <Path d="M24 24l6.5 4.5" stroke="#2FC79B" strokeWidth={3} strokeLinecap="round" />
      <Circle cx={24} cy={24} r={3} fill="#7C6BF5" />
    </Svg>
  )
}

export function BrandWordmark({ size = typography.size.lg }: { size?: number }) {
  const { colors } = useTheme()
  return (
    <Text style={{ fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text, letterSpacing: 0.2, fontSize: size }}>
      Time<Text style={{ fontFamily: fonts.bold, color: colors.primary }}>Lens</Text>
    </Text>
  )
}

// Header used across all tab screens: logo + wordmark, screen name as a chip.
export function BrandHeader({ screen }: { screen: string }) {
  const insets = useSafeAreaInsets()
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <SyncIndicator />
        <View style={styles.screenChip}>
          <Text style={styles.screenChipText}>{screen.toLowerCase()}</Text>
        </View>
      </View>
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  screenChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  screenChipText: { color: colors.primary, fontSize: typography.size.xs, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, letterSpacing: 0.3 },
})
