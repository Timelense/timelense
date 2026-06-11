export type ProductivityTag = 'productive' | 'non-productive' | 'neutral'

export interface AuthResponse {
  token: string
  user: { id: string; email: string }
}

export interface Category {
  id: string
  name: string
  parentId?: string
  color?: string
}

export interface TaskEntry {
  id: string
  title: string
  categoryId: string | null
  tag: ProductivityTag
  startedAt: string
  endedAt: string | null
  notes?: string
  userId: string
}

export interface StartTaskResponse {
  task: TaskEntry
  stoppedTask?: TaskEntry
}

export interface TimeReport {
  userId: string
  from: string
  to: string
  totalMinutes: number
  productiveMinutes: number
  nonProductiveMinutes: number
  neutralMinutes: number
  score: number | null
  entries: TaskEntry[]
}

export interface DailyTimelineEntry extends TaskEntry {
  durationMinutes: number
}

export interface DailyTimeline {
  date: string
  entries: DailyTimelineEntry[]
  totalMinutes: number
  productiveMinutes: number
  nonProductiveMinutes: number
  neutralMinutes: number
  score: number | null
}

export interface DistributionBucket {
  id: string | null
  name: string | null
  color?: string
  tag?: ProductivityTag
  totalMinutes: number
}

export interface Distribution {
  groupBy: 'category' | 'tag'
  from: string
  to: string
  buckets: DistributionBucket[]
}

export interface DayInsight {
  date: string
  totalMinutes: number
  productiveMinutes: number
  nonProductiveMinutes: number
  neutralMinutes: number
  score: number | null
}

export interface CategoryInsight {
  id: string | null
  name: string | null
  color?: string
  totalMinutes: number
  share: number
}

export interface PeriodInsights {
  period: 'week' | 'month'
  offset: number
  from: string
  to: string
  days: DayInsight[]
  totalMinutes: number
  productiveMinutes: number
  nonProductiveMinutes: number
  neutralMinutes: number
  score: number | null
  topCategories: CategoryInsight[]
  deltaTotalMinutes: number | null
  deltaScore: number | null
}
