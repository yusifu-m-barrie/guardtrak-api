import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const code = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='organisations' AND column_name='code'`,
  );
  console.log('code col', code.rows);

  const purpose = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name='password_reset_tokens' AND column_name='purpose'`,
  );
  console.log('purpose col', purpose.rows);

  const indexes = await pool.query(
    `SELECT indexname FROM pg_indexes WHERE tablename IN ('organisations','refresh_sessions','password_reset_tokens') ORDER BY indexname`,
  );
  console.log(
    'indexes',
    indexes.rows.map((r) => r.indexname),
  );
}

main()
  .catch(console.error)
  .finally(() => pool.end());
