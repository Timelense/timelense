/**
 * Analytics API — offline-capable caching.
 *
 * Successful network responses are cached locally in the SQLite database.
 * If network requests fail (offline or server error), it serves cached data.
 */
import { apiRequest } from './client'
import { getDb } from '../db/database'
import type { DailyTimeline, Distribution, PeriodInsights, TimeReport } from '@timelense/shared'

function getCachedItem<T>(key: string): T | null {
  try {
    const db = getDb()
    const result = db.executeSync(
      'SELECT payload, fetched_at FROM analytics_cache WHERE cache_key = ?',
      [key],
    )
    if (!result.rows || result.rows.length === 0) return null
    const row = result.rows[0]
    const data = JSON.parse(row.payload as string)
    return {
      ...data,
      isCached: true,
      fetchedAt: row.fetched_at as string,
    }
  } catch (e) {
    console.warn('[analytics cache] Failed to read from cache:', e)
    return null
  }
}

function setCachedItem(key: string, data: unknown): void {
  try {
    const db = getDb()
    db.executeSync(
      'INSERT OR REPLACE INTO analytics_cache (cache_key, payload, fetched_at) VALUES (?, ?, ?)',
      [key, JSON.stringify(data), new Date().toISOString()],
    )
  } catch (e) {
    console.warn('[analytics cache] Failed to write to cache:', e)
  }
}

export function getTimeline(date: string): Promise<DailyTimeline> {
  // Normally timeline is read synchronously via tasks API, but keep this for completeness
  const cacheKey = `timeline_${date}`
  return apiRequest<DailyTimeline>(`/analytics/timeline?date=${date}`)
    .then((res) => {
      setCachedItem(cacheKey, res)
      return res
    })
    .catch((err) => {
      const cached = getCachedItem<DailyTimeline>(cacheKey)
      if (cached) return cached
      throw err
    })
}

export function getDistribution(params: {
  from: string
  to: string
  groupBy: 'category' | 'tag'
}): Promise<Distribution> {
  const qs = new URLSearchParams({ from: params.from, to: params.to, groupBy: params.groupBy })
  const cacheKey = `dist_${params.from}_${params.to}_${params.groupBy}`
  return apiRequest<Distribution>(`/analytics/distribution?${qs}`)
    .then((res) => {
      setCachedItem(cacheKey, res)
      return res
    })
    .catch((err) => {
      const cached = getCachedItem<Distribution>(cacheKey)
      if (cached) return cached
      throw err
    })
}

export function getInsights(params: {
  period: 'week' | 'month'
  offset?: number
}): Promise<PeriodInsights> {
  const qs = new URLSearchParams({ period: params.period })
  if (params.offset != null) qs.set('offset', String(params.offset))
  const cacheKey = `insights_${params.period}_${params.offset ?? 0}`
  return apiRequest<PeriodInsights>(`/analytics/insights?${qs}`)
    .then((res) => {
      setCachedItem(cacheKey, res)
      return res
    })
    .catch((err) => {
      const cached = getCachedItem<PeriodInsights>(cacheKey)
      if (cached) return cached
      throw err
    })
}

export function getReport(from: string, to: string): Promise<TimeReport> {
  const cacheKey = `report_${from}_${to}`
  return apiRequest<TimeReport>(`/analytics/report?from=${from}&to=${to}`)
    .then((res) => {
      setCachedItem(cacheKey, res)
      return res
    })
    .catch((err) => {
      const cached = getCachedItem<TimeReport>(cacheKey)
      if (cached) return cached
      throw err
    })
}
