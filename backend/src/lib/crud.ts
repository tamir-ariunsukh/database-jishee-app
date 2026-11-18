import { Router, type Request } from 'express';
import { many, one, query, toInt } from '../db.js';
import { ApiError, asyncHandler, pageMeta } from './http.js';
import { requireAuth, requireRole, type Role } from '../middleware/auth.js';

export interface CrudOptions {
  /** Table name inside the database (already trusted, not user input). */
  table: string;
  /** Columns that may be written / sorted on. */
  columns: string[];
  /** Custom SELECT list, e.g. `p.*, c.name AS category_name`. */
  select?: string;
  /** Custom FROM clause, e.g. `products p LEFT JOIN categories c ON ...`. */
  from?: string;
  /** Default ORDER BY, e.g. `created_at DESC`. */
  orderBy?: string;
  /** Columns used by `?q=` free text search. */
  searchColumns?: string[];
  /** Query param -> column equality filters, e.g. { restaurant_id: 'restaurant_id' }. */
  filters?: Record<string, string>;
  /** Allow unauthenticated GET requests. */
  publicRead?: boolean;
  /** Roles allowed to write (default: admin). */
  writeRoles?: Role[];
  idColumn?: string;
  /** Alias-aware id expression used by GET /:id (defaults to idColumn). */
  readIdColumn?: string;
  /** Whitelist of sortable columns: query value -> SQL expression. */
  sortColumns?: Record<string, string>;
  /** Columns that should be sent as JSON (jsonb). */
  jsonColumns?: string[];
  /** Called before insert/update, e.g. to hash a password or rename fields. */
  beforeWrite?: (data: Record<string, unknown>, mode: 'create' | 'update') => Promise<Record<string, unknown>>;
  /** Called after a row is written. */
  afterWrite?: (row: Record<string, unknown>, mode: 'create' | 'update') => Promise<void>;
  /** Extra validation, throw ApiError to reject. */
  validate?: (data: Record<string, unknown>, mode: 'create' | 'update') => Promise<void>;
}

function pickWritable(body: unknown, columns: string[], jsonColumns: string[]): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const col of columns) {
    if (!Object.prototype.hasOwnProperty.call(body, col)) continue;
    let value = (body as Record<string, unknown>)[col];
    if (value === '') value = null;
    if (jsonColumns.includes(col) && value !== null && typeof value !== 'string') {
      value = JSON.stringify(value);
    }
    out[col] = value;
  }
  return out;
}

