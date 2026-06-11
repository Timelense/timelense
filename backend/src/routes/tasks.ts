import type { FastifyInstance } from 'fastify'
import { authenticate } from '../plugins/auth.js'

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate)

  app.get('/', async (_request, reply) => {
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.post('/', async (_request, reply) => {
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.patch('/:id/stop', async (_request, reply) => {
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.delete('/:id', async (_request, reply) => {
    return reply.code(501).send({ message: 'Not implemented' })
  })
}
