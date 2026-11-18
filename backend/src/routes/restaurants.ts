import { Router } from 'express';
import { z } from 'zod';
import { many, one, toInt } from '../db.js';
import { ApiError, asyncHandler, pageMeta, parseBody } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const BASE_SELECT = `
  SELECT r.*,
         COALESCE(rr.avg_rating, 0) AS avg_rating,
         COALESCE(rr.review_count, 0) AS review_count
  FROM public.restaurants r
  LEFT JOIN public.restaurant_ratings rr ON rr.restaurant_id = r.id
`;

const SORTS: Record<string, string> = {
  newest: 'r.created_at DESC',
  name: 'r.name ASC',
  rating: 'avg_rating DESC',
  delivery_fee: 'r.delivery_fee ASC',
  delivery_time: 'r.estimated_delivery_minutes ASC',
};

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 24)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      params.push(`%${q}%`);
      where.push(`(r.name ILIKE $${params.length} OR r.description ILIKE $${params.length})`);
    }

    if (typeof req.query.is_active === 'string' && req.query.is_active !== 'all') {
      params.push(req.query.is_active === 'true');
      where.push(`r.is_active = $${params.length}`);
    }

    if (typeof req.query.category_id === 'string' && req.query.category_id) {
      params.push(req.query.category_id);
      where.push(
        `EXISTS (SELECT 1 FROM public.products p WHERE p.restaurant_id = r.id AND p.category_id = $${params.length})`,
      );
    }

    if (typeof req.query.min_rating === 'string' && req.query.min_rating) {
      params.push(Number(req.query.min_rating));
      where.push(`COALESCE(rr.avg_rating, 0) >= $${params.length}`);
    }

    const order = SORTS[String(req.query.sort ?? 'newest')] ?? SORTS.newest;
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await many(
      `${BASE_SELECT} ${whereSql} ORDER BY ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = await one<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM (${BASE_SELECT} ${whereSql}) AS counted`,
      params,
    );

    res.json({ data: rows, ...pageMeta(total?.total ?? 0, page, limit) });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const restaurant = await one(`${BASE_SELECT} WHERE r.id = $1`, [req.params.id]);
    if (!restaurant) throw new ApiError(404, 'Ресторан олдсонгүй');

    const [hours, reviews, distribution] = await Promise.all([
      many(
        'SELECT * FROM public.restaurant_hours WHERE restaurant_id = $1 ORDER BY day_of_week ASC',
        [req.params.id],
      ),
      many(
        `SELECT rv.*, p.full_name, p.avatar_url
         FROM public.reviews rv
         LEFT JOIN public.profiles p ON p.id = rv.user_id
         WHERE rv.restaurant_id = $1
         ORDER BY rv.created_at DESC
         LIMIT 12`,
        [req.params.id],
      ),
      many(
        `SELECT rating, COUNT(*)::int AS count
         FROM public.reviews WHERE restaurant_id = $1
         GROUP BY rating ORDER BY rating DESC`,
        [req.params.id],
      ),
    ]);

    res.json({ data: { ...restaurant, hours, reviews, rating_distribution: distribution } });
  }),
);

const restaurantSchema = z.object({
  name: z.string().min(2, 'Нэр оруулна уу').max(160),
  description: z.string().max(2000).nullable().optional(),
  logo_url: z.string().max(600).nullable().optional(),
  cover_url: z.string().max(600).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  delivery_fee: z.coerce.number().min(0).optional(),
  min_order_amount: z.coerce.number().min(0).optional(),
  estimated_delivery_minutes: z.coerce.number().int().min(0).max(600).nullable().optional(),
  is_active: z.boolean().optional(),
});

router.post(
  '/',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(restaurantSchema, req.body);
    const keys = Object.keys(body);
    const row = await one(
      `INSERT INTO public.restaurants (${keys.join(', ')})
       VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
      keys.map((k) => (body as Record<string, unknown>)[k]),
    );
    res.status(201).json({ data: row });
  }),
);

router.patch(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(restaurantSchema.partial(), req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');
    const row = await one(
      `UPDATE public.restaurants SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
       WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.params.id],
    );
    if (!row) throw new ApiError(404, 'Ресторан олдсонгүй');
    res.json({ data: row });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const row = await one('DELETE FROM public.restaurants WHERE id = $1 RETURNING id', [
      req.params.id,
    ]);
    if (!row) throw new ApiError(404, 'Ресторан олдсонгүй');
    res.json({ data: { deleted: true } });
  }),
);

export default router;
