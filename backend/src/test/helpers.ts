import { buildApp } from '../app.js'
import type { FastifyInstance } from 'fastify'

export function buildTestApp(): FastifyInstance {
  return buildApp()
}

export async function registerAndLogin(app: FastifyInstance, email = 'test@test.com', password = 'password123') {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: { email, password },
  })
  return JSON.parse(res.body) as { token: string; user: { id: string; email: string } }
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}
