import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { many, one, withTransaction } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

const DRIVER_SELECT = `
  SELECT d.*, u.email, u.created_at,
         (SELECT COUNT(*)::int FROM public.deliveries dl
            WHERE dl.driver_id = d.id AND dl.status IN ('picked_up','delivering')) AS active_deliveries,
         (SELECT COUNT(*)::int FROM public.deliveries dl
            WHERE dl.driver_id = d.id AND dl.status = 'delivered') AS completed_deliveries
  FROM public.drivers d
  JOIN auth.users u ON u.id = d.id
`;

router.get(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const where: string[] = [];
    const params: unknown[] = [];
    if (typeof req.query.is_available === 'string' && req.query.is_available !== 'all') {
      params.push(req.query.is_available === 'true');
      where.push(`d.is_available = $${params.length}`);
    }
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q) {
      params.push(`%${q}%`);
      where.push(`(d.full_name ILIKE $${params.length} OR d.phone ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = await many(`${DRIVER_SELECT} ${whereSql} ORDER BY d.full_name ASC`, params);
    res.json({ data: rows });
  }),
);

const createDriverSchema = z.object({
  email: z.string().email('И-мэйл буруу'),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт'),
  full_name: z.string().min(2, 'Нэр оруулна уу').max(120),
  phone: z.string().max(30).nullable().optional(),
});

router.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(createDriverSchema, req.body);
    const email = body.email.trim().toLowerCase();

    const existing = await one('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing) throw new ApiError(409, 'Энэ и-мэйл бүртгэгдсэн байна');

    const hash = await bcrypt.hash(body.password, 10);
    const id = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO auth.users (email, password_hash, role) VALUES ($1,$2,'driver') RETURNING id`,
        [email, hash],
      );
      const driverId = inserted.rows[0].id;
      await client.query(`INSERT INTO public.profiles (id, full_name, phone) VALUES ($1,$2,$3)`, [
        driverId,
        body.full_name,
        body.phone ?? null,
      ]);
      await client.query(`INSERT INTO public.drivers (id, full_name, phone) VALUES ($1,$2,$3)`, [
        driverId,
        body.full_name,
        body.phone ?? null,
      ]);
      return driverId;
    });

    const row = await one(`${DRIVER_SELECT} WHERE d.id = $1`, [id]);
    res.status(201).json({ data: row });
  }),
);

const updateDriverSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  is_available: z.boolean().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
});

router.patch(
  '/me',
  requireRole('driver', 'admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateDriverSchema, req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');
    const row = await one(
      `UPDATE public.drivers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
       WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.user!.id],
    );
    if (!row) throw new ApiError(404, 'Хүргэгч олдсонгүй');
    res.json({ data: row });
  }),
);

router.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = parseBody(updateDriverSchema, req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');
    const row = await one(
      `UPDATE public.drivers SET ${keys.map((k, i) => `${k} = $${i + 1}`).join(', ')}
       WHERE id = $${keys.length + 1} RETURNING *`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.params.id],
    );
    if (!row) throw new ApiError(404, 'Хүргэгч олдсонгүй');
    res.json({ data: row });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    await withTransaction(async (client) => {
      await client.query('DELETE FROM public.drivers WHERE id = $1', [req.params.id]);
      const deleted = await client.query('DELETE FROM auth.users WHERE id = $1 RETURNING id', [
        req.params.id,
      ]);
      if (!deleted.rowCount) throw new ApiError(404, 'Хүргэгч олдсонгүй');
    });
    res.json({ data: { deleted: true } });
  }),
);

export default router;
