import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import Svg, { Rect, G } from 'react-native-svg'
import { getInsights, getDistribution } from '../../src/api/analytics'
import { colors, typography, spacing, radius } from '../../src/theme'
import type { DayInsight, PeriodInsights } from '@timelense/shared'

const CHART_HEIGHT = 120
const BAR_GAP = 4

function BarChart({ days, width }: { days: DayInsight[]; width: number }) {
  const max = Math.max(...days.map((d) => d.totalMinutes), 1)
  const barW = (width - BAR_GAP * (days.length - 1)) / days.length

  return (
    <Svg width={width} height={CHART_HEIGHT}>
      {days.map((day, i) => {
        const x = i * (barW + BAR_GAP)
        const prodH = (day.productiveMinutes / max) * CHART_HEIGHT
        const nonH = (day.nonProductiveMinutes / max) * CHART_HEIGHT
        const neutralH = (day.neutralMinutes / max) * CHART_HEIGHT
        let y = CHART_HEIGHT
        return (
          <G key={day.date}>
            {neutralH > 0 && (
              <Rect x={x} y={(y -= neutralH)} width={barW} height={neutralH} fill={colors.neutral} rx={2} />
            )}
            {nonH > 0 && (
              <Rect x={x} y={(y -= nonH)} width={barW} height={nonH} fill={colors.nonProductive} rx={2} />
            )}
            {prodH > 0 && (
              <Rect x={x} y={(y -= prodH)} width={barW} height={prodH} fill={colors.productive} rx={2} />
            )}
          </G>
        )
      })}
    </Svg>
  )
}

function ScoreCard({ insights }: { insights: PeriodInsights }) {
  const delta = insights.deltaScore
  const deltaTotal = insights.deltaTotalMinutes
  return (
    <View style={styles.scoreCard}>
      <View style={styles.scoreMain}>
        <Text style={styles.scoreBig}>{insights.score != null ? `${insights.score}%` : '—'}</Text>
        <Text style={styles.scoreLabel}>Productivity Score</Text>
      </View>
      {delta != null && (
        <View style={styles.scoreDelta}>
          <Text style={[styles.deltaText, { color: delta >= 0 ? colors.productive : colors.nonProductive }]}>
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}pt
          </Text>
          <Text style={styles.deltaLabel}>vs last period</Text>
        </View>
      )}
      {deltaTotal != null && (
        <View style={styles.scoreDelta}>
          <Text style={[styles.deltaText, { color: deltaTotal >= 0 ? colors.productive : colors.nonProductive }]}>
            {deltaTotal >= 0 ? '+' : ''}{deltaTotal}m
          </Text>
          <Text style={styles.deltaLabel}>total time</Text>
        </View>
      )}
    </View>
  )
}

