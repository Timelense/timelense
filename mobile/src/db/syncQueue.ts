/**
 * Sync Queue — ordered list of pending mutations to push to the server.
 *
 * Provides intelligent merge logic: e.g. a create followed by an update
 * merges into a single create with the updated payload, and a create
 * followed by a delete cancels both out entirely.
 */
import { getDb } from './database'
import type { Scalar } from '@op-engineering/op-sqlite'

export interface QueueEntry {
  id: number
  entity: 'task' | 'category'
  operation: 'create' | 'update' | 'delete' | 'stop'
  entityId: string // local_id of the entity
  payload: Record<string, unknown> | null
  createdAt: string
  attempts: number
  lastError: string | null
}

// Ops currently being pushed by the sync engine. Merging into an in-flight
// row would be lost: the push already read the old payload and dequeues the
// row on success. In-memory is correct — nothing is in flight after a
// process restart.
const _inFlight = new Set<number>()

export function markInFlight(id: number): void {
  _inFlight.add(id)
}

export function clearInFlight(id: number): void {
  _inFlight.delete(id)
}

export function hasInFlightOp(entity: QueueEntry['entity'], entityId: string): boolean {
  const db = getDb()
  const result = db.executeSync(
    'SELECT id FROM sync_queue WHERE entity = ? AND entity_id = ?',
    [entity, entityId],
  )
  return (result.rows ?? []).some((row) => _inFlight.has(row.id as number))
}

/**
 * Count pending ops for an entity, optionally excluding one op id
 * (the op whose completion is being processed).
 */
export function countPendingOps(
  entity: QueueEntry['entity'],
  entityId: string,
  excludeOpId?: number,
): number {
  const db = getDb()
  const result = db.executeSync(
    'SELECT COUNT(*) as cnt FROM sync_queue WHERE entity = ? AND entity_id = ? AND id != ?',
    [entity, entityId, excludeOpId ?? -1],
  )
  return (result.rows?.[0]?.cnt as number) ?? 0
}

/**
 * Add an operation to the sync queue.
 * Merges intelligently with existing pending ops for the same entity.
 */
export function enqueue(
  entity: QueueEntry['entity'],
  operation: QueueEntry['operation'],
  entityId: string,
  payload: Record<string, unknown> | null = null,
): void {
  const db = getDb()

  // Check for existing pending ops for this entity
  const existing = db.executeSync(
    'SELECT id, operation, payload FROM sync_queue WHERE entity = ? AND entity_id = ? ORDER BY created_at ASC',
    [entity, entityId],
  )

  if (existing.rows && existing.rows.length > 0) {
    const firstRow = existing.rows[0]
    const firstOp = firstRow.operation as string
    const firstId = firstRow.id as number

    // create + update → update the create payload (merge fields)
    if (firstOp === 'create' && operation === 'update' && !_inFlight.has(firstId)) {
      const existingPayload = firstRow.payload
        ? JSON.parse(firstRow.payload as string)
        : {}
      const merged = { ...existingPayload, ...payload }
      db.executeSync(
        'UPDATE sync_queue SET payload = ? WHERE id = ?',
        [JSON.stringify(merged), firstId],
      )
      return
    }

    // create + stop → update the create payload to include endedAt
    if (firstOp === 'create' && operation === 'stop' && !_inFlight.has(firstId)) {
      const existingPayload = firstRow.payload
        ? JSON.parse(firstRow.payload as string)
        : {}
      const merged = { ...existingPayload, ...payload }
      db.executeSync(
        'UPDATE sync_queue SET payload = ? WHERE id = ?',
        [JSON.stringify(merged), firstId],
      )
      return
    }

    // create + delete → cancel both out (entity was never synced)
    if (firstOp === 'create' && operation === 'delete' && !_inFlight.has(firstId)) {
      db.executeSync(
        'DELETE FROM sync_queue WHERE entity = ? AND entity_id = ?',
        [entity, entityId],
      )
      return
    }

    // update + update → merge into last update
    if (firstOp === 'update' && operation === 'update') {
      const lastRow = existing.rows[existing.rows.length - 1]
      const lastId = lastRow.id as number
      if (!_inFlight.has(lastId)) {
        const lastPayload = lastRow.payload ? JSON.parse(lastRow.payload as string) : {}
        const merged = { ...lastPayload, ...payload }
        db.executeSync(
          'UPDATE sync_queue SET payload = ? WHERE id = ?',
          [JSON.stringify(merged), lastId],
        )
        return
      }
      // In flight — fall through to insert a fresh update op below
    }

    // any + delete → the delete supersedes queued mutations, but an in-flight
    // op has already been sent, so its row must survive until dequeue.
    if (operation === 'delete') {
      for (const row of existing.rows) {
        const rowId = row.id as number
        if (!_inFlight.has(rowId)) {
          db.executeSync('DELETE FROM sync_queue WHERE id = ?', [rowId])
        }
      }
      // Fall through to insert the delete op below
    }
  }

  db.executeSync(
    `INSERT INTO sync_queue (entity, operation, entity_id, payload, created_at, attempts)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [entity, operation, entityId, payload ? JSON.stringify(payload) : null, new Date().toISOString()],
  )
}

/**
 * Get the next `n` operations from the queue, ordered by creation time.
 */
export function peek(n: number = 10): QueueEntry[] {
  const db = getDb()
  const result = db.executeSync(
    'SELECT id, entity, operation, entity_id, payload, created_at, attempts, last_error FROM sync_queue ORDER BY created_at ASC LIMIT ?',
    [n],
  )

  if (!result.rows) return []

  return result.rows.map((row) => ({
    id: row.id as number,
    entity: row.entity as QueueEntry['entity'],
    operation: row.operation as QueueEntry['operation'],
    entityId: row.entity_id as string,
    payload: row.payload ? JSON.parse(row.payload as string) : null,
    createdAt: row.created_at as string,
    attempts: row.attempts as number,
    lastError: (row.last_error as string) ?? null,
  }))
}

/**
 * Remove a completed operation from the queue.
 */
export function dequeue(id: number): void {
  const db = getDb()
  db.executeSync('DELETE FROM sync_queue WHERE id = ?', [id])
}

/**
 * Mark an operation as failed with an error message and increment the attempt counter.
 */
export function markFailed(id: number, error: string): void {
  const db = getDb()
  db.executeSync(
    'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?',
    [error, id],
  )
}

/**
 * Get the total number of pending operations.
 */
export function queueLength(): number {
  const db = getDb()
  const result = db.executeSync('SELECT COUNT(*) as cnt FROM sync_queue')
  return (result.rows?.[0]?.cnt as number) ?? 0
}

/**
 * Remove all pending ops for a specific entity.
 */
export function clearForEntity(entityId: string): void {
  const db = getDb()
  db.executeSync('DELETE FROM sync_queue WHERE entity_id = ?', [entityId])
}

/**
 * After a create op syncs and we get a server ID, remap all remaining queue
 * entries that reference the old local_id to use the new server_id.
 */
export function remapEntityId(oldLocalId: string, newServerId: string): void {
  const db = getDb()
  db.executeSync(
    'UPDATE sync_queue SET entity_id = ? WHERE entity_id = ?',
    [newServerId, oldLocalId],
  )
}
