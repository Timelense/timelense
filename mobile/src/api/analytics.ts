import { apiRequest } from './client'
import type { DailyTimeline, Distribution, PeriodInsights, TimeReport } from '@timelense/shared'

export function getTimeline(date: string): Promise<DailyTimeline> {
  return apiRequest(`/analytics/timeline?date=${date}`)
}

export function getDistribution(params: {
  from: string
  to: string
  groupBy: 'category' | 'tag'
}): Promise<Distribution> {
  const qs = new URLSearchParams({ from: params.from, to: params.to, groupBy: params.groupBy })
  return apiRequest(`/analytics/distribution?${qs}`)
}

export function getInsights(params: {
  period: 'week' | 'month'
  offset?: number
}): Promise<PeriodInsights> {
  const qs = new URLSearchParams({ period: params.period })
  if (params.offset != null) qs.set('offset', String(params.offset))
  return apiRequest(`/analytics/insights?${qs}`)
}

export function getReport(from: string, to: string): Promise<TimeReport> {
  return apiRequest(`/analytics/report?from=${from}&to=${to}`)
}
