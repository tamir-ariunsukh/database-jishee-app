import app from './app.js';
import { pool } from './db.js';
import { env } from './env.js';

const server = app.listen(env.port, () => {
  console.log(`\n🍔 Delivery API listening on http://localhost:${env.port}`);
  console.log(`   health: http://localhost:${env.port}/api/health\n`);
});

const shutdown = async (signal: string) => {
  console.log(`\n[api] ${signal} received, shutting down...`);
  server.close(async () => {
    await pool.end().catch(() => undefined);
    process.exit(0);
  });
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
