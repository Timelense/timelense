import { useEffect, useMemo, useState, useRef, useCallback } from 'react'
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
} from 'react-native'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import type { ProductivityTag, TaskEntry } from '@timelense/shared'
import { getCurrentTask, startTask, stopTask, editTask, deleteTask } from '../api/tasks'
import { getCategories } from '../api/categories'
import { getQuickMacros, recordMacroUse, type MacroWithUsage } from '../api/macros'
import { TagSelector } from '../components/TagSelector'
import { CategoryPicker } from '../components/CategoryPicker'
import { AuroraBackground } from '../components/AuroraBackground'
import { SyncIndicator } from '../components/SyncIndicator'
import { Loader } from '../components/Loader'
import { RainbowButton } from '../components/playful'
import { MacroChips } from '../components/macros/MacroChips'
import { MacroPickerSheet } from '../components/macros/MacroPickerSheet'
import { useTheme, typography, spacing, radius, shadow, fonts, rainbowFor, type Palette } from '../theme'

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

// Small blinking status dot — pairs with the RUNNING label.
function BlinkDot({ color, size = 9 }: { color: string; size?: number }) {
  const anim = useRef(new Animated.Value(1)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.2, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [])
  return <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: anim }} />
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

export default function TimerScreen() {
  const { colors, scheme } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
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
  // Quick-start macros (frecency-ordered) + the full picker sheet.
  const [macros, setMacros] = useState<MacroWithUsage[]>(() => getQuickMacros())
  const [sheetVisible, setSheetVisible] = useState(false)
  const navigation = useNavigation()

  // Playful concept: the multi-hue sweep for the hero button, per scheme.
  const rainbow = rainbowFor(scheme)
  // Category attached to the running span (if any) — shown as a live pill.
  const runningCat = useMemo(() => {
    if (!current?.categoryId) return undefined
    return getCategories().find((c) => c.id === current.categoryId)
  }, [current?.categoryId])
  const runningTitle = current && current.title && current.title !== 'Untitled' ? current.title : 'Tracking time'

  // Refresh current task + macros when the tab regains focus
  useFocusEffect(useCallback(() => {
    setCurrent(getCurrentTask())
    setMacros(getQuickMacros())
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

  // Start pre-filled from a macro — title/category/tag are set immediately, so
  // there's nothing to label when this session stops.
  const startWithMacro = (m: MacroWithUsage) => {
    const result = startTask({ title: m.title, categoryId: m.categoryId ?? undefined, tag: m.tag })
    recordMacroUse(m.id)
    setMacros(getQuickMacros())
    setSheetVisible(false)
    setCurrent(result.task)
  }

  // A task counts as "already labeled" if it has a real title (i.e. it was
  // started from a macro). Those skip the post-stop details form entirely.
  const isLabeled = (t: TaskEntry) => !!t.title && t.title !== 'Untitled'

  // Stop ends the time span immediately, then asks for details (unless the
  // entry was started from a macro and is already labeled).
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
      if (stopped && !isLabeled(stopped)) {
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

  // Apply a macro to the just-stopped entry (label-on-stop) and save it.
  const applyMacroToPending = (m: MacroWithUsage) => {
    if (!pendingEntry) return
    try {
      editTask(pendingEntry.id, { title: m.title, categoryId: m.categoryId, tag: m.tag })
      recordMacroUse(m.id)
      setMacros(getQuickMacros())
      setPendingEntry(null)
    } catch {
      Alert.alert('Error', 'Could not save the entry')
    }
  }

  // Label the *running* task with a macro mid-session, so there's nothing to
  // fill in when it stops.
  const applyMacroToRunning = (m: MacroWithUsage) => {
    if (!current) return
    try {
      editTask(current.id, { title: m.title, categoryId: m.categoryId, tag: m.tag })
      recordMacroUse(m.id)
      setMacros(getQuickMacros())
      setCurrent(getCurrentTask())
      setSheetVisible(false)
    } catch {
      Alert.alert('Error', 'Could not label the session')
    }
  }

  // True while a plain (un-labeled) session is running — that's when we still
  // want to offer macros to label it.
  const runningUnlabeled = !!current && (!current.title || current.title === 'Untitled')

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

          {macros.length > 0 && (
            <View style={styles.pendingMacros}>
              <Text style={[styles.label, { paddingHorizontal: 0 }]}>Quick fill</Text>
              <View style={styles.pendingMacrosRow}>
                <MacroChips macros={macros} onPick={applyMacroToPending} />
              </View>
            </View>
          )}

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
          <View style={styles.runningRow}>
            <BlinkDot color={colors.productive} />
            <Text style={styles.runningLabel}>RUNNING</Text>
          </View>
          <Text style={styles.elapsed}>{elapsed}</Text>
          <Text style={styles.startedAt}>since {formatTime(current.startedAt)}</Text>
          <View style={styles.taskPill}>
            <View style={[styles.taskPillDot, { backgroundColor: runningCat?.color ?? colors.primary }]} />
            <Text style={styles.taskPillText}>{runningTitle}</Text>
            {runningCat && <Text style={styles.taskPillMeta}> · {runningCat.name}</Text>}
          </View>
          <View style={{ height: spacing.xl }} />
          <RainbowButton
            size={192}
            label={stopping ? 'Stopping…' : 'Stop'}
            gradient={[colors.danger, colors.nonProductive]}
            shadowColor={colors.danger}
            pulseColors={[colors.danger, colors.danger]}
            onPress={handleStop}
            pulse={!stopping}
          />
          {runningUnlabeled && macros.length > 0 && !stopping && (
            <View style={styles.runningMacros}>
              <Text style={styles.runningMacrosLabel}>Label this session</Text>
              <MacroChips macros={macros} onPick={applyMacroToRunning} onMore={() => setSheetVisible(true)} />
            </View>
          )}
          {stopping && (
            <View style={styles.stopOverlay} pointerEvents="auto">
              <Loader size="large" color={colors.white} label="Stopping…" labelStyle={styles.stopOverlayLabel} />
            </View>
          )}
          <MacroPickerSheet
            visible={sheetVisible}
            macros={macros}
            title="Label this session"
            onPick={applyMacroToRunning}
            onClose={() => setSheetVisible(false)}
            onManage={() => { setSheetVisible(false); navigation.navigate('Settings' as never) }}
          />
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
        <RainbowButton
          size={212}
          label="Start"
          sublabel="tap to begin"
          gradient={rainbow}
          shadowColor={colors.primary}
          pulseColors={[colors.primary, colors.nonProductive]}
          onPress={handleStart}
          onLongPress={() => setSheetVisible(true)}
          pulse
        />
        <Text style={styles.hintLead}>{idleHint}</Text>
        <Text style={styles.hint}>Tap Start, or pick a macro below.</Text>
        <View style={styles.idleMacros}>
          <MacroChips macros={macros} onPick={startWithMacro} onMore={() => setSheetVisible(true)} />
        </View>
        <MacroPickerSheet
          visible={sheetVisible}
          macros={macros}
          onPick={startWithMacro}
          onClose={() => setSheetVisible(false)}
          onManage={() => { setSheetVisible(false); navigation.navigate('Settings' as never) }}
        />
      </View>
    </FadeIn>
  )
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.sm },
  sectionTitle: { fontSize: typography.size.xxl, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing.xs },
  spanSummary: { fontSize: typography.size.md, color: colors.accent, marginBottom: spacing.md, fontVariant: ['tabular-nums'], fontFamily: fonts.semibold, fontWeight: typography.weight.semibold },
  titleInput: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: typography.size.lg, color: colors.text, marginBottom: spacing.sm, fontWeight: typography.weight.semibold },
  titleInputEmpty: { borderColor: colors.danger },
  requiredMark: { color: colors.danger, fontSize: typography.size.sm },
  label: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold, color: colors.textSecondary, marginBottom: spacing.xs },
  notesInput: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, fontSize: typography.size.md, color: colors.text, minHeight: 80, textAlignVertical: 'top', fontWeight: typography.weight.medium },
  hintLead: { marginTop: spacing.xl, color: colors.text, fontSize: typography.size.lg, textAlign: 'center', fontFamily: fonts.semibold, fontWeight: typography.weight.medium },
  // macro rows
  idleMacros: { marginTop: spacing.lg, alignSelf: 'stretch', marginHorizontal: -spacing.lg },
  runningMacros: { marginTop: spacing.xl, alignSelf: 'stretch', marginHorizontal: -spacing.lg, gap: spacing.sm },
  runningMacrosLabel: { fontSize: typography.size.xs, color: colors.textMuted, textAlign: 'center', fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, letterSpacing: 1, textTransform: 'uppercase' },
  pendingMacros: { gap: spacing.xs, marginBottom: spacing.sm },
  pendingMacrosRow: { marginHorizontal: -spacing.lg },
  hint: { marginTop: spacing.xs, color: colors.textMuted, fontSize: typography.size.sm, textAlign: 'center', lineHeight: 22, fontWeight: typography.weight.medium },
  // running state
  runningRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  runningLabel: { fontSize: typography.size.xs, fontFamily: fonts.bold, fontWeight: typography.weight.heavy, color: colors.productive, letterSpacing: 3, textAlign: 'center' },
  elapsed: { fontSize: typography.size.xxxl + 16, fontFamily: fonts.bold, fontWeight: typography.weight.heavy, color: colors.text, textAlign: 'center', fontVariant: ['tabular-nums'] },
  startedAt: { fontSize: typography.size.md, color: colors.textSecondary, textAlign: 'center', fontWeight: typography.weight.medium },
  // running task pill
  taskPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surfaceRaised, borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginTop: spacing.md },
  taskPillDot: { width: 9, height: 9, borderRadius: 4.5 },
  taskPillText: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.medium, color: colors.text },
  taskPillMeta: { fontSize: typography.size.md, color: colors.textMuted, fontWeight: typography.weight.medium },
  // details form actions
  saveBtn: { backgroundColor: colors.primary, paddingVertical: spacing.md, borderRadius: radius.full, alignItems: 'center', marginTop: spacing.lg, ...shadow.button(colors.primary) },
  saveBtnText: { color: colors.white, fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold },
  discardBtn: { padding: spacing.md, borderRadius: radius.full, alignItems: 'center' },
  discardBtnText: { color: colors.danger, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
  btnDisabled: { opacity: 0.6 },
  // stopping overlay
  stopOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28, 24, 48, 0.55)' },
  stopOverlayLabel: { color: colors.white, fontSize: typography.size.md, fontWeight: typography.weight.semibold },
})
