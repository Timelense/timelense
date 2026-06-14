import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import Svg, { Rect, G, Circle, Text as SvgText } from 'react-native-svg'
import { getInsights, getDistribution } from '../api/analytics'
import { colors, typography, spacing, radius } from '../theme'
import type { DayInsight, PeriodInsights } from '@timelense/shared'

// ---- formatting helpers ------------------------------------------------------

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

function fmtRange(fromIso: string, toIso: string): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  const from = new Date(fromIso).toLocaleDateString([], opts)
  const to = new Date(toIso).toLocaleDateString([], opts)
  return `${from} – ${to}`
}

function dayLetter(dateIso: string): string {
  return new Date(dateIso + 'T12:00:00').toLocaleDateString([], { weekday: 'narrow' })
}

// ---- score ring --------------------------------------------------------------

const RING_SIZE = 96
const RING_STROKE = 9
const RING_R = (RING_SIZE - RING_STROKE) / 2
const RING_C = 2 * Math.PI * RING_R

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

function ScoreRing({ score }: { score: number | null }) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    anim.setValue(0)
    Animated.timing(anim, {
      toValue: score ?? 0,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // SVG props can't use the native driver
    }).start()
  }, [score])

  const dashOffset = anim.interpolate({
    inputRange: [0, 100],
    outputRange: [RING_C, 0],
  })

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={colors.divider}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_R}
          stroke={score == null ? colors.textMuted : colors.accent}
          strokeWidth={RING_STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${RING_C} ${RING_C}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        />
        <SvgText
          x={RING_SIZE / 2}
          y={RING_SIZE / 2 + 7}
          textAnchor="middle"
          fontSize={22}
          fontWeight="bold"
          fill={colors.text}
        >
          {score != null ? `${score}` : '—'}
        </SvgText>
      </Svg>
    </View>
  )
}

// ---- bar chart ---------------------------------------------------------------

const CHART_HEIGHT = 140
const LABEL_H = 18
const BAR_GAP = 5

function BarChart({ days, width }: { days: DayInsight[]; width: number }) {
  const max = Math.max(...days.map((d) => d.totalMinutes), 1)
  const barW = (width - BAR_GAP * (days.length - 1)) / days.length
  const showLabels = days.length <= 7 ? 1 : Math.ceil(days.length / 8)

  return (
    <Svg width={width} height={CHART_HEIGHT + LABEL_H}>
      {days.map((day, i) => {
        const x = i * (barW + BAR_GAP)
        const prodH = (day.productiveMinutes / max) * CHART_HEIGHT
        const nonH = (day.nonProductiveMinutes / max) * CHART_HEIGHT
        const neutralH = (day.neutralMinutes / max) * CHART_HEIGHT
        const empty = day.totalMinutes === 0
        let y = CHART_HEIGHT
        return (
          <G key={day.date}>
            {empty && (
              <Rect x={x} y={CHART_HEIGHT - 3} width={barW} height={3} fill={colors.divider} rx={1.5} />
            )}
            {neutralH > 0 && (
              <Rect x={x} y={(y -= neutralH)} width={barW} height={neutralH} fill={colors.neutral} rx={2.5} />
            )}
            {nonH > 0 && (
              <Rect x={x} y={(y -= nonH)} width={barW} height={nonH} fill={colors.nonProductive} rx={2.5} />
            )}
            {prodH > 0 && (
              <Rect x={x} y={(y -= prodH)} width={barW} height={prodH} fill={colors.productive} rx={2.5} />
            )}
            {i % showLabels === 0 && (
              <SvgText
                x={x + barW / 2}
                y={CHART_HEIGHT + LABEL_H - 4}
                textAnchor="middle"
                fontSize={10}
                fill={colors.textMuted}
              >
                {days.length <= 7 ? dayLetter(day.date) : day.date.slice(8, 10)}
              </SvgText>
            )}
          </G>
        )
      })}
    </Svg>
  )
}

// ---- tag split donut -----------------------------------------------------------

const DONUT_SIZE = 110
const DONUT_STROKE = 16
const DONUT_R = (DONUT_SIZE - DONUT_STROKE) / 2
const DONUT_C = 2 * Math.PI * DONUT_R

