import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { many, one, toInt } from '../db.js';
import { createCrudRouter } from '../lib/crud.js';
import { ApiError, asyncHandler, pageMeta, parseBody } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const paySchema = z.object({
  payment_method: z.enum(['cash', 'card', 'qpay']).optional(),
});

router.post(
  '/orders/:orderId/pay',
  asyncHandler(async (req, res) => {
    const body = parseBody(paySchema, req.body ?? {});
    const order = await one<{ id: string; user_id: string; total_amount: number; status: string }>(
      'SELECT id, user_id, total_amount, status FROM public.orders WHERE id = $1',
      [req.params.orderId],
    );
    if (!order) throw new ApiError(404, 'Захиалга олдсонгүй');
    if (order.user_id !== req.user!.id && req.user!.role !== 'admin') {
      throw new ApiError(403, 'Энэ захиалгын төлбөр төлөх эрх байхгүй');
    }
    if (order.status === 'cancelled') throw new ApiError(400, 'Цуцлагдсан захиалга төлөх боломжгүй');

    const existing = await one<{ id: string; payment_status: string }>(
      'SELECT id, payment_status FROM public.payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
      [order.id],
    );
    const transactionId = `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`;

    const row = existing
      ? await one(
          `UPDATE public.payments
   SET payment_status = 'paid', payment_method = COALESCE($2, payment_method),
       transaction_id = $3, paid_at = now(), amount = $4
   WHERE id = $1 RETURNING *`,
          [existing.id, body.payment_method ?? null, transactionId, order.total_amount],
        )
      : await one(
          `INSERT INTO public.payments (order_id, user_id, payment_method, payment_status, amount, transaction_id, paid_at)
           VALUES ($1,$2,$3,'paid',$4,$5, now()) RETURNING *`,
          [
            order.id,
            order.user_id,
            body.payment_method ?? 'card',
            order.total_amount,
            transactionId,
          ],
        );

    res.json({ data: row });
  }),
);

router.patch(
  '/:id/refund',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const row = await one(
      `UPDATE public.payments SET payment_status = 'refunded' WHERE id = $1 RETURNING *`,
      [req.params.id],
    );
    if (!row) throw new ApiError(404, 'Төлбөр олдсонгүй');
    res.json({ data: row });
  }),
);

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];
    if (typeof req.query.payment_status === 'string' && req.query.payment_status !== 'all' && req.query.payment_status) {
      params.push(req.query.payment_status);
      where.push(`pay.payment_status = $${params.length}`);
    }
    if (typeof req.query.order_id === 'string' && req.query.order_id) {
      params.push(req.query.order_id);
      where.push(`pay.order_id = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await many(
      `SELECT pay.*, o.order_number, p.full_name AS customer_name
       FROM public.payments pay
       LEFT JOIN public.orders o ON o.id = pay.order_id
       LEFT JOIN public.profiles p ON p.id = pay.user_id
       ${whereSql}
       ORDER BY pay.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = await one<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM public.payments pay ${whereSql}`,
      params,
    );
    res.json({ data: rows, ...pageMeta(total?.total ?? 0, page, limit) });
  }),
);

export default router;
