import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      DATABASE_URL: 'postgresql://timelense:timelense@localhost:5433/timelense_test',
      JWT_SECRET: 'test-secret',
    },
    globalSetup: './src/test/setup.ts',
    setupFiles: ['./src/test/truncate.ts'],
    fileParallelism: false,
    pool: 'forks',
  },
})
