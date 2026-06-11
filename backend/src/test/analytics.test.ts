import { describe, it, expect } from 'vitest'
import { calcScore, overlapMinutes } from '../lib/analytics.js'

describe('calcScore', () => {
  it('returns score rounded to nearest integer', () => {
    expect(calcScore(75, 25)).toBe(75)
    expect(calcScore(100, 0)).toBe(100)
    expect(calcScore(0, 100)).toBe(0)
    expect(calcScore(1, 2)).toBe(33) // 33.33... rounds to 33
    expect(calcScore(2, 1)).toBe(67) // 66.66... rounds to 67
  })

  it('returns null when denominator is zero', () => {
    expect(calcScore(0, 0)).toBeNull()
    expect(calcScore(0, 0)).toBeNull() // neutral-only time
  })
})

describe('overlapMinutes', () => {
  const r = (h: number, m = 0) => new Date(`2026-01-01T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`)

  it('full overlap returns full duration', () => {
    expect(overlapMinutes(r(9), r(10), r(8), r(11))).toBe(60)
  })

  it('partial overlap from the left', () => {
    expect(overlapMinutes(r(8), r(10), r(9), r(11))).toBe(60)
  })

  it('partial overlap from the right', () => {
    expect(overlapMinutes(r(9), r(11), r(8), r(10))).toBe(60)
  })

  it('no overlap returns 0', () => {
    expect(overlapMinutes(r(8), r(9), r(10), r(11))).toBe(0)
  })

  it('running task (no endedAt) uses current time for overlap', () => {
    const start = new Date(Date.now() - 5 * 60_000) // 5 min ago
    const rangeStart = new Date(Date.now() - 10 * 60_000)
    const rangeEnd = new Date(Date.now() + 10 * 60_000)
    const mins = overlapMinutes(start, null, rangeStart, rangeEnd)
    expect(mins).toBeGreaterThanOrEqual(4)
    expect(mins).toBeLessThanOrEqual(6)
  })

  it('floors partial minutes', () => {
    // 90 seconds = 1.5 min → floors to 1
    const s = new Date('2026-01-01T09:00:00.000Z')
    const e = new Date('2026-01-01T09:01:30.000Z')
    expect(overlapMinutes(s, e, s, e)).toBe(1)
  })
})
