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
import { listTasks } from './tasks'
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

// ---- whole-list mutations (read → modify → save) ----------------------------
// All return the saved list and persist via saveMacros (optimistic local + PUT).

function plainMacros(): Macro[] {
  return readMacros()
}

/** Insert or update a macro by id, then save. */
export async function upsertMacro(macro: Macro): Promise<Macro[]> {
  const list = plainMacros()
  const idx = list.findIndex((m) => m.id === macro.id)
  const next = idx >= 0 ? list.map((m) => (m.id === macro.id ? macro : m)) : [...list, macro]
  return saveMacros(next)
}

/** Remove a macro by id, then save. */
export async function removeMacro(id: string): Promise<Macro[]> {
  return saveMacros(plainMacros().filter((m) => m.id !== id))
}

/** Pin / unpin a macro, then save. */
export async function setMacroPinned(id: string, pinned: boolean): Promise<Macro[]> {
  return saveMacros(plainMacros().map((m) => (m.id === id ? { ...m, pinned } : m)))
}

/** Move a macro one slot earlier (-1) or later (+1) in saved order, then save. */
export async function reorderMacro(id: string, dir: -1 | 1): Promise<Macro[]> {
  const list = plainMacros()
  const i = list.findIndex((m) => m.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return saveMacros(next)
}

/** Minutes logged against a macro (matched by title) over the last 7 days. */
export function macroWeekMinutes(macro: Pick<Macro, 'title'>): number {
  return macroDailyMinutes(macro, 7).reduce((a, b) => a + b, 0)
}

/**
 * Minutes logged against a macro (matched by title) for each of the last
 * `days` days, oldest first — used for the peek sparkline.
 */
export function macroDailyMinutes(macro: Pick<Macro, 'title'>, days = 5): number[] {
  const now = new Date()
  const from = new Date(now.getTime() - days * 86_400_000)
  const tasks = listTasks({ from: from.toISOString(), to: now.toISOString() })
  const buckets = new Array(days).fill(0) as number[]
  const startMs = from.getTime()
  for (const t of tasks) {
    if (t.title !== macro.title || !t.endedAt) continue
    const idx = Math.min(days - 1, Math.max(0, Math.floor((new Date(t.startedAt).getTime() - startMs) / 86_400_000)))
    buckets[idx] += Math.max(0, (new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 60_000)
  }
  return buckets.map((m) => Math.round(m))
}
