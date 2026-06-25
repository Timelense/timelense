/**
 * Sync Engine — pushes queued local mutations to the server and pulls
 * fresh data back. Triggered by network reconnect, app foreground,
 * or after local mutations.
 */
import { AppState, type AppStateStatus } from 'react-native'
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import { apiRequest } from '../api/client'
import * as queue from '../db/syncQueue'
import {
  findTaskByLocalId,
  markTaskSynced,
  markTaskSyncedByLocalId,
  removeDeletedTask,
  upsertTasksFromServer,
} from '../db/taskRepo'
import { upsertCategoriesFromServer } from '../db/categoryRepo'
import { pullMacros } from '../api/macros'
import { updateCheckpointFromDb } from '../db/healthCheck'
import { getSyncMeta, setSyncMeta } from './syncMeta'
import type { TaskEntry, Category } from '@timelense/shared'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _isOnline = true
let _isSyncing = false
let _syncTimer: ReturnType<typeof setTimeout> | null = null
let _userId: string | null = null
const _failedAttemptsCache = new Map<number, number>()

type SyncListener = (state: SyncSnapshot) => void
const _listeners = new Set<SyncListener>()

export interface SyncSnapshot {
  isOnline: boolean
  isSyncing: boolean
  pendingOpsCount: number
  lastSyncedAt: string | null
  lastError: string | null
}

let _lastError: string | null = null

function notify(): void {
  const snapshot = getSnapshot()
  _listeners.forEach((fn) => fn(snapshot))
}

export function getSnapshot(): SyncSnapshot {
  return {
    isOnline: _isOnline,
    isSyncing: _isSyncing,
    pendingOpsCount: queue.queueLength(),
    lastSyncedAt: getSyncMeta('last_sync_at'),
    lastError: _lastError,
  }
}

export function subscribe(fn: SyncListener): () => void {
  _listeners.add(fn)
  return () => { _listeners.delete(fn) }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

let _netInfoUnsub: (() => void) | null = null
let _appStateUnsub: { remove: () => void } | null = null

/**
 * Start the sync engine. Call once on app boot after DB init + auth.
 */
export function startSyncEngine(userId: string): void {
  _userId = userId
  _lastError = null

  // Listen for connectivity changes
  _netInfoUnsub = NetInfo.addEventListener((state: NetInfoState) => {
    const wasOffline = !_isOnline
    _isOnline = !!state.isConnected && !!state.isInternetReachable
    notify()

    // If we just came online, sync immediately
    if (wasOffline && _isOnline) {
      scheduleSyncSoon()
    }
  })

  // Sync on app foreground
  _appStateUnsub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
    if (nextState === 'active' && _isOnline) {
      scheduleSyncSoon()
    }
  })

  // Initial sync
  scheduleSyncSoon()

  // Periodic sync every 5 minutes
  _syncTimer = setInterval(() => {
    if (_isOnline && !_isSyncing) {
      runSyncCycle()
    }
  }, 5 * 60 * 1000)
}

/**
 * Stop the sync engine (on logout).
 */
export function stopSyncEngine(): void {
  _netInfoUnsub?.()
  _netInfoUnsub = null
  _appStateUnsub?.remove()
  _appStateUnsub = null
  if (_syncTimer) {
    clearInterval(_syncTimer)
    _syncTimer = null
  }
  _userId = null
}

// ---------------------------------------------------------------------------
// Sync trigger (debounced)
// ---------------------------------------------------------------------------

let _debounceTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Schedule a sync cycle soon (debounced at 2 seconds).
 * Call this after any local mutation.
 */
export function scheduleSyncSoon(): void {
  if (_debounceTimer) clearTimeout(_debounceTimer)
  _debounceTimer = setTimeout(() => {
    if (_isOnline && !_isSyncing) {
      runSyncCycle()
    }
  }, 2000)
}

// ---------------------------------------------------------------------------
// Core sync cycle
// ---------------------------------------------------------------------------

const MAX_RETRIES = 5

async function runSyncCycle(): Promise<void> {
  if (_isSyncing || !_isOnline || !_userId) return

  _isSyncing = true
  _lastError = null
  notify()

  try {
    // 1. Push phase — send pending ops to server
    await pushPhase()

    // 2. Pull phase — fetch updates from server
    await pullPhase()

    // 3. Update the checkpoint
    await updateCheckpointFromDb(1)

    setSyncMeta('last_sync_at', new Date().toISOString())
  } catch (err) {
    _lastError = err instanceof Error ? err.message : 'Sync failed'
    console.warn('[syncEngine] Sync cycle failed:', err)
  } finally {
    _isSyncing = false
    notify()
  }
}

// ---------------------------------------------------------------------------
// Push phase — send queued ops to the server
// ---------------------------------------------------------------------------

