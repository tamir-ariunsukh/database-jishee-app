import { one } from '../db.js';
import { ApiError } from './http.js';

export interface CouponRow {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed' | null;
  discount_value: number;
  min_order_amount: number | null;
  max_discount: number | null;
  starts_at: string | Date | null;
  expires_at: string | Date | null;
  usage_limit: number | null;
  is_active: boolean;
}

export async function resolveCoupon(rawCode: string, subtotal: number, userId: string | null) {
  const coupon = await one<CouponRow>(
    'SELECT * FROM public.coupons WHERE upper(code) = upper($1)',
    [rawCode.trim()],
  );
  if (!coupon) throw new ApiError(404, 'Купон олдсонгүй');
  if (!coupon.is_active) throw new ApiError(400, 'Купон идэвхгүй байна');

  const now = Date.now();
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > now) {
    throw new ApiError(400, 'Купоны хүчинтэй хугацаа хараахан эхлээгүй');
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now) {
    throw new ApiError(400, 'Купоны хугацаа дууссан байна');
  }

  const minOrder = Number(coupon.min_order_amount ?? 0);
  if (subtotal < minOrder) {
    throw new ApiError(400, `Купон ашиглахын тулд доод дүн ${minOrder.toLocaleString()}₮ байх ёстой`);
  }

  if (coupon.usage_limit != null) {
    const used = await one<{ count: number }>(
      'SELECT COUNT(*)::int AS count FROM public.coupon_usages WHERE coupon_id = $1',
      [coupon.id],
    );
    if ((used?.count ?? 0) >= coupon.usage_limit) {
      throw new ApiError(400, 'Купоны ашиглах хязгаар дууссан байна');
    }
  }

  if (userId) {
    const alreadyUsed = await one(
      'SELECT id FROM public.coupon_usages WHERE coupon_id = $1 AND user_id = $2 LIMIT 1',
      [coupon.id, userId],
    );
    if (alreadyUsed) throw new ApiError(400, 'Энэ купоныг та аль хэдийн ашигласан байна');
  }

  let discount =
    coupon.discount_type === 'percentage'
      ? (subtotal * Number(coupon.discount_value)) / 100
      : Number(coupon.discount_value);

  if (coupon.max_discount != null) {
    discount = Math.min(discount, Number(coupon.max_discount));
  }
  discount = Math.max(0, Math.min(discount, subtotal));

  return { coupon, discount: Number(discount.toFixed(2)) };
}