export default function InsightsScreen() {
  const [period, setPeriod] = useState<'week' | 'month'>('week')
  const [offset, setOffset] = useState(0)

  const { data: insights } = useQuery({
    queryKey: ['insights', period, offset],
    queryFn: () => getInsights({ period, offset }),
  })

  const { data: distribution } = useQuery({
    queryKey: ['distribution', period, offset],
    queryFn: () => {
      if (!insights) return null
      return getDistribution({ from: insights.from, to: insights.to, groupBy: 'category' })
    },
    enabled: !!insights,
  })

  const canGoForward = offset > 0

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period toggle */}
      <View style={styles.toggleRow}>
        <TouchableOpacity
          style={[styles.toggleBtn, period === 'week' && styles.toggleBtnActive]}
          onPress={() => { setPeriod('week'); setOffset(0) }}
        >
          <Text style={[styles.toggleText, period === 'week' && styles.toggleTextActive]}>Week</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.toggleBtn, period === 'month' && styles.toggleBtnActive]}
          onPress={() => { setPeriod('month'); setOffset(0) }}
        >
          <Text style={[styles.toggleText, period === 'month' && styles.toggleTextActive]}>Month</Text>
        </TouchableOpacity>
      </View>

      {/* Period navigation */}
      <View style={styles.periodNav}>
        <TouchableOpacity onPress={() => setOffset((o) => o + 1)}>
          <Text style={styles.navArrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.periodLabel}>
          {insights ? `${insights.from.slice(0, 10)} – ${insights.to.slice(0, 10)}` : '…'}
        </Text>
        <TouchableOpacity onPress={() => setOffset((o) => Math.max(0, o - 1))} disabled={!canGoForward}>
          <Text style={[styles.navArrow, !canGoForward && { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
      </View>

      {insights && (
        <>
          <ScoreCard insights={insights} />

          {/* Bar chart */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Daily Activity</Text>
            <View style={styles.chartContainer} onLayout={undefined}>
              <BarChart days={insights.days} width={300} />
              <View style={styles.legend}>
                {[
                  { color: colors.productive, label: 'Productive' },
                  { color: colors.nonProductive, label: 'Non-prod' },
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

          {/* Top categories */}
          {insights.topCategories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Top Categories</Text>
              {insights.topCategories.map((cat) => (
                <View key={cat.id ?? 'null'} style={styles.catRow}>
                  <View style={[styles.catDot, { backgroundColor: cat.color ?? colors.textMuted }]} />
                  <Text style={styles.catName}>{cat.name ?? 'Uncategorized'}</Text>
                  <Text style={styles.catMins}>{cat.totalMinutes}m</Text>
                  <Text style={styles.catShare}>{cat.share}%</Text>
                </View>
              ))}
            </View>
          )}

          {/* Category distribution */}
          {distribution && distribution.buckets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Time by Category</Text>
              {distribution.buckets
                .sort((a, b) => b.totalMinutes - a.totalMinutes)
                .filter((b) => b.totalMinutes > 0)
                .map((bucket) => {
                  const share = insights.totalMinutes > 0
                    ? Math.round((bucket.totalMinutes / insights.totalMinutes) * 100)
                    : 0
                  return (
                    <View key={bucket.id ?? 'null'} style={styles.distRow}>
                      <View style={styles.distMeta}>
                        <View style={[styles.catDot, { backgroundColor: bucket.color ?? colors.textMuted }]} />
                        <Text style={styles.catName}>{bucket.name ?? 'Uncategorized'}</Text>
                        <Text style={styles.catMins}>{bucket.totalMinutes}m · {share}%</Text>
                      </View>
                      <View style={styles.barBg}>
                        <View style={[styles.barFill, { width: `${share}%`, backgroundColor: bucket.color ?? colors.primary }]} />
                      </View>
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
  toggleRow: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: radius.md, padding: 3, borderWidth: 1, borderColor: colors.border },
  toggleBtn: { flex: 1, padding: spacing.sm, borderRadius: radius.sm - 1, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: colors.primary },
  toggleText: { fontSize: typography.size.sm, fontWeight: typography.weight.medium, color: colors.textSecondary },
  toggleTextActive: { color: colors.white },
  periodNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  navArrow: { fontSize: typography.size.xxl, color: colors.primary, padding: spacing.sm },
  periodLabel: { fontSize: typography.size.sm, color: colors.textSecondary },
  scoreCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  scoreMain: { flex: 1 },
  scoreBig: { fontSize: typography.size.xxxl, fontWeight: typography.weight.bold, color: colors.text },
  scoreLabel: { fontSize: typography.size.sm, color: colors.textMuted },
  scoreDelta: { alignItems: 'center', marginLeft: spacing.md },
  deltaText: { fontSize: typography.size.md, fontWeight: typography.weight.bold },
  deltaLabel: { fontSize: typography.size.xs, color: colors.textMuted },
  section: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text, marginBottom: spacing.sm },
  chartContainer: { alignItems: 'center', gap: spacing.sm },
  legend: { flexDirection: 'row', gap: spacing.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: typography.size.xs, color: colors.textSecondary },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  catDot: { width: 10, height: 10, borderRadius: 5 },
  catName: { flex: 1, fontSize: typography.size.sm, color: colors.text },
  catMins: { fontSize: typography.size.sm, color: colors.textSecondary },
  catShare: { fontSize: typography.size.sm, color: colors.textMuted, width: 36, textAlign: 'right' },
  distRow: { gap: spacing.xs, marginBottom: spacing.sm },
  distMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  barBg: { height: 6, backgroundColor: colors.divider, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
})
