import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { many, one, toInt, withTransaction } from '../db.js';
import { ApiError, asyncHandler, pageMeta, parseBody } from '../lib/http.js';
import { resolveCoupon } from '../lib/pricing.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
] as const;

type OrderStatus = (typeof ORDER_STATUSES)[number];

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up', 'cancelled'],
  picked_up: ['delivering', 'delivered'],
  delivering: ['delivered'],
  delivered: [],
  cancelled: [],
};

const ORDER_SELECT = `
  SELECT o.*,
         r.name AS restaurant_name,
         r.logo_url AS restaurant_logo_url,
         r.estimated_delivery_minutes,
         a.title AS address_title,
         a.address AS address_text,
         a.apartment, a.entrance, a.floor,
         p.full_name AS customer_name,
         p.phone AS customer_phone,
         (SELECT json_agg(oi ORDER BY oi.id)
            FROM public.order_items oi WHERE oi.order_id = o.id) AS items,
         (SELECT json_build_object(
                    'id', pay.id,
                    'payment_method', pay.payment_method,
                    'payment_status', pay.payment_status,
                    'amount', pay.amount,
                    'transaction_id', pay.transaction_id,
                    'paid_at', pay.paid_at,
                    'created_at', pay.created_at)
            FROM public.payments pay
           WHERE pay.order_id = o.id
           ORDER BY pay.created_at DESC
           LIMIT 1) AS payment,
         (SELECT rv.id FROM public.reviews rv WHERE rv.order_id = o.id LIMIT 1) AS review_id
  FROM public.orders o
  LEFT JOIN public.restaurants r ON r.id = o.restaurant_id
  LEFT JOIN public.addresses a ON a.id = o.address_id
  LEFT JOIN public.profiles p ON p.id = o.user_id
`;

async function loadOrderDetail(orderId: string) {
  const order = await one(`${ORDER_SELECT} WHERE o.id = $1`, [orderId]);
  if (!order) return null;

  const [history, delivery, payment] = await Promise.all([
    many(
      `SELECT * FROM public.order_status_history WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId],
    ),
    one(
      `SELECT d.*, dr.full_name AS driver_name, dr.phone AS driver_phone
       FROM public.deliveries d
       LEFT JOIN public.drivers dr ON dr.id = d.driver_id
       WHERE d.order_id = $1`,
      [orderId],
    ),
    one('SELECT * FROM public.payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1', [
      orderId,
    ]),
  ]);

  return { ...order, status_history: history, delivery, payment };
}

async function assertOrderAccess(orderId: string, user: { id: string; role: string }) {
  const order = await one<{ id: string; user_id: string }>(
    'SELECT id, user_id FROM public.orders WHERE id = $1',
    [orderId],
  );
  if (!order) throw new ApiError(404, 'Захиалга олдсонгүй');
  if (user.role === 'admin') return order;
  if (order.user_id === user.id) return order;
  if (user.role === 'driver') {
    const assigned = await one(
      `SELECT d.id FROM public.deliveries d WHERE d.order_id = $1 AND d.driver_id = $2`,
      [orderId, user.id],
    );
    if (assigned) return order;
  }
  throw new ApiError(403, 'Энэ захиалгыг харах эрх байхгүй');
}

/* ------------------------------- LIST ---------------------------------- */

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(100, Math.max(1, toInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const where: string[] = [];
    const params: unknown[] = [];

    if (req.user!.role === 'customer') {
      params.push(req.user!.id);
      where.push(`o.user_id = $${params.length}`);
    } else if (req.user!.role === 'driver') {
      params.push(req.user!.id);
      where.push(
        `EXISTS (SELECT 1 FROM public.deliveries d WHERE d.order_id = o.id AND d.driver_id = $${params.length})`,
      );
    }

    if (typeof req.query.status === 'string' && req.query.status && req.query.status !== 'all') {
      const statuses = req.query.status.split(',').filter(Boolean);
      params.push(statuses);
      where.push(`o.status = ANY($${params.length})`);
    }

    if (typeof req.query.restaurant_id === 'string' && req.query.restaurant_id) {
      params.push(req.query.restaurant_id);
      where.push(`o.restaurant_id = $${params.length}`);
    }

    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      params.push(`%${q}%`);
      where.push(
        `(CAST(o.order_number AS text) ILIKE $${params.length} OR p.full_name ILIKE $${params.length})`,
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await many(
      `${ORDER_SELECT} ${whereSql} ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const total = await one<{ total: number }>(
      `SELECT COUNT(*)::int AS total
       FROM public.orders o LEFT JOIN public.profiles p ON p.id = o.user_id ${whereSql}`,
      params,
    );

    res.json({ data: rows, ...pageMeta(total?.total ?? 0, page, limit) });
  }),
);

/* ------------------------------- DETAIL -------------------------------- */

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertOrderAccess(String(req.params.id), req.user!);
    const order = await loadOrderDetail(String(req.params.id));
    if (!order) throw new ApiError(404, 'Захиалга олдсонгүй');
    res.json({ data: order });
  }),
);

