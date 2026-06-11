import { describe, it, expect } from 'vitest'
import { buildTestApp, authHeader } from './helpers.js'

describe('auth', () => {
  it('register → 201 with token', async () => {
    const app = buildTestApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'a@test.com', password: 'password123' } })
    expect(res.statusCode).toBe(201)
    const body = JSON.parse(res.body)
    expect(body.token).toBeTruthy()
    expect(body.user.email).toBe('a@test.com')
  })

  it('duplicate register → 409', async () => {
    const app = buildTestApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'dup@test.com', password: 'password123' } })
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'dup@test.com', password: 'password123' } })
    expect(res.statusCode).toBe(409)
    expect(JSON.parse(res.body).error).toBe('email_taken')
  })

  it('login with wrong password → 401 with same message', async () => {
    const app = buildTestApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'b@test.com', password: 'password123' } })
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'b@test.com', password: 'wrongpass1' } })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error).toBe('invalid_credentials')
  })

  it('login with wrong email → same 401 message', async () => {
    const app = buildTestApp()
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'nobody@test.com', password: 'password123' } })
    expect(res.statusCode).toBe(401)
    expect(JSON.parse(res.body).error).toBe('invalid_credentials')
  })

  it('correct login → 200 + token', async () => {
    const app = buildTestApp()
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'c@test.com', password: 'password123' } })
    const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'c@test.com', password: 'password123' } })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).token).toBeTruthy()
  })

  it('missing token → 401', async () => {
    const app = buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/tasks/' })
    expect(res.statusCode).toBe(401)
  })

  it('garbage token → 401', async () => {
    const app = buildTestApp()
    const res = await app.inject({ method: 'GET', url: '/tasks/', headers: { Authorization: 'Bearer garbage' } })
    expect(res.statusCode).toBe(401)
  })

  it('validation error → 400 with details', async () => {
    const app = buildTestApp()
    const res = await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'bad', password: 'short' } })
    expect(res.statusCode).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toBe('validation_error')
    expect(Array.isArray(body.details)).toBe(true)
  })
})
