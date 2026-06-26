import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native'
import type { Macro } from '@timelense/shared'
import { getCategories } from '../../api/categories'
import {
  getMacros,
  newMacroId,
  upsertMacro,
  removeMacro,
  reorderMacro,
  type MacroWithUsage,
} from '../../api/macros'
import { MacroEditor } from './MacroEditor'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'
import { categoryColorMap, categoryNameMap, macroColor } from './helpers'

/**
 * Settings section: list, add, edit, delete, reorder and pin quick-start macros.
 * Persists the whole list via the macros API (syncs to the server when online).
 */
export function MacroManager() {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const cats = getCategories()
  const catColor = useMemo(() => categoryColorMap(cats), [cats])
  const catName = useMemo(() => categoryNameMap(cats), [cats])

  const [list, setList] = useState<MacroWithUsage[]>(() => getMacros())
  const [editing, setEditing] = useState<Macro | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const run = async (op: Promise<unknown>) => {
    setSaving(true)
    try {
      await op
    } catch {
      Alert.alert('Saved offline', "Couldn't reach the server. Your macros are saved on this device and will sync when you're back online.")
    } finally {
      setList(getMacros())
      setSaving(false)
      setEditing(null)
    }
  }

  const openNew = () => {
    setIsNew(true)
    setEditing({ id: newMacroId(), title: '', categoryId: null, tag: 'neutral', order: list.length })
  }
  const openEdit = (m: MacroWithUsage) => {
    setIsNew(false)
    setEditing({ id: m.id, title: m.title, categoryId: m.categoryId, tag: m.tag, order: m.order, pinned: m.pinned })
  }

  const handleSave = (m: Macro) => {
    if (!m.title.trim()) { Alert.alert('Name required', 'Give the macro a title.'); return }
    run(upsertMacro({ ...m, title: m.title.trim() }))
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.cardLabel}>Quick macros</Text>
        <TouchableOpacity onPress={openNew} disabled={saving}>
          <Text style={styles.addBtn}>＋ Add</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>One tap on the Timer fills the title, category and tag automatically.</Text>

      {list.length === 0 ? (
        <Text style={styles.empty}>No macros yet — add your most-tracked activities.</Text>
      ) : (
        list.map((m, i) => (
          <View key={m.id} style={styles.row}>
            <TouchableOpacity style={styles.rowMain} onPress={() => openEdit(m)} activeOpacity={0.7}>
              <View style={[styles.dot, { backgroundColor: macroColor(m, catColor, colors) }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{m.title}</Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {m.categoryId && catName[m.categoryId] ? catName[m.categoryId] : m.tag}
                </Text>
              </View>
              {m.pinned && <Text style={styles.pin}>📌</Text>}
            </TouchableOpacity>
            <View style={styles.reorder}>
              <TouchableOpacity disabled={saving || i === 0} onPress={() => run(reorderMacro(m.id, -1))} hitSlop={8}>
                <Text style={[styles.arrow, i === 0 && styles.arrowOff]}>↑</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={saving || i === list.length - 1} onPress={() => run(reorderMacro(m.id, 1))} hitSlop={8}>
                <Text style={[styles.arrow, i === list.length - 1 && styles.arrowOff]}>↓</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      <MacroEditor
        macro={editing}
        isNew={isNew}
        saving={saving}
        onSave={handleSave}
        onDelete={(id) => run(removeMacro(id))}
        onClose={() => setEditing(null)}
      />
    </View>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.textSecondary },
  addBtn: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.primary },
  hint: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },
  empty: { fontSize: typography.size.sm, color: colors.textSecondary, paddingVertical: spacing.sm, fontWeight: typography.weight.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.text },
  rowSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  pin: { fontSize: 14 },
  reorder: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs },
  arrow: { fontSize: typography.size.lg, color: colors.primary, lineHeight: 20 },
  arrowOff: { color: colors.textMuted, opacity: 0.4 },
})
