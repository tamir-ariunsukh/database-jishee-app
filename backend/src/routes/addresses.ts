import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const addressSchema = z.object({
  title: z.string().max(80).nullable().optional(),
  address: z.string().min(3, 'Хаяг оруулна уу').max(300),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  apartment: z.string().max(40).nullable().optional(),
  entrance: z.string().max(40).nullable().optional(),
  floor: z.string().max(40).nullable().optional(),
  is_default: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await many(
      `SELECT * FROM public.addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC`,
      [req.user!.id],
    );
    res.json({ data: rows });
  }),
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseBody(addressSchema, req.body);
    const row = await withTransaction(async (client) => {
      if (body.is_default) {
        await client.query('UPDATE public.addresses SET is_default = false WHERE user_id = $1', [
          req.user!.id,
        ]);
      } else {
        const existing = await client.query(
          'SELECT 1 FROM public.addresses WHERE user_id = $1 LIMIT 1',
          [req.user!.id],
        );
        // first address automatically becomes the default one
        if (!existing.rowCount) body.is_default = true;
      }
      const inserted = await client.query(
        `INSERT INTO public.addresses (user_id, title, address, latitude, longitude, apartment, entrance, floor, is_default)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
        [
          req.user!.id,
          body.title ?? null,
          body.address,
          body.latitude ?? null,
          body.longitude ?? null,
          body.apartment ?? null,
          body.entrance ?? null,
          body.floor ?? null,
          body.is_default ?? false,
        ],
      );
      return inserted.rows[0];
    });
    res.status(201).json({ data: row });
  }),
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = parseBody(addressSchema, req.body);
    const existing = await one<{ user_id: string }>(
      'SELECT user_id FROM public.addresses WHERE id = $1',
      [req.params.id],
    );
    if (!existing) throw new ApiError(404, 'Хаяг олдсонгүй');
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin') {
      throw new ApiError(403, 'Энэ хаягийг засах эрх байхгүй');
    }

    const row = await withTransaction(async (client) => {
      if (body.is_default) {
        await client.query('UPDATE public.addresses SET is_default = false WHERE user_id = $1', [
          existing.user_id,
        ]);
      }
      const keys = Object.keys(body);
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const updated = await client.query(
        `UPDATE public.addresses SET ${sets.join(', ')} WHERE id = $${keys.length + 1} RETURNING *`,
        [...keys.map((k) => (body as Record<string, unknown>)[k]), req.params.id],
      );
      return updated.rows[0];
    });
    res.json({ data: row });
  }),
);

router.post(
  '/:id/default',
  asyncHandler(async (req, res) => {
    const row = await withTransaction(async (client) => {
      const target = await client.query<{ user_id: string }>(
        'SELECT user_id FROM public.addresses WHERE id = $1',
        [req.params.id],
      );
      const address = target.rows[0];
      if (!address) throw new ApiError(404, 'Хаяг олдсонгүй');
      if (address.user_id !== req.user!.id && req.user!.role !== 'admin') {
        throw new ApiError(403, 'Энэ хаягийг солих эрх байхгүй');
      }
      await client.query('UPDATE public.addresses SET is_default = false WHERE user_id = $1', [
        address.user_id,
      ]);
      const updated = await client.query(
        'UPDATE public.addresses SET is_default = true WHERE id = $1 RETURNING *',
        [req.params.id],
      );
      return updated.rows[0];
    });
    res.json({ data: row });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const existing = await one<{ user_id: string }>(
      'SELECT user_id FROM public.addresses WHERE id = $1',
      [req.params.id],
    );
    if (!existing) throw new ApiError(404, 'Хаяг олдсонгүй');
    if (existing.user_id !== req.user!.id && req.user!.role !== 'admin') {
      throw new ApiError(403, 'Энэ хаягийг устгах эрх байхгүй');
    }
    await one('DELETE FROM public.addresses WHERE id = $1 RETURNING id', [req.params.id]);
    res.json({ data: { deleted: true } });
  }),
);

export default router;
