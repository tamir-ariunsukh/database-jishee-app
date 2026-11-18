import { Router } from 'express';
import { z } from 'zod';
import { many, one } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DELIVERY_SELECT = `
  SELECT dl.*,
         o.order_number, o.status AS order_status, o.total_amount, o.customer_note,
         r.name AS restaurant_name, r.address AS restaurant_address, r.phone AS restaurant_phone,
         a.address AS address_text, a.title AS address_title, a.apartment, a.entrance, a.floor,
         p.full_name AS customer_name, p.phone AS customer_phone,
         dr.full_name AS driver_name, dr.phone AS driver_phone
  FROM public.deliveries dl
  JOIN public.orders o ON o.id = dl.order_id
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  LEFT JOIN public.addresses a ON a.id = o.address_id
  LEFT JOIN public.profiles p ON p.id = o.user_id
  LEFT JOIN public.drivers dr ON dr.id = dl.driver_id
`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where: string[] = [];
    const params: unknown[] = [];

    if (req.user!.role === 'driver') {
      params.push(req.user!.id);
      where.push(`dl.driver_id = $${params.length}`);
    } else if (req.user!.role === 'customer') {
      params.push(req.user!.id);
      where.push(`o.user_id = $${params.length}`);
    }

    if (typeof req.query.status === 'string' && req.query.status && req.query.status !== 'all') {
      params.push(req.query.status.split(',').filter(Boolean));
      where.push(`dl.status = ANY($${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await many(`${DELIVERY_SELECT} ${whereSql} ORDER BY dl.created_at DESC`, params);
    res.json({ data: rows });
  }),
);

/** Deliveries waiting for a driver to accept them. */
router.get(
  '/available',
  requireRole('driver', 'admin'),
  asyncHandler(async (_req, res) => {
    const rows = await many(
      `${DELIVERY_SELECT} WHERE dl.driver_id IS NULL AND dl.status = 'waiting' ORDER BY dl.created_at ASC`,
    );
    res.json({ data: rows });
  }),
);

router.post(
  '/:id/claim',
  requireRole('driver'),
  asyncHandler(async (req, res) => {
    const row = await one(
      `UPDATE public.deliveries
       SET driver_id = $1, status = 'assigned'
       WHERE id = $2 AND driver_id IS NULL AND status = 'waiting'
       RETURNING *`,
      [req.user!.id, req.params.id],
    );
    if (!row) throw new ApiError(409, 'Энэ хүргэлтийг өөр хүргэгч авсан эсвэл боломжгүй');
    res.json({ data: row });
  }),
);

const updateSchema = z.object({
  status: z.enum(['waiting', 'assigned', 'picked_up', 'delivering', 'delivered', 'cancelled']).optional(),
  driver_id: z.string().uuid().nullable().optional(),
});

router.patch(
  '/:id',
  requireRole('driver', 'admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateSchema, req.body);
    const existing = await one<{ id: string; driver_id: string | null; order_id: string }>(
      'SELECT id, driver_id, order_id FROM public.deliveries WHERE id = $1',
      [req.params.id],
    );
    if (!existing) throw new ApiError(404, 'Хүргэлт олдсонгүй');

    if (req.user!.role === 'driver' && existing.driver_id !== req.user!.id) {
      throw new ApiError(403, 'Энэ хүргэлтийг удирдах эрх байхгүй');
    }
    if (req.user!.role === 'driver') delete body.driver_id;

    const sets: string[] = [];
    const params: unknown[] = [];
    if (body.status !== undefined) {
      params.push(body.status);
      sets.push(`status = $${params.length}`);
      if (body.status === 'picked_up') sets.push('picked_up_at = now()');
      if (body.status === 'delivered') sets.push('delivered_at = now()');
    }
    if (body.driver_id !== undefined) {
      params.push(body.driver_id);
      sets.push(`driver_id = $${params.length}`);
    }
    if (!sets.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');

    params.push(req.params.id);
    const row = await one(
      `UPDATE public.deliveries SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING *`,
      params,
    );

    res.json({ data: row });
  }),
);

export default router;