export function createCrudRouter(options: CrudOptions): Router {
  const {
    table,
    columns,
    select = '*',
    from,
    orderBy = 'created_at DESC',
    searchColumns = [],
    filters = {},
    publicRead = false,
    writeRoles = ['admin'],
    idColumn = 'id',
    readIdColumn = idColumn,
    jsonColumns = [],
  } = options;

  const router = Router();
  const source = from ?? table;
  const sortMap: Record<string, string> = options.sortColumns
    ? options.sortColumns
    : Object.fromEntries([...columns, idColumn, 'created_at'].map((c) => [c, c]));
  const readGuards = publicRead ? [] : [requireAuth];
  const writeGuards = [requireAuth, requireRole(...writeRoles)];

  // ---- LIST --------------------------------------------------------------
  router.get(
    '/',
    ...readGuards,
    asyncHandler(async (req, res) => {
      const page = Math.max(1, toInt(req.query.page, 1));
      const limit = Math.min(200, Math.max(1, toInt(req.query.limit, 20)));
      const offset = (page - 1) * limit;

      const where: string[] = [];
      const params: unknown[] = [];

      const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      if (q && searchColumns.length) {
        const like = `%${q}%`;
        const parts = searchColumns.map((col) => {
          params.push(like);
          return `${col} ILIKE $${params.length}`;
        });
        where.push(`(${parts.join(' OR ')})`);
      }

      for (const [param, column] of Object.entries(filters)) {
        const raw = req.query[param];
        if (raw === undefined || raw === '' || raw === 'all') continue;
        const values = String(raw)
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        if (!values.length) continue;
        if (values.length === 1) {
          params.push(values[0]);
          where.push(`${column} = $${params.length}`);
        } else {
          params.push(values);
          where.push(`${column} = ANY($${params.length})`);
        }
      }

      const sortBy = typeof req.query.sortBy === 'string' && sortMap[req.query.sortBy] ? req.query.sortBy : null;
      const sortDir = String(req.query.sortDir ?? 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      const order = sortBy ? `${sortMap[sortBy]} ${sortDir}` : orderBy;

      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const limitPlaceholder = `$${params.length + 1}`;
      const offsetPlaceholder = `$${params.length + 2}`;

      const sql = `
        SELECT ${select}, COUNT(*) OVER() AS __total
        FROM ${source}
        ${whereSql}
        ORDER BY ${order}
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
      `;

      const rows = await many(sql, [...params, limit, offset]);
      const total = rows.length ? toInt((rows[0] as Record<string, unknown>).__total) : 0;
      for (const row of rows) delete (row as Record<string, unknown>).__total;

      res.json({ data: rows, ...pageMeta(total, page, limit) });
    }),
  );

  // ---- READ ONE ----------------------------------------------------------
  router.get(
    '/:id',
    ...readGuards,
    asyncHandler(async (req, res) => {
      const row = await one(`SELECT ${select} FROM ${source} WHERE ${readIdColumn} = $1`, [req.params.id]);
      if (!row) throw new ApiError(404, 'Бичлэг олдсонгүй');
      res.json({ data: row });
    }),
  );

  // ---- CREATE ------------------------------------------------------------
  router.post(
    '/',
    ...writeGuards,
    asyncHandler(async (req, res) => {
      let data = pickWritable(req.body, columns, jsonColumns);
      if (!Object.keys(data).length) throw new ApiError(422, 'Хоосон өгөгдөл илгээсэн байна');
      try {
        if (options.validate) await options.validate(data, 'create');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(422, (error as Error).message);
      }
      if (options.beforeWrite) data = await options.beforeWrite(data, 'create');

      const keys = Object.keys(data);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
      const row = await one(sql, keys.map((k) => data[k]));
      if (!row) throw new ApiError(500, 'Бичлэг үүсгэж чадсангүй');
      if (options.afterWrite) await options.afterWrite(row, 'create');
      res.status(201).json({ data: row });
    }),
  );

  // ---- UPDATE ------------------------------------------------------------
  router.patch(
    '/:id',
    ...writeGuards,
    asyncHandler(async (req, res) => {
      let data = pickWritable(req.body, columns, jsonColumns);
      if (!Object.keys(data).length) throw new ApiError(422, 'Шинэчлэх талбар байхгүй');
      try {
        if (options.validate) await options.validate(data, 'update');
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(422, (error as Error).message);
      }
      if (options.beforeWrite) data = await options.beforeWrite(data, 'update');

      const keys = Object.keys(data);
      const sets = keys.map((k, i) => `${k} = $${i + 1}`);
      const sql = `UPDATE ${table} SET ${sets.join(', ')} WHERE ${idColumn} = $${keys.length + 1} RETURNING *`;
      const row = await one(sql, [...keys.map((k) => data[k]), req.params.id]);
      if (!row) throw new ApiError(404, 'Бичлэг олдсонгүй');
      if (options.afterWrite) await options.afterWrite(row, 'update');
      res.json({ data: row });
    }),
  );

  // ---- DELETE ------------------------------------------------------------
  router.delete(
    '/:id',
    ...writeGuards,
    asyncHandler(async (req, res) => {
      const result = await query(`DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING ${idColumn}`, [
        req.params.id,
      ]);
      if (!result.rowCount) throw new ApiError(404, 'Бичлэг олдсонгүй');
      res.json({ data: { deleted: true, id: req.params.id } });
    }),
  );

  return router;
}

export function requireSelfOrAdmin(req: Request, ownerId: string | null | undefined): void {
  if (!req.user) throw new ApiError(401, 'Нэвтэрч орно уу');
  if (req.user.role === 'admin') return;
  if (!ownerId || ownerId !== req.user.id) throw new ApiError(403, 'Энэ үйлдлийг хийх эрх байхгүй');
}
