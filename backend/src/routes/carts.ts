import { Router } from 'express';
import { z } from 'zod';
import { many, one, query } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { ensureCart, getCartState, type SelectedOption } from '../lib/cart.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json({ data: await getCartState(req.user!.id) });
  }),
);

const addItemSchema = z.object({
  product_id: z.string().uuid('Бүтээгдэхүүн сонгоно уу'),
  quantity: z.coerce.number().int().min(1).max(50).optional(),
  option_ids: z.array(z.string().uuid()).max(30).optional(),
  special_instructions: z.string().max(500).nullable().optional(),
});

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const body = parseBody(addItemSchema, req.body);
    const quantity = body.quantity ?? 1;
    const optionIds = body.option_ids ?? [];

    const product = await one<{
      id: string;
      restaurant_id: string;
      name: string;
      price: number;
      discount_price: number | null;
      is_available: boolean;
      restaurant_is_active: boolean;
    }>(
      `SELECT p.id, p.restaurant_id, p.name, p.price, p.discount_price, p.is_available,
              r.is_active AS restaurant_is_active
       FROM public.products p
       JOIN public.restaurants r ON r.id = p.restaurant_id
       WHERE p.id = $1`,
      [body.product_id],
    );
    if (!product) throw new ApiError(404, 'Бүтээгдэхүүн олдсонгүй');
    if (!product.is_available) throw new ApiError(400, 'Энэ бүтээгдэхүүн түр зарагдахгүй байна');
    if (!product.restaurant_is_active) throw new ApiError(400, 'Ресторан түр хаалттай байна');

    let selectedOptions: SelectedOption[] = [];
    if (optionIds.length) {
      const rows = await many(
        `SELECT o.id, o.name, o.additional_price, g.id AS group_id, g.name AS group_name, g.product_id
         FROM public.product_options o
         JOIN public.product_option_groups g ON g.id = o.group_id
         WHERE o.id = ANY($1)`,
        [optionIds],
      );
      if (rows.length !== optionIds.length) {
        throw new ApiError(400, 'Сонгосон нэмэлтүүд хүчингүй байна');
      }
      if (rows.some((r) => r.product_id !== product.id)) {
        throw new ApiError(400, 'Нэмэлт нь өөр бүтээгдэхүүнд хамаарч байна');
      }
      selectedOptions = rows.map((r) => ({
        option_id: r.id as string,
        group_id: r.group_id as string,
        group_name: r.group_name as string,
        name: r.name as string,
        additional_price: Number(r.additional_price ?? 0),
      }));
    }

    const basePrice = Number(product.discount_price ?? product.price);
    const unitPrice = Number(
      (basePrice + selectedOptions.reduce((sum, o) => sum + o.additional_price, 0)).toFixed(2),
    );

    const cart = await ensureCart(req.user!.id);
    if (cart.restaurant_id && cart.restaurant_id !== product.restaurant_id) {
      throw new ApiError(
        409,
        'Сагсанд өөр рестораны бүтээгдэхүүн байна. Эхлээд сагсаа хоослоно уу.',
      );
    }
    if (!cart.restaurant_id) {
      await query('UPDATE public.carts SET restaurant_id = $1 WHERE id = $2', [
        product.restaurant_id,
        cart.id,
      ]);
    }

    await query(
      `INSERT INTO public.cart_items (cart_id, product_id, quantity, unit_price, special_instructions, selected_options)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [
        cart.id,
        product.id,
        quantity,
        unitPrice,
        body.special_instructions ?? null,
        JSON.stringify(selectedOptions),
      ],
    );

    res.status(201).json({ data: await getCartState(req.user!.id) });
  }),
);

const updateItemSchema = z.object({
  quantity: z.coerce.number().int().min(0).max(50),
});

async function assertOwnItem(userId: string, itemId: string) {
  const row = await one<{ id: string; cart_id: string; user_id: string }>(
    `SELECT ci.id, ci.cart_id, c.user_id
     FROM public.cart_items ci
     JOIN public.carts c ON c.id = ci.cart_id
     WHERE ci.id = $1`,
    [itemId],
  );
  if (!row) throw new ApiError(404, 'Сагсны мөр олдсонгүй');
  if (row.user_id !== userId) throw new ApiError(403, 'Энэ мөрийг засах эрх байхгүй');
  return row;
}

router.patch(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const body = parseBody(updateItemSchema, req.body);
    const item = await assertOwnItem(req.user!.id, String(req.params.id));

    if (body.quantity === 0) {
      await query('DELETE FROM public.cart_items WHERE id = $1', [item.id]);
    } else {
      await query('UPDATE public.cart_items SET quantity = $1 WHERE id = $2', [
        body.quantity,
        item.id,
      ]);
    }
    res.json({ data: await getCartState(req.user!.id) });
  }),
);

router.delete(
  '/items/:id',
  asyncHandler(async (req, res) => {
    const item = await assertOwnItem(req.user!.id, String(req.params.id));
    await query('DELETE FROM public.cart_items WHERE id = $1', [item.id]);
    res.json({ data: await getCartState(req.user!.id) });
  }),
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const cart = await one<{ id: string }>('SELECT id FROM public.carts WHERE user_id = $1', [
      req.user!.id,
    ]);
    if (cart) {
      await query('DELETE FROM public.cart_items WHERE cart_id = $1', [cart.id]);
      await query('UPDATE public.carts SET restaurant_id = NULL WHERE id = $1', [cart.id]);
    }
    res.json({ data: await getCartState(req.user!.id) });
  }),
);

export default router;
