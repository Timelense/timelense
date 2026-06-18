import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Animated, Easing } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { getInsights, getDistribution } from '../api/analytics'
import { useTheme, typography, spacing, radius, shadow, fonts, rainbowFor, type Palette } from '../theme'
import type { DayInsight } from '@timelense/shared'
import { Loader } from '../components/Loader'
import { RainbowRing, GradientBubble, GrowColumn, Sparkle } from '../components/playful'

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

// ---- bubble tints (playful gradient washes, scheme-aware) --------------------

type TintKey = 'violet' | 'mint' | 'sky' | 'lemon'
function bubbleTints(colors: Palette, scheme: 'light' | 'dark'): Record<TintKey, [string, string]> {
  return scheme === 'dark'
    ? {
        violet: ['#372D5B', colors.surface],
        mint: ['#1F4A3F', colors.surface],
        sky: ['#243A4D', colors.surface],
        lemon: ['#4D4322', colors.surface],
      }
    : {
        violet: ['#ECE9FE', '#FFFFFF'],
        mint: ['#DFF7EF', '#FFFFFF'],
        sky: ['#E4F1FF', '#FFFFFF'],
        lemon: ['#FFF3D6', '#FFFFFF'],
      }
}

// ---- gradient stat bubble -----------------------------------------------------

function StatBubble({
  label,
  value,
  valueColor,
  delta,
  deltaSuffix,
  tint,
}: {
  label: string
  value: string
  valueColor?: string
  delta?: number | null
  deltaSuffix?: string
  tint: [string, string]
}) {
  const { colors } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  return (
    <GradientBubble from={tint[0]} to={tint[1]} style={styles.statCard}>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {delta != null && (
        <Text style={[styles.statDelta, { color: delta >= 0 ? colors.productive : colors.nonProductive }]}>
          {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}{deltaSuffix ?? ''} vs last
        </Text>
      )}
    </GradientBubble>
  )
}

// ---- week bars (View-based, grow up from the baseline) -----------------------

const CHART_HEIGHT = 130

