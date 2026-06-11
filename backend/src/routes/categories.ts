import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { categories } from '../db/schema.js'
import { authenticate } from '../plugins/auth.js'
import type { Category } from '@timelense/shared'

const CategoryBody = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().uuid().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a hex color like #A3C9F1').optional(),
})

const PatchCategoryBody = CategoryBody.partial()

export async function categoryRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /categories — flat list owned by the user
  app.get('/', async (request): Promise<Category[]> => {
    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.userId, request.userId))

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentId: r.parentId ?? undefined,
      color: r.color ?? undefined,
    }))
  })

  // POST /categories
  app.post('/', async (request, reply) => {
    const body = CategoryBody.parse(request.body)

    if (body.parentId) {
      const err = await validateParent(body.parentId, request.userId)
      if (err) return reply.code(400).send({ error: err })
    }

    const [cat] = await db
      .insert(categories)
      .values({
        name: body.name,
        parentId: body.parentId,
        color: body.color,
        userId: request.userId,
      })
      .returning()

    return reply.code(201).send(toCategory(cat))
  })

  // PATCH /categories/:id
  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = PatchCategoryBody.parse(request.body)

    const existing = await findOwned(id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    if (body.parentId !== undefined) {
      if (body.parentId === id) {
        return reply.code(400).send({ error: 'category cannot be its own parent' })
      }
      if (body.parentId) {
        const err = await validateParent(body.parentId, request.userId)
        if (err) return reply.code(400).send({ error: err })
      }
    }

    const [updated] = await db
      .update(categories)
      .set({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.color !== undefined && { color: body.color }),
        // null clears parentId; undefined means no change
        ...(body.parentId !== undefined && { parentId: body.parentId || null }),
      })
      .where(and(eq(categories.id, id), eq(categories.userId, request.userId)))
      .returning()

    return reply.send(toCategory(updated))
  })

  // DELETE /categories/:id — DB FK (onDelete: set null) re-parents children automatically
  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const existing = await findOwned(id, request.userId)
    if (!existing) return reply.code(404).send({ error: 'not_found' })

    await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, request.userId)))

    return reply.code(204).send()
  })
}

// ---- helpers ----------------------------------------------------------------

async function findOwned(id: string, userId: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
  return row ?? null
}

async function validateParent(parentId: string, userId: string): Promise<string | null> {
  const [parent] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, parentId))

  if (!parent) return 'parent_not_found'
  if (parent.userId !== userId) return 'parent_not_found' // same message — don't reveal existence
  if (parent.parentId) return 'max_depth_exceeded'        // parent itself has a parent → depth 3+
  return null
}

function toCategory(r: typeof categories.$inferSelect): Category {
  return {
    id: r.id,
    name: r.name,
    parentId: r.parentId ?? undefined,
    color: r.color ?? undefined,
  }
}
