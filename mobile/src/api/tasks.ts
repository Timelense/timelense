/**
 * Tasks API — offline-first.
 *
 * All reads come from the local SQLite database.
 * All writes go to SQLite first + enqueue a sync operation.
 * The sync engine pushes mutations to the server in the background.
 *
 * Function signatures are preserved so screens need minimal changes.
 */
import {
  getLocalCurrentTask,
  createLocalTask,
  createLocalManualTask,
  stopLocalTask,
  editLocalTask,
  deleteLocalTask,
  getLocalTasks,
  getLocalTimeline,
  findTaskByLocalId,
  findTaskByServerId,
} from '../db/taskRepo'
import { scheduleSyncSoon } from '../sync/syncEngine'
import type { TaskEntry, StartTaskResponse, DailyTimeline } from '@timelense/shared'

// TODO: Get actual userId from auth context. For now, we read it from the
// first task or use a placeholder. This will be wired up properly when we
// integrate the SyncProvider with the AuthProvider.
let _cachedUserId = 'current-user'
export function setLocalUserId(id: string): void {
  _cachedUserId = id
}

export function getCurrentTask(): TaskEntry | null {
  const task = getLocalCurrentTask()
  return task ? stripSyncMeta(task) : null
}

export function startTask(body: {
  title?: string
  categoryId?: string
  tag?: string
  notes?: string
} = {}): StartTaskResponse {
  const result = createLocalTask(_cachedUserId, body)
  scheduleSyncSoon()
  return result
}

/**
 * Add a manual (backfilled) task with explicit start/end times. Used by the
 * Timeline "Add task" flow when the user missed hitting Start/Stop. Does not
 * touch any running timer.
 */
export function addTask(body: {
  title?: string
  categoryId?: string | null
  tag?: string
  notes?: string | null
  startedAt: string
  endedAt: string
}): TaskEntry {
  const task = createLocalManualTask(_cachedUserId, body)
  scheduleSyncSoon()
  return task
}

export function stopTask(localId: string): TaskEntry | null {
  // localId might be a server_id or local_id — resolve it
  const resolved = resolveLocalId(localId)
  const stopped = stopLocalTask(resolved)
  if (stopped) scheduleSyncSoon()
  return stopped
}

export function listTasks(params: {
  from?: string
  to?: string
  categoryId?: string
  tag?: string
  limit?: number
  offset?: number
}): TaskEntry[] {
  return getLocalTasks(params).map(stripSyncMeta)
}

export function getTimeline(date: string): DailyTimeline {
  return getLocalTimeline(date)
}

export function editTask(id: string, body: Partial<{
  title: string
  categoryId: string | null
  tag: string
  notes: string | null
  startedAt: string
  endedAt: string | null
}>): TaskEntry | null {
  const resolved = resolveLocalId(id)
  const updated = editLocalTask(resolved, body)
  if (updated) scheduleSyncSoon()
  return updated
}

export function deleteTask(id: string): boolean {
  const resolved = resolveLocalId(id)
  const deleted = deleteLocalTask(resolved)
  if (deleted) scheduleSyncSoon()
  return deleted
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve an ID that might be a server_id or local_id to the local_id.
 * Screens may hold server IDs from previously synced entries.
 */
function resolveLocalId(id: string): string {
  const task = findTaskByLocalId(id)
  if (task) return id
  const taskByServer = findTaskByServerId(id)
  if (taskByServer) return taskByServer.localId
  return id
}

/**
 * Strip sync-internal fields before returning to the UI layer.
 */
function stripSyncMeta(task: TaskEntry & { syncStatus?: string; localId?: string }): TaskEntry {
  const { syncStatus, localId, ...entry } = task
  return entry
}
