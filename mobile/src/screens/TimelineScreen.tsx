import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Animated,
  Easing,
} from 'react-native'
import type { DailyTimeline, DailyTimelineEntry, ProductivityTag } from '@timelense/shared'
import { getTimeline, editTask, deleteTask } from '../api/tasks'
import { getCategories } from '../api/categories'
import { TagSelector } from '../components/TagSelector'
import { SyncIndicator } from '../components/SyncIndicator'
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
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function friendlyDate(dateStr: string): string {
  if (dateStr === todayStr()) return 'Today'
  if (dateStr === addDays(todayStr(), -1)) return 'Yesterday'
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

// Minutes of untracked time between two entries (returns 0 when overlapping)
function gapMinutes(prev: DailyTimelineEntry, next: DailyTimelineEntry): number {
  if (!prev.endedAt) return 0
  const gap = (new Date(next.startedAt).getTime() - new Date(prev.endedAt).getTime()) / 60000
  return gap > 1 ? Math.round(gap) : 0
}

// Staggered fade/slide-in for list rows
function RowFadeIn({ index, children }: { index: number; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 300,
      delay: Math.min(index, 10) * 40,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [])
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  )
}

// Proportion bar: productive / non-productive / neutral share of the day
function DayBar({ productive, nonProductive, neutral }: { productive: number; nonProductive: number; neutral: number }) {
  const total = productive + nonProductive + neutral
  if (total === 0) return null
  return (
    <View style={styles.dayBar}>
      {productive > 0 && <View style={{ flex: productive, backgroundColor: colors.productive }} />}
      {nonProductive > 0 && <View style={{ flex: nonProductive, backgroundColor: colors.nonProductive }} />}
      {neutral > 0 && <View style={{ flex: neutral, backgroundColor: colors.neutral }} />}
    </View>
  )
}

