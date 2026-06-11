import 'dotenv/config'
// Side-effect import: Vercel's Fastify detection requires the entrypoint file
// to import 'fastify' directly.
import 'fastify'
import { buildApp } from './build-app.js'

// Vercel's zero-config Fastify support detects this file as the entrypoint
// (src/app.* would take priority, hence the build-app.ts filename) and
// intercepts listen(). Locally this runs as a normal long-lived server.
const app = buildApp()
const port = Number(process.env.PORT ?? 3000)

app.listen({ port, host: '0.0.0.0' }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})
