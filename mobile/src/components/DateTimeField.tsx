import { useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from 'react-native'
import { useTheme, typography, spacing, radius, fonts, type Palette } from '../theme'

interface Props {
  label: string
  value: Date
  onChange: (d: Date) => void
  // 'datetime' shows a day stepper + time wheels; 'time' shows only the wheels.
  mode?: 'datetime' | 'time'
}

const ITEM_H = 40
const VISIBLE = 5 // odd, so there is a clear centre row

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function friendlyDay(d: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yesterday)) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatTrigger(d: Date, mode: 'datetime' | 'time'): string {
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return mode === 'time' ? time : `${friendlyDay(d)}, ${time}`
}

// A single snapping number column.
function Wheel({
  count,
  selected,
  onSelect,
  colors,
}: {
  count: number
  selected: number
  onSelect: (i: number) => void
  colors: Palette
}) {
  const ref = useRef<ScrollView>(null)

  useEffect(() => {
    // Jump (no animation) to the selected row whenever it changes externally.
    ref.current?.scrollTo({ y: selected * ITEM_H, animated: false })
  }, [selected])

  const handleEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y
    const i = Math.max(0, Math.min(count - 1, Math.round(y / ITEM_H)))
    if (i !== selected) onSelect(i)
  }

  return (
    <ScrollView
      ref={ref}
      style={{ height: ITEM_H * VISIBLE }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_H}
      decelerationRate="fast"
      onMomentumScrollEnd={handleEnd}
      contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              fontSize: i === selected ? typography.size.xl : typography.size.md,
              fontFamily: i === selected ? fonts.bold : fonts.medium,
              color: i === selected ? colors.text : colors.textMuted,
              fontVariant: ['tabular-nums'],
            }}
          >
            {pad2(i)}
          </Text>
        </View>
      ))}
    </ScrollView>
  )
}

export function DateTimeField({ label, value, onChange, mode = 'datetime' }: Props) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Date>(value)

  const openSheet = () => {
    setDraft(new Date(value))
    setOpen(true)
  }

  const commit = () => {
    onChange(draft)
    setOpen(false)
  }

  const stepDay = (n: number) => {
    const next = new Date(draft)
    next.setDate(next.getDate() + n)
    setDraft(next)
  }

  const setHour = (h: number) => {
    const next = new Date(draft)
    next.setHours(h)
    setDraft(next)
  }

  const setMinute = (m: number) => {
    const next = new Date(draft)
    next.setMinutes(m)
    setDraft(next)
  }

  return (
    <>
      <TouchableOpacity style={styles.trigger} onPress={openSheet} activeOpacity={0.7}>
        <Text style={styles.triggerLabel}>{label}</Text>
        <Text style={styles.triggerValue}>{formatTrigger(value, mode)}</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Text style={styles.cancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{label}</Text>
              <TouchableOpacity onPress={commit}>
                <Text style={styles.done}>Done</Text>
              </TouchableOpacity>
            </View>

            {mode === 'datetime' && (
              <View style={styles.dayRow}>
                <TouchableOpacity onPress={() => stepDay(-1)} style={styles.dayBtn}>
                  <Text style={styles.dayArrow}>‹</Text>
                </TouchableOpacity>
                <Text style={styles.dayLabel}>{friendlyDay(draft)}</Text>
                <TouchableOpacity onPress={() => stepDay(1)} style={styles.dayBtn}>
                  <Text style={styles.dayArrow}>›</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.wheels}>
              {/* centre selection band */}
              <View pointerEvents="none" style={styles.selectionBand} />
              <Wheel count={24} selected={draft.getHours()} onSelect={setHour} colors={colors} />
              <Text style={styles.colon}>:</Text>
              <Wheel count={60} selected={draft.getMinutes()} onSelect={setMinute} colors={colors} />
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    trigger: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    triggerLabel: { fontSize: typography.size.md, color: colors.textSecondary },
    triggerValue: {
      fontSize: typography.size.md,
      color: colors.text,
      fontFamily: fonts.semibold,
      fontWeight: typography.weight.semibold,
      fontVariant: ['tabular-nums'],
    },
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', paddingHorizontal: spacing.lg },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg + 8,
      paddingBottom: spacing.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    cancel: { color: colors.textSecondary, fontSize: typography.size.md },
    title: { fontSize: typography.size.md, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
    done: { color: colors.accent, fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    dayBtn: {
      width: 40,
      height: 40,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceRaised,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayArrow: { fontSize: typography.size.xl, color: colors.primary, lineHeight: 24 },
    dayLabel: { fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
    wheels: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      marginTop: spacing.sm,
      position: 'relative',
    },
    colon: { fontSize: typography.size.xl, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.textMuted },
    selectionBand: {
      position: 'absolute',
      left: spacing.xl,
      right: spacing.xl,
      top: ITEM_H * Math.floor(VISIBLE / 2),
      height: ITEM_H,
      borderRadius: radius.md,
      backgroundColor: colors.primaryLight,
    },
  })
