import cors from 'cors';
import express, { type ErrorRequestHandler } from 'express';
import morgan from 'morgan';
import { pool } from './db.js';
import { env } from './env.js';
import { ApiError } from './lib/http.js';
import { optionalAuth } from './middleware/auth.js';

import addressRoutes from './routes/addresses.js';
import authRoutes from './routes/auth.js';
import cartsRoutes from './routes/carts.js';
import catalogExtrasRoutes from './routes/catalogExtras.js';
import categoriesRoutes from './routes/categories.js';
import couponsRoutes from './routes/coupons.js';
import deliveriesRoutes from './routes/deliveries.js';
import driversRoutes from './routes/drivers.js';
import favoritesRoutes from './routes/favorites.js';
import ordersRoutes from './routes/orders.js';
import paymentsRoutes from './routes/payments.js';
import productsRoutes from './routes/products.js';
import restaurantsRoutes from './routes/restaurants.js';
import reviewsRoutes from './routes/reviews.js';
import statsRoutes from './routes/stats.js';

const app = express();

app.disable('x-powered-by');
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.corsOrigin.includes(origin) || env.corsOrigin.includes('*')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
if (env.nodeEnv !== 'test') app.use(morgan('dev'));
app.use(optionalAuth);

app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT 1 AS ok');
    res.json({ status: 'ok', db: result.rows[0]?.ok === 1, uptime: process.uptime() });
  } catch (error) {
    res.status(503).json({ status: 'error', message: (error as Error).message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/restaurants', restaurantsRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/cart', cartsRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/drivers', driversRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/coupons', couponsRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/admin', statsRoutes);
// nested catalog endpoints (/products/:id/option-groups, /restaurants/:id/hours, /option-groups/...)
app.use('/api', catalogExtrasRoutes);

app.use((req, res) => {
  res.status(404).json({ message: `Endpoint олдсонгүй: ${req.method} ${req.originalUrl}` });
});

interface PgError extends Error {
  code?: string;
  detail?: string;
}

const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message, details: err.details });
    return;
  }

  const pgError = err as PgError;
  if (pgError.code === '23505') {
    res.status(409).json({ message: 'Ижил утга бүртгэгдсэн байна', detail: pgError.detail });
    return;
  }
  if (pgError.code === '23503') {
    res.status(400).json({ message: 'Холбогдох бичлэг олдсонгүй', detail: pgError.detail });
    return;
  }
  if (pgError.code === '23514') {
    res.status(400).json({ message: 'Утга зөвшөөрөгдөх хязгаарт байхгүй', detail: pgError.detail });
    return;
  }
  if (pgError.code === '22P02') {
    res.status(400).json({ message: 'ID-ийн формат буруу байна' });
    return;
  }

  console.error('[api] unhandled error:', err);
  res.status(500).json({
    message: 'Серверийн дотоод алдаа',
    ...(env.nodeEnv !== 'production' ? { error: pgError.message } : {}),
  });
};
app.use(errorHandler);

export default app;
