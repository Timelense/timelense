import { describe, it, expect } from 'vitest'
import { buildTestApp, registerAndLogin, authHeader } from './helpers.js'

describe('one-running-task invariant', () => {
  it('starting a second task auto-stops the first', async () => {
    const app = buildTestApp()
    const { token } = await registerAndLogin(app)

    await app.inject({ method: 'POST', url: '/tasks/start', headers: authHeader(token), payload: { title: 'Task A' } })
    const res = await app.inject({ method: 'POST', url: '/tasks/start', headers: authHeader(token), payload: { title: 'Task B' } })

    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.stoppedTask).toBeTruthy()
    expect(body.stoppedTask.title).toBe('Task A')
    expect(body.stoppedTask.endedAt).toBeTruthy()

    const current = await app.inject({ method: 'GET', url: '/tasks/current', headers: authHeader(token) })
    expect(JSON.parse(current.body).title).toBe('Task B')
  })

  it('stop an already-stopped task → 409', async () => {
    const app = buildTestApp()
    const { token } = await registerAndLogin(app)

    const start = await app.inject({ method: 'POST', url: '/tasks/start', headers: authHeader(token), payload: { title: 'Task A' } })
    const taskId = JSON.parse(start.body).task.id

    await app.inject({ method: 'PATCH', url: `/tasks/${taskId}/stop`, headers: authHeader(token) })
    const res = await app.inject({ method: 'PATCH', url: `/tasks/${taskId}/stop`, headers: authHeader(token) })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error).toBe('not_running')
  })
})

describe('task ownership', () => {
  it('user A cannot read user B\'s task — 404', async () => {
    const app = buildTestApp()
    const { token: tokenA } = await registerAndLogin(app, 'a@test.com')
    const { token: tokenB } = await registerAndLogin(app, 'b@test.com')

    const start = await app.inject({ method: 'POST', url: '/tasks/start', headers: authHeader(tokenA), payload: { title: 'Secret A' } })
    const taskId = JSON.parse(start.body).task.id

    const res = await app.inject({ method: 'PATCH', url: `/tasks/${taskId}/stop`, headers: authHeader(tokenB) })
    expect(res.statusCode).toBe(404)
  })

  it('user A cannot delete user B\'s task — 404', async () => {
    const app = buildTestApp()
    const { token: tokenA } = await registerAndLogin(app, 'a@test.com')
    const { token: tokenB } = await registerAndLogin(app, 'b@test.com')

    const start = await app.inject({ method: 'POST', url: '/tasks/start', headers: authHeader(tokenA), payload: { title: 'Secret A' } })
    const taskId = JSON.parse(start.body).task.id

    const res = await app.inject({ method: 'DELETE', url: `/tasks/${taskId}`, headers: authHeader(tokenB) })
    expect(res.statusCode).toBe(404)
  })
})

describe('edit validation', () => {
  it('endedAt before startedAt → 400', async () => {
    const app = buildTestApp()
    const { token } = await registerAndLogin(app)
    const start = await app.inject({ method: 'POST', url: '/tasks/start', headers: authHeader(token), payload: { title: 'T' } })
    const taskId = JSON.parse(start.body).task.id
    await app.inject({ method: 'PATCH', url: `/tasks/${taskId}/stop`, headers: authHeader(token) })
    const res = await app.inject({
      method: 'PATCH', url: `/tasks/${taskId}`, headers: authHeader(token),
      payload: { startedAt: '2026-01-01T12:00:00.000Z', endedAt: '2026-01-01T11:00:00.000Z' },
    })
    expect(res.statusCode).toBe(400)
  })
})
