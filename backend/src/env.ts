import 'dotenv/config';

function required(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value) {
    console.warn(`[env] ${name} is not set, falling back to default value`);
    return fallback;
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  databaseUrl: required(
    'DATABASE_URL',
    'postgres://postgres:postgres@localhost:5432/delivery_app',
  ),
  adminDatabaseUrl: required(
    'ADMIN_DATABASE_URL',
    'postgres://postgres:postgres@localhost:5432/postgres',
  ),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
};
