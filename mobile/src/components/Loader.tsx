import { ActivityIndicator, View, Text, StyleSheet } from 'react-native'
import { useTheme, spacing } from '../theme'

type LoaderSize = 'small' | 'large'

interface LoaderProps {
  size?: LoaderSize
  color?: string
  /** When true, fills the parent (used for full-screen / section loading). */
  fullscreen?: boolean
  /** Optional inline label rendered next to the spinner. */
  label?: string
  /** Optional text style for the label. */
  labelStyle?: object
}

/**
 * Lightweight visual loader.
 *
 * - Default is a small inline spinner suitable for buttons or chips.
 * - Pass `fullscreen` to centre a larger spinner inside a flex container
 *   (useful for whole-screen / section loading states).
 */
export function Loader({
  size = 'small',
  color,
  fullscreen = false,
  label,
  labelStyle,
}: LoaderProps) {
  const { colors } = useTheme()
  const spinnerColor = color ?? colors.accent
  const labelColor = { color: colors.textSecondary }
  if (fullscreen) {
    return (
      <View style={styles.fullscreen}>
        <ActivityIndicator size={size} color={spinnerColor} />
        {label != null && <Text style={[styles.label, labelColor, labelStyle]}>{label}</Text>}
      </View>
    )
  }

  return (
    <View style={styles.inline}>
      <ActivityIndicator size={size} color={spinnerColor} />
      {label != null && <Text style={[styles.label, labelColor, labelStyle]}>{label}</Text>}
    </View>
  )
}

const styles = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  fullscreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  label: { fontSize: 13 },
})
