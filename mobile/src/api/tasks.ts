import { apiRequest } from './client'
import type { TaskEntry, StartTaskResponse } from '@timelense/shared'

export function getCurrentTask(): Promise<TaskEntry | null> {
  return apiRequest('/tasks/current')
}

export function startTask(body: {
  title?: string
  categoryId?: string
  tag?: string
  notes?: string
} = {}): Promise<StartTaskResponse> {
  return apiRequest('/tasks/start', 'POST', body)
}

export function stopTask(id: string): Promise<TaskEntry> {
  return apiRequest(`/tasks/${id}/stop`, 'PATCH')
}

export function listTasks(params: {
  from?: string
  to?: string
  categoryId?: string
  tag?: string
  limit?: number
  offset?: number
}): Promise<TaskEntry[]> {
  const qs = new URLSearchParams()
  if (params.from) qs.set('from', params.from)
  if (params.to) qs.set('to', params.to)
  if (params.categoryId) qs.set('categoryId', params.categoryId)
  if (params.tag) qs.set('tag', params.tag)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  return apiRequest(`/tasks?${qs}`)
}

export function editTask(id: string, body: Partial<{
  title: string
  categoryId: string | null
  tag: string
  notes: string | null
  startedAt: string
  endedAt: string | null
}>): Promise<TaskEntry> {
  return apiRequest(`/tasks/${id}`, 'PATCH', body)
}

export function deleteTask(id: string): Promise<void> {
  return apiRequest(`/tasks/${id}`, 'DELETE')
}
