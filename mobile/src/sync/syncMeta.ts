/**
 * Sync Meta — simple key-value store backed by the sync_meta SQLite table.
 * Used to track last_pull_at, last_sync_at, etc.
 */
import { getDb } from '../db/database'

/**
 * Read a sync metadata value.
 */
export function getSyncMeta(key: string): string | null {
  const db = getDb()
  const result = db.executeSync('SELECT value FROM sync_meta WHERE key = ?', [key])
  if (!result.rows || result.rows.length === 0) return null
  return result.rows[0].value as string
}

/**
 * Write a sync metadata value (insert or update).
 */
export function setSyncMeta(key: string, value: string): void {
  const db = getDb()
  db.executeSync(
    'INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
    [key, value],
  )
}

/**
 * Delete a sync metadata key.
 */
export function deleteSyncMeta(key: string): void {
  const db = getDb()
  db.executeSync('DELETE FROM sync_meta WHERE key = ?', [key])
}
