/**
 * Category Repository — local cache of categories from the server.
 *
 * Categories are fetched from the server and cached locally. CRUD operations
 * on categories still require connectivity (per design decision), but reads
 * always come from the local cache for offline support.
 */
import { getDb } from './database'
import type { Scalar } from '@op-engineering/op-sqlite'
import type { Category } from '@timelense/shared'

function rowToCategory(row: Record<string, Scalar>): Category {
  return {
    id: (row.server_id as string) ?? (row.local_id as string),
    name: row.name as string,
    parentId: (row.parent_id as string) ?? undefined,
    color: (row.color as string) ?? undefined,
  }
}

/**
 * Get all categories from the local cache.
 */
export function getLocalCategories(): Category[] {
  const db = getDb()
  const result = db.executeSync('SELECT * FROM local_categories ORDER BY name ASC')
  if (!result.rows) return []
  return result.rows.map(rowToCategory)
}

/**
 * Find a category by its server_id.
 */
export function findCategoryByServerId(serverId: string): Category | null {
  const db = getDb()
  const result = db.executeSync(
    'SELECT * FROM local_categories WHERE server_id = ? LIMIT 1',
    [serverId],
  )
  if (!result.rows || result.rows.length === 0) return null
  return rowToCategory(result.rows[0])
}

/**
 * Replace the entire local category cache with fresh data from the server.
 * Called during sync pull phase. Uses executeBatch for atomicity.
 */
export function upsertCategoriesFromServer(userId: string, categories: Category[]): void {
  const db = getDb()
  const now = new Date().toISOString()

  // Use executeSync in a manual transaction
  db.executeSync('BEGIN TRANSACTION')
  try {
    db.executeSync("DELETE FROM local_categories WHERE sync_status = 'synced'")

    for (const cat of categories) {
      db.executeSync(
        `INSERT INTO local_categories (local_id, server_id, user_id, name, parent_id, color, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
        [cat.id, cat.id, userId, cat.name, cat.parentId ?? null, cat.color ?? null, now],
      )
    }

    db.executeSync('COMMIT')
  } catch (e) {
    db.executeSync('ROLLBACK')
    throw e
  }
}

/**
 * Insert a category locally after successful server creation.
 */
export function insertLocalCategory(userId: string, cat: Category): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.executeSync(
    `INSERT OR REPLACE INTO local_categories (local_id, server_id, user_id, name, parent_id, color, sync_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'synced', ?)`,
    [cat.id, cat.id, userId, cat.name, cat.parentId ?? null, cat.color ?? null, now],
  )
}

/**
 * Update a category locally after successful server edit.
 */
export function updateLocalCategory(cat: Category): void {
  const db = getDb()
  const now = new Date().toISOString()
  db.executeSync(
    `UPDATE local_categories SET name = ?, parent_id = ?, color = ?, updated_at = ? WHERE server_id = ?`,
    [cat.name, cat.parentId ?? null, cat.color ?? null, now, cat.id],
  )
}

/**
 * Delete a category locally after successful server delete.
 */
export function deleteLocalCategory(id: string): void {
  const db = getDb()
  db.executeSync('DELETE FROM local_categories WHERE server_id = ?', [id])
}
