import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { userMacros, categories } from '../db/schema.js'
import { authenticate } from '../plugins/auth.js'
import type { Macro } from '@timelense/shared'

// No hard cap on how many a user can save — a generous safety limit only.
const MAX_MACROS = 50

const MacroSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(100),
  categoryId: z.string().uuid().nullable().default(null),
  tag: z.enum(['productive', 'non-productive', 'neutral']),
  order: z.number().int().min(0),
  pinned: z.boolean().optional(),
})

const PutBody = z.object({
  macros: z.array(MacroSchema).max(MAX_MACROS),
})

export async function macroRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  // GET /macros — the user's saved macros (empty array if none)
  app.get('/', async (request): Promise<Macro[]> => {
    const [row] = await db
      .select()
      .from(userMacros)
      .where(eq(userMacros.userId, request.userId))
    return row?.macros ?? []
  })

  // PUT /macros — replace the whole set. Categories that aren't owned by the
  // user are quietly cleared; order is normalised to the array index.
  app.put('/', async (request, reply) => {
    const body = PutBody.parse(request.body)

    const ownedRows = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.userId, request.userId))
    const owned = new Set(ownedRows.map((c) => c.id))

    const cleaned: Macro[] = body.macros.map((m, i) => ({
      id: m.id,
      title: m.title,
      categoryId: m.categoryId && owned.has(m.categoryId) ? m.categoryId : null,
      tag: m.tag,
      order: i,
      ...(m.pinned ? { pinned: true } : {}),
    }))

    await db
      .insert(userMacros)
      .values({ userId: request.userId, macros: cleaned, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userMacros.userId,
        set: { macros: cleaned, updatedAt: new Date() },
      })

    return reply.send(cleaned)
  })
}
