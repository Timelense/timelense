import { execSync } from 'child_process'

// Runs once before all test files
const TEST_DB = 'postgresql://timelense:timelense@localhost:5433/timelense_test'

export async function setup() {
  // Create test DB if needed and run migrations
  execSync(
    `psql postgresql://timelense:timelense@localhost:5433/timelense -c "CREATE DATABASE timelense_test" 2>/dev/null || true`,
  )
  execSync('npm run db:migrate', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DB },
  })
}

export async function teardown() {}