function WeekBars({ days, colors }: { days: DayInsight[]; colors: Palette }) {
  const styles = useMemo(() => makeStyles(colors), [colors])
  const max = Math.max(...days.map((d) => d.totalMinutes), 1)
  const many = days.length > 7
  const gap = many ? 3 : 8
  const labelStep = many ? Math.ceil(days.length / 8) : 1

  return (
    <View>
      <View style={[styles.barRow, { height: CHART_HEIGHT, gap }]}>
        {days.map((day, i) => {
          const prodH = (day.productiveMinutes / max) * CHART_HEIGHT
          const nonH = (day.nonProductiveMinutes / max) * CHART_HEIGHT
          const neuH = (day.neutralMinutes / max) * CHART_HEIGHT
          const total = prodH + nonH + neuH
          return (
            <View key={day.date} style={styles.barColWrap}>
              <GrowColumn
                height={total > 0 ? total : 3}
                delay={i * 70}
                style={[styles.barColumn, total === 0 && { backgroundColor: colors.divider }]}
              >
                {prodH > 0 && <View style={{ height: prodH, backgroundColor: colors.productive }} />}
                {nonH > 0 && <View style={{ height: nonH, backgroundColor: colors.nonProductive }} />}
                {neuH > 0 && <View style={{ height: neuH, backgroundColor: colors.neutral }} />}
              </GrowColumn>
            </View>
          )
        })}
      </View>
      <View style={[styles.barLabelRow, { gap }]}>
        {days.map((day, i) => (
          <Text key={day.date} style={styles.barLabel}>
            {i % labelStep === 0 ? (many ? day.date.slice(8, 10) : dayLetter(day.date)) : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ---- tag split donut -----------------------------------------------------------

const DONUT_SIZE = 110
const DONUT_STROKE = 16
const DONUT_R = (DONUT_SIZE - DONUT_STROKE) / 2
const DONUT_C = 2 * Math.PI * DONUT_R

function TagDonut({ productive, nonProductive, neutral }: { productive: number; nonProductive: number; neutral: number }) {
  const { colors } = useTheme()
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
        fontSize={16}
        fontFamily={fonts.bold}
        fontWeight="bold"
        fill={colors.text}
      >
        {fmtMinutes(total)}
      </SvgText>
      <SvgText x={DONUT_SIZE / 2} y={DONUT_SIZE / 2 + 16} textAnchor="middle" fontSize={9} fill={colors.textMuted}>
        tracked
      </SvgText>
    </Svg>
  )
}

// ---- animated horizontal share bar -------------------------------------------

function ShareBar({ share, color }: { share: number; color: string }) {
  const { colors } = useTheme()
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
    <View style={{ height: 9, backgroundColor: colors.divider, borderRadius: radius.full, overflow: 'hidden' }}>
      <Animated.View
        style={{
          height: 9,
          borderRadius: radius.full,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
        }}
      />
    </View>
  )
}

// ---- screen -------------------------------------------------------------------

export default function InsightsScreen() {
  const { colors, scheme } = useTheme()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const tints = useMemo(() => bubbleTints(colors, scheme), [colors, scheme])
  const ringColors = rainbowFor(scheme)
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [offset, setOffset] = useState(0)

  const { data: insights, refetch: refetchInsights } = useQuery({
    queryKey: ['insights', period, offset],
    queryFn: () => getInsights({ period, offset }),
  })

  // Tab screens stay mounted — refetch whenever this tab regains focus
  useFocusEffect(useCallback(() => { refetchInsights() }, [refetchInsights]))

  const { data: distribution, isFetching: distributionFetching } = useQuery({
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

      {!insights && (
        <View style={styles.analysisLoadingCard}>
          <Loader size="large" color={colors.accent} label="Crunching your numbers…" />
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
          {/* Score hero — spinning rainbow ring + twinkles */}
          <View style={styles.scoreCard}>
            <Sparkle color="#FFC93C" size={14} delay={0} style={{ top: 16, right: 24 }} />
            <Sparkle color="#FF9EC4" size={10} delay={600} style={{ top: 46, right: 50 }} />
            <Sparkle color="#6FB7FF" size={12} delay={1100} style={{ bottom: 22, right: 30 }} />
            <RainbowRing
              size={124}
              stroke={11}
              ringColors={ringColors}
              holeColor={colors.surface}
              centerValue={insights.score != null ? `${insights.score}` : '—'}
              centerLabel="score"
              spin={insights.score != null}
            />
            <View style={styles.scoreSide}>
              <Text style={styles.scoreTitle}>Productivity score</Text>
              {insights.deltaScore != null ? (
                <Text style={[styles.scoreDelta, { color: insights.deltaScore >= 0 ? colors.productive : colors.nonProductive }]}>
                  {insights.deltaScore >= 0 ? '▲' : '▼'} {Math.abs(insights.deltaScore)} pts vs last {period}
                </Text>
              ) : (
                <Text style={styles.scoreDeltaMuted}>No previous {period} to compare</Text>
              )}
              <Text style={styles.scoreHint}>share of tracked time spent in flow</Text>
            </View>
          </View>

          {/* Stat bubbles */}
          <View style={styles.statRow}>
            <StatBubble
              label="Total tracked"
              value={fmtMinutes(insights.totalMinutes)}
              delta={insights.deltaTotalMinutes != null ? Math.round(insights.deltaTotalMinutes) : null}
              deltaSuffix="m"
              tint={tints.violet}
            />
            <StatBubble
              label="Productive"
              value={fmtMinutes(insights.productiveMinutes)}
              valueColor={colors.productive}
              tint={tints.mint}
            />
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
                <StatBubble label="Avg per active day" value={fmtMinutes(avgPerDay)} tint={tints.sky} />
                <StatBubble label={`Best day · ${bestLabel}`} value={best ? fmtMinutes(best.totalMinutes) : '—'} tint={tints.lemon} />
              </View>
            )
          })()}

          {/* Bar chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{period === 'week' ? 'This week' : 'This month'}</Text>
            <WeekBars days={insights.days} colors={colors} />
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

          {/* Where it went — time by category */}
          {(buckets.length > 0 || distributionFetching) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Where it went</Text>
              {distributionFetching && buckets.length === 0 && (
                <View style={styles.inlineLoader}>
                  <Loader size="small" color={colors.accent} label="Loading categories…" />
                </View>
              )}
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

const makeStyles = (colors: Palette) => StyleSheet.create({
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
  analysisLoadingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  inlineLoader: { paddingVertical: spacing.md, alignItems: 'center' },
  cachedBannerText: { color: colors.warning, fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  // toggle
  toggleRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.full, padding: 4, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.full, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
  // period nav
  periodNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navBtn: { width: 40, height: 40, borderRadius: radius.full, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  navBtnDisabled: { opacity: 0.5 },
  navArrow: { fontSize: typography.size.xl, color: colors.primary, lineHeight: 24 },
  periodLabel: { fontSize: typography.size.md, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.text },
  // empty state
  emptyCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: colors.border, gap: spacing.sm, ...shadow.card },
  emptyTitle: { fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
  emptyText: { fontSize: typography.size.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, fontWeight: typography.weight.medium },
  // score hero
  scoreCard: { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', ...shadow.card },
  scoreSide: { flex: 1, gap: 4 },
  scoreTitle: { fontSize: typography.size.lg, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text },
  scoreDelta: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.bold },
  scoreDeltaMuted: { fontSize: typography.size.sm, color: colors.textMuted, fontWeight: typography.weight.medium },
  scoreHint: { fontSize: typography.size.xs, color: colors.textMuted, fontWeight: typography.weight.medium },
  // stat bubbles
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, padding: spacing.md, borderWidth: 1, borderColor: colors.border, gap: 2, borderRadius: radius.lg, ...shadow.card },
  statValue: { fontSize: typography.size.xxl, fontFamily: fonts.bold, fontWeight: typography.weight.heavy, color: colors.text, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: typography.size.sm, color: colors.textSecondary, fontFamily: fonts.medium, fontWeight: typography.weight.medium },
  statDelta: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, marginTop: 2 },
  // sections
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border, ...shadow.card },
  sectionTitle: { fontSize: typography.size.md, fontFamily: fonts.bold, fontWeight: typography.weight.bold, color: colors.text, marginBottom: spacing.md },
  // bars
  barRow: { flexDirection: 'row', alignItems: 'flex-end' },
  barColWrap: { flex: 1, alignItems: 'stretch', justifyContent: 'flex-end' },
  barColumn: { flexDirection: 'column-reverse', borderRadius: 9, overflow: 'hidden' },
  barLabelRow: { flexDirection: 'row', marginTop: spacing.sm },
  barLabel: { flex: 1, textAlign: 'center', fontSize: 11, color: colors.textMuted },
  legend: { flexDirection: 'row', gap: spacing.md, justifyContent: 'center', marginTop: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: typography.size.xs, color: colors.textSecondary },
  // donut
  donutSection: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  donutLegend: { flex: 1, gap: spacing.sm },
  donutLegendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  donutLegendLabel: { flex: 1, fontSize: typography.size.sm, color: colors.textSecondary },
  donutLegendValue: { fontSize: typography.size.sm, fontFamily: fonts.semibold, fontWeight: typography.weight.semibold, color: colors.text, fontVariant: ['tabular-nums'] },
  // category bars
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: typography.size.sm, color: colors.text, fontWeight: typography.weight.medium },
  catShare: { fontSize: typography.size.sm, color: colors.textMuted, width: 44, textAlign: 'right', fontVariant: ['tabular-nums'] },
  distRow: { gap: 6, marginBottom: spacing.md },
  distMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
})
