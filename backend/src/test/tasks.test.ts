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

describe('batch sync', () => {
  it('processes batch operations (create, update, stop, delete) successfully', async () => {
    const app = buildTestApp()
    const { token } = await registerAndLogin(app)

    // 1. Send a batch of create operations
    const resSync = await app.inject({
      method: 'POST',
      url: '/tasks/sync',
      headers: authHeader(token),
      payload: {
        operations: [
          {
            op: 'create',
            tempId: 'local-uuid-1',
            data: { title: 'Batch Task A', tag: 'productive', startedAt: '2026-06-14T08:00:00.000Z', endedAt: '2026-06-14T08:30:00.000Z' },
          },
          {
            op: 'create',
            tempId: 'local-uuid-2',
            data: { title: 'Batch Task B', tag: 'neutral', startedAt: '2026-06-14T09:00:00.000Z' },
          },
        ],
      },
    })

    expect(resSync.statusCode).toBe(200)
    const syncResult = JSON.parse(resSync.body)
    expect(syncResult.results).toHaveLength(2)
    expect(syncResult.results[0].status).toBe('created')
    expect(syncResult.results[0].tempId).toBe('local-uuid-1')
    expect(syncResult.results[1].status).toBe('created')
    expect(syncResult.results[1].tempId).toBe('local-uuid-2')

    const serverIdA = syncResult.results[0].serverId
    const serverIdB = syncResult.results[1].serverId

    // 2. Perform stop, update, and delete in a subsequent batch
    const resSync2 = await app.inject({
      method: 'POST',
      url: '/tasks/sync',
      headers: authHeader(token),
      payload: {
        operations: [
          {
            op: 'stop',
            id: serverIdB,
            data: { endedAt: '2026-06-14T09:30:00.000Z' },
          },
          {
            op: 'update',
            id: serverIdB,
            data: { title: 'Updated Batch Task B', notes: 'Done with some notes' },
          },
          {
            op: 'delete',
            id: serverIdA,
          },
        ],
      },
    })

    expect(resSync2.statusCode).toBe(200)
    const syncResult2 = JSON.parse(resSync2.body)
    expect(syncResult2.results).toHaveLength(3)
    expect(syncResult2.results[0].status).toBe('stopped')
    expect(syncResult2.results[1].status).toBe('updated')
    expect(syncResult2.results[2].status).toBe('deleted')

    // 3. Verify on server that Task A is deleted and Task B has the updated name
    const listRes = await app.inject({
      method: 'GET',
      url: '/tasks/',
      headers: authHeader(token),
    })
    const tasks = JSON.parse(listRes.body)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].id).toBe(serverIdB)
    expect(tasks[0].title).toBe('Updated Batch Task B')
    expect(tasks[0].notes).toBe('Done with some notes')
  })
})
