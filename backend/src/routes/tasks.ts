import type { FastifyInstance } from 'fastify'

export async function taskRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    // TODO: fetch tasks for authenticated user
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.post('/', async (request, reply) => {
    // TODO: create task entry
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.patch('/:id/stop', async (request, reply) => {
    // TODO: set endedAt for running task
    return reply.code(501).send({ message: 'Not implemented' })
  })

  app.delete('/:id', async (request, reply) => {
    // TODO: delete task entry
    return reply.code(501).send({ message: 'Not implemented' })
  })
}
