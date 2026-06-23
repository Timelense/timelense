import { eq, and, or, lte, gte, isNull, desc, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { tasks, categories } from '../db/schema.js'
import { authenticate } from '../plugins/auth.js'
import type { TaskEntry, StartTaskResponse } from '@timelense/shared'

const PRODUCTIVE_TAG = ['productive', 'non-productive', 'neutral'] as const

const StartBody = z.object({
  // Title is optional at start: the timer-first flow asks for details on stop.
  title: z.string().min(1).max(255).optional().default('Untitled'),
  categoryId: z.string().uuid().optional(),
  tag: z.enum(PRODUCTIVE_TAG).optional().default('neutral'),
  notes: z.string().optional(),
  // Manual backfill: when the client supplies explicit times (typically a
  // completed entry with both startedAt + endedAt), we honor them instead of
  // starting a live timer at now().
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
})

const EditBody = z.object({
  title: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  tag: z.enum(PRODUCTIVE_TAG).optional(),
  notes: z.string().nullable().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().nullable().optional(),
})

const StopBody = z.object({
  endedAt: z.string().datetime().optional(),
})

const ListQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  categoryId: z.string().uuid().optional(),
  tag: z.enum(PRODUCTIVE_TAG).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  updatedSince: z.string().datetime().optional(),
})

const SyncOp = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('create'),
    tempId: z.string(),
    data: z.object({
      title: z.string().min(1).max(255).optional().default('Untitled'),
      categoryId: z.string().uuid().optional(),
      tag: z.enum(PRODUCTIVE_TAG).optional().default('neutral'),
      startedAt: z.string().datetime().optional(),
      endedAt: z.string().datetime().optional(),
      notes: z.string().optional(),
    }),
  }),
  z.object({
    op: z.literal('update'),
    id: z.string().uuid(),
    data: z.object({
      title: z.string().min(1).max(255).optional(),
      categoryId: z.string().uuid().nullable().optional(),
      tag: z.enum(PRODUCTIVE_TAG).optional(),
      notes: z.string().nullable().optional(),
      startedAt: z.string().datetime().optional(),
      endedAt: z.string().datetime().nullable().optional(),
    }),
  }),
  z.object({
    op: z.literal('stop'),
    id: z.string().uuid(),
    data: z.object({
      endedAt: z.string().datetime().optional(),
    }).optional(),
  }),
  z.object({
    op: z.literal('delete'),
    id: z.string().uuid(),
  }),
])

