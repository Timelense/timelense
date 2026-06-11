import type { FastifyRequest, FastifyReply } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    userId: string
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string }
    user: { sub: string }
  }
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
    request.userId = request.user.sub
  } catch {
    reply.code(401).send({ error: 'unauthorized' })
  }
}
