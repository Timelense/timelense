import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView, Switch, Alert } from 'react-native'
import type { Macro, ProductivityTag } from '@timelense/shared'
import { getCategories } from '../../api/categories'
import { getMacros, saveMacros, newMacroId, type MacroWithUsage } from '../../api/macros'
import { CategoryPicker } from '../CategoryPicker'
import { TagSelector } from '../TagSelector'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'
import { categoryColorMap, categoryNameMap, macroColor } from './helpers'

/**
 * Settings section to manage quick-start macros: list, add, edit, delete, pin.
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

  const persist = async (next: Macro[]) => {
    setSaving(true)
    try {
      await saveMacros(next)
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
    const cleaned = { ...m, title: m.title.trim() }
    const next = isNew
      ? [...list.map(strip), cleaned]
      : list.map(strip).map((x) => (x.id === cleaned.id ? cleaned : x))
    persist(next)
  }
  const handleDelete = (id: string) => {
    persist(list.map(strip).filter((x) => x.id !== id))
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
        list.map((m) => (
          <TouchableOpacity key={m.id} style={styles.row} onPress={() => openEdit(m)} activeOpacity={0.7}>
            <View style={[styles.dot, { backgroundColor: macroColor(m, catColor, colors) }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle} numberOfLines={1}>{m.title}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {m.categoryId && catName[m.categoryId] ? catName[m.categoryId] : m.tag}
              </Text>
            </View>
            {m.pinned && <Text style={styles.pin}>📌</Text>}
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))
      )}

      <MacroEditor
        macro={editing}
        isNew={isNew}
        saving={saving}
        onSave={handleSave}
        onDelete={handleDelete}
        onClose={() => setEditing(null)}
      />
    </View>
  )
}

function strip(m: MacroWithUsage | Macro): Macro {
  return { id: m.id, title: m.title, categoryId: m.categoryId, tag: m.tag, order: m.order, ...(m.pinned ? { pinned: true } : {}) }
}

function MacroEditor({
  macro,
  isNew,
  saving,
  onSave,
  onDelete,
  onClose,
}: {
  macro: Macro | null
  isNew: boolean
  saving: boolean
  onSave: (m: Macro) => void
  onDelete: (id: string) => void
  onClose: () => void
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [tag, setTag] = useState<ProductivityTag>('neutral')
  const [pinned, setPinned] = useState(false)

  // Sync local form state when a macro opens.
  const [lastId, setLastId] = useState<string | null>(null)
  if (macro && macro.id !== lastId) {
    setLastId(macro.id)
    setTitle(macro.title)
    setCategoryId(macro.categoryId)
    setTag(macro.tag)
    setPinned(!!macro.pinned)
  }

  if (!macro) return null

  return (
    <Modal
      visible
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.sheetTitle}>{isNew ? 'New macro' : 'Edit macro'}</Text>
            <TouchableOpacity onPress={() => onSave({ id: macro.id, title, categoryId, tag, order: macro.order, ...(pinned ? { pinned: true } : {}) })} disabled={saving}>
              <Text style={styles.save}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Deep work"
              placeholderTextColor={colors.textMuted}
              maxLength={100}
              autoFocus={isNew}
            />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Category</Text>
            <CategoryPicker value={categoryId} onChange={setCategoryId} />

            <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Tag</Text>
            <TagSelector value={tag} onChange={setTag} />

            <View style={styles.pinRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.fieldLabel}>Pin to front</Text>
                <Text style={styles.pinHint}>Always show first, ahead of most-used.</Text>
              </View>
              <Switch value={pinned} onValueChange={setPinned} trackColor={{ true: colors.primary }} />
            </View>

            {!isNew && (
              <TouchableOpacity style={styles.deleteBtn} onPress={() => onDelete(macro.id)} disabled={saving}>
                <Text style={styles.deleteText}>Delete macro</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLabel: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.textSecondary },
  addBtn: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.primary },
  hint: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },
  empty: { fontSize: typography.size.sm, color: colors.textSecondary, paddingVertical: spacing.sm, fontWeight: typography.weight.medium },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.divider },
  dot: { width: 12, height: 12, borderRadius: 6 },
  rowTitle: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.text },
  rowSub: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  pin: { fontSize: 14 },
  chevron: { fontSize: typography.size.xl, color: colors.textMuted },
  // editor sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, paddingBottom: spacing.xl, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  cancel: { color: colors.textSecondary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  sheetTitle: { fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
  save: { color: colors.accent, fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold },
  body: { paddingHorizontal: spacing.lg },
  fieldLabel: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.textSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: typography.size.lg, color: colors.text, fontWeight: typography.weight.semibold },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  pinHint: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, fontWeight: typography.weight.medium },
  deleteBtn: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  deleteText: { color: colors.danger, fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold },
})
