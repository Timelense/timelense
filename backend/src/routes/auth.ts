import type { FastifyInstance } from 'fastify'

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (_request, reply) => {
    // TODO: validate body, hash password, insert user, return JWT
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.post('/login', async (_request, reply) => {
    // TODO: validate credentials, return JWT
    return reply.code(501).send({ message: 'Not implemented' })
  })
}