function TagDonut({ productive, nonProductive, neutral }: { productive: number; nonProductive: number; neutral: number }) {
  const total = productive + nonProductive + neutral
  if (total === 0) return null
  const segments = [
    { value: productive, color: colors.productive },
    { value: nonProductive, color: colors.nonProductive },
    { value: neutral, color: colors.neutral },
  ].filter((s) => s.value > 0)

  let acc = 0
  return (
    <Svg width={DONUT_SIZE} height={DONUT_SIZE}>
      {segments.map((seg, i) => {
        const frac = seg.value / total
        const dash = frac * DONUT_C
        const offset = -acc * DONUT_C
        acc += frac
        return (
          <Circle
            key={i}
            cx={DONUT_SIZE / 2}
            cy={DONUT_SIZE / 2}
            r={DONUT_R}
            stroke={seg.color}
            strokeWidth={DONUT_STROKE}
            fill="none"
            strokeDasharray={`${dash} ${DONUT_C - dash}`}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${DONUT_SIZE / 2} ${DONUT_SIZE / 2})`}
          />
        )
      })}
      <SvgText
        x={DONUT_SIZE / 2}
        y={DONUT_SIZE / 2 + 1}
        textAnchor="middle"
        fontSize={15}
        fontWeight="bold"
        fill={colors.text}
      >
        {fmtMinutes(total)}
      </SvgText>
      <SvgText
        x={DONUT_SIZE / 2}
        y={DONUT_SIZE / 2 + 16}
        textAnchor="middle"
        fontSize={9}
        fill={colors.textMuted}
      >
        tracked
      </SvgText>
    </Svg>
  )
}

// ---- animated horizontal share bar -------------------------------------------

function ShareBar({ share, color }: { share: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, {
      toValue: share,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width animation
    }).start()
  }, [share])
  return (
    <View style={styles.barBg}>
      <Animated.View
        style={[
          styles.barFill,
          {
            backgroundColor: color,
            width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  )
}

// ---- stat card ----------------------------------------------------------------

function StatCard({ label, value, delta, deltaSuffix }: { label: string; value: string; delta?: number | null; deltaSuffix?: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {delta != null && (
        <Text style={[styles.statDelta, { color: delta >= 0 ? colors.productive : colors.nonProductive }]}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}{deltaSuffix ?? ''} vs last
        </Text>
      )}
    </View>
  )
}

// ---- screen -------------------------------------------------------------------

export default function InsightsScreen() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [offset, setOffset] = useState(0)
  const [chartWidth, setChartWidth] = useState(0)

  const { data: insights, refetch: refetchInsights } = useQuery({
    queryKey: ['insights', period, offset],
    queryFn: () => getInsights({ period, offset }),
  })

  // Tab screens stay mounted — refetch whenever this tab regains focus
  useFocusEffect(useCallback(() => { refetchInsights() }, [refetchInsights]))

  const { data: distribution } = useQuery({
    queryKey: ['distribution', period, offset, insights?.from, insights?.to],
    queryFn: () => getDistribution({ from: insights!.from, to: insights!.to, groupBy: 'category' }),
    enabled: !!insights,
  })

  const canGoForward = offset > 0
  const isEmpty = insights != null && insights.totalMinutes === 0

  const buckets = (distribution?.buckets ?? [])
    .filter((b) => b.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period toggle */}
      <View style={styles.toggleRow}>
        {(['week', 'month'] as const).map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.toggleBtn, period === p && styles.toggleBtnActive]}
            onPress={() => { setPeriod(p); setOffset(0) }}
          >
            <Text style={[styles.toggleText, period === p && styles.toggleTextActive]}>
              {p === 'week' ? 'Week' : 'Month'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Period navigation */}
      <View style={styles.periodNav}>
        <TouchableOpacity style={styles.navBtn} onPress={() => setOffset((o) => o + 1)}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.periodLabel}>
          {insights ? fmtRange(insights.from, insights.to) : '…'}
        </Text>
        <TouchableOpacity
          style={[styles.navBtn, !canGoForward && styles.navBtnDisabled]}
          onPress={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={!canGoForward}
        >
          <Text style={[styles.navArrow, !canGoForward && { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {insights && insights.isCached && (
        <View style={styles.cachedBanner}>
          <Text style={styles.cachedBannerText}>
            ⚠️ Showing offline cached data from {insights.fetchedAt ? new Date(insights.fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'earlier'}
          </Text>
        </View>
      )}

      {insights && isEmpty && (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No data, no judgment</Text>
          <Text style={styles.emptyText}>
            Track some time this {period} and we'll turn it into charts you can brag about.
          </Text>
        </View>
      )}

      {insights && !isEmpty && (
        <>
          {/* Score + stats */}
          <View style={styles.scoreCard}>
            <ScoreRing score={insights.score} />
            <View style={styles.scoreSide}>
              <Text style={styles.scoreTitle}>Productivity score</Text>
              {insights.deltaScore != null ? (
                <Text style={[styles.scoreDelta, { color: insights.deltaScore >= 0 ? colors.productive : colors.nonProductive }]}>
                  {insights.deltaScore >= 0 ? '▲' : '▼'} {Math.abs(insights.deltaScore)} pts vs last {period}
                </Text>
              ) : (
                <Text style={styles.scoreDeltaMuted}>No previous {period} to compare</Text>
              )}
              <Text style={styles.scoreHint}>share of tracked time spent productively</Text>
            </View>
          </View>

          <View style={styles.statRow}>
            <StatCard
              label="Total tracked"
              value={fmtMinutes(insights.totalMinutes)}
              delta={insights.deltaTotalMinutes != null ? Math.round(insights.deltaTotalMinutes) : null}
              deltaSuffix="m"
            />
            <StatCard label="Productive" value={fmtMinutes(insights.productiveMinutes)} />
          </View>

          {(() => {
            const activeDays = insights.days.filter((d) => d.totalMinutes > 0)
            const avgPerDay = activeDays.length > 0 ? Math.round(insights.totalMinutes / activeDays.length) : 0
            const best = activeDays.reduce<DayInsight | null>(
              (acc, d) => (acc == null || d.totalMinutes > acc.totalMinutes ? d : acc),
              null,
            )
            const bestLabel = best
              ? new Date(best.date + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric' })
              : '—'
            return (
              <View style={styles.statRow}>
                <StatCard label="Avg per active day" value={fmtMinutes(avgPerDay)} />
                <StatCard label={`Best day · ${bestLabel}`} value={best ? fmtMinutes(best.totalMinutes) : '—'} />
              </View>
            )
          })()}

          {/* Tag split donut */}
          <View style={[styles.section, styles.donutSection]}>
            <TagDonut
              productive={insights.productiveMinutes}
              nonProductive={insights.nonProductiveMinutes}
              neutral={insights.neutralMinutes}
            />
            <View style={styles.donutLegend}>
              {[
                { color: colors.productive, label: 'Productive', value: insights.productiveMinutes },
                { color: colors.nonProductive, label: 'Non-productive', value: insights.nonProductiveMinutes },
                { color: colors.neutral, label: 'Neutral', value: insights.neutralMinutes },
              ].map((item) => (
                <View key={item.label} style={styles.donutLegendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <Text style={styles.donutLegendLabel}>{item.label}</Text>
                  <Text style={styles.donutLegendValue}>{fmtMinutes(item.value)}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Daily activity chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily activity</Text>
            <View
              style={styles.chartContainer}
              onLayout={(e) => setChartWidth(e.nativeEvent.layout.width)}
            >
              {chartWidth > 0 && <BarChart days={insights.days} width={chartWidth} />}
              <View style={styles.legend}>
                {[
                  { color: colors.productive, label: 'Productive' },
                  { color: colors.nonProductive, label: 'Non-productive' },
                  { color: colors.neutral, label: 'Neutral' },
                ].map((item) => (
                  <View key={item.label} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                    <Text style={styles.legendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>

          {/* Time by category */}
          {buckets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time by category</Text>
              {buckets.map((bucket) => {
                const share = insights.totalMinutes > 0
                  ? Math.round((bucket.totalMinutes / insights.totalMinutes) * 100)
                  : 0
                const color = bucket.color ?? colors.accent
                return (
                  <View key={bucket.id ?? 'null'} style={styles.distRow}>
                    <View style={styles.distMeta}>
                      <View style={[styles.catDot, { backgroundColor: color }]} />
                      <Text style={styles.catName} numberOfLines={1}>{bucket.name ?? 'Uncategorized'}</Text>
                      <Text style={styles.catMins}>{fmtMinutes(bucket.totalMinutes)}</Text>
                      <Text style={styles.catShare}>{share}%</Text>
                    </View>
                    <ShareBar share={share} color={color} />
                  </View>
                )
              })}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl },
  cachedBanner: {
    backgroundColor: `${colors.warning}1A`,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  cachedBannerText: {
    color: colors.warning,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
  },
  // toggle
  toggleRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
  // period nav
  periodNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.5 },
  navArrow: { fontSize: typography.size.xl, color: colors.accent, lineHeight: 24 },
  periodLabel: { fontSize: typography.size.md, fontWeight: typography.weight.medium, color: colors.text },
  // empty state
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: spacing.sm },
  emptyTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  // score card
  scoreCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderWidth: 1, borderColor: colors.border },
  scoreSide: { flex: 1, gap: 4 },
  scoreTitle: { fontSize: typography.size.lg, fontWeight: typography.weight.semibold, color: colors.text },
  scoreDelta: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
  scoreDeltaMuted: { fontSize: typography.size.sm, color: colors.textMuted },
  scoreHint: { fontSize: typography.size.xs, color: colors.textMuted },
  // stat cards
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 2 },
  statValue: { fontSize: typography.size.xxl, fontWeight: typography.weight.bold, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  statDelta: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold, marginTop: 2 },
  // sections
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.sm },
  chartContainer: { gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: typography.size.xs, color: colors.textSecondary },
  // donut
  donutSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  donutLegend: { flex: 1, gap: spacing.sm },
  donutLegendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  donutLegendLabel: { flex: 1, fontSize: typography.size.sm, color: colors.textSecondary },
  donutLegendValue: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  // category bars
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: typography.size.sm, color: colors.text },
  catMins: { fontSize: typography.size.sm, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  catShare: { fontSize: typography.size.sm, color: colors.textMuted, width: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  distRow: { gap: spacing.xs, marginBottom: spacing.sm },
  distMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barBg: { height: 7, backgroundColor: colors.divider, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 7, borderRadius: 4 },
})