async function pushPhase(): Promise<void> {
  const ops = queue.peek(20)

  for (const op of ops) {
    if (!_isOnline) break // Stop pushing if we lose connectivity mid-cycle
    if (op.attempts >= MAX_RETRIES) {
      // Skip permanently failed ops (don't block the queue)
      console.warn(`[syncEngine] Skipping op ${op.id} after ${op.attempts} failures`)
      continue
    }

    if (op.attempts > 0) {
      const lastFailed = _failedAttemptsCache.get(op.id)
      if (lastFailed) {
        const delayMs = Math.pow(2, op.attempts) * 1000
        if (Date.now() - lastFailed < delayMs) {
          // Delay has not elapsed yet, skip it for this cycle
          continue
        }
      }
    }

    try {
      await pushSingleOp(op)
      queue.dequeue(op.id)
      _failedAttemptsCache.delete(op.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown'

      if (isNetworkError(err)) {
        // Network failure — stop pushing, try again later
        _isOnline = false
        notify()
        break
      }

      if (is4xxError(err) && !is409Error(err)) {
        // Client error (bad data) — mark failed, skip it
        queue.markFailed(op.id, msg)
        _failedAttemptsCache.set(op.id, Date.now())
        continue
      }

      if (is409Error(err)) {
        // Conflict — the server version wins for now (last-writer-wins via pull)
        queue.dequeue(op.id)
        _failedAttemptsCache.delete(op.id)
        continue
      }

      // Unknown error — mark failed and continue
      queue.markFailed(op.id, msg)
      _failedAttemptsCache.set(op.id, Date.now())
    }
  }
}

async function pushSingleOp(op: queue.QueueEntry): Promise<void> {
  const task = findTaskByLocalId(op.entityId)

  switch (op.operation) {
    case 'create': {
      if (op.entity === 'task') {
        const payload = op.payload ?? {}
        const res = await apiRequest<{ task: TaskEntry }>('/tasks/start', 'POST', {
          title: payload.title,
          categoryId: payload.categoryId,
          tag: payload.tag,
          notes: payload.notes,
          // Manual backfill entries carry explicit times; a live-timer create
          // omits these and the server starts at now().
          startedAt: payload.startedAt,
          endedAt: payload.endedAt,
        })
        // Map local_id → server_id
        markTaskSynced(op.entityId, res.task.id)
        queue.remapEntityId(op.entityId, op.entityId) // Keep local_id in queue for consistency
      }
      break
    }

    case 'stop': {
      if (op.entity === 'task' && task?.id) {
        const serverId = task.id
        if (serverId === task.localId) {
          // No server ID yet — this shouldn't happen if create ran first
          throw new Error('Cannot stop unsynced task')
        }
        // Forward the real stop time so a delayed sync doesn't stamp now().
        await apiRequest(`/tasks/${serverId}/stop`, 'PATCH', { endedAt: op.payload?.endedAt })
        markTaskSyncedByLocalId(op.entityId)
      }
      break
    }

    case 'update': {
      if (op.entity === 'task' && task?.id) {
        const serverId = task.id
        if (serverId === task.localId) {
          throw new Error('Cannot update unsynced task')
        }
        await apiRequest(`/tasks/${serverId}`, 'PATCH', op.payload)
        markTaskSyncedByLocalId(op.entityId)
      }
      break
    }

    case 'delete': {
      if (op.entity === 'task' && task) {
        const serverId = task.id
        if (serverId !== task.localId) {
          // Only delete on server if it was synced
          await apiRequest(`/tasks/${serverId}`, 'DELETE')
        }
        removeDeletedTask(op.entityId)
      }
      break
    }
  }
}

// ---------------------------------------------------------------------------
// Pull phase — fetch updates from server
// ---------------------------------------------------------------------------

async function pullPhase(): Promise<void> {
  if (!_userId) return

  try {
    // Pull recent tasks
    const lastPull = getSyncMeta('last_pull_at')
    const params = new URLSearchParams()
    if (lastPull) params.set('updatedSince', lastPull)
    params.set('limit', '200')

    const tasks = await apiRequest<TaskEntry[]>(`/tasks?${params}`)
    upsertTasksFromServer(tasks)

    // Pull categories
    const categories = await apiRequest<Category[]>('/categories')
    upsertCategoriesFromServer(_userId, categories)

    // Pull quick-start macros into the local cache
    await pullMacros()

    setSyncMeta('last_pull_at', new Date().toISOString())
  } catch (err) {
    if (isNetworkError(err)) {
      _isOnline = false
      notify()
    }
    // Non-network pull failures are non-critical — we still have local data
    console.warn('[syncEngine] Pull phase failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message === 'Network request failed') return true
  if (err instanceof Error && err.message.includes('Network request failed')) return true
  return false
}

function is4xxError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status
    return status >= 400 && status < 500
  }
  return false
}

function is409Error(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    return (err as { status: number }).status === 409
  }
  return false
}
