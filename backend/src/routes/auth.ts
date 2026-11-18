import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { one, withTransaction } from '../db.js';
import { ApiError, asyncHandler, parseBody } from '../lib/http.js';
import { requireAuth, signToken, type Role } from '../middleware/auth.js';

const router = Router();

const PUBLIC_USER_COLUMNS = `
  u.id, u.email, u.role, u.created_at,
  p.full_name, p.phone, p.avatar_url
`;

const publicUserSelect = `
  SELECT ${PUBLIC_USER_COLUMNS}
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
`;

async function loadUser(id: string) {
  const user = await one(`${publicUserSelect} WHERE u.id = $1`, [id]);
  if (!user) throw new ApiError(404, 'Хэрэглэгч олдсонгүй');
  return user;
}

const registerSchema = z.object({
  email: z.string().email('И-мэйл буруу'),
  password: z.string().min(6, 'Нууц үг хамгийн багадаа 6 тэмдэгт').max(72),
  full_name: z.string().min(2, 'Нэрээ оруулна уу').max(120),
  phone: z
    .string()
    .min(6, 'Утасны дугаар буруу')
    .max(30)
    .optional()
    .nullable()
    .or(z.literal('')),
  role: z.enum(['customer', 'driver']).optional(),
});

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const body = parseBody(registerSchema, req.body);
    const email = body.email.trim().toLowerCase();
    const phone = body.phone && body.phone.length ? body.phone.trim() : null;
    const role: Role = body.role ?? 'customer';

    const existing = await one('SELECT id FROM auth.users WHERE email = $1', [email]);
    if (existing) throw new ApiError(409, 'Энэ и-мэйл хаяг бүртгэгдсэн байна');

    if (phone) {
      const phoneTaken = await one('SELECT id FROM public.profiles WHERE phone = $1', [phone]);
      if (phoneTaken) throw new ApiError(409, 'Энэ утасны дугаар бүртгэгдсэн байна');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);

    const userId = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO auth.users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id`,
        [email, passwordHash, role],
      );
      const id = inserted.rows[0].id;
      await client.query(
        `INSERT INTO public.profiles (id, full_name, phone) VALUES ($1, $2, $3)`,
        [id, body.full_name.trim(), phone],
      );
      if (role === 'driver') {
        await client.query(
          `INSERT INTO public.drivers (id, full_name, phone) VALUES ($1, $2, $3)`,
          [id, body.full_name.trim(), phone],
        );
      }
      return id;
    });

    const user = await loadUser(userId);
    const token = signToken({ id: userId, email, role });
    res.status(201).json({ data: { token, user } });
  }),
);

const loginSchema = z.object({
  email: z.string().email('И-мэйл буруу'),
  password: z.string().min(1, 'Нууц үг оруулна уу'),
});

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const body = parseBody(loginSchema, req.body);
    const email = body.email.trim().toLowerCase();

    const account = await one<{ id: string; email: string; role: Role; password_hash: string }>(
      'SELECT id, email, role, password_hash FROM auth.users WHERE email = $1',
      [email],
    );
    if (!account) throw new ApiError(401, 'И-мэйл эсвэл нууц үг буруу');

    const valid = await bcrypt.compare(body.password, account.password_hash);
    if (!valid) throw new ApiError(401, 'И-мэйл эсвэл нууц үг буруу');

    const user = await loadUser(account.id);
    const token = signToken({ id: account.id, email: account.email, role: account.role });
    res.json({ data: { token, user } });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ data: await loadUser(req.user!.id) });
  }),
);

const profileSchema = z.object({
  full_name: z.string().min(2).max(120).optional(),
  phone: z.string().max(30).nullable().optional(),
  avatar_url: z.string().url().nullable().optional(),
});

router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parseBody(profileSchema, req.body);
    const keys = Object.keys(body);
    if (!keys.length) throw new ApiError(422, 'Өөрчлөх талбар байхгүй');

    if (body.phone) {
      const taken = await one('SELECT id FROM public.profiles WHERE phone = $1 AND id <> $2', [
        body.phone,
        req.user!.id,
      ]);
      if (taken) throw new ApiError(409, 'Энэ утасны дугаар бүртгэгдсэн байна');
    }

    const sets = keys.map((k, i) => `${k} = $${i + 1}`);
    await one(
      `INSERT INTO public.profiles (id, ${keys.join(', ')})
       VALUES ($${keys.length + 1}, ${keys.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (id) DO UPDATE SET ${sets.join(', ')}
       RETURNING id`,
      [...keys.map((k) => (body as Record<string, unknown>)[k]), req.user!.id],
    );

    res.json({ data: await loadUser(req.user!.id) });
  }),
);

export default router;
