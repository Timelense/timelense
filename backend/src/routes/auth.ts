import crypto from 'crypto'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import type { FastifyInstance } from 'fastify'
import { db } from '../db/index.js'
import { users } from '../db/schema.js'
import { hashPassword, verifyPassword } from '../lib/password.js'
import { sendPasswordResetEmail } from '../lib/email.js'
import type { AuthResponse } from '@timelense/shared'

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const ForgotPasswordBody = z.object({
  email: z.string().email(),
})

const ResetPasswordBody = z.object({
  email: z.string().email(),
  code: z.string().length(6, 'Reset code must be exactly 6 digits'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export async function authRoutes(app: FastifyInstance) {
  app.post('/register', async (request, reply) => {
    const body = RegisterBody.parse(request.body)

    const passwordHash = await hashPassword(body.password)

    try {
      const [user] = await db
        .insert(users)
        .values({ email: body.email, passwordHash })
        .returning()

      const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' })
      const response: AuthResponse = { token, user: { id: user.id, email: user.email } }
      return reply.code(201).send(response)
    } catch (err: any) {
      if (err.code === '23505') {
        return reply.code(409).send({ error: 'email_taken' })
      }
      throw err
    }
  })

  app.post('/login', async (request, reply) => {
    const body = LoginBody.parse(request.body)

    const [user] = await db.select().from(users).where(eq(users.email, body.email))

    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'invalid_credentials' })
    }

    const token = app.jwt.sign({ sub: user.id }, { expiresIn: '30d' })
    const response: AuthResponse = { token, user: { id: user.id, email: user.email } }
    return reply.code(200).send(response)
  })

  app.post('/forgot-password', async (request, reply) => {
    const body = ForgotPasswordBody.parse(request.body)
    const email = body.email.toLowerCase().trim()

    const [user] = await db.select().from(users).where(eq(users.email, email))

    // Always return success even if user not found to prevent email enumeration
    if (!user) {
      return reply.code(200).send({ success: true, message: 'If the email exists, a reset code has been sent.' })
    }

    // Generate a secure 6-digit numeric OTP code
    const code = crypto.randomInt(100000, 999999).toString()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

    // Store in DB
    await db
      .update(users)
      .set({
        resetPasswordToken: code,
        resetPasswordExpiresAt: expiresAt,
      })
      .where(eq(users.id, user.id))

    // Send email
    await sendPasswordResetEmail(user.email, code)

    // For ease of development/testing, if resend API key is not configured, we also return the code
    const devCode = !process.env.RESEND_API_KEY ? code : undefined

    return reply.code(200).send({
      success: true,
      message: 'If the email exists, a reset code has been sent.',
      ...(devCode ? { code: devCode } : {}),
    })
  })

  app.post('/reset-password', async (request, reply) => {
    const body = ResetPasswordBody.parse(request.body)
    const email = body.email.toLowerCase().trim()

    const [user] = await db.select().from(users).where(eq(users.email, email))

    if (!user || !user.resetPasswordToken || !user.resetPasswordExpiresAt) {
      return reply.code(400).send({ error: 'invalid_or_expired_code' })
    }

    const now = new Date()
    if (now > user.resetPasswordExpiresAt) {
      return reply.code(400).send({ error: 'invalid_or_expired_code' })
    }

    if (user.resetPasswordToken !== body.code) {
      return reply.code(400).send({ error: 'invalid_or_expired_code' })
    }

    // Hash new password and update user, clearing the token fields
    const passwordHash = await hashPassword(body.password)
    await db
      .update(users)
      .set({
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      })
      .where(eq(users.id, user.id))

    return reply.code(200).send({ success: true })
  })
}
