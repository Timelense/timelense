/**
 * Macros API — offline-first quick-start presets.
 *
 * The macro *set* (config) is cached locally in sync_meta and pushed to the
 * server with a whole-list PUT. Per-device *usage* (for frecency ordering) is
 * tracked separately and never synced — "what I use most on this phone".
 *
 * Reads are synchronous from the local cache so macros are available instantly
 * and offline at the critical Start/Stop moment.
 */
import { apiRequest } from './client'
import { getSyncMeta, setSyncMeta } from '../sync/syncMeta'
import type { Macro } from '@timelense/shared'

const MACROS_KEY = 'macros'
const USAGE_KEY = 'macro_usage'

export interface MacroWithUsage extends Macro {
  usageCount: number
  lastUsedAt: string | null
}

type UsageMap = Record<string, { count: number; lastUsedAt: string }>

function readMacros(): Macro[] {
  const raw = getSyncMeta(MACROS_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Macro[]) : []
  } catch {
    return []
  }
}

function readUsage(): UsageMap {
  const raw = getSyncMeta(USAGE_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as UsageMap
  } catch {
    return {}
  }
}

/** All macros (manage view), in saved order, with usage stats attached. */
export function getMacros(): MacroWithUsage[] {
  const usage = readUsage()
  return readMacros().map((m) => ({
    ...m,
    usageCount: usage[m.id]?.count ?? 0,
    lastUsedAt: usage[m.id]?.lastUsedAt ?? null,
  }))
}

// Frecency: usage count + an exponentially-decaying recency boost (~1-week
// half-life). Pinned macros always sort to the front, by their saved order.
function frecency(m: MacroWithUsage, now: number): number {
  if (m.pinned) return Number.MAX_SAFE_INTEGER - m.order
  const days = m.lastUsedAt ? (now - new Date(m.lastUsedAt).getTime()) / 86_400_000 : 9999
  const recencyBoost = Math.exp(-days / 7) * 5
  return m.usageCount + recencyBoost
}

/** Macros ordered for the quick-pick row (most relevant first). */
export function getQuickMacros(now: number = Date.now()): MacroWithUsage[] {
  return getMacros().sort((a, b) => frecency(b, now) - frecency(a, now))
}

/** Bump local usage for a macro after it's used (drives frecency ordering). */
export function recordMacroUse(id: string): void {
  const usage = readUsage()
  const cur = usage[id] ?? { count: 0, lastUsedAt: '' }
  usage[id] = { count: cur.count + 1, lastUsedAt: new Date().toISOString() }
  setSyncMeta(USAGE_KEY, JSON.stringify(usage))
}

/** Overwrite the local macro cache (used by the sync pull phase). */
export function cacheMacros(macros: Macro[]): void {
  setSyncMeta(MACROS_KEY, JSON.stringify(macros))
}

/**
 * Save the whole macro list: optimistically update the local cache, then PUT
 * to the server. Order is normalised to the array index. Requires connectivity;
 * on failure the local copy is kept and the error is re-thrown for the caller.
 */
export async function saveMacros(macros: Macro[]): Promise<Macro[]> {
  const normalized = macros.map((m, i) => ({ ...m, order: i }))
  cacheMacros(normalized) // optimistic
  const saved = await apiRequest<Macro[]>('/macros', 'PUT', { macros: normalized })
  cacheMacros(saved)
  return saved
}

/** Fetch macros from the server into the local cache. Called during sync pull. */
export async function pullMacros(): Promise<void> {
  const macros = await apiRequest<Macro[]>('/macros')
  cacheMacros(macros)
}

/** Generate a client-side id for a new macro. */
export function newMacroId(): string {
  return `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}
