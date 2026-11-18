import { many, one } from '../db.js';

export interface SelectedOption {
  option_id: string;
  group_id?: string;
  group_name?: string;
  name: string;
  additional_price: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  special_instructions: string | null;
  selected_options: SelectedOption[];
  is_available: boolean;
}

export interface CartState {
  id: string | null;
  user_id?: string;
  restaurant_id: string | null;
  restaurant_name: string | null;
  restaurant_is_active?: boolean | null;
  estimated_delivery_minutes?: number | null;
  delivery_fee: number;
  min_order_amount: number;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  total: number;
}

export async function getCartState(userId: string): Promise<CartState> {
  const cart = await one(
    `SELECT c.id, c.user_id, c.restaurant_id, c.created_at,
            r.name AS restaurant_name,
            r.is_active AS restaurant_is_active,
            r.estimated_delivery_minutes,
            COALESCE(r.delivery_fee, 0) AS delivery_fee,
            COALESCE(r.min_order_amount, 0) AS min_order_amount
     FROM public.carts c
     LEFT JOIN public.restaurants r ON r.id = c.restaurant_id
     WHERE c.user_id = $1`,
    [userId],
  );

  if (!cart) {
    return {
      id: null,
      restaurant_id: null,
      restaurant_name: null,
      delivery_fee: 0,
      min_order_amount: 0,
      items: [],
      item_count: 0,
      subtotal: 0,
      total: 0,
    };
  }

  const rawItems = await many(
    `SELECT ci.*, p.name AS product_name, p.image_url, p.is_available
     FROM public.cart_items ci
     JOIN public.products p ON p.id = ci.product_id
     WHERE ci.cart_id = $1
     ORDER BY ci.id ASC`,
    [cart.id],
  );

  const items: CartItem[] = rawItems.map((row) => {
    const quantity = Number(row.quantity);
    const unitPrice = Number(row.unit_price);
    const selected = (row.selected_options ?? []) as SelectedOption[];
    return {
      id: row.id as string,
      product_id: row.product_id as string,
      product_name: row.product_name as string,
      image_url: (row.image_url as string | null) ?? null,
      quantity,
      unit_price: unitPrice,
      line_total: Number((unitPrice * quantity).toFixed(2)),
      special_instructions: (row.special_instructions as string | null) ?? null,
      selected_options: Array.isArray(selected) ? selected : [],
      is_available: Boolean(row.is_available),
    };
  });

  const subtotal = Number(items.reduce((sum, i) => sum + i.line_total, 0).toFixed(2));
  const deliveryFee = Number(cart.delivery_fee ?? 0);

  return {
    id: cart.id as string,
    user_id: cart.user_id as string,
    restaurant_id: (cart.restaurant_id as string | null) ?? null,
    restaurant_name: (cart.restaurant_name as string | null) ?? null,
    restaurant_is_active: cart.restaurant_is_active as boolean | null,
    estimated_delivery_minutes: cart.estimated_delivery_minutes as number | null,
    delivery_fee: deliveryFee,
    min_order_amount: Number(cart.min_order_amount ?? 0),
    items,
    item_count: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal,
    total: Number((subtotal + (items.length ? deliveryFee : 0)).toFixed(2)),
  };
}

export async function ensureCart(userId: string): Promise<{ id: string; user_id: string; restaurant_id: string | null }> {
  const existing = await one<{ id: string; user_id: string; restaurant_id: string | null }>(
    'SELECT id, user_id, restaurant_id FROM public.carts WHERE user_id = $1',
    [userId],
  );
  if (existing) return existing;
  const created = await one<{ id: string; user_id: string; restaurant_id: string | null }>(
    'INSERT INTO public.carts (user_id) VALUES ($1) RETURNING id, user_id, restaurant_id',
    [userId],
  );
  if (!created) throw new Error('Сагс үүсгэж чадсангүй');
  return created;
}
