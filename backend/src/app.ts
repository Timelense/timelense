import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ZodError } from 'zod'
import { authRoutes } from './routes/auth.js'
import { taskRoutes } from './routes/tasks.js'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })

  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  // Must be declared before routes so all route handlers can set it
  app.decorateRequest('userId', '')

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({
        error: 'validation_error',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      })
    }
    app.log.error(error)
    return reply.code(500).send({ error: 'internal_server_error' })
  })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(taskRoutes, { prefix: '/tasks' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
