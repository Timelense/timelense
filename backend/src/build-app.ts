import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { ZodError } from 'zod'
import { authRoutes } from './routes/auth.js'
import { taskRoutes } from './routes/tasks.js'
import { categoryRoutes } from './routes/categories.js'
import { analyticsRoutes } from './routes/analytics.js'

export function buildApp() {
  const app = Fastify({ logger: true })

  app.register(cors, { origin: true })

  // Parse all request bodies as JSON regardless of the Content-Type header.
  // React Native's fetch defaults string bodies to `text/plain;charset=UTF-8`
  // and bodyless requests (e.g. PATCH /tasks/:id/stop) may still carry a
  // Content-Type — the default parsers reject both (415 / 400). This handler
  // treats an empty body as no body and JSON-parses anything non-empty.
  const jsonBodyParser = (
    req: { method?: string; url?: string; headers?: Record<string, unknown> },
    body: string,
    done: (err: Error | null, value?: unknown) => void,
  ): void => {
    if (body === '' || body == null) {
      done(null, undefined)
      return
    }
    try {
      done(null, JSON.parse(body))
    } catch (err) {
      ;(err as { statusCode?: number }).statusCode = 400
      done(err as Error, undefined)
    }
  }

  app.removeAllContentTypeParsers()
  app.addContentTypeParser('*', { parseAs: 'string' }, jsonBodyParser)

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
    const status = (error as { statusCode?: number }).statusCode ?? 500
    if (status < 500) {
      return reply.code(status).send({ error: error.message })
    }
    app.log.error(error)
    return reply.code(500).send({ error: 'internal_server_error' })
  })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(categoryRoutes, { prefix: '/categories' })
  app.register(taskRoutes, { prefix: '/tasks' })
  app.register(analyticsRoutes, { prefix: '/analytics' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