/* ------------------------------- CREATE -------------------------------- */

const createOrderSchema = z.object({
  address_id: z.string().uuid('Хүргэлтийн хаяг сонгоно уу'),
  payment_method: z.enum(['cash', 'card', 'qpay']),
  coupon_code: z.string().max(60).nullable().optional(),
  customer_note: z.string().max(500).nullable().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid(),
        quantity: z.coerce.number().int().min(1).max(50),
        option_ids: z.array(z.string().uuid()).max(30).optional(),
        special_instructions: z.string().max(500).nullable().optional(),
      }),
    )
    .optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parseBody(createOrderSchema, req.body);
    const userId = req.user!.id;

    const address = await one('SELECT id FROM public.addresses WHERE id = $1 AND user_id = $2', [
      body.address_id,
      userId,
    ]);
    if (!address) throw new ApiError(400, 'Хүргэлтийн хаяг олдсонгүй');

    // 1. Build the list of lines (from the request or from the server-side cart).
    const cart = await one<{ id: string; restaurant_id: string | null }>(
      'SELECT id, restaurant_id FROM public.carts WHERE user_id = $1',
      [userId],
    );
    const cartItems = cart
      ? await many<any>(
          `SELECT product_id, quantity, special_instructions, selected_options
           FROM public.cart_items WHERE cart_id = $1 ORDER BY id ASC`,
          [cart.id],
        )
      : [];

    const lines = body.items?.length
      ? body.items.map((i) => ({
          product_id: i.product_id,
          quantity: i.quantity,
          special_instructions: i.special_instructions ?? null,
          option_ids: i.option_ids ?? [],
        }))
      : cartItems.map((i) => ({
          product_id: i.product_id as string,
          quantity: Number(i.quantity),
          special_instructions: (i.special_instructions as string | null) ?? null,
          option_ids: Array.isArray(i.selected_options)
            ? (i.selected_options as { option_id: string }[]).map((o) => o.option_id)
            : [],
        }));

    if (!lines.length) throw new ApiError(400, 'Сагс хоосон байна');

    // 2. Validate products / restaurant.
    const productIds = [...new Set(lines.map((l) => l.product_id))];
    const products = await many<any>(
      `SELECT p.id, p.name, p.price, p.discount_price, p.is_available, p.restaurant_id,
              r.is_active AS restaurant_is_active, r.delivery_fee, r.min_order_amount, r.name AS restaurant_name
       FROM public.products p
       JOIN public.restaurants r ON r.id = p.restaurant_id
       WHERE p.id = ANY($1)`,
      [productIds],
    );
    const productMap = new Map(products.map((p) => [p.id as string, p]));
    for (const line of lines) {
      const product = productMap.get(line.product_id);
      if (!product) throw new ApiError(400, 'Сонгосон бүтээгдэхүүн олдсонгүй');
      if (!product.is_available) throw new ApiError(400, `${product.name} түр зарагдахгүй байна`);
    }

    const restaurantIds = [...new Set(products.map((p) => p.restaurant_id as string))];
    if (restaurantIds.length !== 1) {
      throw new ApiError(400, 'Нэг захиалга зөвхөн нэг ресторанаас байх боломжтой');
    }
    const restaurant = products[0];
    if (!restaurant.restaurant_is_active) throw new ApiError(400, 'Ресторан түр хаалттай байна');

    // 3. Options.
    const optionIds = [...new Set(lines.flatMap((l) => l.option_ids))];
    const optionRows = optionIds.length
      ? await many<any>(
          `SELECT o.id, o.name, o.additional_price, o.group_id, g.name AS group_name, g.product_id
           FROM public.product_options o
           JOIN public.product_option_groups g ON g.id = o.group_id
           WHERE o.id = ANY($1)`,
          [optionIds],
        )
      : [];
    const optionMap = new Map(optionRows.map((o) => [o.id as string, o]));

    // 4. Price server-side (never trust client prices).
    const pricedLines = lines.map((line) => {
      const product = productMap.get(line.product_id)!;
      const chosen = line.option_ids.map((id) => {
        const option = optionMap.get(id);
        if (!option || option.product_id !== line.product_id) {
          throw new ApiError(400, 'Сонгосон нэмэлт хүчингүй байна');
        }
        return {
          option_id: option.id,
          group_id: option.group_id,
          group_name: option.group_name,
          name: option.name,
          additional_price: Number(option.additional_price ?? 0),
        };
      });
      const base = Number(product.discount_price ?? product.price);
      const unitPrice = Number(
        (base + chosen.reduce((sum, o) => sum + o.additional_price, 0)).toFixed(2),
      );
      return {
        product_id: line.product_id,
        product_name: product.name as string,
        quantity: line.quantity,
        unit_price: unitPrice,
        total_price: Number((unitPrice * line.quantity).toFixed(2)),
        selected_options: chosen,
        special_instructions: line.special_instructions,
      };
    });

    const subtotal = Number(pricedLines.reduce((sum, l) => sum + l.total_price, 0).toFixed(2));
    const minOrder = Number(restaurant.min_order_amount ?? 0);
    if (subtotal < minOrder) {
      throw new ApiError(
        400,
        `Захиалгын доод дүн ${minOrder.toLocaleString()}₮ байх ёстой (одоо ${subtotal.toLocaleString()}₮)`,
      );
    }

    // 5. Coupon.
    let discount = 0;
    let couponId: string | null = null;
    if (body.coupon_code) {
      const applied = await resolveCoupon(body.coupon_code, subtotal, userId);
      discount = applied.discount;
      couponId = applied.coupon.id;
    }

    const deliveryFee = Number(restaurant.delivery_fee ?? 0);
    const total = Number(Math.max(0, subtotal - discount + deliveryFee).toFixed(2));

    // 6. Persist everything atomically.
    const orderId = await withTransaction(async (client) => {
      const orderResult = await client.query<any>(
        `INSERT INTO public.orders
           (user_id, restaurant_id, address_id, status, subtotal, delivery_fee, discount_amount, total_amount, customer_note)
         VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8)
         RETURNING id, order_number`,
        [
          userId,
          restaurant.restaurant_id,
          body.address_id,
          subtotal,
          deliveryFee,
          discount,
          total,
          body.customer_note ?? null,
        ],
      );
      const order = orderResult.rows[0];

      for (const line of pricedLines) {
        await client.query(
          `INSERT INTO public.order_items
             (order_id, product_id, product_name, quantity, unit_price, total_price, selected_options, special_instructions)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            order.id,
            line.product_id,
            line.product_name,
            line.quantity,
            line.unit_price,
            line.total_price,
            JSON.stringify(line.selected_options),
            line.special_instructions,
          ],
        );
      }

      await client.query(
        `INSERT INTO public.order_status_history (order_id, status, note)
         VALUES ($1, 'pending', 'Захиалга үүслээ')`,
        [order.id],
      );

      await client.query(
        `INSERT INTO public.payments
           (order_id, user_id, payment_method, payment_status, amount, transaction_id, paid_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          order.id,
          userId,
          body.payment_method,
          body.payment_method === 'cash' ? 'pending' : 'paid',
          total,
          body.payment_method === 'cash' ? null : `MOCK-${randomUUID().slice(0, 8).toUpperCase()}`,
          body.payment_method === 'cash' ? null : new Date(),
        ],
      );

      await client.query(
        `INSERT INTO public.deliveries (order_id, driver_id, status) VALUES ($1, NULL, 'waiting')`,
        [order.id],
      );

      if (couponId) {
        await client.query(
          `INSERT INTO public.coupon_usages (coupon_id, user_id, order_id) VALUES ($1,$2,$3)`,
          [couponId, userId, order.id],
        );
      }

      if (cart) {
        await client.query('DELETE FROM public.cart_items WHERE cart_id = $1', [cart.id]);
        await client.query('DELETE FROM public.carts WHERE id = $1', [cart.id]);
      }

      return order.id as string;
    });

    res.status(201).json({ data: await loadOrderDetail(orderId) });
  }),
);

