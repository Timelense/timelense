import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Modal, ScrollView, Switch } from 'react-native'
import type { Macro, ProductivityTag } from '@timelense/shared'
import { CategoryPicker } from '../CategoryPicker'
import { TagSelector } from '../TagSelector'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../../theme'

/**
 * Create / edit a macro. Controlled by `macro` (null = closed). Reused by the
 * Settings manager and the Timer's "+ New" / peek-edit flows.
 */
export function MacroEditor({
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
  const [lastId, setLastId] = useState<string | null>(null)

  // Sync local form state when a different macro opens.
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
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}><Text style={styles.cancel}>Cancel</Text></TouchableOpacity>
            <Text style={styles.title}>{isNew ? 'New macro' : 'Edit macro'}</Text>
            <TouchableOpacity
              onPress={() => onSave({ id: macro.id, title, categoryId, tag, order: macro.order, ...(pinned ? { pinned: true } : {}) })}
              disabled={saving}
            >
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
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, paddingBottom: spacing.xl, maxHeight: '85%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  cancel: { color: colors.textSecondary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  title: { fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
  save: { color: colors.accent, fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.bold },
  body: { paddingHorizontal: spacing.lg },
  fieldLabel: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.textSecondary, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: typography.size.lg, color: colors.text, fontWeight: typography.weight.semibold },
  pinRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  pinHint: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2, fontWeight: typography.weight.medium },
  deleteBtn: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  deleteText: { color: colors.danger, fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold },
})
