import { useEffect, useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Pressable,
} from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import type { ProductivityTag, TaskEntry } from '@timelense/shared'
import { getCurrentTask, startTask, stopTask, editTask, deleteTask } from '../api/tasks'
import { TagSelector } from '../components/TagSelector'
import { CategoryPicker } from '../components/CategoryPicker'
import { AuroraBackground } from '../components/AuroraBackground'
import { SyncIndicator } from '../components/SyncIndicator'
import { Loader } from '../components/Loader'
import { colors, typography, spacing, radius } from '../theme'

function formatElapsed(startedAt: string, endedAt?: string): string {
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  const elapsed = Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000))
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const BTN_SIZE = 190

// Quirky-but-professional microcopy, picked at random
const IDLE_HINTS = [
  'Time flies. Catch it.',
  'Big things start with one tap.',
  "Track first, judge later.",
  'Your future self is watching. No pressure.',
  'One tap. Total clarity.',
]
const STOP_PROMPTS = [
  'Nice sprint! What was it?',
  'So… what just happened?',
  'Label that block of brilliance',
  'What did this slice of life go to?',
  'Give those minutes a name',
]
const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]

// Soft expanding ring behind the big button
function PulseRing({ color, active }: { color: string; active: boolean }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!active) return
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    )
    loop.start()
    return () => { loop.stop(); anim.setValue(0) }
  }, [active])

  if (!active) return null

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulseRing,
        {
          borderColor: color,
          opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.55, 0.12, 0] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
        },
      ]}
    />
  )
}

// Fades + slides its children in when mounted
function FadeIn({ children }: { children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [])
  return (
    <Animated.View
      style={{
        flex: 1,
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  )
}

// Big round button with press feedback
function BigButton({ label, color, onPress, pulse }: { label: string; color: string; onPress: () => void; pulse: boolean }) {
  const scale = useRef(new Animated.Value(1)).current
  const pressIn = () => Animated.spring(scale, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 4 }).start()
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start()

  return (
    <View style={styles.bigBtnWrap}>
      <PulseRing color={color} active={pulse} />
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress}>
        <Animated.View style={[styles.bigBtn, { backgroundColor: color, transform: [{ scale }] }]}>
          <Text style={styles.bigBtnText}>{label}</Text>
        </Animated.View>
      </Pressable>
    </View>
  )
}

