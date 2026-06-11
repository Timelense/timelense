import { eq, and, or, lte, gte, isNull, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { tasks, categories } from '../db/schema.js'
import { authenticate } from '../plugins/auth.js'
import type { TaskEntry, StartTaskResponse } from '@timelense/shared'

const PRODUCTIVE_TAG = ['productive', 'non-productive', 'neutral'] as const

const StartBody = z.object({
  title: z.string().min(1).max(255),
  categoryId: z.string().uuid().optional(),
  tag: z.enum(PRODUCTIVE_TAG).optional().default('neutral'),
  notes: z.string().optional(),
})

const EditBody = z.object({
  title: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  tag: z.enum(PRODUCTIVE_TAG).optional(),
  notes: z.string().nullable().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
})

const ListQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  categoryId: z.string().uuid().optional(),
  tag: z.enum(PRODUCTIVE_TAG).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /tasks/current — running task or null (registered before /:id)
  app.get('/current', async (request): Promise<TaskEntry | null> => {
    const [row] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, request.userId), isNull(tasks.endedAt)))
    return row ? toEntry(row) : null
  })

  // GET /tasks — list with optional filters
  app.get('/', async (request): Promise<TaskEntry[]> => {
    const q = ListQuery.parse(request.query)

    const conditions = [eq(tasks.userId, request.userId)]

    if (q.from) {
      // entry ends after (or is still running past) the range start
      conditions.push(or(gte(tasks.endedAt, new Date(q.from)), isNull(tasks.endedAt))!)
    }
    if (q.to) {
      // entry starts before the range end
      conditions.push(lte(tasks.startedAt, new Date(q.to)))
    }
    if (q.categoryId) conditions.push(eq(tasks.categoryId, q.categoryId))
    if (q.tag) conditions.push(eq(tasks.tag, q.tag))

    const rows = await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.startedAt))
      .limit(q.limit)
      .offset(q.offset)

    return rows.map(toEntry)
  })

  // POST /tasks/start — auto-stops any running task then creates a new one
  app.post('/start', async (request, reply) => {
    const body = StartBody.parse(request.body)

    if (body.categoryId) {
      const err = await validateCategoryOwnership(body.categoryId, request.userId)
      if (err) return reply.code(400).send({ error: err })
    }

    let stoppedTask: TaskEntry | undefined

    // Stop the current running task if any
    const [running] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.userId, request.userId), isNull(tasks.endedAt)))

    if (running) {
      const [stopped] = await db
        .update(tasks)
        .set({ endedAt: sql`now()` })
        .where(eq(tasks.id, running.id))
        .returning()
      stoppedTask = toEntry(stopped)
    }

    const [newTask] = await db
      .insert(tasks)
      .values({
        userId: request.userId,
        categoryId: body.categoryId,
        title: body.title,
        tag: body.tag,
        notes: body.notes,
      })
      .returning()

    const response: StartTaskResponse = { task: toEntry(newTask), stoppedTask }
    return reply.code(201).send(response)
  })

  // PATCH /tasks/:id/stop
  app.patch('/:id/stop', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await findOwned(id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (existing.endedAt !== null) return reply.code(409).send({ error: 'not_running' })

    const [updated] = await db
      .update(tasks)
      .set({ endedAt: sql`now()` })
      .where(eq(tasks.id, id))
      .returning()

    return reply.send(toEntry(updated))
  })

  // PATCH /tasks/:id — manual edit
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = EditBody.parse(request.body)

    const existing = await findOwned(id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    if (body.categoryId) {
      const err = await validateCategoryOwnership(body.categoryId, request.userId)
      if (err) return reply.code(400).send({ error: err })
    }

    // Resolve effective start/end for validation
    const startedAt = body.startedAt ? new Date(body.startedAt) : existing.startedAt
    const endedAt = body.endedAt !== undefined
      ? (body.endedAt ? new Date(body.endedAt) : null)
      : existing.endedAt

    if (endedAt !== null) {
      if (endedAt <= startedAt) {
        return reply.code(400).send({ error: 'endedAt must be after startedAt' })
      }
      const durationMs = endedAt.getTime() - startedAt.getTime()
      if (durationMs > 24 * 60 * 60 * 1000) {
        return reply.code(400).send({ error: 'duration exceeds 24 hours' })
      }
    }

    const [updated] = await db
      .update(tasks)
      .set({
        ...(body.title !== undefined && { title: body.title }),
        ...(body.categoryId !== undefined && { categoryId: body.categoryId }),
        ...(body.tag !== undefined && { tag: body.tag }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.startedAt !== undefined && { startedAt }),
        ...(body.endedAt !== undefined && { endedAt }),
      })
      .where(and(eq(tasks.id, id), eq(tasks.userId, request.userId)))
      .returning()

    return reply.send(toEntry(updated))
  })

  // DELETE /tasks/:id
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await findOwned(id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, request.userId)))
    return reply.code(204).send()
  })
}

// ---- helpers ----------------------------------------------------------------

async function findOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)))
  return row ?? null
}

async function validateCategoryOwnership(categoryId: string, userId: string): Promise<string | null> {
  const [cat] = await db.select().from(categories).where(eq(categories.id, categoryId))
  if (!cat) return 'category_not_found'
  if (cat.userId !== userId) return 'category_not_found'
  return null
}

function toEntry(r: typeof tasks.$inferSelect): TaskEntry {
  return {
    id: r.id,
    title: r.title,
    categoryId: r.categoryId ?? null,
    tag: r.tag as TaskEntry['tag'],
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt?.toISOString() ?? null,
    notes: r.notes ?? undefined,
    userId: r.userId,
  }
}
