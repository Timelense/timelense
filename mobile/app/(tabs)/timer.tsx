import { useEffect, useState, useRef } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProductivityTag } from '@timelense/shared'
import { getCurrentTask, startTask, stopTask } from '../../src/api/tasks'
import { TagSelector } from '../../src/components/TagSelector'
import { CategoryPicker } from '../../src/components/CategoryPicker'
import { colors, typography, spacing, radius } from '../../src/theme'

function formatElapsed(startedAt: string): string {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function TimerScreen() {
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [tag, setTag] = useState<ProductivityTag>('neutral')
  const [notes, setNotes] = useState('')
  const [elapsed, setElapsed] = useState('00:00')
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const { data: current, isLoading } = useQuery({
    queryKey: ['current-task'],
    queryFn: getCurrentTask,
    refetchInterval: false,
  })

  // Live elapsed time computed from startedAt — survives backgrounding
  useEffect(() => {
    if (current) {
      setElapsed(formatElapsed(current.startedAt))
      tickRef.current = setInterval(() => setElapsed(formatElapsed(current.startedAt)), 1000)
    } else {
      if (tickRef.current) clearInterval(tickRef.current)
    }
    return () => { if (tickRef.current) clearInterval(tickRef.current) }
  }, [current?.id])

  const handleStart = async () => {
    if (!title.trim()) { Alert.alert('', 'Enter a task title'); return }
    try {
      const res = await startTask({ title: title.trim(), categoryId: categoryId ?? undefined, tag, notes: notes || undefined })
      if (res.stoppedTask) Alert.alert('', `Stopped "${res.stoppedTask.title}"`, [{ text: 'OK' }])
      qc.setQueryData(['current-task'], res.task)
      qc.invalidateQueries({ queryKey: ['tasks'] })
    } catch {
      Alert.alert('Error', 'Could not start task')
    }
  }

  const handleStop = async () => {
    if (!current) return
    try {
      await stopTask(current.id)
      qc.setQueryData(['current-task'], null)
      qc.invalidateQueries({ queryKey: ['tasks'] })
      setTitle('')
      setNotes('')
      setCategoryId(null)
      setTag('neutral')
    } catch {
      Alert.alert('Error', 'Could not stop task')
    }
  }

  if (isLoading) return <View style={styles.container} />

  if (current) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.runningLabel}>RUNNING</Text>
        <Text style={styles.elapsed}>{elapsed}</Text>
        <Text style={styles.taskTitle}>{current.title}</Text>

        <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
          <Text style={styles.stopBtnText}>Stop</Text>
        </TouchableOpacity>

        <View style={styles.notesRow}>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={styles.notesInput}
            placeholder="Add notes…"
            placeholderTextColor={colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>What are you working on?</Text>

      <TextInput
        style={styles.titleInput}
        placeholder="Task title"
        placeholderTextColor={colors.textMuted}
        value={title}
        onChangeText={setTitle}
        maxLength={255}
      />

      <Text style={styles.label}>Category</Text>
      <CategoryPicker value={categoryId} onChange={setCategoryId} />

      <Text style={[styles.label, { marginTop: spacing.md }]}>Tag</Text>
      <TagSelector value={tag} onChange={setTag} />

      <Text style={[styles.label, { marginTop: spacing.md }]}>Notes</Text>
      <TextInput
        style={styles.notesInput}
        placeholder="Optional notes"
        placeholderTextColor={colors.textMuted}
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
        <Text style={styles.startBtnText}>Start</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.sm },
  titleInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: typography.size.lg, color: colors.text, marginBottom: spacing.sm },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing.xs },
  notesInput: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: typography.size.md, color: colors.text, minHeight: 80, textAlignVertical: 'top' },
  startBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  startBtnText: { color: colors.white, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  // running state
  runningLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.productive, letterSpacing: 2, textAlign: 'center' },
  elapsed: { fontSize: typography.size.xxxl + 8, fontWeight: typography.weight.bold, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  taskTitle: { fontSize: typography.size.xl, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.xl },
  stopBtn: { backgroundColor: colors.danger, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginBottom: spacing.xl },
  stopBtnText: { color: colors.white, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  notesRow: { gap: spacing.xs },
})
