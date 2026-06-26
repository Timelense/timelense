import { useMemo } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { getCategories } from '../../api/categories'
import { macroWeekMinutes, macroDailyMinutes, type MacroWithUsage } from '../../api/macros'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'
import { categoryColorMap, categoryNameMap, macroColor } from './helpers'

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/**
 * Long-press peek: a popover with this-week stats and quick Edit / Pin / Delete
 * — so power actions don't need a trip to Settings.
 */
export function MacroPeek({
  macro,
  onStart,
  onEdit,
  onTogglePin,
  onDelete,
  onClose,
}: {
  macro: MacroWithUsage | null
  onStart: (m: MacroWithUsage) => void
  onEdit: (m: MacroWithUsage) => void
  onTogglePin: (m: MacroWithUsage) => void
  onDelete: (m: MacroWithUsage) => void
  onClose: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const cats = useMemo(() => getCategories(), [macro?.id])
  const catColor = useMemo(() => categoryColorMap(cats), [cats])
  const catName = useMemo(() => categoryNameMap(cats), [cats])

  const week = useMemo(() => (macro ? macroWeekMinutes(macro) : 0), [macro?.id, macro?.title])
  const bars = useMemo(() => (macro ? macroDailyMinutes(macro, 5) : []), [macro?.id, macro?.title])
  const maxBar = Math.max(...bars, 1)

  if (!macro) return null
  const color = macroColor(macro, catColor, colors)
  const sub = macro.categoryId && catName[macro.categoryId] ? catName[macro.categoryId] : null

  return (
    <Modal visible transparent statusBarTranslucent presentationStyle="overFullScreen" animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.card} onPress={() => {}}>
          <View style={styles.titleRow}>
            <View style={[styles.dot, { backgroundColor: color }]} />
            <Text style={styles.title} numberOfLines={1}>{macro.title}</Text>
            {macro.pinned && <Text style={styles.pinned}>★ pinned</Text>}
          </View>
          <Text style={styles.sub}>{[sub, macro.tag].filter(Boolean).join(' · ')}</Text>

          <View style={styles.spark}>
            {bars.map((b, i) => (
              <View key={i} style={styles.sparkCol}>
                <View style={{ width: '100%', height: `${Math.max(6, (b / maxBar) * 100)}%`, backgroundColor: i === bars.length - 1 ? color : `${color}55`, borderRadius: 4 }} />
              </View>
            ))}
          </View>
          <Text style={styles.weekStat}>{fmtMinutes(week)} this week</Text>

          <TouchableOpacity style={[styles.startBtn, { backgroundColor: color }]} onPress={() => onStart(macro)}>
            <Text style={styles.startText}>Start now</Text>
          </TouchableOpacity>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => onEdit(macro)}>
              <Text style={styles.actionText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => onTogglePin(macro)}>
              <Text style={[styles.actionText, { color: colors.warning }]}>{macro.pinned ? '★ Unpin' : '★ Pin'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => onDelete(macro)}>
              <Text style={[styles.actionText, { color: colors.danger }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 320, backgroundColor: colors.surface, borderRadius: radius.lg + 4, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, ...shadowCard(colors) },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7 },
  title: { flex: 1, fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
  pinned: { fontSize: typography.size.xs, color: colors.warning, fontWeight: typography.weight.semibold },
  sub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 4, textTransform: 'capitalize', fontWeight: typography.weight.medium },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 40, marginTop: spacing.md },
  sparkCol: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  weekStat: { fontSize: typography.size.sm, color: colors.textSecondary, marginTop: 8, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold },
  startBtn: { borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.md },
  startText: { color: colors.white, fontSize: typography.size.md, fontFamily: fonts.bold, fontWeight: typography.weight.bold },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  action: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  actionText: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.primary },
})

function shadowCard(colors: Palette) {
  return { shadowColor: colors.black, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 28, elevation: 8 }
}
