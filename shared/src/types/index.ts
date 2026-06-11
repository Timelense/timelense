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
  categoryId: string
  tag: ProductivityTag
  startedAt: string
  endedAt: string | null
  notes?: string
  userId: string
}

export interface TimeReport {
  userId: string
  from: string
  to: string
  totalMinutes: number
  productiveMinutes: number
  nonProductiveMinutes: number
  neutralMinutes: number
  entries: TaskEntry[]
}
