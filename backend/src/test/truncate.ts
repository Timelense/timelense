import { beforeEach } from 'vitest'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: 'postgresql://timelense:timelense@localhost:5433/timelense_test' })

beforeEach(async () => {
  await pool.query('TRUNCATE users CASCADE')
})
