/**
 * DB Health Check — Keychain-based integrity verification.
 *
 * Stores a checkpoint in the device Keychain (which survives app data clears
 * and reinstalls) so the app can detect when the local SQLite has been wiped
 * or corrupted, and trigger a full re-sync from the server.
 */
import * as Keychain from 'react-native-keychain'
import { getDb } from './database'

const CHECKPOINT_SERVICE = 'timelense_db_checkpoint'

export interface DbCheckpoint {
  taskCount: number
  lastSyncEpoch: number
  schemaVersion: number
}

/**
 * Read the DB checkpoint from the Keychain.
 * Returns null on a fresh install (no checkpoint saved yet).
 */
export async function readCheckpoint(): Promise<DbCheckpoint | null> {
  try {
    const creds = await Keychain.getGenericPassword({ service: CHECKPOINT_SERVICE })
    if (!creds) return null
    return JSON.parse(creds.password) as DbCheckpoint
  } catch {
    return null
  }
}

/**
 * Persist a checkpoint to the Keychain. Call after every successful sync.
 */
export async function writeCheckpoint(checkpoint: DbCheckpoint): Promise<void> {
  await Keychain.setGenericPassword(
    'checkpoint',
    JSON.stringify(checkpoint),
    { service: CHECKPOINT_SERVICE },
  )
}

/**
 * Clear the checkpoint (e.g. on logout).
 */
export async function clearCheckpoint(): Promise<void> {
  await Keychain.resetGenericPassword({ service: CHECKPOINT_SERVICE })
}

export type HealthStatus =
  | { status: 'healthy' }
  | { status: 'fresh_install' }
  | { status: 'db_wiped'; checkpoint: DbCheckpoint }
  | { status: 'db_corrupt'; checkpoint: DbCheckpoint | null }

/**
 * Run the health check. Call once on app launch AFTER `initDatabase()`.
 *
 * Returns a status indicating whether the DB is healthy, freshly installed,
 * was wiped (needs full re-sync), or is corrupted (needs delete + re-sync).
 */
export async function checkDbHealth(): Promise<HealthStatus> {
  const checkpoint = await readCheckpoint()

  let localCount: number
  try {
    const db = getDb()
    const result = db.executeSync('SELECT COUNT(*) as cnt FROM local_tasks')
    localCount = (result.rows?.[0]?.cnt as number) ?? 0
  } catch {
    // SQLite failed to open or query — corruption
    return { status: 'db_corrupt', checkpoint }
  }

  if (!checkpoint) {
    // No checkpoint saved → fresh install or first run
    return { status: 'fresh_install' }
  }

  if (localCount === 0 && checkpoint.taskCount > 0) {
    // DB was wiped but we had data before
    return { status: 'db_wiped', checkpoint }
  }

  return { status: 'healthy' }
}

/**
 * Update the checkpoint to reflect the current DB state.
 * Call after every successful sync cycle.
 */
export async function updateCheckpointFromDb(schemaVersion: number): Promise<void> {
  try {
    const db = getDb()
    const result = db.executeSync('SELECT COUNT(*) as cnt FROM local_tasks')
    const taskCount = (result.rows?.[0]?.cnt as number) ?? 0

    await writeCheckpoint({
      taskCount,
      lastSyncEpoch: Date.now(),
      schemaVersion,
    })
  } catch {
    // Non-critical — checkpoint update failure shouldn't crash the app
    console.warn('[healthCheck] Failed to update DB checkpoint')
  }
}
