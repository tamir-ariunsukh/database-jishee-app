import { Router } from 'express';
import { z } from 'zod';
import { many, one, toInt } from '../db.js';
import { ApiError, asyncHandler, pageMeta, parseBody } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [summary, statusCounts, revenueSeries, topRestaurants, topProducts, recentOrders] =
      await Promise.all([
        one(`
          SELECT
            (SELECT COUNT(*)::int FROM public.orders) AS total_orders,
            (SELECT COUNT(*)::int FROM public.orders WHERE created_at::date = CURRENT_DATE) AS orders_today,
            (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders WHERE status = 'delivered') AS total_revenue,
            (SELECT COALESCE(SUM(total_amount), 0) FROM public.orders
               WHERE status = 'delivered' AND created_at::date = CURRENT_DATE) AS revenue_today,
            (SELECT COUNT(*)::int FROM public.orders WHERE status NOT IN ('delivered', 'cancelled')) AS active_orders,
            (SELECT COUNT(*)::int FROM public.profiles) AS total_customers,
            (SELECT COUNT(*)::int FROM public.restaurants WHERE is_active) AS active_restaurants,
            (SELECT COUNT(*)::int FROM public.drivers) AS total_drivers,
            (SELECT COALESCE(ROUND(AVG(rating)::numeric, 2), 0) FROM public.reviews) AS avg_rating
        `),
        many(`SELECT status, COUNT(*)::int AS count FROM public.orders GROUP BY status`),
        many(`
          SELECT to_char(d, 'YYYY-MM-DD') AS day,
                 COALESCE(SUM(o.total_amount), 0) AS revenue,
                 COUNT(o.id)::int AS orders
          FROM generate_series(CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day') AS d
          LEFT JOIN public.orders o
                 ON o.created_at::date = d::date AND o.status <> 'cancelled'
          GROUP BY d
          ORDER BY d ASC
        `),
        many(`
          SELECT r.id, r.name, r.logo_url,
                 COUNT(o.id)::int AS orders,
                 COALESCE(SUM(o.total_amount), 0) AS revenue
          FROM public.restaurants r
          JOIN public.orders o ON o.restaurant_id = r.id AND o.status <> 'cancelled'
          GROUP BY r.id
          ORDER BY revenue DESC
          LIMIT 5
        `),
        many(`
          SELECT oi.product_name, SUM(oi.quantity)::int AS sold, COALESCE(SUM(oi.total_price), 0) AS revenue
          FROM public.order_items oi
          JOIN public.orders o ON o.id = oi.order_id AND o.status <> 'cancelled'
          GROUP BY oi.product_name
          ORDER BY sold DESC
          LIMIT 5
        `),
        many(`
          SELECT o.id, o.order_number, o.status, o.total_amount, o.created_at,
                 r.name AS restaurant_name, p.full_name AS customer_name
          FROM public.orders o
          LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
          LEFT JOIN public.profiles p ON p.id = o.user_id
          ORDER BY o.created_at DESC
          LIMIT 8
        `),
      ]);

    res.json({
      data: {
        summary,
        status_counts: statusCounts,
        revenue_series: revenueSeries,
        top_restaurants: topRestaurants,
        top_products: topProducts,
        recent_orders: recentOrders,
      },
    });
  }),
);

router.get(
  '/users',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      params.push(`%${q}%`);
      where.push(`(p.full_name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR p.phone ILIKE $${params.length})`);
    }
    if (typeof req.query.role === 'string' && req.query.role && req.query.role !== 'all') {
      params.push(req.query.role);
      where.push(`u.role = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await many(
      `SELECT u.id, u.email, u.role, u.created_at, p.full_name, p.phone, p.avatar_url,
              (SELECT COUNT(*)::int FROM public.orders o WHERE o.user_id = u.id) AS order_count,
              (SELECT COALESCE(SUM(o.total_amount), 0) FROM public.orders o
                 WHERE o.user_id = u.id AND o.status = 'delivered') AS total_spent
       FROM auth.users u
       LEFT JOIN public.profiles p ON p.id = u.id
       ${whereSql}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = await one<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id ${whereSql}`,
      params,
    );
    res.json({ data: rows, ...pageMeta(total?.total ?? 0, page, limit) });
  }),
);

const roleSchema = z.object({ role: z.enum(['customer', 'admin', 'driver']) });

router.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const body = parseBody(roleSchema, req.body);
    if (body.role === 'driver') {
      const profile = await one<{ full_name: string | null; phone: string | null }>(
        'SELECT full_name, phone FROM public.profiles WHERE id = $1',
        [req.params.id],
      );
      await one(
        `INSERT INTO public.drivers (id, full_name, phone) VALUES ($1,$2,$3)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [req.params.id, profile?.full_name ?? null, profile?.phone ?? null],
      );
    }
    const row = await one(
      `UPDATE auth.users SET role = $1 WHERE id = $2 RETURNING id, email, role`,
      [body.role, req.params.id],
    );
    if (!row) throw new ApiError(404, 'Хэрэглэгч олдсонгүй');
    res.json({ data: row });
  }),
);

const userSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
});

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const body = parseBody(userSchema, req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');
    const row = await one(
      `INSERT INTO public.profiles (id, ${keys.join(', ')})
       VALUES ($${keys.length + 1}, ${keys.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
       RETURNING *`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.params.id],
    );
    res.json({ data: row });
  }),
);

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user!.id) throw new ApiError(400, 'Өөрийгөө устгах боломжгүй');
    const row = await one('DELETE FROM auth.users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!row) throw new ApiError(404, 'Хэрэглэгч олдсонгүй');
    res.json({ data: { deleted: true } });
  }),
);

export default router;