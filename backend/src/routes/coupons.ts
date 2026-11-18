import { Router } from 'express';
import { z } from 'zod';
import { createCrudRouter } from '../lib/crud.js';
import { asyncHandler, parseBody } from '../lib/http.js';
import { resolveCoupon } from '../lib/pricing.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

const validateSchema = z.object({
  code: z.string().min(1, 'Купон код оруулна уу').max(60),
  subtotal: z.coerce.number().min(0),
});

router.post(
  '/validate',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(validateSchema, req.body);
    const { coupon, discount } = await resolveCoupon(body.code, body.subtotal, req.user!.id);
    res.json({
      data: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount,
        max_discount: coupon.max_discount,
        min_order_amount: coupon.min_order_amount,
        expires_at: coupon.expires_at,
      },
    });
  }),
);

const couponSchema = z
  .object({
    code: z.string().min(2, 'Код оруулна уу').max(60),
    discount_type: z.enum(['percentage', 'fixed']),
    discount_value: z.coerce.number().min(0),
    min_order_amount: z.coerce.number().min(0).optional(),
    max_discount: z.coerce.number().min(0).nullable().optional(),
    starts_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    usage_limit: z.coerce.number().int().min(0).nullable().optional(),
    is_active: z.boolean().optional(),
  })
  .refine((c) => c.discount_type !== 'percentage' || c.discount_value <= 100, {
    message: 'Хувийн хямдрал 100-аас их байж болохгүй',
    path: ['discount_value'],
  });

const adminCrud = createCrudRouter({
  table: 'public.coupons',
  columns: [
    'code',
    'discount_type',
    'discount_value',
    'min_order_amount',
    'max_discount',
    'starts_at',
    'expires_at',
    'usage_limit',
    'is_active',
  ],
  searchColumns: ['code'],
  filters: { is_active: 'is_active', discount_type: 'discount_type' },
  sortColumns: { code: 'code', discount_value: 'discount_value', is_active: 'is_active' },
  orderBy: 'is_active DESC, code ASC',
  writeRoles: ['admin'],
  beforeWrite: async (data) => {
    if (typeof data.code === 'string') data.code = data.code.trim().toUpperCase();
    return data;
  },
  validate: async (data, mode) => {
    if (mode === 'create' && !data.code) throw new Error('Купон код оруулна уу');
    if (data.discount_type === 'percentage' && Number(data.discount_value) > 100) {
      throw new Error('Хувийн хямдрал 100-аас их байж болохгүй');
    }
  },
});

export { couponSchema };
export default router.use(adminCrud);
