import { useState } from 'react'
import { View, Text, TouchableOpacity, Modal, FlatList, TextInput, StyleSheet, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Category } from '@timelense/shared'
import { getCategories, createCategory } from '../api/categories'
import { colors, typography, spacing, radius } from '../theme'

const COLOR_PALETTE = ['#4A90D9', '#48BB78', '#FC8181', '#F6AD55', '#805AD5', '#2C5282', '#38A169', '#E53E3E']

interface Props {
  value: string | null
  onChange: (categoryId: string | null) => void
}

export function CategoryPicker({ value, onChange }: Props) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newParentId, setNewParentId] = useState<string | null>(null)
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0])

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories })

  const topLevel = categories.filter((c) => !c.parentId)
  const selectedCat = categories.find((c) => c.id === value)

  const handleCreate = async () => {
    if (!newName.trim()) return
    try {
      await createCategory({ name: newName.trim(), parentId: newParentId ?? undefined, color: newColor })
      await qc.invalidateQueries({ queryKey: ['categories'] })
      setCreating(false)
      setNewName('')
      setNewParentId(null)
      setNewColor(COLOR_PALETTE[0])
    } catch {
      Alert.alert('Error', 'Could not create category')
    }
  }

  const renderItem = ({ item }: { item: Category }) => {
    const children = categories.filter((c) => c.parentId === item.id)
    return (
      <View>
        <TouchableOpacity
          style={[styles.item, value === item.id && styles.itemActive]}
          onPress={() => { onChange(item.id); setOpen(false) }}
        >
          <View style={[styles.dot, { backgroundColor: item.color ?? colors.textMuted }]} />
          <Text style={styles.itemText}>{item.name}</Text>
        </TouchableOpacity>
        {children.map((child) => (
          <TouchableOpacity
            key={child.id}
            style={[styles.item, styles.itemChild, value === child.id && styles.itemActive]}
            onPress={() => { onChange(child.id); setOpen(false) }}
          >
            <View style={[styles.dot, { backgroundColor: child.color ?? colors.textMuted }]} />
            <Text style={styles.itemText}>{child.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={() => setOpen(true)}>
        {selectedCat ? (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: selectedCat.color ?? colors.textMuted }]} />
            <Text style={styles.triggerText}>{selectedCat.name}</Text>
          </View>
        ) : (
          <Text style={[styles.triggerText, { color: colors.textMuted }]}>Select category</Text>
        )}
        <Text style={{ color: colors.textMuted }}>›</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Category</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Text style={{ color: colors.primary }}>Done</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.item} onPress={() => { onChange(null); setOpen(false) }}>
            <Text style={[styles.itemText, { color: colors.textMuted }]}>None</Text>
          </TouchableOpacity>

          <FlatList
            data={topLevel}
            keyExtractor={(i) => i.id}
            renderItem={renderItem}
          />

          {creating ? (
            <View style={styles.createForm}>
              <Text style={styles.createTitle}>New Category</Text>
              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor={colors.textMuted}
                value={newName}
                onChangeText={setNewName}
                autoFocus
              />
              <View style={styles.row}>
                {topLevel.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setNewParentId(newParentId === c.id ? null : c.id)}
                    style={[styles.parentChip, newParentId === c.id && { borderColor: colors.primary }]}
                  >
                    <Text style={{ fontSize: typography.size.xs, color: colors.text }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={[styles.row, { marginTop: spacing.sm }]}>
                {COLOR_PALETTE.map((col) => (
                  <TouchableOpacity
                    key={col}
                    onPress={() => setNewColor(col)}
                    style={[styles.colorSwatch, { backgroundColor: col, borderWidth: newColor === col ? 2 : 0, borderColor: colors.text }]}
                  />
                ))}
              </View>
              <TouchableOpacity style={styles.createBtn} onPress={handleCreate}>
                <Text style={{ color: colors.white, fontWeight: typography.weight.semibold }}>Create</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.newBtn} onPress={() => setCreating(true)}>
              <Text style={{ color: colors.primary, fontWeight: typography.weight.semibold }}>+ New category</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md },
  triggerText: { fontSize: typography.size.md, color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemChild: { paddingLeft: spacing.xl },
  itemActive: { backgroundColor: colors.primaryLight },
  itemText: { fontSize: typography.size.md, color: colors.text },
  createForm: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  createTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.sm },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.sm, fontSize: typography.size.md, color: colors.text, marginBottom: spacing.sm },
  parentChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  colorSwatch: { width: 28, height: 28, borderRadius: 14 },
  createBtn: { backgroundColor: colors.primary, padding: spacing.sm, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.sm },
  newBtn: { padding: spacing.md, alignItems: 'center' },
})
