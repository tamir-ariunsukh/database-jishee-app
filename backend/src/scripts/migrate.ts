import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../db.js';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const schemaPath = resolve(here, '../../../db/schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  console.log(`→ Applying ${schemaPath}`);
  await pool.query(sql);
  console.log('✓ Schema applied');
  await pool.end();
}

main().catch(async (error) => {
  console.error('✗ Migration failed:', error);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
