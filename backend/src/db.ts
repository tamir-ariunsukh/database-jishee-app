import pg from 'pg';
import { env } from './env.js';

// Postgres returns `numeric` and `bigint` as strings. For a JSON API numbers are
// far more convenient, so we normalise them here (amounts in this app are small).
pg.types.setTypeParser(1700, (v: string | null) => (v === null ? null : Number(v))); // numeric
pg.types.setTypeParser(20, (v: string | null) => (v === null ? null : Number(v))); // int8

export const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: 12,
  idleTimeoutMillis: 30_000,
});

pool.on('error', (err) => {
  console.error('[db] unexpected idle client error', err);
});

export type Row = pg.QueryResultRow;

export async function query<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never[]);
}

export async function many<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows;
}

export async function one<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const res = await pool.query<T>(text, params as never[]);
  return res.rows[0] ?? null;
}

export async function withTransaction<T>(
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function toInt(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
