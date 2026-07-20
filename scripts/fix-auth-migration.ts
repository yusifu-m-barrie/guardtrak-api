import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  await pool.query(
    `DROP INDEX IF EXISTS "refresh_sessions_tokenHash_idx"`,
  );
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "refresh_sessions_tokenHash_key" ON "refresh_sessions"("tokenHash")`,
  );
  console.log('refresh_sessions unique tokenHash ensured');
}

main()
  .catch(console.error)
  .finally(() => pool.end());
