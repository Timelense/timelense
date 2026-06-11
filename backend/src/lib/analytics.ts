import { and, eq, isNull, lt, or, gt } from 'drizzle-orm'
import { db } from '../db/index.js'
import { tasks, categories } from '../db/schema.js'
import type { TaskEntry, ProductivityTag } from '@timelense/shared'

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function calcScore(productive: number, nonProductive: number): number | null {
  const denom = productive + nonProductive
  if (denom === 0) return null
  return Math.round((100 * productive) / denom)
}

/** Overlap in whole minutes between [taskStart, taskEnd|now] and [rangeStart, rangeEnd]. */
export function overlapMinutes(
  taskStart: Date,
  taskEnd: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  const end = taskEnd ?? new Date()
  const overlapStart = Math.max(taskStart.getTime(), rangeStart.getTime())
  const overlapEnd = Math.min(end.getTime(), rangeEnd.getTime())
  if (overlapEnd <= overlapStart) return 0
  return Math.floor((overlapEnd - overlapStart) / 60_000)
}

export function toDayString(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Start of a UTC day. */
export function dayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

/** End of a UTC day (exclusive: start of next day). */
export function dayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T24:00:00.000Z`)
}

/** Bounds for a period (week/month) at the given offset (0 = current). Weeks start Monday. */
export function getPeriodBounds(period: 'week' | 'month', offset: number): { start: Date; end: Date } {
  const now = new Date()

  if (period === 'week') {
    // Monday of the current week
    const dayOfWeek = now.getUTCDay() // 0=Sun
    const mondayOffset = (dayOfWeek + 6) % 7
    const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset))
    const start = new Date(monday)
    start.setUTCDate(monday.getUTCDate() - offset * 7)
    const end = new Date(start)
    end.setUTCDate(start.getUTCDate() + 7)
    return { start, end }
  }

  // month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  return { start, end }
}

// ---------------------------------------------------------------------------
// DB queries
// ---------------------------------------------------------------------------

/** Fetch tasks overlapping [rangeStart, rangeEnd) for a user. */
export async function fetchTasksInRange(userId: string, rangeStart: Date, rangeEnd: Date) {
  return db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, userId),
        lt(tasks.startedAt, rangeEnd),
        or(gt(tasks.endedAt, rangeStart), isNull(tasks.endedAt)),
      ),
    )
}

/** Fetch all categories for a user keyed by id. */
export async function fetchCategoryMap(userId: string) {
  const rows = await db.select().from(categories).where(eq(categories.userId, userId))
  return new Map(rows.map((r) => [r.id, r]))
}

/** Resolve top-level category for a categoryId (one level of parent lookup). */
export function resolveTopLevel(
  categoryId: string | null,
  catMap: Map<string, typeof categories.$inferSelect>,
) {
  if (!categoryId) return null
  const cat = catMap.get(categoryId)
  if (!cat) return null
  if (cat.parentId) {
    const parent = catMap.get(cat.parentId)
    return parent ?? cat
  }
  return cat
}

// ---------------------------------------------------------------------------
// Aggregation helpers (operates on fetched rows + range)
// ---------------------------------------------------------------------------

export interface MinuteTotals {
  totalMinutes: number
  productiveMinutes: number
  nonProductiveMinutes: number
  neutralMinutes: number
  score: number | null
}

export function aggregateMinutes(
  rows: Array<{ tag: string; startedAt: Date; endedAt: Date | null }>,
  rangeStart: Date,
  rangeEnd: Date,
): MinuteTotals {
  let productive = 0
  let nonProductive = 0
  let neutral = 0

  for (const row of rows) {
    const mins = overlapMinutes(row.startedAt, row.endedAt, rangeStart, rangeEnd)
    if (row.tag === 'productive') productive += mins
    else if (row.tag === 'non-productive') nonProductive += mins
    else neutral += mins
  }

  return {
    totalMinutes: productive + nonProductive + neutral,
    productiveMinutes: productive,
    nonProductiveMinutes: nonProductive,
    neutralMinutes: neutral,
    score: calcScore(productive, nonProductive),
  }
}

export function toTaskEntry(r: typeof tasks.$inferSelect): TaskEntry {
  return {
    id: r.id,
    title: r.title,
    categoryId: r.categoryId ?? null,
    tag: r.tag as ProductivityTag,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    notes: r.notes ?? undefined,
    userId: r.userId,
  }
}
