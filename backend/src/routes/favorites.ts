import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT f.id, f.created_at, r.*, COALESCE(rr.avg_rating, 0) AS avg_rating,
              COALESCE(rr.review_count, 0) AS review_count
       FROM public.favorites f
       JOIN public.restaurants r ON r.id = f.restaurant_id
       LEFT JOIN public.restaurant_ratings rr ON rr.restaurant_id = r.id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [req.user!.id],
    );
    res.json({ data: rows });
  }),
);

const favoriteSchema = z.object({ restaurant_id: z.string().uuid() });

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseBody(favoriteSchema, req.body);
    const restaurant = await one('SELECT id FROM public.restaurants WHERE id = $1', [
      body.restaurant_id,
    ]);
    if (!restaurant) throw new ApiError(404, 'Ресторан олдсонгүй');

    await one(
      `INSERT INTO public.favorites (user_id, restaurant_id) VALUES ($1,$2)
       ON CONFLICT (user_id, restaurant_id) DO NOTHING RETURNING id`,
      [req.user!.id, body.restaurant_id],
    );
    res.status(201).json({ data: { restaurant_id: body.restaurant_id, favorite: true } });
  }),
);

router.delete(
  '/:restaurantId',
  asyncHandler(async (req, res) => {
    await one('DELETE FROM public.favorites WHERE user_id = $1 AND restaurant_id = $2 RETURNING id', [
      req.user!.id,
      req.params.restaurantId,
    ]);
    res.json({ data: { restaurant_id: req.params.restaurantId, favorite: false } });
  }),
);

export default router;