export default function TimelineScreen() {
  const [date, setDate] = useState(todayStr())
  const [data, setData] = useState<DailyTimeline | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [editing, setEditing] = useState<DailyTimelineEntry | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editTag, setEditTag] = useState<ProductivityTag>('neutral')

  // Load timeline from local DB (synchronous)
  const loadTimeline = useCallback(() => {
    setData(getTimeline(date))
  }, [date])

  // Reload when date changes
  useEffect(() => { loadTimeline() }, [loadTimeline])

  // Reload when tab regains focus
  useFocusEffect(useCallback(() => { loadTimeline() }, [loadTimeline]))

  const categories = getCategories()
  const catById = new Map(categories.map((c) => [c.id, c]))

  const openEdit = (entry: DailyTimelineEntry) => {
    setEditing(entry)
    setEditTitle(entry.title)
    setEditNotes(entry.notes ?? '')
    setEditTag(entry.tag)
  }

  const handleSave = () => {
    if (!editing) return
    try {
      editTask(editing.id, { title: editTitle, notes: editNotes || null, tag: editTag })
      loadTimeline()
      setEditing(null)
    } catch {
      Alert.alert('Error', 'Could not save changes')
    }
  }

  const handleDelete = (entry: DailyTimelineEntry) => {
    Alert.alert('Delete entry', `Delete "${entry.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          try {
            deleteTask(entry.id)
            loadTimeline()
          } catch { Alert.alert('Error', 'Could not delete entry') }
        },
      },
    ])
  }

  const renderEntry = ({ item, index }: { item: DailyTimelineEntry; index: number }) => {
    const entries = data?.entries ?? []
    const prev = index > 0 ? entries[index - 1] : null
    const gap = prev ? gapMinutes(prev, item) : 0
    const cat = item.categoryId ? catById.get(item.categoryId) : undefined
    const tagColor = TAG_COLOR[item.tag]
    const running = !item.endedAt

    return (
      <RowFadeIn index={index}>
        {gap > 0 && (
          <View style={styles.gapRow}>
            <View style={styles.gapLine} />
            <Text style={styles.gapText}>{fmtMinutes(gap)} untracked</Text>
            <View style={styles.gapLine} />
          </View>
        )}
        <View style={styles.row}>
          {/* time rail */}
          <View style={styles.rail}>
            <Text style={styles.railTime}>{formatTime(item.startedAt)}</Text>
            <View style={[styles.railDot, { backgroundColor: tagColor }, running && styles.railDotRunning]} />
            <View style={styles.railLine} />
          </View>
          {/* card */}
          <TouchableOpacity
            style={[styles.card, running && styles.cardRunning]}
            onPress={() => openEdit(item)}
            onLongPress={() => handleDelete(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.durationChip, { backgroundColor: `${tagColor}26` }]}>
                <Text style={[styles.durationText, { color: tagColor }]}>
                  {running ? 'now' : fmtMinutes(item.durationMinutes)}
                </Text>
              </View>
            </View>
            <View style={styles.cardMetaRow}>
              <Text style={styles.cardMeta}>
                {formatTime(item.startedAt)}{item.endedAt ? ` – ${formatTime(item.endedAt)}` : ' – running'}
              </Text>
              {cat && (
                <View style={styles.catChip}>
                  <View style={[styles.catDot, { backgroundColor: cat.color ?? colors.textMuted }]} />
                  <Text style={styles.catText} numberOfLines={1}>{cat.name}</Text>
                </View>
              )}
            </View>
            {!!item.notes && <Text style={styles.cardNotes} numberOfLines={2}>{item.notes}</Text>}
          </TouchableOpacity>
        </View>
      </RowFadeIn>
    )
  }

  return (
    <View style={styles.container}>
      {/* Date navigation */}
      <View style={styles.dateNav}>
        <TouchableOpacity onPress={() => setDate(addDays(date, -1))} style={styles.navBtn}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setDate(todayStr())}>
          <Text style={styles.dateText}>{friendlyDate(date)}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setDate(addDays(date, 1))}
          style={[styles.navBtn, date >= todayStr() && styles.navBtnDisabled]}
          disabled={date >= todayStr()}
        >
          <Text style={[styles.navArrow, date >= todayStr() && { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Day summary */}
      {data && data.totalMinutes > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{fmtMinutes(data.totalMinutes)}</Text>
              <Text style={styles.summaryLabel}>Tracked</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.productive }]}>{fmtMinutes(data.productiveMinutes)}</Text>
              <Text style={styles.summaryLabel}>Productive</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.nonProductive }]}>{fmtMinutes(data.nonProductiveMinutes)}</Text>
              <Text style={styles.summaryLabel}>Non-prod</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: colors.accent }]}>
                {data.score != null ? `${data.score}` : '—'}
              </Text>
              <Text style={styles.summaryLabel}>Score</Text>
            </View>
          </View>
          <DayBar
            productive={data.productiveMinutes}
            nonProductive={data.nonProductiveMinutes}
            neutral={data.neutralMinutes}
          />
        </View>
      )}

      {/* Entry list */}
      {isLoading ? (
        <View style={styles.emptyState}><Text style={styles.emptyText}>Loading…</Text></View>
      ) : data?.entries.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>A perfectly blank day</Text>
          <Text style={styles.emptyHint}>Future you will want receipts — hit Start on the Timer tab</Text>
        </View>
      ) : (
        <FlatList
          data={data?.entries}
          keyExtractor={(i) => i.id}
          renderItem={renderEntry}
          contentContainerStyle={{ paddingVertical: spacing.md, paddingRight: spacing.md }}
        />
      )}

      {/* Edit sheet */}
      <Modal visible={!!editing} animationType="slide" transparent>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.editHeader}>
              <TouchableOpacity onPress={() => setEditing(null)}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.editTitle}>Edit entry</Text>
              <TouchableOpacity onPress={handleSave}>
                <Text style={{ color: colors.accent, fontWeight: typography.weight.semibold }}>Save</Text>
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
              <Text style={styles.fieldLabel}>Tag</Text>
              <TagSelector value={editTag} onChange={setEditTag} />
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
                onPress={() => { const e = editing; setEditing(null); e && handleDelete(e) }}
              >
                <Text style={{ color: colors.danger, fontWeight: typography.weight.semibold }}>Delete entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const RAIL_W = 64

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  // date nav
  dateNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  navBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.4 },
  navArrow: { fontSize: typography.size.xl, color: colors.accent, lineHeight: 24 },
  dateText: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  // summary
  summary: { marginHorizontal: spacing.md, marginBottom: spacing.xs, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  summaryStats: { flexDirection: 'row' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryValue: { fontSize: typography.size.md, fontWeight: typography.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  summaryLabel: { fontSize: typography.size.xs, color: colors.textMuted, marginTop: 2 },
  dayBar: { flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.divider },
  // gap indicator
  gapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: RAIL_W, marginVertical: 2, paddingRight: spacing.sm },
  gapLine: { flex: 1, height: 1, backgroundColor: colors.divider },
  gapText: { fontSize: typography.size.xs, color: colors.textMuted },
  // timeline rows
  row: { flexDirection: 'row', marginTop: spacing.sm },
  rail: { width: RAIL_W, alignItems: 'center' },
  railTime: { fontSize: typography.size.xs, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  railDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  railDotRunning: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: colors.background },
  railLine: { flex: 1, width: 2, backgroundColor: colors.divider, marginTop: 4, borderRadius: 1 },
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 6 },
  cardRunning: { borderColor: colors.productive },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { flex: 1, fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text },
  durationChip: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.full },
  durationText: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, fontVariant: ['tabular-nums'] },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardMeta: { fontSize: typography.size.xs, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: 140 },
  catDot: { width: 7, height: 7, borderRadius: 3.5 },
  catText: { fontSize: typography.size.xs, color: colors.textSecondary },
  cardNotes: { fontSize: typography.size.sm, color: colors.textSecondary, lineHeight: 18 },
  // empty state
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyText: { fontSize: typography.size.lg, color: colors.textSecondary },
  emptyHint: { fontSize: typography.size.sm, color: colors.textMuted },
  // edit sheet
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg + 8, borderTopRightRadius: radius.lg + 8, paddingBottom: spacing.xl },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginTop: spacing.sm },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  editTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  editBody: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  fieldLabel: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginTop: spacing.xs },
  fieldInput: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: typography.size.md, color: colors.text },
  deleteBtn: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.md },
})
