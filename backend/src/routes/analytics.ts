import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../plugins/auth.js'
import {
  calcScore,
  overlapMinutes,
  toDayString,
  dayStart,
  dayEnd,
  getPeriodBounds,
  fetchTasksInRange,
  fetchCategoryMap,
  resolveTopLevel,
  aggregateMinutes,
  toTaskEntry,
} from '../lib/analytics.js'
import type {
  DailyTimeline,
  Distribution,
  DistributionBucket,
  PeriodInsights,
  DayInsight,
  CategoryInsight,
  TimeReport,
  ProductivityTag,
} from '@timelense/shared'

const MAX_RANGE_DAYS = 366
const MS_PER_DAY = 86_400_000

const DateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
const DateTimeParam = z.string().datetime()

function validateRange(from: Date, to: Date, reply: any): boolean {
  if (to <= from) {
    reply.code(400).send({ error: 'to must be after from' })
    return false
  }
  if ((to.getTime() - from.getTime()) / MS_PER_DAY > MAX_RANGE_DAYS) {
    reply.code(400).send({ error: `range exceeds ${MAX_RANGE_DAYS} days` })
    return false
  }
  return true
}

export async function analyticsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // -------------------------------------------------------------------------
  // GET /analytics/timeline?date=YYYY-MM-DD
  // -------------------------------------------------------------------------
  app.get('/timeline', async (request, reply): Promise<DailyTimeline> => {
    const { date } = z.object({ date: DateParam }).parse(request.query)

    const start = dayStart(date)
    const end = dayEnd(date)

    const rows = await fetchTasksInRange(request.userId, start, end)

    const entries = rows
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
      .map((r) => ({
        ...toTaskEntry(r),
        durationMinutes: overlapMinutes(r.startedAt, r.endedAt, start, end),
      }))

    const totals = aggregateMinutes(rows, start, end)

    return { date, entries, ...totals }
  })

  // -------------------------------------------------------------------------
  // GET /analytics/distribution?from&to&groupBy=category|tag
  // -------------------------------------------------------------------------
  app.get('/distribution', async (request, reply): Promise<Distribution> => {
    const q = z
      .object({
        from: DateTimeParam,
        to: DateTimeParam,
        groupBy: z.enum(['category', 'tag']),
      })
      .parse(request.query)

    const from = new Date(q.from)
    const to = new Date(q.to)
    if (!validateRange(from, to, reply)) return reply as any

    const rows = await fetchTasksInRange(request.userId, from, to)

    let buckets: DistributionBucket[]

    if (q.groupBy === 'tag') {
      const byTag = new Map<string, number>()
      for (const r of rows) {
        const mins = overlapMinutes(r.startedAt, r.endedAt, from, to)
        byTag.set(r.tag, (byTag.get(r.tag) ?? 0) + mins)
      }
      buckets = (['productive', 'non-productive', 'neutral'] as ProductivityTag[]).map((tag) => ({
        id: tag,
        name: tag,
        tag,
        totalMinutes: byTag.get(tag) ?? 0,
      }))
    } else {
      const catMap = await fetchCategoryMap(request.userId)
      const byTopLevel = new Map<string | null, { id: string | null; name: string | null; color?: string; totalMinutes: number }>()

      // Seed buckets for all top-level categories (so they appear even with 0 mins)
      for (const [, cat] of catMap) {
        if (!cat.parentId) {
          if (!byTopLevel.has(cat.id)) {
            byTopLevel.set(cat.id, { id: cat.id, name: cat.name, color: cat.color ?? undefined, totalMinutes: 0 })
          }
        }
      }
      // null bucket for uncategorized
      byTopLevel.set(null, { id: null, name: null, totalMinutes: 0 })

      for (const r of rows) {
        const mins = overlapMinutes(r.startedAt, r.endedAt, from, to)
        const top = resolveTopLevel(r.categoryId, catMap)
        const key = top?.id ?? null
        const existing = byTopLevel.get(key)
        if (existing) {
          existing.totalMinutes += mins
        } else {
          byTopLevel.set(key, { id: key, name: top?.name ?? null, color: top?.color ?? undefined, totalMinutes: mins })
        }
      }

      buckets = [...byTopLevel.values()].filter((b) => b.totalMinutes > 0 || b.id !== null)
    }

    return { groupBy: q.groupBy, from: q.from, to: q.to, buckets }
  })

  // -------------------------------------------------------------------------
  // GET /analytics/insights?period=week|month&offset=0
  // -------------------------------------------------------------------------
  app.get('/insights', async (request, reply): Promise<PeriodInsights> => {
    const q = z
      .object({
        period: z.enum(['week', 'month']),
        offset: z.coerce.number().int().min(0).optional().default(0),
      })
      .parse(request.query)

    const { start, end } = getPeriodBounds(q.period, q.offset)
    const { start: prevStart, end: prevEnd } = getPeriodBounds(q.period, q.offset + 1)

    const [rows, prevRows, catMap] = await Promise.all([
      fetchTasksInRange(request.userId, start, end),
      fetchTasksInRange(request.userId, prevStart, prevEnd),
      fetchCategoryMap(request.userId),
    ])

    // Per-day breakdown
    const days: DayInsight[] = []
    const cursor = new Date(start)
    while (cursor < end) {
      const ds = toDayString(cursor)
      const dStart = dayStart(ds)
      const dEnd = dayEnd(ds)
      const dayRows = rows.filter(
        (r) => r.startedAt < dEnd && (r.endedAt === null || r.endedAt > dStart),
      )
      const totals = aggregateMinutes(dayRows, dStart, dEnd)
      days.push({ date: ds, ...totals })
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }

    const periodTotals = aggregateMinutes(rows, start, end)
    const prevTotals = aggregateMinutes(prevRows, prevStart, prevEnd)

    // Top categories
    const byTopLevel = new Map<string | null, { id: string | null; name: string | null; color?: string; totalMinutes: number }>()
    for (const r of rows) {
      const mins = overlapMinutes(r.startedAt, r.endedAt, start, end)
      const top = resolveTopLevel(r.categoryId, catMap)
      const key = top?.id ?? null
      const existing = byTopLevel.get(key)
      if (existing) {
        existing.totalMinutes += mins
      } else {
        byTopLevel.set(key, { id: key, name: top?.name ?? null, color: top?.color ?? undefined, totalMinutes: mins })
      }
    }

    const sortedCats = [...byTopLevel.values()]
      .sort((a, b) => b.totalMinutes - a.totalMinutes)
      .slice(0, 3)

    const topCategories: CategoryInsight[] = sortedCats.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      totalMinutes: c.totalMinutes,
      share: periodTotals.totalMinutes > 0
        ? Math.round((100 * c.totalMinutes) / periodTotals.totalMinutes)
        : 0,
    }))

    const deltaTotalMinutes = prevTotals.totalMinutes > 0 || periodTotals.totalMinutes > 0
      ? periodTotals.totalMinutes - prevTotals.totalMinutes
      : null

    const deltaScore =
      periodTotals.score !== null && prevTotals.score !== null
        ? periodTotals.score - prevTotals.score
        : null

    return {
      period: q.period,
      offset: q.offset,
      from: start.toISOString(),
      to: end.toISOString(),
      days,
      ...periodTotals,
      topCategories,
      deltaTotalMinutes,
      deltaScore,
    }
  })

  // -------------------------------------------------------------------------
  // GET /analytics/report?from&to
  // -------------------------------------------------------------------------
  app.get('/report', async (request, reply): Promise<TimeReport> => {
    const q = z
      .object({ from: DateTimeParam, to: DateTimeParam })
      .parse(request.query)

    const from = new Date(q.from)
    const to = new Date(q.to)
    if (!validateRange(from, to, reply)) return reply as any

    const rows = await fetchTasksInRange(request.userId, from, to)
    const totals = aggregateMinutes(rows, from, to)

    return {
      userId: request.userId,
      from: q.from,
      to: q.to,
      ...totals,
      entries: rows.map(toTaskEntry),
    }
  })
}
