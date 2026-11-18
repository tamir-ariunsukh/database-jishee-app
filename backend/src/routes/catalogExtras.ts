import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
const admin = [requireAuth, requireRole('admin')];

/* ------------------------- product option groups ------------------------- */

const groupSchema = z.object({
  name: z.string().min(1, 'Нэр оруулна уу').max(120),
  required: z.boolean().optional(),
  min_select: z.coerce.number().int().min(0).max(20).optional(),
  max_select: z.coerce.number().int().min(1).max(20).optional(),
});

const optionSchema = z.object({
  name: z.string().min(1, 'Нэр оруулна уу').max(120),
  additional_price: z.coerce.number().min(0).optional(),
});

router.get(
  '/products/:productId/option-groups',
  asyncHandler(async (req, res) => {
    const groups = await many(
      'SELECT * FROM public.product_option_groups WHERE product_id = $1 ORDER BY name ASC',
      [req.params.productId],
    );
    const ids = groups.map((g) => g.id as string);
    const options = ids.length
      ? await many(
          'SELECT * FROM public.product_options WHERE group_id = ANY($1) ORDER BY name ASC',
          [ids],
        )
      : [];
    res.json({
      data: groups.map((g) => ({
        ...g,
        options: options.filter((o) => o.group_id === g.id),
      })),
    });
  }),
);

router.post(
  '/products/:productId/option-groups',
  ...admin,
  asyncHandler(async (req, res) => {
    const body = parseBody(groupSchema, req.body);
    const row = await one(
      `INSERT INTO public.product_option_groups (product_id, name, required, min_select, max_select)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [
        req.params.productId,
        body.name,
        body.required ?? false,
        body.min_select ?? 0,
        body.max_select ?? 1,
      ],
    );
    res.status(201).json({ data: row });
  }),
);

router.patch(
  '/option-groups/:id',
  ...admin,
  asyncHandler(async (req, res) => {
    const body = parseBody(groupSchema.partial(), req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');
    const row = await one(
      `UPDATE public.product_option_groups SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
       WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.params.id],
    );
    if (!row) throw new ApiError(404, 'Бүлэг олдсонгүй');
    res.json({ data: row });
  }),
);

router.delete(
  '/option-groups/:id',
  ...admin,
  asyncHandler(async (req, res) => {
    const row = await one('DELETE FROM public.product_option_groups WHERE id = $1 RETURNING id', [
      req.params.id,
    ]);
    if (!row) throw new ApiError(404, 'Бүлэг олдсонгүй');
    res.json({ data: { deleted: true } });
  }),
);

router.post(
  '/option-groups/:id/options',
  ...admin,
  asyncHandler(async (req, res) => {
    const body = parseBody(optionSchema, req.body);
    const row = await one(
      `INSERT INTO public.product_options (group_id, name, additional_price)
       VALUES ($1,$2,$3) RETURNING *`,
      [req.params.id, body.name, body.additional_price ?? 0],
    );
    res.status(201).json({ data: row });
  }),
);

router.patch(
  '/options/:id',
  ...admin,
  asyncHandler(async (req, res) => {
    const body = parseBody(optionSchema.partial(), req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');
    const row = await one(
      `UPDATE public.product_options SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
       WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.params.id],
    );
    if (!row) throw new ApiError(404, 'Нэмэлт олдсонгүй');
    res.json({ data: row });
  }),
);

router.delete(
  '/options/:id',
  ...admin,
  asyncHandler(async (req, res) => {
    const row = await one('DELETE FROM public.product_options WHERE id = $1 RETURNING id', [
      req.params.id,
    ]);
    if (!row) throw new ApiError(404, 'Нэмэлт олдсонгүй');
    res.json({ data: { deleted: true } });
  }),
);

/* ---------------------------- restaurant hours --------------------------- */

router.get(
  '/restaurants/:restaurantId/hours',
  asyncHandler(async (req, res) => {
    const rows = await many(
      'SELECT * FROM public.restaurant_hours WHERE restaurant_id = $1 ORDER BY day_of_week ASC',
      [req.params.restaurantId],
    );
    res.json({ data: rows });
  }),
);

const hoursSchema = z.object({
  hours: z.array(
    z.object({
      day_of_week: z.coerce.number().int().min(0).max(6),
      open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Цаг HH:MM хэлбэртэй байна').nullable().optional(),
      close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Цаг HH:MM хэлбэртэй байна').nullable().optional(),
      is_closed: z.boolean().optional(),
    }),
  ),
});

router.put(
  '/restaurants/:restaurantId/hours',
  ...admin,
  asyncHandler(async (req, res) => {
    const body = parseBody(hoursSchema, req.body);
    const rows = await withTransaction(async (client) => {
      const out = [];
      for (const h of body.hours) {
        const result = await client.query(
          `INSERT INTO public.restaurant_hours (restaurant_id, day_of_week, open_time, close_time, is_closed)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (restaurant_id, day_of_week)
           DO UPDATE SET open_time = EXCLUDED.open_time,
                         close_time = EXCLUDED.close_time,
                         is_closed = EXCLUDED.is_closed
           RETURNING *`,
          [
            req.params.restaurantId,
            h.day_of_week,
            h.open_time ?? '10:00',
            h.close_time ?? '22:00',
            h.is_closed ?? false,
          ],
        );
        out.push(result.rows[0]);
      }
      return out;
    });
    res.json({ data: rows });
  }),
);

export default router;
