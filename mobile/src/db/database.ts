/**
 * Core SQLite database module.
 *
 * Opens (or creates) the local database and ensures the schema is up to date.
 * All local data operations go through the singleton `db` handle exposed here.
 *
 * Uses `executeSync` throughout — the time tracker's queries are small and
 * synchronous access is simpler and faster for local-only operations.
 */
import { open, type DB } from '@op-engineering/op-sqlite'

const DB_NAME = 'timelense.db'

let _db: DB | null = null

/** Return the singleton DB handle — call `initDatabase()` first. */
export function getDb(): DB {
  if (!_db) throw new Error('Database not initialized — call initDatabase() first')
  return _db
}

/**
 * Open the database and run migrations.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export function initDatabase(): DB {
  if (_db) return _db

  _db = open({ name: DB_NAME })

  // Enable WAL mode for better concurrent read/write performance.
  _db.executeSync('PRAGMA journal_mode = WAL')
  _db.executeSync('PRAGMA foreign_keys = ON')

  runMigrations(_db)

  return _db
}

/**
 * Close the database handle. Used mainly for testing or cleanup.
 */
export function closeDatabase(): void {
  if (_db) {
    _db.close()
    _db = null
  }
}

/**
 * Drop all tables and recreate them. Used for recovering from corruption or full reset.
 */
export function resetDatabase(): void {
  const db = getDb()
  db.executeSync('DROP TABLE IF EXISTS local_tasks')
  db.executeSync('DROP TABLE IF EXISTS local_categories')
  db.executeSync('DROP TABLE IF EXISTS sync_queue')
  db.executeSync('DROP TABLE IF EXISTS sync_meta')
  db.executeSync('DROP TABLE IF EXISTS analytics_cache')
  db.executeSync('PRAGMA user_version = 0')
  runMigrations(db)
}

// ---------------------------------------------------------------------------
// Schema migrations
// ---------------------------------------------------------------------------

const CURRENT_VERSION = 1

function runMigrations(db: DB): void {
  const result = db.executeSync('PRAGMA user_version')
  const version = (result.rows?.[0]?.user_version as number) ?? 0

  if (version < 1) migrationV1(db)

  db.executeSync(`PRAGMA user_version = ${CURRENT_VERSION}`)
}

/** v1 — Initial schema: local_tasks, local_categories, sync_queue, sync_meta */
function migrationV1(db: DB): void {
  db.executeSync(`
    CREATE TABLE IF NOT EXISTS local_tasks (
      local_id     TEXT PRIMARY KEY,
      server_id    TEXT,
      user_id      TEXT NOT NULL,
      title        TEXT NOT NULL DEFAULT 'Untitled',
      category_id  TEXT,
      tag          TEXT NOT NULL DEFAULT 'neutral',
      notes        TEXT,
      started_at   TEXT NOT NULL,
      ended_at     TEXT,
      sync_status  TEXT NOT NULL DEFAULT 'pending_create',
      updated_at   TEXT NOT NULL,
      created_at   TEXT NOT NULL
    )
  `)

  db.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_user_started
      ON local_tasks(user_id, started_at)
  `)
  db.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_sync_status
      ON local_tasks(sync_status)
  `)
  db.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_tasks_server_id
      ON local_tasks(server_id)
  `)

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS local_categories (
      local_id     TEXT PRIMARY KEY,
      server_id    TEXT,
      user_id      TEXT NOT NULL,
      name         TEXT NOT NULL,
      parent_id    TEXT,
      color        TEXT,
      sync_status  TEXT NOT NULL DEFAULT 'synced',
      updated_at   TEXT NOT NULL
    )
  `)
  db.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_categories_server_id
      ON local_categories(server_id)
  `)

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      entity      TEXT NOT NULL,
      operation   TEXT NOT NULL,
      entity_id   TEXT NOT NULL,
      payload     TEXT,
      created_at  TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0,
      last_error  TEXT
    )
  `)
  db.executeSync(`
    CREATE INDEX IF NOT EXISTS idx_queue_created
      ON sync_queue(created_at)
  `)

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS sync_meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `)

  db.executeSync(`
    CREATE TABLE IF NOT EXISTS analytics_cache (
      cache_key   TEXT PRIMARY KEY,
      payload     TEXT NOT NULL,
      fetched_at  TEXT NOT NULL
    )
  `)
}
