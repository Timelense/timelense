/**
 * Sync Status — React context providing sync state to the UI.
 *
 * Wraps the app and wires up the sync engine lifecycle to auth state.
 */
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { initDatabase, resetDatabase } from '../db/database'
import { checkDbHealth, updateCheckpointFromDb } from '../db/healthCheck'
import { deleteSyncMeta } from './syncMeta'
import {
  startSyncEngine,
  stopSyncEngine,
  subscribe,
  getSnapshot,
  scheduleSyncSoon,
  type SyncSnapshot,
} from './syncEngine'
import { useAuth } from '../contexts/auth'

interface SyncContextValue extends SyncSnapshot {
  /** Manually trigger a sync cycle. */
  triggerSync: () => void
  /** Whether the local DB has been initialized. */
  isDbReady: boolean
  /** Whether a full re-sync is needed (DB was wiped). */
  needsResync: boolean
}

const SyncContext = createContext<SyncContextValue | null>(null)

const DEFAULT_SNAPSHOT: SyncSnapshot = {
  isOnline: true,
  isSyncing: false,
  pendingOpsCount: 0,
  lastSyncedAt: null,
  lastError: null,
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn } = useAuth()
  const [snapshot, setSnapshot] = useState<SyncSnapshot>(DEFAULT_SNAPSHOT)
  const [isDbReady, setIsDbReady] = useState(false)
  const [needsResync, setNeedsResync] = useState(false)
  const initRef = useRef(false)

  // Initialize database on mount
  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    ;(async () => {
      try {
        await initDatabase()

        // Run health check
        let health = await checkDbHealth()

        if (health.status === 'db_corrupt') {
          console.warn('[SyncProvider] DB is corrupt! Resetting database...')
          resetDatabase()
          health = await checkDbHealth()
        }

        if (health.status === 'db_wiped') {
          console.warn(`[SyncProvider] DB health: ${health.status} — clearing pull meta for full re-sync`)
          deleteSyncMeta('last_pull_at')
          setNeedsResync(true)
        }

        setIsDbReady(true)
      } catch (err) {
        console.error('[SyncProvider] Failed to initialize database:', err)
      }
    })()
  }, [])

  // Start/stop sync engine based on auth state
  useEffect(() => {
    if (!isDbReady || !isSignedIn) {
      stopSyncEngine()
      return
    }

    // We need a userId — for now use a placeholder since the auth context
    // doesn't expose it. The sync engine will get it from the token.
    // TODO: expose userId from auth context
    startSyncEngine('current-user')

    const unsub = subscribe((s) => {
      setSnapshot(s)
      if (!s.isSyncing && s.lastSyncedAt && !s.lastError) {
        setNeedsResync(false)
      }
    })
    setSnapshot(getSnapshot())

    return () => {
      unsub()
      stopSyncEngine()
    }
  }, [isDbReady, isSignedIn])

  const triggerSync = useCallback(() => {
    scheduleSyncSoon()
  }, [])

  const value: SyncContextValue = {
    ...snapshot,
    triggerSync,
    isDbReady,
    needsResync,
  }

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  )
}

export function useSyncStatus(): SyncContextValue {
  const ctx = useContext(SyncContext)
  if (!ctx) throw new Error('useSyncStatus must be used within SyncProvider')
  return ctx
}
