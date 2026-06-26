import { useMemo } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { getCategories } from '../../api/categories'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'
import type { MacroWithUsage } from '../../api/macros'
import { categoryColorMap, macroColor } from './helpers'

/**
 * "Quick start" macro board — Jelly flavour. Every macro is visible at once
 * (the row wraps), with pillowy white chips that carry a soft coloured glow.
 * Tap a chip to start; long-press to peek/edit; the dashed chip adds a new one.
 */
export function MacroBoard({
  macros,
  onPick,
  onPeek,
  onNew,
  onManage,
}: {
  macros: MacroWithUsage[]
  onPick: (m: MacroWithUsage) => void
  onPeek: (m: MacroWithUsage) => void
  onNew: () => void
  onManage?: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const catColor = useMemo(() => categoryColorMap(getCategories()), [])

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Quick start</Text>
        {onManage && (
          <Pressable onPress={onManage} hitSlop={8}>
            <Text style={styles.edit}>Edit</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.board}>
        {macros.map((m) => {
          const color = macroColor(m, catColor, colors)
          return (
            <Pressable
              key={m.id}
              onPress={() => onPick(m)}
              onLongPress={() => onPeek(m)}
              delayLongPress={280}
              style={({ pressed }) => [
                styles.chip,
                { shadowColor: color },
                pressed && styles.chipPressed,
              ]}
            >
              <View style={[styles.ring, { backgroundColor: `${color}26` }]}>
                <View style={[styles.dot, { backgroundColor: color }]} />
              </View>
              <Text style={styles.chipText} numberOfLines={1}>{m.title}</Text>
              {m.pinned && <Text style={styles.star}>★</Text>}
            </Pressable>
          )
        })}

        <Pressable
          onPress={onNew}
          style={({ pressed }) => [styles.newChip, pressed && styles.chipPressed]}
        >
          <Text style={styles.newText}>＋ New</Text>
        </Pressable>
      </View>

      {macros.length > 0 && (
        <Text style={styles.caption}>One tap starts it · hold to peek</Text>
      )}
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  wrap: { alignSelf: 'stretch', gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  headerLabel: { fontSize: typography.size.xs, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, letterSpacing: 1.5, textTransform: 'uppercase', color: colors.textMuted },
  edit: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.primary },
  board: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  // Jelly chip: pillowy white with a soft, colour-tinted shadow.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 15,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 220,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 3,
  },
  chipPressed: { transform: [{ scale: 0.93 }] },
  ring: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chipText: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.text },
  star: { fontSize: 11, color: colors.warning },
  newChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.neutral,
    borderStyle: 'dashed',
  },
  newText: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.primary },
  caption: { textAlign: 'center', fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },
})
