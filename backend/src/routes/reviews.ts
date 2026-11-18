import { Router } from 'express';
import { z } from 'zod';
import { many, one, toInt } from '../db.js';
import { ApiError, asyncHandler, pageMeta, parseBody } from '../lib/http.js';
import { optionalAuth, requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 10)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    if (typeof req.query.restaurant_id === 'string' && req.query.restaurant_id) {
      params.push(req.query.restaurant_id);
      where.push(`rv.restaurant_id = $${params.length}`);
    }
    if (typeof req.query.user_id === 'string' && req.query.user_id) {
      params.push(req.query.user_id);
      where.push(`rv.user_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await many(
      `SELECT rv.*, p.full_name, p.avatar_url, r.name AS restaurant_name
       FROM public.reviews rv
       LEFT JOIN public.profiles p ON p.id = rv.user_id
       LEFT JOIN public.restaurants r ON r.id = rv.restaurant_id
       ${whereSql}
       ORDER BY rv.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = await one<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public.reviews rv ${whereSql}`,
      params,
    );
    res.json({ data: rows, ...pageMeta(total?.total ?? 0, page, limit) });
  }),
);

const reviewSchema = z.object({
  order_id: z.string().uuid('Захиалга сонгоно уу'),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).nullable().optional(),
});

router.post(
  '/',
  optionalAuth,
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(reviewSchema, req.body);

    const order = await one<{ id: string; user_id: string; restaurant_id: string; status: string }>(
      'SELECT id, user_id, restaurant_id, status FROM public.orders WHERE id = $1',
      [body.order_id],
    );
    if (!order) throw new ApiError(404, 'Захиалга олдсонгүй');
    if (order.user_id !== req.user!.id) throw new ApiError(403, 'Зөвхөн өөрийн захиалгыг үнэлнэ');
    if (order.status !== 'delivered') throw new ApiError(400, 'Хүргэгдсэн захиалгыг л үнэлэх боломжтой');

    const existing = await one('SELECT id FROM public.reviews WHERE order_id = $1', [order.id]);
    if (existing) throw new ApiError(409, 'Энэ захиалгыг аль хэдийн үнэлсэн байна');

    const row = await one(
      `INSERT INTO public.reviews (user_id, restaurant_id, order_id, rating, comment)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.user!.id, order.restaurant_id, order.id, body.rating, body.comment ?? null],
    );
    res.status(201).json({ data: row });
  }),
);

router.delete(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const review = await one<{ id: string; user_id: string }>(
      'SELECT id, user_id FROM public.reviews WHERE id = $1',
      [req.params.id],
    );
    if (!review) throw new ApiError(404, 'Үнэлгээ олдсонгүй');
    if (review.user_id !== req.user!.id && req.user!.role !== 'admin') {
      throw new ApiError(403, 'Энэ үнэлгээг устгах эрх байхгүй');
    }
    await one('DELETE FROM public.reviews WHERE id = $1 RETURNING id', [req.params.id]);
    res.json({ data: { deleted: true } });
  }),
);

export default router;
