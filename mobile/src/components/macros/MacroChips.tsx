import { useMemo } from 'react'
import { ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getCategories } from '../../api/categories'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'
import type { MacroWithUsage } from '../../api/macros'
import { categoryColorMap, macroColor } from './helpers'

/**
 * Horizontal, frecency-ordered row of quick-start macro chips. Tap a chip to
 * apply that macro. Optional trailing "More" chip opens the full picker.
 */
export function MacroChips({
  macros,
  onPick,
  onMore,
}: {
  macros: MacroWithUsage[]
  onPick: (macro: MacroWithUsage) => void
  onMore?: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const catColor = useMemo(() => categoryColorMap(getCategories()), [])

  if (macros.length === 0) {
    if (!onMore) return null
    return (
      <View style={styles.row}>
        <TouchableOpacity style={[styles.chip, styles.moreChip]} onPress={onMore} activeOpacity={0.7}>
          <Text style={styles.moreText}>＋ Quick macros</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {macros.map((m) => {
        const color = macroColor(m, catColor, colors)
        return (
          <TouchableOpacity key={m.id} style={styles.chip} onPress={() => onPick(m)} activeOpacity={0.7}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.chipText} numberOfLines={1}>{m.title}</Text>
          </TouchableOpacity>
        )
      })}
      {onMore && (
        <TouchableOpacity style={[styles.chip, styles.moreChip]} onPress={onMore} activeOpacity={0.7}>
          <Text style={styles.moreText}>All</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: 200,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 9, height: 9, borderRadius: 4.5 },
  chipText: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.text },
  moreChip: { backgroundColor: colors.surfaceRaised },
  moreText: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.primary },
})
