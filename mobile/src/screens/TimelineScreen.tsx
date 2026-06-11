import { useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Alert, Modal, TextInput } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { DailyTimelineEntry } from '@timelense/shared'
import { getTimeline } from '../api/analytics'
import { editTask, deleteTask } from '../api/tasks'
import { colors, typography, spacing, radius } from '../theme'

const TAG_COLOR: Record<string, string> = {
  productive: colors.productive,
  'non-productive': colors.nonProductive,
  neutral: colors.neutral,
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function TimelineScreen() {
  const qc = useQueryClient()
  const [date, setDate] = useState(todayStr())
  const [editing, setEditing] = useState<DailyTimelineEntry | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['timeline', date],
    queryFn: () => getTimeline(date),
  })

  const openEdit = (entry: DailyTimelineEntry) => {
    setEditing(entry)
    setEditTitle(entry.title)
    setEditNotes(entry.notes ?? '')
  }

  const handleSave = async () => {
    if (!editing) return
    try {
      await editTask(editing.id, { title: editTitle, notes: editNotes || null })
      qc.invalidateQueries({ queryKey: ['timeline', date] })
      setEditing(null)
    } catch {
      Alert.alert('Error', 'Could not save changes')
    }
  }

  const handleDelete = async (entry: DailyTimelineEntry) => {
    Alert.alert('Delete entry', `Delete "${entry.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          try {
            await deleteTask(entry.id)
            qc.invalidateQueries({ queryKey: ['timeline', date] })
          } catch { Alert.alert('Error', 'Could not delete entry') }
        },
      },
    ])
  }

  const renderEntry = ({ item }: { item: DailyTimelineEntry }) => (
    <TouchableOpacity style={styles.entry} onPress={() => openEdit(item)} onLongPress={() => handleDelete(item)}>
      <View style={[styles.tagBar, { backgroundColor: TAG_COLOR[item.tag] }]} />
      <View style={styles.entryBody}>
        <Text style={styles.entryTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.entryMeta}>
          {formatTime(item.startedAt)}{item.endedAt ? ` – ${formatTime(item.endedAt)}` : ' (running)'} · {item.durationMinutes}m
        </Text>
      </View>
    </TouchableOpacity>
  )

  return (
    <View style={styles.container}>
      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(todayStr())}>
          <Text style={styles.dateText}>{date === todayStr() ? 'Today' : date}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDate(addDays(date, 1))}
          style={[styles.navBtn, date >= todayStr() && styles.navBtnDisabled]}
          disabled={date >= todayStr()}
        >
          <Text style={[styles.navArrow, date >= todayStr() && { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Summary card */}
      {data && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{data.totalMinutes}m</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.productive }]}>{data.productiveMinutes}m</Text>
            <Text style={styles.summaryLabel}>Productive</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.nonProductive }]}>{data.nonProductiveMinutes}m</Text>
            <Text style={styles.summaryLabel}>Non-prod</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {data.score != null ? `${data.score}%` : '—'}
            </Text>
            <Text style={styles.summaryLabel}>Score</Text>
          </View>
        </View>
      )}

      {/* Entry list */}
      {isLoading ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>Loading…</Text></View>
      ) : data?.entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No entries for this day</Text>
          <Text style={styles.emptyHint}>Start the timer to track your time</Text>
        </View>
      ) : (
        <FlatList
          data={data?.entries}
          keyExtractor={(i) => i.id}
          renderItem={renderEntry}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        />
      )}

      {/* Edit sheet */}
      <Modal visible={!!editing} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.editModal}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setEditing(null)}>
              <Text style={{ color: colors.danger }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.editTitle}>Edit Entry</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={{ color: colors.primary, fontWeight: typography.weight.semibold }}>Save</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.editBody}>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              style={styles.fieldInput}
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Task title"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
              value={editNotes}
              onChangeText={setEditNotes}
              placeholder="Notes"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => { setEditing(null); editing && handleDelete(editing) }}
            >
              <Text style={{ color: colors.white, fontWeight: typography.weight.semibold }}>Delete Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  navBtn: { padding: spacing.sm },
  navBtnDisabled: { opacity: 0.3 },
  navArrow: { fontSize: typography.size.xxl, color: colors.primary },
  dateText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  summary: { flexDirection: 'row', backgroundColor: colors.surface, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: typography.size.lg, fontWeight: typography.weight.bold, color: colors.text },
  summaryLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  entry: { flexDirection: 'row', backgroundColor: colors.surface, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md, overflow: 'hidden' },
  tagBar: { width: 4 },
  entryBody: { flex: 1, padding: spacing.md },
  entryTitle: { fontSize: typography.size.md, fontWeight: typography.weight.medium, color: colors.text },
  entryMeta: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { fontSize: typography.size.lg, color: colors.textSecondary },
  emptyHint: { fontSize: typography.size.sm, color: colors.textMuted },
  editModal: { flex: 1, backgroundColor: colors.background },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  editTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  editBody: { padding: spacing.lg, gap: spacing.sm },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  fieldInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: typography.size.md, color: colors.text },
  deleteBtn: { backgroundColor: colors.danger, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
})