const SyncBody = z.object({
  operations: z.array(SyncOp),
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
    if (q.updatedSince) {
      conditions.push(gte(tasks.updatedAt, new Date(q.updatedSince)))
    }

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

    // A manual backfill entry is one that arrives already completed (endedAt
    // set). It must not disturb a live timer, so we skip the auto-stop and
    // insert it with the supplied times.
    const isManual = body.endedAt != null
    const startedAt = body.startedAt ? new Date(body.startedAt) : undefined
    const endedAt = body.endedAt ? new Date(body.endedAt) : undefined

    if (startedAt && endedAt) {
      if (endedAt <= startedAt) {
        return reply.code(400).send({ error: 'endedAt must be after startedAt' })
      }
      if (endedAt.getTime() - startedAt.getTime() > 24 * 60 * 60 * 1000) {
        return reply.code(400).send({ error: 'duration exceeds 24 hours' })
      }
    }

    let stoppedTask: TaskEntry | undefined

    // Stop the current running task if any — but not for manual backfill entries.
    if (!isManual) {
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
    }

    const [newTask] = await db
      .insert(tasks)
      .values({
        userId: request.userId,
        categoryId: body.categoryId,
        title: body.title,
        tag: body.tag,
        notes: body.notes,
        ...(startedAt && { startedAt }),
        ...(endedAt && { endedAt }),
      })
      .returning()

    const response: StartTaskResponse = { task: toEntry(newTask), stoppedTask }
    return reply.code(201).send(response)
  })

  // PATCH /tasks/:id/stop
  app.patch('/:id/stop', async (request, reply) => {
    const { id } = request.params as { id: string }
    // The client may report the actual stop time (it can differ from now()
    // when the stop was recorded offline and synced later). Honor it; fall
    // back to server now() when absent.
    const body = StopBody.parse(request.body ?? {})

    const existing = await findOwned(id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })
    if (existing.endedAt !== null) return reply.code(409).send({ error: 'not_running' })

    const endedAt = body.endedAt ? new Date(body.endedAt) : undefined
    if (endedAt && endedAt <= existing.startedAt) {
      return reply.code(400).send({ error: 'endedAt must be after startedAt' })
    }

    const [updated] = await db
      .update(tasks)
      .set({ endedAt: endedAt ?? sql`now()`, updatedAt: sql`now()` })
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
        updatedAt: sql`now()`,
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

  // POST /tasks/sync — batch sync endpoint
  app.post('/sync', async (request, reply) => {
    const { operations } = SyncBody.parse(request.body)
    const results = []

    for (const op of operations) {
      try {
        if (op.op === 'create') {
          if (op.data.categoryId) {
            const err = await validateCategoryOwnership(op.data.categoryId, request.userId)
            if (err) {
              results.push({ tempId: op.tempId, status: 'error', error: err })
              continue
            }
          }

          const [newTask] = await db
            .insert(tasks)
            .values({
              userId: request.userId,
              categoryId: op.data.categoryId,
              title: op.data.title,
              tag: op.data.tag,
              notes: op.data.notes,
              startedAt: op.data.startedAt ? new Date(op.data.startedAt) : undefined,
              endedAt: op.data.endedAt ? new Date(op.data.endedAt) : undefined,
              updatedAt: new Date(),
            })
            .returning()

          results.push({ tempId: op.tempId, serverId: newTask.id, status: 'created' })
        } else if (op.op === 'stop') {
          const existing = await findOwned(op.id, request.userId)
          if (!existing) {
            results.push({ id: op.id, status: 'error', error: 'not_found' })
            continue
          }
          if (existing.endedAt !== null) {
            results.push({ id: op.id, status: 'stopped' })
            continue
          }

          const endedAt = op.data?.endedAt ? new Date(op.data.endedAt) : new Date()
          await db
            .update(tasks)
            .set({ endedAt, updatedAt: sql`now()` })
            .where(eq(tasks.id, op.id))

          results.push({ id: op.id, status: 'stopped' })
        } else if (op.op === 'update') {
          const existing = await findOwned(op.id, request.userId)
          if (!existing) {
            results.push({ id: op.id, status: 'error', error: 'not_found' })
            continue
          }

          if (op.data.categoryId) {
            const err = await validateCategoryOwnership(op.data.categoryId, request.userId)
            if (err) {
              results.push({ id: op.id, status: 'error', error: err })
              continue
            }
          }

          const startedAt = op.data.startedAt ? new Date(op.data.startedAt) : existing.startedAt
          const endedAt = op.data.endedAt !== undefined
            ? (op.data.endedAt ? new Date(op.data.endedAt) : null)
            : existing.endedAt

          if (endedAt !== null && endedAt <= startedAt) {
            results.push({ id: op.id, status: 'error', error: 'endedAt must be after startedAt' })
            continue
          }

          await db
            .update(tasks)
            .set({
              ...(op.data.title !== undefined && { title: op.data.title }),
              ...(op.data.categoryId !== undefined && { categoryId: op.data.categoryId }),
              ...(op.data.tag !== undefined && { tag: op.data.tag }),
              ...(op.data.notes !== undefined && { notes: op.data.notes }),
              ...(op.data.startedAt !== undefined && { startedAt }),
              ...(op.data.endedAt !== undefined && { endedAt }),
              updatedAt: sql`now()`,
            })
            .where(eq(tasks.id, op.id))

          results.push({ id: op.id, status: 'updated' })
        } else if (op.op === 'delete') {
          const existing = await findOwned(op.id, request.userId)
          if (!existing) {
            results.push({ id: op.id, status: 'deleted' })
            continue
          }

          await db.delete(tasks).where(eq(tasks.id, op.id))
          results.push({ id: op.id, status: 'deleted' })
        }
      } catch (err) {
        results.push({
          status: 'error',
          error: err instanceof Error ? err.message : 'unknown',
        })
      }
    }

    return reply.send({
      results,
      serverTime: new Date().toISOString(),
    })
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