/* ------------------------------- STATUS -------------------------------- */

const statusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().max(300).nullable().optional(),
});

router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const body = parseBody(statusSchema, req.body);
    const order = await assertOrderAccess(String(req.params.id), req.user!);

    const current = await one<{ status: OrderStatus }>('SELECT status FROM public.orders WHERE id = $1', [
      req.params.id,
    ]);
    if (!current) throw new ApiError(404, 'Захиалга олдсонгүй');

    const isAdmin = req.user!.role === 'admin';
    if (!isAdmin && !TRANSITIONS[current.status].includes(body.status)) {
      throw new ApiError(400, `"${current.status}" төлвөөс "${body.status}" руу шилжих боломжгүй`);
    }

    await withTransaction(async (client) => {
      await client.query('UPDATE public.orders SET status = $1 WHERE id = $2', [
        body.status,
        order.id,
      ]);
      await client.query(
        `INSERT INTO public.order_status_history (order_id, status, note) VALUES ($1,$2,$3)`,
        [order.id, body.status, body.note ?? null],
      );

      if (body.status === 'picked_up') {
        await client.query(
          `UPDATE public.deliveries SET status = 'picked_up', picked_up_at = now() WHERE order_id = $1`,
          [order.id],
        );
      }
      if (body.status === 'delivering') {
        await client.query(`UPDATE public.deliveries SET status = 'delivering' WHERE order_id = $1`, [
          order.id,
        ]);
      }
      if (body.status === 'delivered') {
        await client.query(
          `UPDATE public.deliveries SET status = 'delivered', delivered_at = now() WHERE order_id = $1`,
          [order.id],
        );
        await client.query(
          `UPDATE public.payments SET payment_status = 'paid', paid_at = COALESCE(paid_at, now())
           WHERE order_id = $1 AND payment_method = 'cash'`,
          [order.id],
        );
      }
      if (body.status === 'cancelled') {
        await client.query(
          `UPDATE public.payments SET payment_status = 'refunded' WHERE order_id = $1 AND payment_status = 'paid'`,
          [order.id],
        );
        await client.query(`UPDATE public.deliveries SET status = 'cancelled' WHERE order_id = $1`, [
          order.id,
        ]);
      }
    });

    res.json({ data: await loadOrderDetail(order.id) });
  }),
);

router.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const order = await assertOrderAccess(String(req.params.id), req.user!);
    const current = await one<{ status: OrderStatus }>('SELECT status FROM public.orders WHERE id = $1', [
      order.id,
    ]);
    if (!current) throw new ApiError(404, 'Захиалга олдсонгүй');
    if (!['pending', 'confirmed'].includes(current.status)) {
      throw new ApiError(400, 'Энэ төлөвт захиалгыг цуцлах боломжгүй');
    }

    await withTransaction(async (client) => {
      await client.query(`UPDATE public.orders SET status = 'cancelled' WHERE id = $1`, [order.id]);
      await client.query(
        `INSERT INTO public.order_status_history (order_id, status, note) VALUES ($1,'cancelled',$2)`,
        [order.id, 'Хэрэглэгч цуцалсан'],
      );
      await client.query(
        `UPDATE public.payments SET payment_status = 'refunded' WHERE order_id = $1 AND payment_status = 'paid'`,
        [order.id],
      );
      await client.query(`UPDATE public.deliveries SET status = 'cancelled' WHERE order_id = $1`, [
        order.id,
      ]);
    });

    res.json({ data: await loadOrderDetail(order.id) });
  }),
);

export default router;
