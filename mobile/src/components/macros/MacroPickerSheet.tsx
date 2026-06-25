import { useMemo } from 'react'
import { Modal, ScrollView, Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import { getCategories } from '../../api/categories'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'
import type { MacroWithUsage } from '../../api/macros'
import { categoryColorMap, categoryNameMap, macroColor } from './helpers'

/**
 * Bottom-sheet picker listing every macro (the long tail beyond the chip row).
 * Tap a row to apply it. The footer links to macro management.
 */
export function MacroPickerSheet({
  visible,
  macros,
  title = 'Start with…',
  onPick,
  onClose,
  onManage,
}: {
  visible: boolean
  macros: MacroWithUsage[]
  title?: string
  onPick: (macro: MacroWithUsage) => void
  onClose: () => void
  onManage?: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const cats = useMemo(() => getCategories(), [visible])
  const catColor = useMemo(() => categoryColorMap(cats), [cats])
  const catName = useMemo(() => categoryNameMap(cats), [cats])

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <Text style={styles.title}>{title}</Text>

          {macros.length === 0 ? (
            <Text style={styles.empty}>No macros yet. Create one in Settings → Quick macros.</Text>
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              {macros.map((m) => {
                const color = macroColor(m, catColor, colors)
                const sub = m.categoryId && catName[m.categoryId] ? catName[m.categoryId] : m.tag
                return (
                  <TouchableOpacity key={m.id} style={styles.rowItem} onPress={() => onPick(m)} activeOpacity={0.7}>
                    <View style={[styles.dot, { backgroundColor: color }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{m.title}</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          )}

          {onManage && (
            <TouchableOpacity style={styles.manageBtn} onPress={onManage} activeOpacity={0.7}>
              <Text style={styles.manageText}>Manage macros</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, paddingBottom: spacing.xl, paddingHorizontal: spacing.lg, maxHeight: '70%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm, marginBottom: spacing.md },
  title: { fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing.sm },
  empty: { fontSize: typography.size.sm, color: colors.textSecondary, paddingVertical: spacing.lg, textAlign: 'center', fontWeight: typography.weight.medium },
  list: { marginBottom: spacing.sm },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.text },
  rowSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  manageBtn: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  manageText: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.primary },
})
