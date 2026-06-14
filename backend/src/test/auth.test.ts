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

  it('forgot-password sends code for existing email', async () => {
    const app = buildTestApp()
    const email = 'reset@test.com'
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'oldpassword123' } })

    const res = await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.code).toHaveLength(6)
  })

  it('forgot-password returns success even if email does not exist', async () => {
    const app = buildTestApp()
    const res = await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email: 'nonexistent@test.com' } })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.success).toBe(true)
    expect(body.code).toBeUndefined()
  })

  it('reset-password updates password with correct code', async () => {
    const app = buildTestApp()
    const email = 'reset2@test.com'
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'oldpassword123' } })

    const forgotRes = await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email } })
    const { code } = JSON.parse(forgotRes.body)

    const resetRes = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { email, code, password: 'newpassword123' },
    })
    expect(resetRes.statusCode).toBe(200)
    expect(JSON.parse(resetRes.body).success).toBe(true)

    // Verify we can login with the new password
    const loginRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'newpassword123' },
    })
    expect(loginRes.statusCode).toBe(200)
    expect(JSON.parse(loginRes.body).token).toBeTruthy()

    // Verify we cannot login with the old password
    const loginOldRes = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'oldpassword123' },
    })
    expect(loginOldRes.statusCode).toBe(401)
  })

  it('reset-password fails with invalid code', async () => {
    const app = buildTestApp()
    const email = 'reset3@test.com'
    await app.inject({ method: 'POST', url: '/auth/register', payload: { email, password: 'oldpassword123' } })
    await app.inject({ method: 'POST', url: '/auth/forgot-password', payload: { email } })

    const resetRes = await app.inject({
      method: 'POST',
      url: '/auth/reset-password',
      payload: { email, code: '000000', password: 'newpassword123' },
    })
    expect(resetRes.statusCode).toBe(400)
    expect(JSON.parse(resetRes.body).error).toBe('invalid_or_expired_code')
  })
})
