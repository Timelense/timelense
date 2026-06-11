import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import type { AuthResponse } from '@timelense/shared'

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = RegisterBody.parse(request.body)

    const passwordHash = await hashPassword(body.password)

    try {
      const [user] = await db
        .insert(users)
        .values({ email: body.email, passwordHash })
        .returning()

      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' })
      const response: AuthResponse = { token, user: { id: user.id, email: user.email } }
      return reply.code(201).send(response)
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'email_taken' })
      }
      throw err
    }
  })

  app.post('/login', async (request, reply) => {
    const body = LoginBody.parse(request.body)

    const [user] = await db.select().from(users).where(eq(users.email, body.email))

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' })
    const response: AuthResponse = { token, user: { id: user.id, email: user.email } }
    return reply.code(200).send(response)
  })
}
