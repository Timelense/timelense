import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { authRoutes } from './routes/auth.js'
import { taskRoutes } from './routes/tasks.js'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })

  app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(taskRoutes, { prefix: '/tasks' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
