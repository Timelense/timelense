import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { hashPassword } from '../lib/password.js'
import { users, categories, tasks } from './schema.js'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required')
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const db = drizzle(pool, { schema: { users, categories, tasks } })

// ---------------------------------------------------------------------------
// Demo data definitions
// ---------------------------------------------------------------------------

const DEMO_EMAIL = 'demo@timelense.app'
const DEMO_PASSWORD = 'demo1234'

const CATEGORY_DEFS = [
  { key: 'work',        name: 'Work',         color: '#4A90D9', parentKey: null },
  { key: 'deep_work',   name: 'Deep Work',    color: '#2C5282', parentKey: 'work' },
  { key: 'meetings',    name: 'Meetings',     color: '#63B3ED', parentKey: 'work' },
  { key: 'exercise',    name: 'Exercise',     color: '#48BB78', parentKey: null },
  { key: 'social',      name: 'Social Media', color: '#FC8181', parentKey: null },
  { key: 'chores',      name: 'Chores',       color: '#F6AD55', parentKey: null },
]

// Each entry: [categoryKey, tag, durationMinutes, startHour, startMinute, notes?]
// 30 days * ~3 entries/day ≈ 90 entries; some days have 2, some 4
const DAILY_PATTERNS: Array<Array<[string, 'productive' | 'non-productive' | 'neutral', number, number, number, string?]>> = [
  // Day 0
  [
    ['deep_work', 'productive', 90, 9, 0, 'Working on the new feature'],
    ['social', 'non-productive', 25, 12, 30],
    ['meetings', 'neutral', 45, 14, 0, 'Weekly sync'],
    ['exercise', 'productive', 40, 18, 0],
  ],
  // Day 1
  [
    ['deep_work', 'productive', 120, 8, 30],
    ['chores', 'neutral', 30, 11, 0],
    ['social', 'non-productive', 35, 20, 0, 'Evening scroll'],
  ],
  // Day 2
  [
    ['meetings', 'neutral', 60, 9, 0, 'Sprint planning'],
    ['work', 'productive', 75, 10, 15],
    ['exercise', 'productive', 50, 17, 30],
    ['chores', 'neutral', 20, 19, 0],
  ],
  // Day 3
  [
    ['deep_work', 'productive', 150, 9, 0, 'Architecture design doc'],
    ['meetings', 'neutral', 30, 14, 30, '1:1 with manager'],
    ['social', 'non-productive', 40, 21, 0],
  ],
  // Day 4
  [
    ['work', 'productive', 60, 8, 0],
    ['meetings', 'neutral', 90, 10, 0, 'All-hands meeting'],
    ['exercise', 'productive', 45, 17, 0],
    ['social', 'non-productive', 20, 22, 0],
  ],
  // Day 5
  [
    ['deep_work', 'productive', 180, 9, 0, 'Deep work session — no interruptions'],
    ['chores', 'neutral', 45, 15, 0, 'Grocery run and cooking'],
  ],
  // Day 6
  [
    ['exercise', 'productive', 60, 8, 0, 'Long run'],
    ['chores', 'neutral', 90, 11, 0, 'House cleaning'],
    ['social', 'non-productive', 60, 15, 0],
  ],
  // Day 7
  [
    ['deep_work', 'productive', 100, 9, 15, 'Code review and refactoring'],
    ['meetings', 'neutral', 45, 11, 30],
    ['work', 'productive', 50, 14, 0],
    ['social', 'non-productive', 30, 20, 30],
  ],
  // Day 8
  [
    ['work', 'productive', 80, 8, 45],
    ['meetings', 'neutral', 60, 11, 0, 'Client call'],
    ['exercise', 'productive', 35, 17, 30],
  ],
  // Day 9
  [
    ['deep_work', 'productive', 120, 8, 0, 'Building new API endpoints'],
    ['chores', 'neutral', 25, 12, 0],
    ['meetings', 'neutral', 30, 15, 0, 'Retrospective'],
    ['social', 'non-productive', 45, 21, 30, 'News and feeds'],
  ],
  // Day 10
  [
    ['exercise', 'productive', 55, 7, 30, 'Gym session'],
    ['deep_work', 'productive', 90, 10, 0],
    ['work', 'productive', 40, 14, 30],
  ],
  // Day 11
  [
    ['meetings', 'neutral', 120, 9, 0, 'Planning and grooming'],
    ['social', 'non-productive', 50, 13, 0],
    ['chores', 'neutral', 35, 18, 0],
  ],
  // Day 12
  [
    ['deep_work', 'productive', 90, 9, 30],
    ['exercise', 'productive', 40, 13, 0],
    ['meetings', 'neutral', 30, 15, 0],
    ['social', 'non-productive', 25, 21, 0],
  ],
  // Day 13
  [
    ['work', 'productive', 75, 8, 0, 'Bug fixes'],
    ['deep_work', 'productive', 120, 10, 15, 'Performance optimisation'],
    ['chores', 'neutral', 40, 18, 30],
  ],
  // Day 14
  [
    ['exercise', 'productive', 70, 8, 0, 'Weekend workout'],
    ['chores', 'neutral', 60, 10, 30, 'Laundry and tidying'],
    ['social', 'non-productive', 90, 14, 0, 'Catching up with friends online'],
  ],
  // Day 15
  [
    ['social', 'non-productive', 45, 10, 0],
    ['chores', 'neutral', 50, 12, 0],
    ['exercise', 'productive', 45, 16, 0],
    ['deep_work', 'productive', 60, 19, 0, 'Side project work'],
  ],
  // Day 16
  [
    ['deep_work', 'productive', 110, 9, 0, 'Writing technical documentation'],
    ['meetings', 'neutral', 45, 11, 30],
    ['work', 'productive', 55, 14, 0],
    ['social', 'non-productive', 20, 20, 0],
  ],
  // Day 17
  [
    ['work', 'productive', 90, 8, 30],
    ['exercise', 'productive', 30, 13, 0, 'Quick jog'],
    ['chores', 'neutral', 20, 17, 30],
  ],
  // Day 18
  [
    ['meetings', 'neutral', 90, 9, 0, 'Design review'],
    ['deep_work', 'productive', 80, 11, 30],
    ['social', 'non-productive', 40, 20, 30],
  ],
  // Day 19
  [
    ['deep_work', 'productive', 150, 8, 0, 'Feature implementation sprint'],
    ['meetings', 'neutral', 30, 14, 0, 'Standup and sync'],
    ['exercise', 'productive', 45, 17, 30],
    ['chores', 'neutral', 25, 20, 0],
  ],
  // Day 20
  [
    ['work', 'productive', 65, 9, 0, 'Deployment and monitoring'],
    ['social', 'non-productive', 30, 12, 0],
    ['meetings', 'neutral', 60, 14, 0, 'Post-launch review'],
  ],
  // Day 21
  [
    ['exercise', 'productive', 80, 7, 30, 'Long bike ride'],
    ['chores', 'neutral', 45, 11, 0],
    ['deep_work', 'productive', 90, 15, 0, 'Side project — new feature'],
    ['social', 'non-productive', 30, 20, 0],
  ],
  // Day 22
  [
    ['deep_work', 'productive', 120, 9, 0],
    ['work', 'productive', 45, 11, 30],
    ['meetings', 'neutral', 45, 14, 0, 'Team offsite planning'],
    ['social', 'non-productive', 35, 21, 0],
  ],
  // Day 23
  [
    ['chores', 'neutral', 30, 8, 30],
    ['work', 'productive', 70, 10, 0],
    ['exercise', 'productive', 40, 13, 0],
    ['meetings', 'neutral', 30, 15, 30],
  ],
  // Day 24
  [
    ['deep_work', 'productive', 100, 9, 0, 'Database optimisation'],
    ['social', 'non-productive', 55, 12, 0, 'Lunch break browsing'],
    ['work', 'productive', 60, 14, 15],
  ],
  // Day 25
  [
    ['meetings', 'neutral', 60, 9, 0, 'Sprint demo'],
    ['deep_work', 'productive', 90, 10, 30, 'Next sprint prep'],
    ['exercise', 'productive', 50, 17, 0, 'Evening run'],
    ['chores', 'neutral', 30, 20, 0],
  ],
  // Day 26
  [
    ['exercise', 'productive', 60, 8, 0],
    ['social', 'non-productive', 40, 11, 0],
    ['chores', 'neutral', 75, 14, 0, 'Meal prep for the week'],
  ],
  // Day 27
  [
    ['deep_work', 'productive', 90, 10, 0, 'Learning and research'],
    ['exercise', 'productive', 35, 15, 0],
    ['social', 'non-productive', 50, 19, 0],
    ['chores', 'neutral', 20, 21, 30],
  ],
  // Day 28
  [
    ['work', 'productive', 80, 8, 30],
    ['meetings', 'neutral', 45, 10, 30, 'Cross-team alignment'],
    ['deep_work', 'productive', 70, 13, 0],
    ['social', 'non-productive', 25, 21, 0],
  ],
  // Day 29
  [
    ['deep_work', 'productive', 120, 9, 0, 'Final feature polish'],
    ['meetings', 'neutral', 60, 11, 30, 'Release planning'],
    ['exercise', 'productive', 45, 17, 0],
  ],
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysAgo(n: number, hour: number, minute: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function seed() {
  console.log('Seeding database...')

  // Wipe existing demo user (cascade removes their categories + tasks)
  await db.delete(users).where(eq(users.email, DEMO_EMAIL))

  // Create demo user
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const [user] = await db.insert(users).values({ email: DEMO_EMAIL, passwordHash }).returning()
  console.log(`Created user: ${user.email}`)

  // Create categories (top-level first so we can resolve parentId)
  const catIdByKey: Record<string, string> = {}

  for (const def of CATEGORY_DEFS) {
    const parentId = def.parentKey ? catIdByKey[def.parentKey] : null
    const [cat] = await db
      .insert(categories)
      .values({ name: def.name, color: def.color, parentId: parentId ?? undefined, userId: user.id })
      .returning()
    catIdByKey[def.key] = cat.id
  }
  console.log(`Created ${CATEGORY_DEFS.length} categories`)

  // Create task entries
  let taskCount = 0
  for (let dayOffset = DAILY_PATTERNS.length - 1; dayOffset >= 0; dayOffset--) {
    const daysBack = DAILY_PATTERNS.length - 1 - dayOffset
    const pattern = DAILY_PATTERNS[dayOffset]

    for (const [catKey, tag, durationMinutes, startHour, startMinute, notes] of pattern) {
      const startedAt = daysAgo(daysBack, startHour, startMinute)
      const endedAt = new Date(startedAt.getTime() + durationMinutes * 60 * 1000)

      // Guard: don't let any entry cross midnight
      const midnight = new Date(startedAt)
      midnight.setHours(23, 59, 59, 999)
      const clampedEnd = endedAt > midnight ? midnight : endedAt

      await db.insert(tasks).values({
        userId: user.id,
        categoryId: catIdByKey[catKey],
        title: buildTitle(catKey),
        tag,
        notes,
        startedAt,
        endedAt: clampedEnd,
      })
      taskCount++
    }
  }

  console.log(`Created ${taskCount} task entries`)
  console.log('Done. Demo credentials: demo@timelense.app / demo1234')
}

function buildTitle(catKey: string): string {
  const titles: Record<string, string> = {
    deep_work: 'Deep work session',
    work: 'Work session',
    meetings: 'Meeting',
    exercise: 'Exercise',
    social: 'Social media',
    chores: 'Chores',
  }
  return titles[catKey] ?? 'Task'
}

seed()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => pool.end())