export default function TimerScreen() {
  // Current running task — read from local DB (synchronous)
  const [current, setCurrent] = useState<TaskEntry | null>(() => getCurrentTask())
  const [isLoading, setIsLoading] = useState(false)
  // Entry that was just stopped and is awaiting details
  const [pendingEntry, setPendingEntry] = useState<TaskEntry | null>(null)
  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [tag, setTag] = useState<ProductivityTag>('neutral')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [elapsed, setElapsed] = useState('00:00')
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [idleHint] = useState(() => pick(IDLE_HINTS))
  const [stopPrompt, setStopPrompt] = useState(STOP_PROMPTS[0])
  const [stopping, setStopping] = useState(false)

  // Refresh current task when the tab regains focus
  useFocusEffect(useCallback(() => {
    setCurrent(getCurrentTask())
  }, []))

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

  const handleStart = () => {
    // Writes to local DB instantly — no network needed
    const result = startTask()
    setCurrent(result.task)
  }

  // Stop ends the time span immediately, then asks for details
  const handleStop = () => {
    if (!current || stopping) return
    setStopping(true)
    // The local write is fast — hold the loader for a tick so the user
    // perceives the transition rather than seeing the screen snap.
    const MIN_LOADER_MS = 350
    const startedAt = Date.now()
    const stopped = stopTask(current.id)
    setCurrent(null)
    const finish = () => {
      if (stopped) {
        setStopPrompt(pick(STOP_PROMPTS))
        setPendingEntry(stopped)
        setTitle('')
        setCategoryId(null)
        setTag('neutral')
        setNotes('')
      }
      setStopping(false)
    }
    const elapsed = Date.now() - startedAt
    if (elapsed >= MIN_LOADER_MS) finish()
    else setTimeout(finish, MIN_LOADER_MS - elapsed)
  }

  const handleSave = () => {
    if (!pendingEntry) return
    // Save is also disabled in the UI when title is empty, but guard anyway.
    if (!title.trim()) return
    setSaving(true)
    try {
      editTask(pendingEntry.id, {
        title: title.trim(),
        categoryId,
        tag,
        notes: notes.trim() || null,
      })
      setPendingEntry(null)
    } catch {
      Alert.alert('Error', 'Could not save the entry')
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (!pendingEntry) return
    Alert.alert('Discard entry?', 'This time span will be deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          try {
            deleteTask(pendingEntry.id)
            setPendingEntry(null)
          } catch {
            Alert.alert('Error', 'Could not discard the entry')
          }
        },
      },
    ])
  }

  if (isLoading) return <View style={styles.container} />

  // 3) Details form for the span that just ended
  if (pendingEntry) {
    return (
      <FadeIn>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>{stopPrompt}</Text>
          <Text style={styles.spanSummary}>
            {formatTime(pendingEntry.startedAt)} – {pendingEntry.endedAt ? formatTime(pendingEntry.endedAt) : ''}
            {'  ·  '}
            {formatElapsed(pendingEntry.startedAt, pendingEntry.endedAt ?? undefined)}
          </Text>

          <Text style={styles.label}>
            Title <Text style={styles.requiredMark}>*</Text>
          </Text>
          <TextInput
            style={[styles.titleInput, !title.trim() && styles.titleInputEmpty]}
            placeholder="Task title"
            placeholderTextColor={colors.textMuted}
            value={title}
            onChangeText={setTitle}
            maxLength={255}
            autoFocus
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

          <TouchableOpacity
            style={[styles.saveBtn, (saving || !title.trim()) && styles.btnDisabled]}
            onPress={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <Loader size="small" color={colors.white} label="Saving…" labelStyle={styles.saveBtnText} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.discardBtn} onPress={handleDiscard} disabled={saving}>
            <Text style={styles.discardBtnText}>Discard</Text>
          </TouchableOpacity>
        </ScrollView>
      </FadeIn>
    )
  }

  // 2) Running: timer + Stop
  if (current) {
    return (
      <FadeIn>
        <View style={[styles.container, styles.centered]}>
          <AuroraBackground accent={colors.danger} />
          <Text style={styles.runningLabel}>RUNNING</Text>
          <Text style={styles.elapsed}>{elapsed}</Text>
          <Text style={styles.startedAt}>since {formatTime(current.startedAt)}</Text>
          <View style={{ height: spacing.xl }} />
          <BigButton label={stopping ? 'Stopping…' : 'Stop'} color={colors.danger} onPress={handleStop} pulse={!stopping} />
          {stopping && (
            <View style={styles.stopOverlay} pointerEvents="auto">
              <Loader size="large" color={colors.white} label="Stopping…" labelStyle={styles.stopOverlayLabel} />
            </View>
          )}
        </View>
      </FadeIn>
    )
  }

  // 1) Idle: just a big Start button
  return (
    <FadeIn>
      <View style={[styles.container, styles.centered]}>
        <AuroraBackground accent={colors.primary} />
        <SyncIndicator />
        <View style={{ height: spacing.md }} />
        <BigButton label="Start" color={colors.primary} onPress={handleStart} pulse />
        <Text style={styles.hint}>{idleHint}{'\n'}Tap Start — details come later.</Text>
      </View>
    </FadeIn>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: typography.size.xl, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.xs },
  spanSummary: { fontSize: typography.size.md, color: colors.accent, marginBottom: spacing.md, fontVariant: ['tabular-nums'] },
  titleInput: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: typography.size.lg, color: colors.text, marginBottom: spacing.sm },
  titleInputEmpty: { borderColor: colors.danger },
  requiredMark: { color: colors.danger, fontSize: typography.size.sm },
  label: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary, marginBottom: spacing.xs },
  notesInput: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, fontSize: typography.size.md, color: colors.text, minHeight: 80, textAlignVertical: 'top' },
  // big round start/stop button
  bigBtnWrap: { width: BTN_SIZE, height: BTN_SIZE, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, borderWidth: 3 },
  bigBtn: { width: BTN_SIZE, height: BTN_SIZE, borderRadius: BTN_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  bigBtnText: { color: colors.white, fontSize: typography.size.xxl, fontWeight: typography.weight.bold, letterSpacing: 1 },
  hint: { marginTop: spacing.xl, color: colors.textMuted, fontSize: typography.size.sm, textAlign: 'center', lineHeight: 20 },
  // running state
  runningLabel: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.productive, letterSpacing: 3, textAlign: 'center' },
  elapsed: { fontSize: typography.size.xxxl + 16, fontWeight: typography.weight.bold, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  startedAt: { fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center' },
  // details form actions
  saveBtn: { backgroundColor: colors.primary, padding: spacing.md, borderRadius: radius.md, alignItems: 'center', marginTop: spacing.lg },
  saveBtnText: { color: colors.white, fontSize: typography.size.lg, fontWeight: typography.weight.bold },
  discardBtn: { padding: spacing.md, borderRadius: radius.md, alignItems: 'center' },
  discardBtnText: { color: colors.danger, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  btnDisabled: { opacity: 0.6 },
  // stopping overlay
  stopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11, 17, 32, 0.55)' },
  stopOverlayLabel: { color: colors.white, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
})
