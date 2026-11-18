import pg from 'pg';
import { env } from '../env.js';

async function main() {
  const url = new URL(env.databaseUrl);
  const dbName = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!dbName) throw new Error('DATABASE_URL-д датабаазын нэр байхгүй байна');

  const client = new pg.Client({ connectionString: env.adminDatabaseUrl });
  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (exists.rowCount) {
      console.log(`✓ Database "${dbName}" аль хэдийн байна`);
    } else {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✓ Database "${dbName}" үүслээ`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('✗ Database үүсгэхэд алдаа гарлаа:', error);
  process.exit(1);
});
