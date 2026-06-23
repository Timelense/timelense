/**
 * Task Repository — local CRUD operations on the SQLite database.
 *
 * Every mutation writes to the local DB first and enqueues a sync operation.
 * Reads always come from the local DB, never from the network.
 *
 * Uses executeSync with named-column row access (Record<string, Scalar>).
 */
import { getDb } from './database'
import { enqueue } from './syncQueue'
import type { Scalar } from '@op-engineering/op-sqlite'
import type { TaskEntry, StartTaskResponse, DailyTimeline, DailyTimelineEntry, ProductivityTag } from '@timelense/shared'

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// ---------------------------------------------------------------------------
// Row → domain type mapping
// ---------------------------------------------------------------------------

type TaskWithSync = TaskEntry & { syncStatus: string; localId: string }

function rowToEntry(row: Record<string, Scalar>): TaskWithSync {
  return {
    id: (row.server_id as string) ?? (row.local_id as string), // prefer server_id
    localId: row.local_id as string,
    title: row.title as string,
    categoryId: (row.category_id as string) ?? null,
    tag: (row.tag as string) as ProductivityTag,
    startedAt: row.started_at as string,
    endedAt: (row.ended_at as string) ?? null,
    notes: (row.notes as string) ?? undefined,
    userId: row.user_id as string,
    syncStatus: row.sync_status as string,
  }
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Get the currently running task (no endedAt, not pending delete).
 */
export function getLocalCurrentTask(): TaskWithSync | null {
  const db = getDb()
  const result = db.executeSync(
    "SELECT * FROM local_tasks WHERE ended_at IS NULL AND sync_status != 'pending_delete' LIMIT 1",
  )
  if (!result.rows || result.rows.length === 0) return null
  return rowToEntry(result.rows[0])
}

/**
 * Get tasks for a date range with optional filters.
 */
export function getLocalTasks(params: {
  from?: string
  to?: string
  categoryId?: string
  tag?: string
  limit?: number
  offset?: number
}): TaskWithSync[] {
  const db = getDb()
  const conditions: string[] = ["sync_status != 'pending_delete'"]
  const args: Scalar[] = []

  if (params.from) {
    conditions.push('(ended_at >= ? OR ended_at IS NULL)')
    args.push(params.from)
  }
  if (params.to) {
    conditions.push('started_at <= ?')
    args.push(params.to)
  }
  if (params.categoryId) {
    conditions.push('category_id = ?')
    args.push(params.categoryId)
  }
  if (params.tag) {
    conditions.push('tag = ?')
    args.push(params.tag)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const limit = params.limit ?? 50
  const offset = params.offset ?? 0

  const result = db.executeSync(
    `SELECT * FROM local_tasks ${where} ORDER BY started_at DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  )

  if (!result.rows) return []
  return result.rows.map(rowToEntry)
}

/**
 * Compute a DailyTimeline from local tasks for a given date.
 * Replicates the server's analytics/timeline endpoint logic locally.
 */
export function getLocalTimeline(date: string): DailyTimeline {
  const db = getDb()
  const dayStart = `${date}T00:00:00.000Z`
  const dayEnd = `${date}T23:59:59.999Z`

  const result = db.executeSync(
    `SELECT * FROM local_tasks
     WHERE sync_status != 'pending_delete'
       AND started_at <= ?
       AND (ended_at >= ? OR ended_at IS NULL)
     ORDER BY started_at ASC`,
    [dayEnd, dayStart],
  )

  const entries: DailyTimelineEntry[] = (result.rows ?? []).map((row) => {
    const entry = rowToEntry(row)
    const start = new Date(entry.startedAt).getTime()
    const end = entry.endedAt ? new Date(entry.endedAt).getTime() : Date.now()
    const durationMinutes = Math.max(0, (end - start) / 60000)

    return {
      ...entry,
      durationMinutes: Math.round(durationMinutes),
    }
  })

  let totalMinutes = 0
  let productiveMinutes = 0
  let nonProductiveMinutes = 0
  let neutralMinutes = 0

  for (const e of entries) {
    totalMinutes += e.durationMinutes
    if (e.tag === 'productive') productiveMinutes += e.durationMinutes
    else if (e.tag === 'non-productive') nonProductiveMinutes += e.durationMinutes
    else neutralMinutes += e.durationMinutes
  }

  const score = totalMinutes > 0
    ? Math.round((productiveMinutes / totalMinutes) * 100)
    : null

  return {
    date,
    entries,
    totalMinutes,
    productiveMinutes,
    nonProductiveMinutes,
    neutralMinutes,
    score,
  }
}

// ---------------------------------------------------------------------------
// Write operations — always local first + enqueue sync
// ---------------------------------------------------------------------------

/**
 * Start a new task locally. Auto-stops any running task.
 */
export function createLocalTask(
  userId: string,
  body: { title?: string; categoryId?: string; tag?: string; notes?: string } = {},
): StartTaskResponse {
  const db = getDb()
  const now = new Date().toISOString()
  const localId = uuid()

  let stoppedTask: TaskEntry | undefined

  // Auto-stop any running task
  const running = getLocalCurrentTask()
  if (running) {
    db.executeSync(
      `UPDATE local_tasks SET ended_at = ?, sync_status = CASE
        WHEN sync_status = 'pending_create' THEN 'pending_create'
        ELSE 'pending_update'
       END, updated_at = ? WHERE local_id = ?`,
      [now, now, running.localId],
    )

    if (running.syncStatus === 'synced') {
      enqueue('task', 'stop', running.localId, { endedAt: now })
    }

    stoppedTask = { ...running, endedAt: now }
  }

  // Create the new task
  db.executeSync(
    `INSERT INTO local_tasks (local_id, server_id, user_id, title, category_id, tag, notes, started_at, ended_at, sync_status, updated_at, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, NULL, 'pending_create', ?, ?)`,
    [localId, userId, body.title ?? 'Untitled', body.categoryId ?? null, body.tag ?? 'neutral', body.notes ?? null, now, now, now],
  )

  enqueue('task', 'create', localId, {
    title: body.title ?? 'Untitled',
    categoryId: body.categoryId,
    tag: body.tag ?? 'neutral',
    notes: body.notes,
    startedAt: now,
  })

  const task: TaskEntry = {
    id: localId,
    title: body.title ?? 'Untitled',
    categoryId: body.categoryId ?? null,
    tag: (body.tag ?? 'neutral') as ProductivityTag,
    startedAt: now,
    endedAt: null,
    notes: body.notes,
    userId,
  }

  return { task, stoppedTask }
}

/**
 * Create a manual (backfilled) task locally with explicit start/end times.
 *
 * Unlike `createLocalTask`, this does NOT auto-stop the running task — it
 * represents a completed entry the user is filling in after the fact, so it
 * must not disturb a live timer. The entry is inserted already-completed
 * (ended_at set) and the create op carries both times so the server honors
 * them on sync.
 */
export function createLocalManualTask(
  userId: string,
  body: {
    title?: string
    categoryId?: string | null
    tag?: string
    notes?: string | null
    startedAt: string
    endedAt: string
  },
): TaskEntry {
  const db = getDb()
  const now = new Date().toISOString()
  const localId = uuid()

  db.executeSync(
    `INSERT INTO local_tasks (local_id, server_id, user_id, title, category_id, tag, notes, started_at, ended_at, sync_status, updated_at, created_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, 'pending_create', ?, ?)`,
    [localId, userId, body.title ?? 'Untitled', body.categoryId ?? null, body.tag ?? 'neutral', body.notes ?? null, body.startedAt, body.endedAt, now, now],
  )

  enqueue('task', 'create', localId, {
    title: body.title ?? 'Untitled',
    categoryId: body.categoryId ?? undefined,
    tag: body.tag ?? 'neutral',
    notes: body.notes ?? undefined,
    startedAt: body.startedAt,
    endedAt: body.endedAt,
  })

  return {
    id: localId,
    title: body.title ?? 'Untitled',
    categoryId: body.categoryId ?? null,
    tag: (body.tag ?? 'neutral') as ProductivityTag,
    startedAt: body.startedAt,
    endedAt: body.endedAt,
    notes: body.notes ?? undefined,
    userId,
  }
}

/**
 * Stop a running task locally.
 */
export function stopLocalTask(localId: string): TaskEntry | null {
  const db = getDb()
  const now = new Date().toISOString()

  const result = db.executeSync(
    'SELECT * FROM local_tasks WHERE local_id = ?',
    [localId],
  )
  if (!result.rows || result.rows.length === 0) return null
  const entry = rowToEntry(result.rows[0])
  if (entry.endedAt) return null // already stopped

  const newSyncStatus = entry.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update'

  db.executeSync(
    'UPDATE local_tasks SET ended_at = ?, sync_status = ?, updated_at = ? WHERE local_id = ?',
    [now, newSyncStatus, now, localId],
  )

  // Always enqueue the stop. For a synced task this becomes a standalone stop
  // op; for a still-unsynced task (pending_create) the queue merges endedAt
  // into the pending create payload (see syncQueue's create+stop rule) so the
  // stop time isn't lost when the create finally syncs.
  enqueue('task', 'stop', localId, { endedAt: now })

  return { ...entry, endedAt: now }
}

/**
 * Edit a task's details locally.
 */
export function editLocalTask(
  localId: string,
  body: Partial<{
    title: string
    categoryId: string | null
    tag: string
    notes: string | null
    startedAt: string
    endedAt: string | null
  }>,
): TaskEntry | null {
  const db = getDb()
  const now = new Date().toISOString()

  const result = db.executeSync(
    'SELECT * FROM local_tasks WHERE local_id = ?',
    [localId],
  )
  if (!result.rows || result.rows.length === 0) return null
  const entry = rowToEntry(result.rows[0])

  // Build SET clause dynamically
  const sets: string[] = ['updated_at = ?']
  const args: Scalar[] = [now]

  if (body.title !== undefined) { sets.push('title = ?'); args.push(body.title) }
  if (body.categoryId !== undefined) { sets.push('category_id = ?'); args.push(body.categoryId) }
  if (body.tag !== undefined) { sets.push('tag = ?'); args.push(body.tag) }
  if (body.notes !== undefined) { sets.push('notes = ?'); args.push(body.notes) }
  if (body.startedAt !== undefined) { sets.push('started_at = ?'); args.push(body.startedAt) }
  if (body.endedAt !== undefined) { sets.push('ended_at = ?'); args.push(body.endedAt) }

  const newStatus = entry.syncStatus === 'pending_create' ? 'pending_create' : 'pending_update'
  sets.push('sync_status = ?')
  args.push(newStatus)

  args.push(localId)

  db.executeSync(
    `UPDATE local_tasks SET ${sets.join(', ')} WHERE local_id = ?`,
    args,
  )

  // Enqueue the update (will merge if a create/update is already queued)
  enqueue('task', 'update', localId, body as Record<string, unknown>)

  return {
    id: entry.id,
    title: body.title ?? entry.title,
    categoryId: body.categoryId !== undefined ? body.categoryId : entry.categoryId,
    tag: (body.tag ?? entry.tag) as ProductivityTag,
    startedAt: body.startedAt ?? entry.startedAt,
    endedAt: body.endedAt !== undefined ? body.endedAt : entry.endedAt,
    notes: body.notes !== undefined ? (body.notes ?? undefined) : entry.notes,
    userId: entry.userId,
  }
}

/**
 * Delete a task locally.
 */
export function deleteLocalTask(localId: string): boolean {
  const db = getDb()

  const result = db.executeSync(
    'SELECT sync_status FROM local_tasks WHERE local_id = ?',
    [localId],
  )
  if (!result.rows || result.rows.length === 0) return false
  const syncStatus = result.rows[0].sync_status as string

  if (syncStatus === 'pending_create') {
    db.executeSync('DELETE FROM local_tasks WHERE local_id = ?', [localId])
    enqueue('task', 'delete', localId) // queue merge will cancel the create+delete
    return true
  }

  db.executeSync(
    "UPDATE local_tasks SET sync_status = 'pending_delete', updated_at = ? WHERE local_id = ?",
    [new Date().toISOString(), localId],
  )
  enqueue('task', 'delete', localId)
  return true
}

/**
 * Find a task by its local_id.
 */
export function findTaskByLocalId(localId: string): TaskWithSync | null {
  const db = getDb()
  const result = db.executeSync(
    'SELECT * FROM local_tasks WHERE local_id = ? LIMIT 1',
    [localId],
  )
  if (!result.rows || result.rows.length === 0) return null
  return rowToEntry(result.rows[0])
}

/**
 * Find a task by its server_id.
 */
export function findTaskByServerId(serverId: string): TaskWithSync | null {
  const db = getDb()
  const result = db.executeSync(
    'SELECT * FROM local_tasks WHERE server_id = ? LIMIT 1',
    [serverId],
  )
  if (!result.rows || result.rows.length === 0) return null
  return rowToEntry(result.rows[0])
}

/**
 * Upsert tasks received from the server during a pull.
 * Only updates entries in 'synced' status — never overwrites local pending changes.
 */
export function upsertTasksFromServer(tasks: TaskEntry[]): void {
  const db = getDb()

  for (const task of tasks) {
    const existing = db.executeSync(
      'SELECT local_id, sync_status FROM local_tasks WHERE server_id = ?',
      [task.id],
    )

    if (existing.rows && existing.rows.length > 0) {
      const syncStatus = existing.rows[0].sync_status as string
      if (syncStatus !== 'synced') continue // don't overwrite local changes

      const localId = existing.rows[0].local_id as string
      db.executeSync(
        `UPDATE local_tasks SET title = ?, category_id = ?, tag = ?, notes = ?,
         started_at = ?, ended_at = ?, updated_at = ? WHERE local_id = ?`,
        [task.title, task.categoryId, task.tag, task.notes ?? null,
         task.startedAt, task.endedAt, new Date().toISOString(), localId],
      )
    } else {
      const localId = uuid()
      db.executeSync(
        `INSERT INTO local_tasks (local_id, server_id, user_id, title, category_id, tag, notes, started_at, ended_at, sync_status, updated_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)`,
        [localId, task.id, task.userId, task.title, task.categoryId, task.tag,
         task.notes ?? null, task.startedAt, task.endedAt, new Date().toISOString(), new Date().toISOString()],
      )
    }
  }
}

/**
 * After a create op syncs, map local_id → server_id.
 */
export function markTaskSynced(localId: string, serverId: string): void {
  const db = getDb()
  db.executeSync(
    "UPDATE local_tasks SET server_id = ?, sync_status = 'synced' WHERE local_id = ?",
    [serverId, localId],
  )
}

/**
 * Mark a task as synced (for stop/update ops that completed).
 */
export function markTaskSyncedByLocalId(localId: string): void {
  const db = getDb()
  db.executeSync(
    "UPDATE local_tasks SET sync_status = 'synced' WHERE local_id = ?",
    [localId],
  )
}

/**
 * Permanently remove a task that was successfully deleted on the server.
 */
export function removeDeletedTask(localId: string): void {
  const db = getDb()
  db.executeSync('DELETE FROM local_tasks WHERE local_id = ?', [localId])
}
